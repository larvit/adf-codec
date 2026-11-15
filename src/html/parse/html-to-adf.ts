import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { FirstParagraphForm } from '../first-paragraph.ts'
import type { ParseError, Result } from '../../result.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { built, readInlineBlock } from './inline-block.ts'
import { carryContent } from '../carry-content.ts'
import { centeredImage, externalMedia } from '../../adf/plain-image.ts'
import { containerElements, headingElements, headingLevel, readListStart, type ContainerType } from '../block-elements.ts'
import { expandClasses, expandOfClass, panelAttributes, panelClass, taskListOfClass, taskListOfType } from '../block-classes.ts'
import { firstParagraphForm } from '../first-paragraph.ts'
import { foundAt, misread, misspelledText, positionIn, readStartTag, refused, startTagName, type Place, type ReadNode, type StartTag } from './source.ts'
import { isHeaderRow, readCellAttributes } from '../cell-element.ts'
import { largestNesting } from '../../nesting.ts'
import { misspelledAt, unescapedValue } from '../escaping.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { notAString } from '../../not-a-string.ts'
import { positioned, success } from '../../result.ts'
import { readAnchorAttributes } from '../anchor-element.ts'
import { readCarry } from './carry-element.ts'
import { readCarryAttributes } from '../carry-attributes.ts'
import { readDataAttributes, readDataAttributesAfter } from '../data-attributes.ts'
import { readFigure, readMediaGroup } from './media-block.ts'
import { readImageAttributes } from '../image-element.ts'
import { readInline } from './inline.ts'
import { readLanguageClass } from '../language-class.ts'
import { readTaskItem } from './task-item.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { withinEngineLimits } from '../../length-bound.ts'

type BlockReader = (html: string, tag: StartTag, place: Place, open: Open) => Result<BlockStep, ParseError>

type BlockStep = { end: number; kind: 'node'; node: AdfNode } | { end: number; kind: 'opened'; open: Open }

// A container whose blocks, items, rows or cells are being read: `node` holds what its opening tag gave, `depth` is its children's as `adfToHtml` counts it, and `closer` ends it. An open table has kind `rows` and no `closer`: `section` names the table section, head or body, its rows stand in.
type Open = { content: AdfNode[]; depth: number; node: AdfNode; place: Place | undefined } & ({ closer: string; kind: 'blocks' | 'item' | 'list' | 'row' } | { kind: 'rows'; section: TableSection })

// A row's step names the section the table's rows stand in from that row on.
type RowStep = BlockStep & { section: TableSection }

type TableSection = 'body' | 'head'

// No element name opens both a block and an inline node, so the name alone tells an item's line from its next block.
const blockReaders: ReadonlyMap<string, BlockReader> = new Map([
  [containerElements.blockquote, containerReader('blockquote')],
  [containerElements.bulletList, readBulletList],
  [containerElements.orderedList, containerReader('orderedList')],
  ['details', readDetails],
  ['div', readDiv],
  ['figure', (html, tag, place) => asStep(readFigure(html, tag, place))],
  ['hr', readRule],
  ['p', readParagraph],
  ['pre', readCodeBlock],
  ['table', readTable],
  ...headingElements.map((name): [string, BlockReader] => [name, readHeading]),
])
const bodyCloser = '\n</tbody>\n</table>'
const codeCloser = '</code></pre>'
const documentCarryAlone = 'a carry element holding the document stands alone, as the whole document'
const documentCarryEnd = `${carryContent({ type: 'doc' }, 'div')}</div>`
const emptyDocument = serializeCanonicalJson({ type: 'doc', version: 1 }, 'compact')
const formRefusals: Readonly<Record<FirstParagraphForm, string>> = {
  bare: "an item's or cell's first paragraph holding content and no attribute stands bare on the line of the item's or cell's start tag, as in <li>Bolt</li>",
  block: "an item's or cell's first paragraph holding neither content nor an attribute stands on a line of its own",
  element: "an item's or cell's first paragraph holding an attribute stands as its <p> straight after the item's or cell's start tag",
}
const headCloser = '\n</thead>\n</table>'
const headToBody = '</thead>\n<tbody>\n'

// Reads back what `adfToHtml` writes, as it or a browser spells it.
export function htmlToAdf(html: string): Result<AdfDocument, ParseError> {
  return positioned(
    withinEngineLimits(() => readHtml(html)),
    { line: 1, offset: 0 },
  )
}

// A form post ends each line in `\r\n`, which reads as the line feed `adfToHtml` writes.
function readHtml(html: string): Result<AdfDocument> {
  if (typeof html !== 'string') return notAString(html, 'HTML')
  const read = readLineFeeds(html.replaceAll('\r\n', '\n'))
  return read.ok ? read : { error: { ...read.error, position: positionIn(html, read.error.position) }, ok: false }
}

function readLineFeeds(html: string): Result<AdfDocument, ParseError> {
  if (html === '') return success({ content: [], type: 'doc', version: 1 })
  return readDocumentCarry(html) ?? readBlocks(html)
}

// The carry of a document holding no content key stands alone, as the whole HTML; `undefined` where the HTML opens with no such carry.
function readDocumentCarry(html: string): Result<AdfDocument, ParseError> | undefined {
  const tag = readStartTag(html, 0)
  if (tag?.name !== 'div' || readCarryAttributes(tag.attributes) !== emptyDocument) return undefined
  if (!html.startsWith(documentCarryEnd, tag.end)) return refused('unmappable-html', `a carry element holding the document shows nothing: ${foundAt(html, tag.end)}`, html, tag.end, undefined)
  const end = tag.end + documentCarryEnd.length
  if (html.startsWith('\n', end) && isBlockStart(html, end + 1)) return refused('unsupported-node-shape', `${documentCarryAlone}: ${foundAt(html, end)}`, html, end, { index: 0, parent: undefined })
  return end === html.length - 1 && html.endsWith('\n') ? success({ type: 'doc', version: 1 }) : partedRefusal(html, end, undefined)
}

// A stack rather than recursion: only this loop opens and closes containers.
function readBlocks(html: string): Result<AdfDocument, ParseError> {
  const root: Open = { closer: '', content: [], depth: 0, kind: 'blocks', node: { type: 'doc' }, place: undefined }
  const opened: Open[] = []
  let open: Open = root
  let index = 0
  for (;;) {
    const place = { index: open.content.length, parent: open.place }
    if (open.depth > largestNesting) return refused('unsupported-nesting-depth', `blocks nest deeper than ${largestNesting} levels`, html, index, place)
    const step = readStep(html, index, place, open)
    if (!step.ok) return step
    if (open.kind === 'rows' && 'section' in step.value) open.section = step.value.section
    index = step.value.end
    if (step.value.kind === 'opened') {
      opened.push(open)
      open = step.value.open
      continue
    }
    open.content.push(step.value.node)
    while (open !== root && html.startsWith(closerOf(open), index)) {
      index += closerOf(open).length
      const closed: AdfNode = { ...open.node, content: open.content }
      const closedPlace = open.place
      open = opened.pop() ?? root
      if (open.kind === 'rows' && open.content.length === 0 && isHeaderRow(closed) !== (open.section === 'head')) return firstRowRefusal(html, index, closedPlace)
      open.content.push(closed)
    }
    if (open.kind === 'row') continue
    if (open === root && index === html.length - 1 && html.endsWith('\n')) return success({ content: root.content, type: 'doc', version: 1 })
    if (!html.startsWith('\n', index)) return partedRefusal(html, index, open.place)
    index += 1
  }
}

// Where a block ends short of the line feed parting it from the next, or a second line feed follows it.
function partedRefusal<T>(html: string, end: number, place: Place | undefined): Result<T, ParseError> {
  const at = html.startsWith('\n', end) ? end + 1 : end
  return refused('unmappable-html', `a line feed parts each block from the next, and ends the HTML: ${foundAt(html, at)}`, html, at, place)
}

function closerOf(open: Open): string {
  if (open.kind !== 'rows') return open.closer
  return open.section === 'head' ? headCloser : bodyCloser
}

function readStep(html: string, index: number, place: Place, open: Open): Result<BlockStep | RowStep, ParseError> {
  if (open.kind === 'list') return readItem(html, index, place, open)
  if (open.kind === 'rows') return readRow(html, index, place, open)
  return open.kind === 'row' ? readCell(html, index, place, open.depth) : readBlock(html, index, place, open)
}

function readBlock(html: string, index: number, place: Place, open: Open): Result<BlockStep, ParseError> {
  const tag = readStartTag(html, index)
  const reader = tag === undefined ? undefined : blockReaders.get(tag.name)
  if (tag !== undefined && reader !== undefined) return reader(html, tag, place, open)
  const stop = misread(html, index, 'a block element of the dialect stands here', 'no block element of the dialect')
  return refused('unmappable-html', stop.message, html, stop.at, place)
}

function asStep(read: ReadNode): Result<BlockStep, ParseError> {
  return read.ok ? success({ ...read.value, kind: 'node' }) : read
}

function readHeading(html: string, tag: StartTag, place: Place): Result<BlockStep, ParseError> {
  return asStep(readInlineBlock(html, tag, 'heading', blockNodes.heading.attributes, { level: headingLevel(tag.name) }, place))
}

function readParagraph(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const image = tag.attributes.length === 0 ? tryImage(html, tag.end, place) : undefined
  if (image !== undefined) return asStep(image)
  const paragraph = readInlineBlock(html, tag, 'paragraph', blockNodes.paragraph.attributes, {}, place)
  const firstInItem = open.kind === 'item' && open.content.length === 0
  return asStep(firstInItem && paragraph.ok ? asFirstParagraph(paragraph.value, 'block', html, tag.start, place) : paragraph)
}

function asFirstParagraph(read: { end: number; node: AdfNode }, found: FirstParagraphForm, html: string, index: number, place: Place): ReadNode {
  const form = firstParagraphForm(read.node)
  return form === found ? success(read) : refused('unmappable-html', `${formRefusals[form]}: ${foundAt(html, index)}`, html, index, place)
}

// `undefined` where no image follows the `<p>`, so it opens a paragraph.
function tryImage(html: string, index: number, place: Place): ReadNode | undefined {
  const opener = readStartTag(html, index)
  const anchor = opener?.name === 'a' ? opener : undefined
  const image = anchor === undefined ? opener : readStartTag(html, anchor.end)
  if (image?.name !== 'img') return undefined
  const node = imageNode(image, anchor)
  const closer = anchor === undefined ? '</p>' : '</a></p>'
  if (node === undefined || !html.startsWith(closer, image.end)) {
    const at = node === undefined ? index : image.end
    return refused('unmappable-html', `an image stands alone in its paragraph as <img src="…" alt="…">, alt left out where it holds none, inside <a> where a link marks it: ${foundAt(html, at)}`, html, at, place)
  }
  return success({ end: image.end + closer.length, node })
}

// The image an `<img>`, and the `<a>` around it, read as; `undefined` where `adfToHtml` writes no such elements.
function imageNode(image: StartTag, anchor: StartTag | undefined): AdfNode | undefined {
  const found = readImageAttributes(image.attributes)
  const link = anchor === undefined ? undefined : readAnchorAttributes(anchor.attributes)
  if (found === undefined || (anchor !== undefined && link === undefined)) return undefined
  const media = externalMedia(found.alt ?? '', found.src, link)
  return nodeAttrs(media)['alt'] === found.alt ? centeredImage([media]) : undefined
}

function readCodeBlock(html: string, tag: StartTag, place: Place): Result<BlockStep, ParseError> {
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes.codeBlock.attributes, ['language'])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const code = readStartTag(html, tag.end)
  const named = code?.name === 'code' ? readLanguageClass(code.attributes) : undefined
  if (code === undefined || named === undefined) {
    const stop = misread(html, tag.end, '<pre> holds <code>, or <code class="language-…"> naming the language', 'no code element of the dialect, which writes <code> or <code class="language-…">')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  const next = html.indexOf('<', code.end)
  const end = next < 0 ? html.length : next
  const spelled = html.slice(code.end, end)
  const text = unescapedValue(spelled, 'text')
  if (text === undefined) return misspelledText(html, code.end + misspelledAt(spelled, 'text'), place)
  if (!html.startsWith(codeCloser, end)) return refused('unmappable-html', `a code block's text ends at ${codeCloser}: ${foundAt(html, end)}`, html, end, place)
  const { language } = named
  return success({ end: end + codeCloser.length, kind: 'node', node: built('codeBlock', language === undefined ? data.value : { ...data.value, language }, text === '' ? [] : [{ text, type: 'text' }]) })
}

function readRule(html: string, tag: StartTag, place: Place): Result<BlockStep, ParseError> {
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes.rule.attributes, [])
  return data.fault === undefined ? success({ end: tag.end, kind: 'node', node: built('rule', data.value, []) }) : refused(data.fault.code, data.fault.message, html, tag.start, place)
}

function readDiv(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const [first] = tag.attributes
  const className = first?.[0] === 'class' ? first[1] : undefined
  if (className === panelClass) return readPanel(html, tag, place, open)
  return className === 'adf-media-group' ? asStep(readMediaGroup(html, tag, place)) : readBlockCarry(html, tag, place, open)
}

function readPanel(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const data = readDataAttributes(tag.attributes.slice(1), tag.name, panelAttributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  return readContents(html, tag, built('panel', data.value, []), place, open, 'blocks')
}

// An expand's title stands in a `<summary>` on the first line, its blocks a line each after it.
function readDetails(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const [first, ...pairs] = tag.attributes
  const type = first?.[0] === 'class' ? expandOfClass(first[1]) : undefined
  if (type === undefined) return refused('unmappable-html', `<details> starts with class="${expandClasses.expand}" or class="${expandClasses.nestedExpand}": ${foundAt(html, tag.start)}`, html, tag.start, place)
  const data = readDataAttributes(pairs, tag.name, blockNodes[type].attributes, ['title'])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const summary = html.startsWith('\n<summary>', tag.end) ? readSummary(html, tag.end + 1, place) : undefined
  if (summary?.ok === false) return summary
  if (summary === undefined) return readContents(html, tag, built(type, data.value, []), place, open, 'blocks')
  const node = built(type, { ...data.value, title: summary.value.title }, [])
  const { end } = summary.value
  if (html.startsWith('\n</details>', end)) return success({ end: end + '\n</details>'.length, kind: 'node', node })
  if (!html.startsWith('\n', end)) return refused('unmappable-html', `<summary> holds the title, then a line feed and the first block, or a line feed and </details>: ${foundAt(html, end)}`, html, end, place)
  return success({ end: end + 1, kind: 'opened', open: { closer: '\n</details>', content: [], depth: open.depth + 1, kind: 'blocks', node, place } })
}

function readSummary(html: string, index: number, place: Place): Result<{ end: number; title: string }, ParseError> {
  const start = index + '<summary>'.length
  const close = html.indexOf('</summary>', start)
  if (close < 0) return refused('unmappable-html', `<summary> ends at </summary>: ${foundAt(html, start)}`, html, start, place)
  const spelled = html.slice(start, close)
  const title = unescapedValue(spelled, 'text')
  if (title === undefined) return misspelledText(html, start + misspelledAt(spelled, 'text'), place)
  return success({ end: close + '</summary>'.length, title })
}

function readBlockCarry(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  if (readCarryAttributes(tag.attributes) === emptyDocument) return refused('unsupported-node-shape', `${documentCarryAlone}: ${foundAt(html, tag.start)}`, html, tag.start, place)
  return asStep(readCarry(html, tag, 'div', largestNesting - open.depth, place))
}

// A `<ul>` is a task or decision list where its class says so.
function readBulletList(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const [first, ...pairs] = tag.attributes
  const type = first?.[0] === 'class' ? taskListOfClass(first[1]) : undefined
  if (type === undefined) return readContainer(html, tag, 'bulletList', place, open)
  const data = readDataAttributes(pairs, tag.name, blockNodes[type].attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  return readContents(html, tag, built(type, data.value, []), place, open, 'list')
}

function containerReader(type: ContainerType): BlockReader {
  return (html, tag, place, open) => readContainer(html, tag, type, place, open)
}

// A quote's blocks, or a list's items, stand a line each between its tags; a container holding no content key holds nothing.
function readContainer(html: string, tag: StartTag, type: ContainerType, place: Place, open: Open): Result<BlockStep, ParseError> {
  const ordered = type === 'orderedList'
  const [first] = tag.attributes
  const start = ordered && first?.[0] === 'start' ? first[1] : undefined
  const order = start === undefined ? undefined : readListStart(start)
  if (start !== undefined && order === undefined) {
    const at = tag.start + `<${tag.name} start="`.length
    return refused('unmappable-html', `an ordered list starts at an integer, written as JavaScript writes it: ${foundAt(html, at)}`, html, at, place)
  }
  const vocabulary = blockNodes[type].attributes
  const data = ordered ? readDataAttributesAfter('start', tag.attributes, tag.name, vocabulary, ['order']) : readDataAttributes(tag.attributes, tag.name, vocabulary, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  return readContents(html, tag, built(type, order === undefined ? data.value : { order, ...data.value }, []), place, open, type === 'blockquote' ? 'blocks' : 'list')
}

// The element holds nothing, or a line feed and its first block or item.
function readContents(html: string, tag: StartTag, node: AdfNode, place: Place, open: Open, kind: 'blocks' | 'list'): Result<BlockStep, ParseError> {
  const closer = `</${tag.name}>`
  if (html.startsWith(closer, tag.end)) return success({ end: tag.end + closer.length, kind: 'node', node })
  if (!html.startsWith('\n', tag.end)) return refused('unmappable-html', `<${tag.name}> holds ${closer} straight after it, or a line feed and its first ${kind === 'blocks' ? 'block' : 'item'}: ${foundAt(html, tag.end)}`, html, tag.end, place)
  return success({ end: tag.end + 1, kind: 'opened', open: { closer: `\n${closer}`, content: [], depth: open.depth + 1, kind, node, place } })
}

function readTable(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes.table.attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const node = built('table', data.value, [])
  if (html.startsWith('</table>', tag.end)) return success({ end: tag.end + '</table>'.length, kind: 'node', node })
  const headed = html.startsWith('\n<thead>\n', tag.end)
  if (!headed && !html.startsWith('\n<tbody>\n', tag.end)) return refused('unmappable-html', `<table> holds </table> straight after it, or a line feed and <thead> or <tbody> on a line of its own: ${foundAt(html, tag.end)}`, html, tag.end, place)
  return success({ end: tag.end + '\n<thead>\n'.length, kind: 'opened', open: { content: [], depth: open.depth + 1, kind: 'rows', node, place, section: headed ? 'head' : 'body' } })
}

// `<thead>` holds one row, so a second row stands past `</thead>`.
function readRow(html: string, index: number, place: Place, table: Open & { kind: 'rows' }): Result<RowStep, ParseError> {
  const pastHead = table.section === 'head' && table.content.length > 0
  if (pastHead && !html.startsWith(headToBody, index)) return refused('unmappable-html', `<thead> holds one row, then </thead>: ${foundAt(html, index)}`, html, index, place)
  const start = pastHead ? index + headToBody.length : index
  const section = pastHead ? 'body' : table.section
  const tag = readStartTag(html, start)
  if (tag?.name !== 'tr') {
    const stop = misread(html, start, 'a table section holds <tr> rows, one to a line', 'no table row of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes.tableRow.attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const node = built('tableRow', data.value, [])
  if (!html.startsWith('</tr>', tag.end)) return success({ end: tag.end, kind: 'opened', open: { closer: '</tr>', content: [], depth: table.depth + 1, kind: 'row', node, place }, section })
  return section === 'head' ? firstRowRefusal(html, tag.end, place) : success({ end: tag.end + '</tr>'.length, kind: 'node', node, section })
}

function firstRowRefusal<T>(html: string, index: number, place: Place | undefined): Result<T, ParseError> {
  return refused('unmappable-html', `a table's first row stands in <thead> where it holds at least one cell and all its cells are <th>, and in <tbody> otherwise: ${foundAt(html, index)}`, html, index, place)
}

function readCell(html: string, index: number, place: Place, depth: number): Result<BlockStep, ParseError> {
  const tag = readStartTag(html, index)
  if (tag?.name !== 'td' && tag?.name !== 'th') {
    const stop = misread(html, index, 'a row holds <td> and <th> cells on its line, then </tr>', 'no table cell of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  const attrs = readCellAttributes(tag.attributes, tag.name)
  if (attrs.fault !== undefined) return refused(attrs.fault.code, attrs.fault.message, html, tag.start, place)
  return readHolder(html, tag, built(tag.name === 'td' ? 'tableCell' : 'tableHeader', attrs.value, []), place, depth)
}

function readItem(html: string, index: number, place: Place, { depth, node: list }: Open): Result<BlockStep, ParseError> {
  const tasks = taskListOfType(list.type)
  if (tasks !== undefined) return asStep(readTaskItem(html, index, place, tasks))
  const tag = readStartTag(html, index)
  if (tag?.name !== 'li') {
    const stop = misread(html, index, 'a list holds <li> items, one to a line', 'no list item of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes.listItem.attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  return readHolder(html, tag, built('listItem', data.value, []), place, depth)
}

// An item or cell: its element holding nothing, its first paragraph on its line, or its blocks a line each.
function readHolder(html: string, tag: StartTag, node: AdfNode, place: Place, depth: number): Result<BlockStep, ParseError> {
  const closer = `</${tag.name}>`
  if (html.startsWith(closer, tag.end)) return success({ end: tag.end + closer.length, kind: 'node', node })
  const open: Open = { closer: `\n${closer}`, content: [], depth, kind: 'item', node, place }
  return html.startsWith('\n', tag.end) && isBlockStart(html, tag.end + 1) ? success({ end: tag.end + 1, kind: 'opened', open }) : readItemLine(html, tag.end, tag.name, open)
}

function readItemLine(html: string, index: number, element: string, open: Open): Result<BlockStep, ParseError> {
  const place = { index: 0, parent: open.place }
  const closer = `</${element}>`
  const line = readLineParagraph(html, index, place)
  if (!line.ok) return line
  const { end, node } = line.value
  if (!html.startsWith(closer, end) && !html.startsWith('\n', end)) {
    const stop = lineEndRefusal(html, end, line.value.form, element)
    return refused('unmappable-html', stop.message, html, stop.at, open.place)
  }
  const paragraph = asFirstParagraph({ end, node }, line.value.form, html, index, place)
  if (!paragraph.ok) return paragraph
  if (html.startsWith(closer, end)) return success({ end: end + closer.length, kind: 'node', node: { ...open.node, content: [node] } })
  return success({ end: end + 1, kind: 'opened', open: { ...open, content: [node] } })
}

function lineEndRefusal(html: string, end: number, form: FirstParagraphForm, element: string): { at: number; message: string } {
  const lineEnd = `the line ends at </${element}>, or at a line feed before the next block`
  // After a line's `</p>`, or before a block or the next item, no inline element can stand.
  if (form !== 'bare' || isBlockStart(html, end) || startTagName(html, end) === element) return { at: end, message: `${lineEnd}: ${foundAt(html, end)}` }
  return misread(html, end, `${lineEnd}, and its text spells < as &lt;`, 'no inline element of the dialect')
}

// The paragraph on an item's or cell's line and the form it stands in there, up to its closer or to the line feed before its next block.
function readLineParagraph(html: string, index: number, place: Place): Result<{ end: number; form: FirstParagraphForm; node: AdfNode }, ParseError> {
  const tag = readStartTag(html, index)
  if (tag?.name === 'p') {
    const paragraph = readInlineBlock(html, tag, 'paragraph', blockNodes.paragraph.attributes, {}, place)
    return paragraph.ok ? success({ ...paragraph.value, form: 'element' }) : paragraph
  }
  const inline = readInline(html, index, place)
  if (!inline.ok) return inline
  const { end, nodes } = inline.value
  const parted = partedLine(html, end, nodes)
  return success(parted === undefined ? { end, form: 'bare', node: { content: nodes, type: 'paragraph' } } : { end: end - 1, form: 'bare', node: { content: parted, type: 'paragraph' } })
}

// Only text ends in a line feed, so the text read last holds the one parting the line from the next block; `undefined` where no block follows.
function partedLine(html: string, end: number, nodes: AdfNode[]): AdfNode[] | undefined {
  const last = nodes[nodes.length - 1]
  if (!isBlockStart(html, end) || !html.endsWith('\n', end) || last?.text === undefined) return undefined
  const text = last.text.slice(0, -1)
  return [...nodes.slice(0, -1), ...(text === '' ? [] : [{ ...last, text }])]
}

function isBlockStart(html: string, index: number): boolean {
  return blockReaders.has(startTagName(html, index) ?? '')
}

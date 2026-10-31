import type { AdfAttributes, AdfDocument, AdfNode } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { FirstParagraphForm } from '../first-paragraph.ts'
import type { ParseError, Result } from '../../result.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { carryContent } from '../carry-content.ts'
import { centeredImage, externalMedia } from '../../adf/plain-image.ts'
import { containerElements, headingElements, headingLevel, readListStart, type ContainerType } from '../block-elements.ts'
import { firstParagraphForm } from '../first-paragraph.ts'
import { foundAt, misread, positionIn, readStartTag, refused, startTagName, type Place, type ReadNode, type StartTag } from './source.ts'
import { largestNesting } from '../../nesting.ts'
import { misspelledAt, unescapedValue } from '../escaping.ts'
import { misspelledText, readInline } from './inline.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { notAString } from '../../not-a-string.ts'
import { positioned, success } from '../../result.ts'
import { readAnchorAttributes } from '../anchor-element.ts'
import { readCarry } from './carry-element.ts'
import { readCarryAttributes } from '../carry-attributes.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { readImageAttributes } from '../image-element.ts'
import { readLanguageClass } from '../language-class.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { withinEngineLimits } from '../../length-bound.ts'

type BlockReader = (html: string, tag: StartTag, place: Place, open: Open) => Result<BlockStep, ParseError>

type BlockStep = { end: number; kind: 'node'; node: AdfNode } | { end: number; kind: 'opened'; open: Open }

// A container whose blocks or items are being read: `node` holds what its opening tag gave, `depth` is its children's as `adfToHtml` counts it, and `closer` ends it.
type Open = { closer: string; content: AdfNode[]; depth: number; kind: 'blocks' | 'item' | 'list'; node: AdfNode; place: Place | undefined }

// No element name opens both a block and an inline node, so the name alone tells an item's line from its next block.
const blockReaders: ReadonlyMap<string, BlockReader> = new Map([
  [containerElements.blockquote, containerReader('blockquote')],
  [containerElements.bulletList, containerReader('bulletList')],
  [containerElements.orderedList, containerReader('orderedList')],
  ['div', readBlockCarry],
  ['hr', readRule],
  ['p', readParagraph],
  ['pre', readCodeBlock],
  ...headingElements.map((name): [string, BlockReader] => [name, readHeading]),
])
const codeCloser = '</code></pre>'
const documentCarryAlone = 'a carry element holding the document stands alone, as the whole document'
const documentCarryEnd = `${carryContent({ type: 'doc' }, 'div')}</div>`
const emptyDocument = serializeCanonicalJson({ type: 'doc', version: 1 }, 'compact')
const formRefusals: Readonly<Record<FirstParagraphForm, string>> = {
  bare: "an item's first paragraph holding content and no attribute stands bare on the item's line, as in <li>Bolt</li>",
  block: "an item's first paragraph holding neither content nor an attribute stands on a line of its own",
  element: "an item's first paragraph holding an attribute stands as its <p> on the item's line, straight after <li>",
}

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
  let open = root
  let index = 0
  for (;;) {
    const place = { index: open.content.length, parent: open.place }
    if (open.depth > largestNesting) return refused('unsupported-nesting-depth', `blocks nest deeper than ${largestNesting} levels`, html, index, place)
    const step = open.kind === 'list' ? readItem(html, index, place, open.depth) : readBlock(html, index, place, open)
    if (!step.ok) return step
    index = step.value.end
    if (step.value.kind === 'opened') {
      opened.push(open)
      open = step.value.open
      continue
    }
    open.content.push(step.value.node)
    while (open !== root && html.startsWith(open.closer, index)) {
      index += open.closer.length
      const closed: AdfNode = { ...open.node, content: open.content }
      open = opened.pop() ?? root
      open.content.push(closed)
    }
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

// `own`: the attributes the element itself writes, such as a heading's level.
function readInlineBlock(html: string, tag: StartTag, type: string, vocabulary: AttributeVocabulary, own: AdfAttributes, place: Place): ReadNode {
  const data = readDataAttributes(tag.attributes, tag.name, vocabulary, Object.keys(own))
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const inline = readInline(html, tag.end, place)
  if (!inline.ok) return inline
  const { end, nodes } = inline.value
  const closer = `</${tag.name}>`
  if (!html.startsWith(closer, end)) {
    const stop = misread(html, end, `${closer} ends the ${type}, and its text spells < as &lt;`, 'no inline element of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  return success({ end: end + closer.length, node: built(type, { ...own, ...data.value }, nodes) })
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

function readBlockCarry(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  if (readCarryAttributes(tag.attributes) === emptyDocument) return refused('unsupported-node-shape', `${documentCarryAlone}: ${foundAt(html, tag.start)}`, html, tag.start, place)
  return asStep(readCarry(html, tag, 'div', largestNesting - open.depth, place))
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
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes[type].attributes, ordered ? ['order'] : [], ordered ? 'start' : undefined)
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const node = built(type, order === undefined ? data.value : { order, ...data.value }, [])
  const closer = `</${tag.name}>`
  if (html.startsWith(closer, tag.end)) return success({ end: tag.end + closer.length, kind: 'node', node })
  if (!html.startsWith('\n', tag.end)) return refused('unmappable-html', `<${tag.name}> holds ${closer} straight after it, or a line feed and its first ${type === 'blockquote' ? 'block' : 'item'}: ${foundAt(html, tag.end)}`, html, tag.end, place)
  return success({ end: tag.end + 1, kind: 'opened', open: { closer: `\n${closer}`, content: [], depth: open.depth + 1, kind: type === 'blockquote' ? 'blocks' : 'list', node, place } })
}

function readItem(html: string, index: number, place: Place, depth: number): Result<BlockStep, ParseError> {
  const tag = readStartTag(html, index)
  if (tag?.name !== 'li') {
    const stop = misread(html, index, 'a list holds <li> items, one to a line', 'no list item of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  const data = readDataAttributes(tag.attributes, tag.name, blockNodes.listItem.attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const item = built('listItem', data.value, [])
  if (html.startsWith('</li>', tag.end)) return success({ end: tag.end + '</li>'.length, kind: 'node', node: item })
  const open: Open = { closer: '\n</li>', content: [], depth, kind: 'item', node: item, place }
  return html.startsWith('\n', tag.end) && isBlockStart(html, tag.end + 1) ? success({ end: tag.end + 1, kind: 'opened', open }) : readItemLine(html, tag.end, open)
}

function readItemLine(html: string, index: number, open: Open): Result<BlockStep, ParseError> {
  const place = { index: 0, parent: open.place }
  const line = readLineParagraph(html, index, place)
  if (!line.ok) return line
  const { end, node } = line.value
  if (!html.startsWith('</li>', end) && !html.startsWith('\n', end)) {
    const lineEnd = "an item's line ends at </li>, or at a line feed before the item's next block"
    // After a line's `</p>`, or before a block or the next item, no inline element can stand.
    const stop = line.value.form === 'bare' && !isBlockStart(html, end) && startTagName(html, end) !== 'li' ? misread(html, end, `${lineEnd}, and its text spells < as &lt;`, 'no inline element of the dialect') : { at: end, message: `${lineEnd}: ${foundAt(html, end)}` }
    return refused('unmappable-html', stop.message, html, stop.at, open.place)
  }
  const paragraph = asFirstParagraph({ end, node }, line.value.form, html, index, place)
  if (!paragraph.ok) return paragraph
  if (html.startsWith('</li>', end)) return success({ end: end + '</li>'.length, kind: 'node', node: { ...open.node, content: [node] } })
  return success({ end: end + 1, kind: 'opened', open: { ...open, content: [node] } })
}

// The paragraph on an item's line and the form it stands in there, up to `</li>` or to the line feed before the item's next block.
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

// The node an element holding no attribute or content reads as: `adfToHtml` writes a node holding an empty `attrs` or `content` as a carry.
function built(type: string, attrs: AdfAttributes, content: AdfNode[]): AdfNode {
  return { ...(Object.keys(attrs).length === 0 ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

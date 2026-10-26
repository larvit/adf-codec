import type { AdfAttributes, AdfDocument, AdfNode } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { FirstParagraphForm } from '../first-paragraph.ts'
import type { ParseError, Result } from '../../result.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { centeredImage, externalMedia } from '../../adf/plain-image.ts'
import { firstParagraphForm } from '../first-paragraph.ts'
import { foundAt, readStartTag, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { heldNode, readCarry } from './carry-element.ts'
import { largestNesting } from '../../nesting.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { notAString } from '../../not-a-string.ts'
import { positioned, success } from '../../result.ts'
import { readAnchorAttributes } from '../anchor-element.ts'
import { readCarryAttributes } from '../carry-attributes.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { readImageAttributes } from '../image-element.ts'
import { readInline } from './inline.ts'
import { readLanguageClass } from '../language-class.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { unescapedValue } from '../escaping.ts'
import { withinEngineLimits } from '../../length-bound.ts'

type BlockReader = (html: string, tag: StartTag, place: Place, open: Open) => Result<BlockStep, ParseError>

type BlockStep = { end: number; kind: 'node'; node: AdfNode } | { end: number; kind: 'opened'; open: Open }

// A container whose blocks or items are being read: `node` holds what its opening tag gave, `depth` is its children's as `adfToHtml` counts it, and `closer` ends it.
type Open = { closer: string; content: AdfNode[]; depth: number; kind: 'blocks' | 'item' | 'list'; node: AdfNode; place: Place | undefined }

// No element name opens both a block and an inline node, so the name alone tells an item's line from its next block.
const blockReaders: ReadonlyMap<string, BlockReader> = new Map([
  ['blockquote', readContainer],
  ['div', readBlockCarry],
  ['h1', readHeading],
  ['h2', readHeading],
  ['h3', readHeading],
  ['h4', readHeading],
  ['h5', readHeading],
  ['h6', readHeading],
  ['hr', readRule],
  ['ol', readContainer],
  ['p', readParagraph],
  ['pre', readCodeBlock],
  ['ul', readContainer],
])
const codeCloser = '</code></pre>'
const emptyDocument = serializeCanonicalJson({ type: 'doc', version: 1 }, 'compact')
const formRefusals: Readonly<Record<FirstParagraphForm, string>> = {
  bare: "an item's first paragraph holding content and no attribute stands bare on the item's line: <li>Bolt</li>",
  block: "an item's first paragraph holding neither content nor an attribute stands on a line of its own",
  element: "an item's first paragraph holding an attribute stands as its <p> on the item's line, straight after <li>",
}

// Reads back exactly what `adfToHtml` writes. Other HTML is `unmappable-html`; a `data-*` name or value no attribute of its node spells is `unsupported-node-shape`, as a directive's attribute is (docs/decisions.md §Which code a cause takes).
export function htmlToAdf(html: string): Result<AdfDocument, ParseError> {
  return positioned(
    withinEngineLimits(() => readHtml(html)),
    { line: 1, offset: 0 },
  )
}

function readHtml(html: string): Result<AdfDocument> {
  if (typeof html !== 'string') return notAString(html, 'HTML')
  if (html === '') return success({ content: [], type: 'doc', version: 1 })
  return isDocumentCarry(html) ? success({ type: 'doc', version: 1 }) : readBlocks(html)
}

// The carry element of a document holding no content key stands alone, as the whole HTML; the walk refuses it anywhere else.
function isDocumentCarry(html: string): boolean {
  const tag = readStartTag(html, 0)
  if (tag?.name !== 'div' || readCarryAttributes(tag.attributes) !== emptyDocument) return false
  const carry = readCarry(html, tag, largestNesting, { index: 0, parent: undefined })
  return carry.ok && carry.value.end === html.length - 1 && html.endsWith('\n')
}

// A stack rather than recursion: only this loop opens and closes containers.
function readBlocks(html: string): Result<AdfDocument, ParseError> {
  const root: Open = { closer: '', content: [], depth: 0, kind: 'blocks', node: { type: 'doc' }, place: undefined }
  const opened: Open[] = []
  let open = root
  let index = 0
  for (;;) {
    const place = { index: open.content.length, parent: open.place }
    if (open.depth > largestNesting) return refused('unsupported-nesting-depth', `the HTML nests deeper than the ${largestNesting} levels the reader carries`, html, index, place)
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
    if (!html.startsWith('\n', index)) return refused('unmappable-html', `a line feed parts each block from the next, and ends the HTML: ${foundAt(html, index)}`, html, index, open.place)
    index += 1
  }
}

function readBlock(html: string, index: number, place: Place, open: Open): Result<BlockStep, ParseError> {
  const tag = readStartTag(html, index)
  if (tag === undefined) return refused('unmappable-html', `a block element of the dialect stands here: ${foundAt(html, index)}`, html, index, place)
  const reader = blockReaders.get(tag.name)
  return reader === undefined ? refused('unmappable-html', `<${tag.name}> is no block element of the dialect`, html, index, place) : reader(html, tag, place, open)
}

function asStep(read: ReadNode): Result<BlockStep, ParseError> {
  return read.ok ? success({ ...read.value, kind: 'node' }) : read
}

function readHeading(html: string, tag: StartTag, place: Place): Result<BlockStep, ParseError> {
  return asStep(readInlineBlock(html, tag, 'heading', blockNodes.heading.attributes, { level: Number(tag.name.slice(1)) }, place))
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
  return form === found ? success(read) : refused('unmappable-html', formRefusals[form], html, index, place)
}

// `own`: the attributes the element itself writes, such as a heading's level.
function readInlineBlock(html: string, tag: StartTag, type: string, vocabulary: AttributeVocabulary, own: AdfAttributes, place: Place): ReadNode {
  const data = readDataAttributes(tag.attributes, type, vocabulary, Object.keys(own))
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const inline = readInline(html, tag.end, place)
  if (!inline.ok) return inline
  const { end, nodes } = inline.value
  const closer = `</${tag.name}>`
  if (!html.startsWith(closer, end)) return refused('unmappable-html', `${closer} ends the ${type}, which holds inline elements alone: ${foundAt(html, end)}`, html, end, place)
  return success({ end: end + closer.length, node: built(type, { ...own, ...data.value }, nodes) })
}

// `undefined` where no image follows the `<p>`, so it opens a paragraph.
function tryImage(html: string, index: number, place: Place): ReadNode | undefined {
  const opener = readStartTag(html, index)
  const anchor = opener?.name === 'a' ? opener : undefined
  const image = readStartTag(html, anchor?.end ?? index)
  if (image?.name !== 'img') return undefined
  const node = imageNode(image, anchor)
  const closer = anchor === undefined ? '</p>' : '</a></p>'
  if (node === undefined || !html.startsWith(closer, image.end)) {
    return refused('unmappable-html', 'an image stands alone in its paragraph as <img src="…" alt="…">, alt left out where it holds none, inside <a> where a link marks it', html, image.start, place)
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
  const data = readDataAttributes(tag.attributes, 'codeBlock', blockNodes.codeBlock.attributes, ['language'])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const code = readCode(html, tag.end)
  if (code === undefined) return refused('unmappable-html', 'a code block is <pre><code class="language-…">, its text escaped, then </code></pre>', html, tag.end, place)
  const { end, language, text } = code
  return success({ end, kind: 'node', node: built('codeBlock', language === undefined ? data.value : { ...data.value, language }, text === '' ? [] : [{ text, type: 'text' }]) })
}

// The `<code>` at `index`, through the `</pre>` after it; `undefined` where `adfToHtml` writes no such elements.
function readCode(html: string, index: number): { end: number; language: string | undefined; text: string } | undefined {
  const code = readStartTag(html, index)
  const named = code?.name === 'code' ? readLanguageClass(code.attributes) : undefined
  if (code === undefined || named === undefined) return undefined
  const next = html.indexOf('<', code.end)
  const end = next < 0 ? html.length : next
  const text = unescapedValue(html.slice(code.end, end))
  return text === undefined || !html.startsWith(codeCloser, end) ? undefined : { end: end + codeCloser.length, language: named.language, text }
}

function readRule(html: string, tag: StartTag, place: Place): Result<BlockStep, ParseError> {
  const data = readDataAttributes(tag.attributes, 'rule', blockNodes.rule.attributes, [])
  return data.fault === undefined ? success({ end: tag.end, kind: 'node', node: built('rule', data.value, []) }) : refused(data.fault.code, data.fault.message, html, tag.start, place)
}

function readBlockCarry(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const carry = readCarry(html, tag, largestNesting - open.depth, place)
  if (!carry.ok) return carry
  if (carry.value.json === emptyDocument) return refused('unsupported-node-shape', 'a carry element holding the document stands alone, as the whole document', html, tag.start, place)
  const node = heldNode(carry.value.held, html, tag.start, place)
  return node.ok ? success({ end: carry.value.end, kind: 'node', node: node.value }) : node
}

// A quote's blocks, or a list's items, stand a line each between its tags; a container holding no content key holds nothing.
function readContainer(html: string, tag: StartTag, place: Place, open: Open): Result<BlockStep, ParseError> {
  const type = tag.name === 'blockquote' ? 'blockquote' : tag.name === 'ul' ? 'bulletList' : 'orderedList'
  const [first, ...rest] = tag.attributes
  const start = type === 'orderedList' && first?.[0] === 'start' ? first[1] : undefined
  const order = start === undefined ? undefined : Number(start)
  if (order !== undefined && (!Number.isSafeInteger(order) || String(order) !== start)) {
    return refused('unmappable-html', `an ordered list starts at an integer, written as JavaScript writes it: found start="${start}"`, html, tag.start, place)
  }
  const data = readDataAttributes(start === undefined ? tag.attributes : rest, type, blockNodes[type].attributes, type === 'orderedList' ? ['order'] : [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const node = built(type, order === undefined ? data.value : { order, ...data.value }, [])
  const closer = `</${tag.name}>`
  if (html.startsWith(closer, tag.end)) return success({ end: tag.end + closer.length, kind: 'node', node })
  if (!html.startsWith('\n', tag.end)) return refused('unmappable-html', `<${tag.name}> holds ${closer} straight after it, or a line feed and its first ${type === 'blockquote' ? 'block' : 'item'}: ${foundAt(html, tag.end)}`, html, tag.end, place)
  return success({ end: tag.end + 1, kind: 'opened', open: { closer: `\n${closer}`, content: [], depth: open.depth + 1, kind: type === 'blockquote' ? 'blocks' : 'list', node, place } })
}

function readItem(html: string, index: number, place: Place, depth: number): Result<BlockStep, ParseError> {
  const tag = readStartTag(html, index)
  if (tag?.name !== 'li') return refused('unmappable-html', `a list holds <li> items, one to a line: ${foundAt(html, index)}`, html, index, place)
  const data = readDataAttributes(tag.attributes, 'listItem', blockNodes.listItem.attributes, [])
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
    return refused('unmappable-html', `an item's line ends at </li>, or at a line feed before the item's next block: ${foundAt(html, end)}`, html, end, open.place)
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
  const last = nodes[nodes.length - 1]
  if (!isBlockStart(html, end) || !html.endsWith('\n', end) || last?.text === undefined) return success({ end, form: 'bare', node: { content: nodes, type: 'paragraph' } })
  // Only text ends in a line feed, so the text read last holds the one parting the line from the next block.
  const text = last.text.slice(0, -1)
  return success({ end: end - 1, form: 'bare', node: { content: [...nodes.slice(0, -1), ...(text === '' ? [] : [{ ...last, text }])], type: 'paragraph' } })
}

function isBlockStart(html: string, index: number): boolean {
  const tag = readStartTag(html, index)
  return tag !== undefined && blockReaders.has(tag.name)
}

// A node holding `attrs` and `content` only where it holds any, as `adfToHtml` reads an element holding none.
function built(type: string, attrs: AdfAttributes, content: AdfNode[]): AdfNode {
  return { ...(Object.keys(attrs).length === 0 ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

import type { AdfAttributes, AdfDocument, AdfNode } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { ParseError, Result } from '../../result.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { centeredImage, externalMedia } from '../../adf/plain-image.ts'
import { classLanguage, unescapedValue } from '../escaping.ts'
import { foundAt, readStartTag, refused, type Place, type StartTag } from './source.ts'
import { heldNode, readCarry } from './carry-element.ts'
import { largestNesting } from '../../nesting.ts'
import { notAString } from '../../not-a-string.ts'
import { positioned, success } from '../../result.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { readInline, readLink } from './inline.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { withinEngineLimits } from '../../length-bound.ts'

// A container whose blocks or items are being read: `node` holds what its opening tag gave, `depth` is its children's as `adfToHtml` counts it, and `closer` ends it.
type Open = { closer: string; content: AdfNode[]; depth: number; kind: 'blocks' | 'item' | 'items'; node: AdfNode; place: Place | undefined }

type Read = { end: number; kind: 'document' } | { end: number; kind: 'node'; node: AdfNode } | { end: number; kind: 'opened'; open: Open }

type ReadNode = Result<{ end: number; node: AdfNode }, ParseError>

const blockElements: ReadonlySet<string> = new Set(['blockquote', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'ol', 'p', 'pre', 'ul'])
const emptyDocument = serializeCanonicalJson({ type: 'doc', version: 1 }, 'compact')

// Reads back exactly what `adfToHtml` writes. Other HTML is `unmappable-html`; a `data-*` name or value no attribute of its node spells is `unsupported-node-shape`, as a directive's attribute is (docs/decisions.md §Which code a cause takes).
export function htmlToAdf(html: string): Result<AdfDocument, ParseError> {
  return positioned(
    withinEngineLimits(() => readHtml(html)),
    { line: 1, offset: 0 },
  )
}

function readHtml(html: string): Result<AdfDocument> {
  if (typeof html !== 'string') return notAString(html, 'HTML')
  return html === '' ? success({ content: [], type: 'doc', version: 1 }) : readBlocks(html)
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
    const read = open.kind === 'items' ? readItem(html, index, place, open.depth) : readBlock(html, index, place, open)
    if (!read.ok) return read
    index = read.value.end
    if (read.value.kind === 'document') {
      if (open === root && open.content.length === 0 && index === html.length - 1 && html.endsWith('\n')) return success({ type: 'doc', version: 1 })
      return refused('unsupported-node-shape', 'a carry element holding the document stands alone, as the whole document', html, index, place)
    }
    if (read.value.kind === 'opened') {
      opened.push(open)
      open = read.value.open
      continue
    }
    open.content.push(read.value.node)
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

function readBlock(html: string, index: number, place: Place, open: Open): Result<Read, ParseError> {
  const tag = readStartTag(html, index)
  if (tag === undefined) return refused('unmappable-html', `a block element of the dialect stands here: ${foundAt(html, index)}`, html, index, place)
  const level = /^h([1-6])$/.exec(tag.name)?.[1]
  if (level !== undefined) return asNode(readInlineBlock(html, tag, 'heading', blockNodes.heading.attributes, { level: Number(level) }, place))
  if (tag.name === 'p') return asNode(readParagraph(html, tag, place, open.kind === 'item' && open.content.length === 0))
  if (tag.name === 'pre') return asNode(readCodeBlock(html, tag, place))
  if (tag.name === 'hr') return asNode(readRule(html, tag, place))
  if (tag.name === 'div') return readBlockCarry(html, tag, place, open.depth)
  if (['blockquote', 'ol', 'ul'].includes(tag.name)) return readContainer(html, tag, place, open.depth)
  return refused('unmappable-html', `<${tag.name}> is no block element of the dialect`, html, index, place)
}

function asNode(read: ReadNode): Result<Read, ParseError> {
  return read.ok ? success({ ...read.value, kind: 'node' }) : read
}

// `firstInItem`: the paragraph opens an item read block by block, which the writer does only where the paragraph holds neither content nor an attribute.
function readParagraph(html: string, tag: StartTag, place: Place, firstInItem: boolean): ReadNode {
  const image = tag.attributes.length === 0 ? tryImage(html, tag.end, place) : undefined
  if (image !== undefined) return image
  const paragraph = readInlineBlock(html, tag, 'paragraph', blockNodes.paragraph.attributes, {}, place)
  if (!firstInItem || !paragraph.ok || (paragraph.value.node.attrs === undefined && paragraph.value.node.content === undefined)) return paragraph
  return refused('unmappable-html', "an item's first paragraph holding content or an attribute stands on the item's line, straight after <li>", html, tag.start, place)
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
  const anchor = readStartTag(html, index)
  const linked = anchor?.name === 'a'
  const image = readStartTag(html, linked ? anchor.end : index)
  if (image?.name !== 'img') return undefined
  const link = linked ? readLink(anchor) : undefined
  const [src, alt, ...others] = image.attributes
  const closer = linked ? '</a></p>' : '</p>'
  if ((linked && link === undefined) || src?.[0] !== 'src' || (alt !== undefined && (alt[0] !== 'alt' || alt[1] === '')) || others.length > 0 || !html.startsWith(closer, image.end)) {
    return refused('unmappable-html', 'an image stands alone in its paragraph as <img src="…" alt="…">, alt left out where it holds none, inside <a> where a link marks it', html, image.start, place)
  }
  return success({ end: image.end + closer.length, node: centeredImage([externalMedia(alt?.[1] ?? '', src[1], link)]) })
}

function readCodeBlock(html: string, tag: StartTag, place: Place): ReadNode {
  const data = readDataAttributes(tag.attributes, 'codeBlock', blockNodes.codeBlock.attributes, ['language'])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const code = readStartTag(html, tag.end)
  const [className, ...others] = code?.attributes ?? []
  const language = className?.[0] === 'class' ? classLanguage(className[1]) : undefined
  const next = code === undefined ? -1 : html.indexOf('<', code.end)
  const end = next < 0 ? html.length : next
  const text = code === undefined ? undefined : unescapedValue(html.slice(code.end, end))
  if (code?.name !== 'code' || (className !== undefined && language === undefined) || others.length > 0 || text === undefined || !html.startsWith('</code></pre>', end)) {
    return refused('unmappable-html', 'a code block is <pre><code class="language-…">, its text escaped, then </code></pre>', html, tag.end, place)
  }
  const attrs = language === undefined ? data.value : { ...data.value, language }
  return success({ end: end + '</code></pre>'.length, node: built('codeBlock', attrs, text === '' ? [] : [{ text, type: 'text' }]) })
}

function readRule(html: string, tag: StartTag, place: Place): ReadNode {
  const data = readDataAttributes(tag.attributes, 'rule', blockNodes.rule.attributes, [])
  return data.fault === undefined ? success({ end: tag.end, node: built('rule', data.value, []) }) : refused(data.fault.code, data.fault.message, html, tag.start, place)
}

function readBlockCarry(html: string, tag: StartTag, place: Place, depth: number): Result<Read, ParseError> {
  const carry = readCarry(html, tag, largestNesting - depth, place)
  if (!carry.ok) return carry
  if (tag.attributes[1]?.[1] === emptyDocument) return success({ end: carry.value.end, kind: 'document' })
  const node = heldNode(carry.value.held, html, tag.start, place)
  return node.ok ? success({ end: carry.value.end, kind: 'node', node: node.value }) : node
}

// A quote's blocks, or a list's items, stand a line each between its tags; a container holding no content key holds nothing.
function readContainer(html: string, tag: StartTag, place: Place, depth: number): Result<Read, ParseError> {
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
  return success({ end: tag.end + 1, kind: 'opened', open: { closer: `\n${closer}`, content: [], depth: depth + 1, kind: type === 'blockquote' ? 'blocks' : 'items', node, place } })
}

// An item's first paragraph stands on its line, as the writer panels picked (docs/decisions.md §The HTML dialect); where it does not, the item's blocks follow a line each.
function readItem(html: string, index: number, place: Place, depth: number): Result<Read, ParseError> {
  const tag = readStartTag(html, index)
  if (tag?.name !== 'li') return refused('unmappable-html', `a list holds <li> items, one to a line: ${foundAt(html, index)}`, html, index, place)
  const data = readDataAttributes(tag.attributes, 'listItem', blockNodes.listItem.attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const item = built('listItem', data.value, [])
  if (html.startsWith('</li>', tag.end)) return success({ end: tag.end + '</li>'.length, kind: 'node', node: item })
  const open: Open = { closer: '\n</li>', content: [], depth, kind: 'item', node: item, place }
  if (html.startsWith('\n', tag.end) && isBlockStart(html, tag.end + 1)) return success({ end: tag.end + 1, kind: 'opened', open })
  const line = readItemLine(html, tag.end, { index: 0, parent: place })
  if (!line.ok) return line
  const { end, node } = line.value
  if (html.startsWith('</li>', end)) return success({ end: end + '</li>'.length, kind: 'node', node: { ...item, content: [node] } })
  if (!html.startsWith('\n', end)) return refused('unmappable-html', `an item's line ends at </li>, or at a line feed before the item's next block: ${foundAt(html, end)}`, html, end, place)
  return success({ end: end + 1, kind: 'opened', open: { ...open, content: [node] } })
}

// The paragraph on an item's line, up to `</li>` or to the line feed before the item's next block, which its caller reads.
function readItemLine(html: string, index: number, place: Place): ReadNode {
  const tag = readStartTag(html, index)
  if (tag?.name === 'p') {
    if (tag.attributes.length > 0) return readInlineBlock(html, tag, 'paragraph', blockNodes.paragraph.attributes, {}, place)
    return refused('unmappable-html', "an item's first paragraph holding no attribute stands bare on the item's line: <li>Bolt</li>", html, index, place)
  }
  const inline = readInline(html, index, place)
  if (!inline.ok) return inline
  const { end, nodes } = inline.value
  const last = nodes[nodes.length - 1]
  if (!isBlockStart(html, end) || !html.endsWith('\n', end) || last?.text === undefined) return success({ end, node: { content: nodes, type: 'paragraph' } })
  // Only text ends in a line feed, so the text read last holds the one parting the line from the next block.
  const text = last.text.slice(0, -1)
  return success({ end: end - 1, node: { content: [...nodes.slice(0, -1), ...(text === '' ? [] : [{ ...last, text }])], type: 'paragraph' } })
}

function isBlockStart(html: string, index: number): boolean {
  const tag = readStartTag(html, index)
  return tag !== undefined && blockElements.has(tag.name)
}

// A node holding `attrs` and `content` only where it holds any, as `adfToHtml` reads an element holding none.
function built(type: string, attrs: AdfAttributes, content: AdfNode[]): AdfNode {
  return { ...(Object.keys(attrs).length === 0 ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

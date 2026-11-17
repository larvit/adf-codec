import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { LinkAttrs } from '../../adf/mark-attributes.ts'
import type { ParseError, Result } from '../../result.ts'
import type { Place, ReadNode } from './source.ts'
import { centeredImage, externalMedia } from '../../adf/plain-image.ts'
import { foundAt, refused } from './source.ts'
import { headingLevel, readListStart } from '../block-elements.ts'
import { imageAside } from '../../adf/image-aside.ts'
import { largestNesting } from '../../nesting.ts'
import { linkAttrs, linkMarkFrom } from '../../adf/mark-attributes.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { readEntityReference } from '../../entity-references.ts'
import { readInlineElement } from './inline.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { success } from '../../result.ts'

// The dialect's block at `index`, read as the dialect alone; `undefined` where the element named there is no block of the dialect.
export type DialectBlockReader = (html: string, index: number, place: Place, depth: number) => ReadNode | undefined

type Attributes = ReadonlyMap<string, string>

// An open element. `blocks`, `list`, `table`, `row` and `text` hold what their node holds, `depth` their children's level as `adfToHtml` counts it; `unwrap` and `inline` hand their content to the holder under them; `hidden` drops it; `pre` gathers a code block's text.
type Frame = {
  // The (image) of each image inside this link, standing after the link.
  asides: AdfNode[][]
  attrs: AdfAttributes
  content: AdfNode[]
  depth: number
  // The nearest open element around this one holding content of its own; `undefined` where this one does.
  holder: Frame | undefined
  // The image a paragraph holds alone so far.
  image: AdfNode | undefined
  kind: 'blocks' | 'hidden' | 'inline' | 'list' | 'pre' | 'row' | 'table' | 'text' | 'unwrap'
  // The content of the item last put in this list, where a block standing between two items goes.
  lastItem: AdfNode[] | undefined
  // The nearest open `<a>` marking its text as a link.
  link: Frame | undefined
  // The marks of every element open here, each type once, the outermost first.
  marks: AdfMark[]
  name: string
  place: Place | undefined
  type: string
}

// An image in the line being read: `media` is what it reads as where it turns out to stand alone in its paragraph.
type LineImage = { aside: AdfNode[] | undefined; link: Frame | undefined; media: AdfNode }

type Reading = {
  // Where each open table and cell stands in `frames`: an end tag inside the last closes no element around it.
  barriers: number[]
  code: string[]
  frames: Frame[]
  html: string
  imageNodes: Set<AdfNode>
  images: LineImage[]
  // The inline nodes since the last block boundary.
  line: AdfNode[]
  // Where the open elements of each name stand in `frames`, so no tag walks them all to find one.
  open: Map<string, number[]>
  readBlock: DialectBlockReader
  root: Frame
}

type Tag = { attributes: Attributes; end: number; name: string }

const attribute = /[\t\n\f\r /]*([^\t\n\f\r />][^\t\n\f\r />=]*)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r >]*)))?/y
// WHATWG HTML §15.3.3, §15.3.7, §15.3.10 and §15.3.13: what a browser shows as a block, less what `mappedNode` reads as a node.
const blockElements: ReadonlySet<string> = new Set([
  'address',
  'article',
  'aside',
  'body',
  'caption',
  'center',
  'colgroup',
  'dd',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'header',
  'hgroup',
  'html',
  'legend',
  'listing',
  'main',
  'menu',
  'nav',
  'optgroup',
  'option',
  'plaintext',
  'search',
  'section',
  'tbody',
  'tfoot',
  'thead',
  'xmp',
])
const cellTypes: Readonly<Record<string, string>> = { td: 'tableCell', th: 'tableHeader' }
const containerTypes: Readonly<Record<string, string>> = { blockquote: 'blockquote', ol: 'orderedList', ul: 'bulletList' }
const endTag = /<\/([a-zA-Z][^\t\n\f\r />]*)[^>]*>?/y
// WHATWG HTML §15.3.1: what a browser shows none of.
const hiddenElements: ReadonlySet<string> = new Set(['area', 'base', 'basefont', 'datalist', 'head', 'link', 'meta', 'noembed', 'noframes', 'param', 'rp', 'script', 'style', 'template', 'title'])
// WHATWG HTML §15.3.4: the elements a browser shows as each mark.
const markElements: ReadonlyMap<string, AdfMark> = new Map<string, AdfMark>([
  ['b', { type: 'strong' }],
  ['cite', { type: 'em' }],
  ['code', { type: 'code' }],
  ['del', { type: 'strike' }],
  ['dfn', { type: 'em' }],
  ['em', { type: 'em' }],
  ['i', { type: 'em' }],
  ['ins', { type: 'underline' }],
  ['kbd', { type: 'code' }],
  ['s', { type: 'strike' }],
  ['samp', { type: 'code' }],
  ['strike', { type: 'strike' }],
  ['strong', { type: 'strong' }],
  ['sub', { attrs: { type: 'sub' }, type: 'subsup' }],
  ['sup', { attrs: { type: 'sup' }, type: 'subsup' }],
  ['tt', { type: 'code' }],
  ['u', { type: 'underline' }],
  ['var', { type: 'em' }],
])
// WHATWG HTML §13.1.2: the elements whose text holds no tag.
const rawTextElements: ReadonlySet<string> = new Set(['script', 'style'])
const startTagName = /<([a-zA-Z][^\t\n\f\r />]*)/y
const tableParts: ReadonlySet<string> = new Set(['table', 'td', 'th', 'tr'])
const tagEnd = /[\t\n\f\r /]*>/y
// The elements holding no content and taking no end tag: WHATWG HTML §13.1.2, and §13.2.6.4 for the obsolete `<basefont>` and `<param>`.
const voidElements: ReadonlySet<string> = new Set(['area', 'base', 'basefont', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
const whitespace = /[\t\n\f\r ]+/g

// Reads any HTML best effort (docs/decisions.md, Foreign HTML reads best effort and is never refused). It refuses only an element claiming the dialect that `readBlock` or `readInlineElement` refuses, and nesting past `largestNesting`.
export function readForeignHtml(html: string, readBlock: DialectBlockReader): Result<AdfDocument, ParseError> {
  const root: Frame = { asides: [], attrs: {}, content: [], depth: 0, holder: undefined, image: undefined, kind: 'blocks', lastItem: undefined, link: undefined, marks: [], name: '', place: undefined, type: 'doc' }
  const reading: Reading = { barriers: [], code: [], frames: [root], html, imageNodes: new Set(), images: [], line: [], open: new Map(), readBlock, root }
  let index = 0
  while (index < html.length) {
    const next = html.startsWith('<', index) ? readMarkup(reading, index) : success(readText(reading, index))
    if (!next.ok) return next
    index = next.value
  }
  while (reading.frames.length > 1) close(reading)
  flushLine(reading)
  return success({ content: root.content, type: 'doc', version: 1 })
}

// Where reading goes on after the markup at `index`; a `<` opening no markup is text.
function readMarkup(reading: Reading, index: number): Result<number, ParseError> {
  const { html } = reading
  if (html.startsWith('<!--', index)) return success(after(html, '-->', index + 2))
  if (html.startsWith('<!', index) || html.startsWith('<?', index)) return success(after(html, '>', index + 2))
  endTag.lastIndex = index
  const ended = endTag.exec(html)
  if (ended !== null) {
    closeNamed(reading, (ended[1] ?? '').toLowerCase())
    return success(index + ended[0].length)
  }
  const tag = readTag(html, index)
  if (tag === undefined) return success(readText(reading, index))
  return tag.end < 0 ? success(html.length) : readElement(reading, index, tag)
}

function after(html: string, closer: string, from: number): number {
  const found = html.indexOf(closer, from)
  return found < 0 ? html.length : found + closer.length
}

// `undefined` where no start tag stands at `index`; `end` is -1 where the HTML ends inside the tag, which a browser drops. One attribute a match, as `scanStartTag` reads them.
function readTag(html: string, index: number): Tag | undefined {
  startTagName.lastIndex = index
  const name = startTagName.exec(html)?.[1]?.toLowerCase()
  if (name === undefined) return undefined
  const attributes = new Map<string, string>()
  let at = index + 1 + name.length
  for (;;) {
    tagEnd.lastIndex = at
    const closed = tagEnd.exec(html)
    if (closed !== null) return { attributes, end: at + closed[0].length, name }
    attribute.lastIndex = at
    const match = attribute.exec(html)
    if (match === null) return { attributes, end: -1, name }
    const key = (match[1] ?? '').toLowerCase()
    if (!attributes.has(key)) attributes.set(key, decoded(match[2] ?? match[3] ?? match[4] ?? ''))
    at += match[0].length
  }
}

function decoded(spelled: string): string {
  const pieces: string[] = []
  let from = 0
  for (let at = spelled.indexOf('&'); at >= 0; at = spelled.indexOf('&', at + 1)) {
    const reference = readEntityReference(spelled, at)
    if (reference === undefined) continue
    pieces.push(spelled.slice(from, at), reference.text)
    from = at + reference.length
  }
  return pieces.join('') + spelled.slice(from)
}

// The text from `index` to the next `<` after it.
function readText(reading: Reading, index: number): number {
  const top = topOf(reading)
  const next = reading.html.indexOf('<', index + 1)
  const end = next < 0 ? reading.html.length : next
  const text = decoded(reading.html.slice(index, end))
  if (top.kind === 'pre') reading.code.push(text)
  else if (top.kind !== 'hidden') reading.line.push(textNode(text.replace(whitespace, ' '), top.marks))
  return end
}

function textNode(text: string, marks: AdfMark[]): AdfNode {
  return marks.length === 0 ? { text, type: 'text' } : { marks, text, type: 'text' }
}

function topOf(reading: Reading): Frame {
  return reading.frames.at(-1) ?? reading.root
}

function holderOf(reading: Reading): Frame {
  const top = topOf(reading)
  return top.holder ?? top
}

function push(reading: Reading, opened: Frame): void {
  const { barriers, frames, open } = reading
  const named = open.get(opened.name)
  if (named === undefined) open.set(opened.name, [frames.length])
  else named.push(frames.length)
  if (isBarrier(opened)) barriers.push(frames.length)
  frames.push(opened)
}

function isBarrier({ kind, type }: Frame): boolean {
  return kind === 'table' || isCell(type)
}

function isCell(type: string): boolean {
  return type === 'tableCell' || type === 'tableHeader'
}

// Where the nearest open element of this name stands in `frames`, -1 where none is open.
function nearest(reading: Reading, name: string): number {
  return reading.open.get(name)?.at(-1) ?? -1
}

function readElement(reading: Reading, index: number, tag: Tag): Result<number, ParseError> {
  const top = topOf(reading)
  const { attributes, name } = tag
  if (rawTextElements.has(name)) return success(afterRawText(reading.html, name, tag.end))
  if (top.kind === 'pre') return success(readInPre(reading, top, tag))
  if (top.kind === 'hidden' || hiddenElements.has(name) || attributes.has('hidden')) {
    if (!voidElements.has(name)) push(reading, frame('hidden', name, top))
    return success(tag.end)
  }
  if (claimsDialect(attributes)) return readDialect(reading, index, name)
  return opened(reading, tag)
}

// An element handing its content to the holder around it, or dropping it.
function frame(kind: 'hidden' | 'inline' | 'unwrap', name: string, top: Frame, marks: AdfMark[] = top.marks): Frame {
  return { ...top, asides: [], attrs: {}, content: [], holder: top.holder ?? top, image: undefined, kind, lastItem: undefined, marks, name, type: '' }
}

function afterRawText(html: string, name: string, from: number): number {
  const closer = new RegExp(`</${name}[\\t\\n\\f\\r />]`, 'gi')
  closer.lastIndex = from
  const found = closer.exec(html)
  return found === null ? html.length : after(html, '>', found.index)
}

// A code block's text is its element's text: only a `<br>` and the language class of a `<code>` read from the start tags inside it, and the end tag of a block around it ends it.
function readInPre(reading: Reading, pre: Frame, { attributes, end, name }: Tag): number {
  if (name === 'br') reading.code.push('\n')
  const language = name === 'code' ? languageOf(attributes) : undefined
  if (language !== undefined && pre.attrs['language'] === undefined) pre.attrs = { language }
  return end
}

function languageOf(attributes: Attributes): string | undefined {
  const named = (attributes.get('class') ?? '').split(whitespace).find((token) => token.startsWith('language-') && token.length > 'language-'.length)
  return named?.slice('language-'.length)
}

function claimsDialect(attributes: Attributes): boolean {
  return attributes.has('data-adf') || (attributes.get('class') ?? '').split(whitespace).some((token) => token.startsWith('adf-'))
}

// An element claiming the dialect reads as the dialect alone, and is refused where that reading fails (docs/decisions.md, `htmlToAdf` reads any HTML, with no option and no second call).
function readDialect(reading: Reading, index: number, name: string): Result<number, ParseError> {
  const { html } = reading
  const inline = inlinePlace(reading)
  const element = readInlineElement(html, index, inline)
  if (element?.ok === true) reading.line.push(element.value.node)
  if (element !== undefined) return element.ok ? success(element.value.end) : element
  endParagraph(reading)
  const holder = holderOf(reading)
  const block = reading.readBlock(html, index, { index: holder.content.length, parent: holder.place }, holder.depth)
  if (block === undefined) return refused('unmappable-html', `<${name}> holds data-adf or an adf- class, which mark an element adfToHtml writes, and adfToHtml writes no <${name}>: ${foundAt(html, index)}`, html, index, inline)
  if (block.ok) put(holder, block.value.node)
  return block.ok ? success(block.value.end) : block
}

function inlinePlace(reading: Reading): Place {
  const holder = holderOf(reading)
  const parent = holder.kind === 'text' ? holder.place : { index: holder.content.length, parent: holder.place }
  return { index: reading.line.length, parent }
}

// A block ends the paragraph, heading or summary it starts in, as a `<p>` ends at the next block's start tag (WHATWG HTML §13.1.2.4).
function endParagraph(reading: Reading): void {
  const holder = holderOf(reading)
  if (holder.kind === 'text') closeThrough(reading, reading.frames.lastIndexOf(holder))
  flushLine(reading)
}

function closeThrough(reading: Reading, index: number): void {
  while (reading.frames.length > index) close(reading)
}

// Closes the nearest open element of this name. An end tag never closes through a table opened inside that element, and one naming no part of a table never through a cell either.
function closeNamed(reading: Reading, name: string): void {
  const found = nearest(reading, name)
  const floor = tableParts.has(name) ? nearest(reading, 'table') : (reading.barriers.at(-1) ?? 1)
  if (topOf(reading).kind === 'pre' && !isBlock(name)) return
  if (found >= Math.max(floor, 1)) closeThrough(reading, found)
}

function opened(reading: Reading, { attributes, end, name }: Tag): Result<number, ParseError> {
  if (name === 'br') reading.line.push({ type: 'hardBreak' })
  else if (name === 'img') readImage(reading, attributes)
  else if (name === 'hr') {
    endParagraph(reading)
    put(holderOf(reading), { type: 'rule' })
  } else if (voidElements.has(name)) return success(end)
  else if (isBlock(name)) return openBlock(reading, name, attributes, end)
  else push(reading, inlineFrame(topOf(reading), name, attributes))
  return success(end)
}

function isBlock(name: string): boolean {
  return blockElements.has(name) || name === 'summary' || endsParagraph(name)
}

function endsParagraph(name: string): boolean {
  return Object.hasOwn(containerTypes, name) || Object.hasOwn(cellTypes, name) || headingLevel(name) > 0 || ['details', 'li', 'p', 'pre', 'table', 'tr'].includes(name)
}

function inlineFrame(top: Frame, name: string, attributes: Attributes): Frame {
  const href = name === 'a' ? attributes.get('href') : undefined
  const mark = href === undefined ? markElements.get(name) : linkMarkFrom(titled(href, attributes))
  const marked = mark !== undefined && top.marks.every(({ type }) => type !== mark.type)
  const opened = frame('inline', name, top, marked ? [...top.marks, mark] : top.marks)
  if (marked && mark.type === 'link') opened.link = opened
  return opened
}

function titled(href: string, attributes: Attributes): LinkAttrs {
  const title = attributes.get('title')
  return title === undefined || title === '' ? { href } : { href, title }
}

function openBlock(reading: Reading, name: string, attributes: Attributes, end: number): Result<number, ParseError> {
  closeImplied(reading, name)
  if (endsParagraph(name)) endParagraph(reading)
  else flushLine(reading)
  const top = topOf(reading)
  const holder = holderOf(reading)
  const mapped = mappedNode(reading, name, attributes)
  if (mapped === undefined) {
    push(reading, frame('unwrap', name, top))
    return success(end)
  }
  const inRow = isCell(mapped.type) && holder.kind === 'table'
  const depth = holder.depth + mapped.deeper + (inRow ? 1 : 0)
  const place = { index: holder.content.length, parent: holder.place }
  if (depth > largestNesting) return refused('unsupported-nesting-depth', `blocks nest deeper than ${largestNesting} levels`, reading.html, end, place)
  const marked = isCell(mapped.type) ? { link: undefined, marks: [] } : { link: top.link, marks: top.marks }
  const under = { ...marked, asides: [], depth, holder: undefined, image: undefined, lastItem: undefined }
  if (inRow) push(reading, { ...under, attrs: {}, content: [], kind: 'row', name: 'tr', place, type: 'tableRow' })
  push(reading, { ...under, attrs: mapped.attrs, content: [], kind: mapped.kind, name, place: inRow ? { index: 0, parent: place } : place, type: mapped.type })
  if (mapped.kind === 'pre') reading.code = []
  return success(end)
}

// An item, row or cell ends at the next one's start tag (WHATWG HTML §13.1.2.4), unless a list or table opened inside it.
function closeImplied(reading: Reading, name: string): void {
  const item = name === 'li' ? nearest(reading, 'li') : -1
  const row = name === 'tr' ? nearest(reading, 'tr') : -1
  const cell = Object.hasOwn(cellTypes, name) ? Math.max(nearest(reading, 'td'), nearest(reading, 'th')) : -1
  const table = nearest(reading, 'table')
  if (item > Math.max(nearest(reading, 'ol'), nearest(reading, 'ul')) && reading.frames[item]?.type === 'listItem') closeThrough(reading, item)
  if (row > table && reading.frames[row]?.kind === 'row') closeThrough(reading, row)
  if (cell > Math.max(table, nearest(reading, 'tr')) && isCell(reading.frames[cell]?.type ?? '')) closeThrough(reading, cell)
}

// The node a block element opens where it stands, `deeper` the levels it adds to its holder's; `undefined` where it unwraps to its children: an item outside a list, a row outside a table, a cell outside both, and a `<summary>` not titling its `<details>`.
function mappedNode(reading: Reading, name: string, attributes: Attributes): { attrs: AdfAttributes; deeper: number; kind: Frame['kind']; type: string } | undefined {
  const top = topOf(reading)
  const holder = holderOf(reading)
  const level = headingLevel(name)
  const container = containerTypes[name]
  const cell = cellTypes[name]
  if (name === 'p') return { attrs: {}, deeper: 0, kind: 'text', type: 'paragraph' }
  if (level > 0) return { attrs: { level }, deeper: 0, kind: 'text', type: 'heading' }
  if (name === 'pre') return { attrs: {}, deeper: 0, kind: 'pre', type: 'codeBlock' }
  if (name === 'blockquote') return { attrs: {}, deeper: 1, kind: 'blocks', type: 'blockquote' }
  if (container !== undefined) return { attrs: orderOf(name, attributes), deeper: 1, kind: 'list', type: container }
  if (name === 'table') return { attrs: {}, deeper: 1, kind: 'table', type: 'table' }
  if (name === 'details') return { attrs: {}, deeper: 1, kind: 'blocks', type: nearest(reading, 'details') < 0 ? 'expand' : 'nestedExpand' }
  if (name === 'summary') return top.name === 'details' && top.attrs['title'] === undefined ? { attrs: {}, deeper: 0, kind: 'text', type: 'summary' } : undefined
  if (name === 'li') return holder.kind === 'list' ? { attrs: {}, deeper: 0, kind: 'blocks', type: 'listItem' } : undefined
  if (name === 'tr') return holder.kind === 'table' ? { attrs: {}, deeper: 1, kind: 'row', type: 'tableRow' } : undefined
  return cell !== undefined && (holder.kind === 'row' || holder.kind === 'table') ? { attrs: {}, deeper: 0, kind: 'blocks', type: cell } : undefined
}

function orderOf(name: string, attributes: Attributes): AdfAttributes {
  const order = name === 'ol' ? readListStart(attributes.get('start') ?? '') : undefined
  return order === undefined ? {} : { order }
}

function close(reading: Reading): void {
  const { barriers, frames, open } = reading
  const closing = topOf(reading)
  if (closing.kind !== 'inline' && closing.kind !== 'hidden') flushLine(reading)
  frames.pop()
  open.get(closing.name)?.pop()
  if (isBarrier(closing)) barriers.pop()
  for (const aside of closing.asides) for (const node of aside) pushImageNode(reading, node)
  if (closing.holder !== undefined) return
  const holder = holderOf(reading)
  if (closing.type === 'summary') holder.attrs = { ...holder.attrs, title: closing.content.map((node) => (node.type === 'text' ? (node.text ?? '') : ' ')).join('') }
  else if (closing.image !== undefined) put(holder, closing.image)
  else if (closing.kind === 'pre') put(holder, built(closing, codeText(reading.code)))
  else if (closing.kind === 'blocks' && closing.type !== 'blockquote') put(holder, built(closing, closing.content.length === 0 ? [{ type: 'paragraph' }] : closing.content))
  else if (closing.content.length > 0) put(holder, built(closing, closing.content))
}

function pushImageNode(reading: Reading, node: AdfNode): void {
  reading.line.push(node)
  reading.imageNodes.add(node)
}

// A line feed straight after `<pre>` is no text of its code (WHATWG HTML §4.4.3).
function codeText(code: string[]): AdfNode[] {
  const text = code.join('')
  const shown = text.startsWith('\n') ? text.slice(1) : text
  return shown === '' ? [] : [{ text: shown, type: 'text' }]
}

function built({ attrs, type }: Frame, content: AdfNode[]): AdfNode {
  return { ...(Object.keys(attrs).length === 0 ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

// Puts a block where its holder takes it: a list takes items, so a block between two items joins the item before it, and a table takes rows of cells.
function put(holder: Frame, node: AdfNode): void {
  if (holder.kind === 'list' && node.type !== 'listItem') {
    if (holder.lastItem === undefined) put(holder, { content: [node], type: 'listItem' })
    else holder.lastItem.push(node)
  } else if (holder.kind === 'table' && node.type !== 'tableRow') put(holder, { content: [isCell(node.type) ? node : { content: [node], type: 'tableCell' }], type: 'tableRow' })
  else if (holder.kind === 'row' && !isCell(node.type)) holder.content.push({ content: [node], type: 'tableCell' })
  else {
    holder.content.push(node)
    holder.lastItem = node.content
  }
}

// An image alone in its paragraph reads as the image; anywhere else as its alt text, its URL where it has none, linked to the image, and inside a link as the link's text with ` (image)` after the link (docs/decisions.md, An image reads as an image only alone in its paragraph).
function readImage(reading: Reading, attributes: Attributes): void {
  const top = topOf(reading)
  const src = attributes.get('src')
  const alt = attributes.get('alt') ?? ''
  if (src === undefined) {
    if (alt !== '') reading.line.push(textNode(alt, top.marks))
    return
  }
  const image = titled(src, attributes)
  const around = top.marks.find(({ type }) => type === 'link')
  const link = around === undefined ? undefined : linkAttrs(nodeAttrs(around))
  const caption: AdfNode[] = image.title === undefined ? [] : [{ content: [{ text: image.title, type: 'text' }], type: 'caption' }]
  const reached = link === undefined || (link.href === src && (image.title === undefined || image.title === link.title))
  const aside = reached ? undefined : imageAside((text) => [{ marks: [linkMarkFrom(image)], text, type: 'text' }])
  if (aside !== undefined) top.link?.asides.push(aside)
  pushImageNode(reading, textNode(alt === '' ? src : alt, link === undefined ? [...top.marks, linkMarkFrom(image)] : top.marks))
  reading.images.push({ aside, link: top.link, media: centeredImage([externalMedia(alt, src, link), ...caption]) })
}

// Ends the line at a block boundary: it is a paragraph of its holder, or the next line of the paragraph, heading or summary it stands in.
function flushLine(reading: Reading): void {
  const { images, imageNodes, line } = reading
  if (line.length === 0) return
  const [image] = images
  const alone = images.length === 1 && line.every((node) => imageNodes.has(node) || node.text === ' ') ? image : undefined
  const nodes = shownLine(line)
  reading.line = []
  reading.images = []
  reading.imageNodes = new Set()
  if (nodes.length === 0) return
  const holder = holderOf(reading)
  if (alone?.link?.asides.at(-1) === alone?.aside) alone?.link?.asides.pop()
  if (holder.kind !== 'text') {
    put(holder, alone === undefined ? { content: nodes, type: 'paragraph' } : alone.media)
    return
  }
  holder.image = holder.content.length === 0 && holder.type === 'paragraph' ? alone?.media : undefined
  if (holder.content.length > 0) holder.content.push({ type: 'hardBreak' })
  for (const node of nodes) holder.content.push(node)
}

// The line as a browser shows it (CSS Text §4.1.1 and §4.1.2): each run of white space one space, none at the line's edges or beside a break, and no break ending the line. Text nodes side by side holding the same marks are one.
function shownLine(line: readonly AdfNode[]): AdfNode[] {
  const shown: AdfNode[] = []
  let atEdge = true
  for (const node of line) {
    const last = shown.at(-1)
    const text: string = atEdge && node.text?.startsWith(' ') === true ? node.text.slice(1) : (node.text ?? '')
    if (node.type !== 'text') {
      if (node.type === 'hardBreak') trimEnd(shown)
      atEdge = node.type === 'hardBreak'
      shown.push(node)
    } else if (text !== '') {
      atEdge = text.endsWith(' ')
      if (last?.type === 'text' && sameMarks(last, node)) shown[shown.length - 1] = { ...last, text: (last.text ?? '') + text }
      else shown.push({ ...node, text })
    }
  }
  trimEnd(shown)
  while (shown.at(-1)?.type === 'hardBreak') {
    shown.pop()
    trimEnd(shown)
  }
  return shown
}

function trimEnd(shown: AdfNode[]): void {
  const last = shown.at(-1)
  if (last?.type !== 'text' || last.text?.endsWith(' ') !== true) return
  shown.pop()
  if (last.text !== ' ') shown.push({ ...last, text: last.text.slice(0, -1) })
}

function sameMarks(one: AdfNode, other: AdfNode): boolean {
  return one.marks === other.marks || serializeCanonicalJson(one.marks ?? [], 'compact') === serializeCanonicalJson(other.marks ?? [], 'compact')
}

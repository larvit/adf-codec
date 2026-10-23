import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import { adfDocumentFault, heldTextLength, holdsOnlyAttributes, isSpellableText, isUnmarkedSpellableText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { carriedJson } from '../../adf/carried-json.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { joinedWithin, longestOutput, tooLong, withinEngineLimits } from '../../length-bound.ts'
import { largestNesting } from '../../nesting.ts'
import { linkTarget, type LinkTarget } from '../../adf/mark-attributes.ts'
import { plainImage } from '../../adf/external-image.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { shownText } from '../../adf/shown-text.ts'

// depth: the nesting level of the block list holding the node, as `largestNesting` counts it.
type Block = { depth: number; node: AdfNode; path: ConvertErrorPath }
type Pending = Block | string

// Each names its element.
const elementMarks: readonly string[] = ['code', 'em', 'strong']

export function adfToHtml(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => writeHtml(document))
}

function writeHtml(document: AdfDocument): Result<string> {
  const fault = adfDocumentFault(document)
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no HTML spelling carries ADF version ${document.version}`, [])
  if (document.content === undefined) return success(`${carryElement('div', serializeCanonicalJson(document, 'compact'), '')}\n`)
  // Every character of text is written at least once, so this much text cannot fit, and none of it is written.
  if (heldTextLength(document.content) > longestOutput) return tooLong()
  const pending: Pending[] = []
  scheduleBlocks(pending, document.content, [], 0, '', document.content.length === 0 ? '' : '\n')
  const pieces: string[] = []
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (typeof next === 'string') {
      pieces.push(next)
      continue
    }
    const written = writeBlock(next, pending)
    if (!written.ok) return written
    if (written.value !== undefined) pieces.push(written.value)
  }
  return joinedWithin(pieces)
}

// Pushed in reverse, so the walk pops them in document order: a stack rather than recursion, since each level would cost several frames.
function scheduleBlocks(pending: Pending[], nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number, opener: string, closer: string): void {
  const scheduled: Pending[] = [opener]
  for (const [index, node] of nodes.entries()) {
    if (index > 0) scheduled.push('\n')
    scheduled.push({ depth, node, path: [...path, 'content', index] })
  }
  scheduled.push(closer)
  for (const item of scheduled.reverse()) pending.push(item)
}

function tooDeep(path: ConvertErrorPath): Result<never> {
  return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, path)
}

// `undefined` where the block scheduled its children rather than writing itself whole.
function writeBlock(block: Block, pending: Pending[]): Result<string | undefined> {
  const { depth, node, path } = block
  if (depth > largestNesting) return tooDeep(path)
  const leaf = tryLeafBlock(node, path)
  if (leaf !== undefined) return leaf
  if (node.type === 'blockquote' && holdsOnlyAttributes(node, [])) return containerBlock(pending, block, 'blockquote', '')
  const list = listElement(node)
  if (list !== undefined) return scheduleList(pending, block, list)
  return carriedBlock(node, path, depth)
}

function tryLeafBlock(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  if (node.type === 'paragraph' && holdsOnlyAttributes(node, [])) return inlineElement('p', '', nodeContent(node), path)
  if (node.type === 'heading' && holdsOnlyAttributes(node, ['level'])) {
    const level = nodeAttrs(node)['level']
    if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 6) return inlineElement(`h${level}`, '', nodeContent(node), path)
  }
  const text = tryCodeBlock(node) ?? tryImage(node) ?? (node.type === 'rule' && holdsOnlyAttributes(node, []) && nodeContent(node).length === 0 ? '<hr>' : undefined)
  return text === undefined ? undefined : success(text)
}

function inlineElement(tag: string, attributes: string, nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
  const inline = inlineHtml(nodes, path)
  return inline.ok ? success(`<${tag}${attributes}>${inline.value}</${tag}>`) : inline
}

// A class holds the language as one token, so a language holding whitespace rides the carry.
function tryCodeBlock(node: AdfNode): string | undefined {
  if (node.type !== 'codeBlock' || !holdsOnlyAttributes(node, ['language'])) return undefined
  const language = nodeAttrs(node)['language']
  if (language !== undefined && (typeof language !== 'string' || !/^[^\t\n\f\r ]+$/.test(language))) return undefined
  const className = language === undefined ? '' : ` class="${escapeHtml(`language-${language}`)}"`
  if (node.content === undefined) return `<pre><code${className}></code></pre>`
  const [only, ...others] = node.content
  if (only === undefined || others.length > 0 || !writableText(only) || !isUnmarkedSpellableText(only)) return undefined
  return `<pre><code${className}>${escapeHtml(only.text)}</code></pre>`
}

function tryImage(node: AdfNode): string | undefined {
  const image = node.type === 'mediaSingle' ? plainImage(node) : undefined
  if (image === undefined || !writableUrl(image.url) || (image.alt !== undefined && image.alt.includes('\0'))) return undefined
  const element = `<img src="${escapeHtml(image.url)}"${image.alt === undefined ? '' : ` alt="${escapeHtml(image.alt)}"`}>`
  if (image.link === undefined) return `<p>${element}</p>`
  const anchor = anchorOpener(image.link)
  return anchor === undefined ? undefined : `<p>${anchor}${element}</a></p>`
}

function containerBlock(pending: Pending[], { depth, node, path }: Block, tag: string, attributes: string): Result<string | undefined> {
  if (node.content === undefined) return success(`<${tag}${attributes}></${tag}>`)
  scheduleBlocks(pending, node.content, path, depth + 1, `<${tag}${attributes}>\n`, `\n</${tag}>`)
  return success(undefined)
}

// The list's element, `undefined` where the list or an item holds what the elements cannot, so the whole list rides the carry.
function listElement(node: AdfNode): { attributes: string; tag: string } | undefined {
  if (node.type === 'bulletList' && holdsOnlyAttributes(node, [])) return listItemsWritable(node) ? { attributes: '', tag: 'ul' } : undefined
  if (node.type !== 'orderedList' || !holdsOnlyAttributes(node, ['order']) || !listItemsWritable(node)) return undefined
  const order = nodeAttrs(node)['order']
  if (order === undefined) return { attributes: '', tag: 'ol' }
  return typeof order === 'number' && Number.isSafeInteger(order) && !Object.is(order, -0) ? { attributes: ` start="${order}"`, tag: 'ol' } : undefined
}

function listItemsWritable(list: AdfNode): boolean {
  return nodeContent(list).every((item) => item.type === 'listItem' && holdsOnlyAttributes(item, []))
}

function scheduleList(pending: Pending[], block: Block, { attributes, tag }: { attributes: string; tag: string }): Result<string | undefined> {
  const { depth, node, path } = block
  if (node.content === undefined) return success(`<${tag}${attributes}></${tag}>`)
  const items: { opening: string; rest: Pending[] }[] = []
  // The items' blocks sit one level below the list, as a markdown list's do.
  for (const [index, item] of node.content.entries()) {
    const rest: Pending[] = []
    const opening = writeItem(rest, item, [...path, 'content', index], depth + 1)
    if (!opening.ok) return opening
    items.push({ opening: `${index === 0 ? '' : '\n'}${opening.value}`, rest })
  }
  pending.push(`\n</${tag}>`)
  for (const { opening, rest } of items.reverse()) {
    for (const piece of rest) pending.push(piece)
    pending.push(opening)
  }
  pending.push(`<${tag}${attributes}>\n`)
  return success(undefined)
}

// Returns the item's opening, its first paragraph written bare where it holds content, and pushes the rest; panel pick, docs/decisions.md §The HTML dialect.
function writeItem(pending: Pending[], item: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  if (depth > largestNesting) return tooDeep(path)
  if (item.content === undefined) return success('<li></li>')
  const [first] = item.content
  const bare = first !== undefined && first.type === 'paragraph' && holdsOnlyAttributes(first, []) && nodeContent(first).length > 0
  const rest = bare ? item.content.slice(1) : item.content
  scheduleBlocks(pending, rest, path, depth, rest.length === 0 ? '' : '\n', rest.length === 0 ? '</li>' : '\n</li>')
  if (!bare) return success('<li>')
  const inline = inlineHtml(nodeContent(first), [...path, 'content', 0])
  return inline.ok ? success(`<li>${inline.value}`) : inline
}

function inlineHtml(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
  let html = ''
  let afterPlainText = false
  for (const [index, node] of nodes.entries()) {
    // Two unmarked text nodes side by side read back as one, so the second rides the carry.
    const written: string | undefined = afterPlainText && isUnmarkedSpellableText(node) ? undefined : tryInlineNode(node)
    if (written === undefined) {
      const carried = carriedInline(node, [...path, 'content', index])
      if (!carried.ok) return carried
      html += carried.value
    } else html += written
    afterPlainText = written !== undefined && isUnmarkedSpellableText(node)
  }
  return success(html)
}

function tryInlineNode(node: AdfNode): string | undefined {
  if (node.type === 'hardBreak') return holdsOnlyAttributes(node, []) && nodeContent(node).length === 0 ? '<br>' : undefined
  if (!isSpellableText(node) || !writableText(node)) return undefined
  const marks = nodeMarks(node)
  const openers: string[] = []
  const closers: string[] = []
  for (const mark of marks) {
    if (marks.filter(({ type }) => type === mark.type).length > 1) return undefined
    const element = markElement(mark)
    if (element === undefined) return undefined
    openers.push(element.opener)
    closers.unshift(element.closer)
  }
  return `${openers.join('')}${escapeHtml(node.text)}${closers.join('')}`
}

function markElement(mark: AdfMark): { closer: string; opener: string } | undefined {
  const { type } = mark
  if (elementMarks.includes(type)) return mark.attrs === undefined ? { closer: `</${type}>`, opener: `<${type}>` } : undefined
  if (type !== 'link' || Object.keys(nodeAttrs(mark)).some((key) => key !== 'href' && key !== 'title')) return undefined
  const target = linkTarget(nodeAttrs(mark))
  const opener = target === undefined ? undefined : anchorOpener(target)
  return opener === undefined ? undefined : { closer: '</a>', opener }
}

function anchorOpener({ href, title }: LinkTarget): string | undefined {
  if (!writableUrl(href) || title?.includes('\0') === true) return undefined
  return `<a href="${escapeHtml(href)}"${title === undefined ? '' : ` title="${escapeHtml(title)}"`}>`
}

// HTML holds no null character, and no element holds empty text apart from no text.
function writableText(node: AdfNode): node is AdfNode & { text: string } {
  return typeof node.text === 'string' && node.text !== '' && !node.text.includes('\0')
}

// cmark's dangerous-URL rule: its schemes and its safe image data. A browser drops tabs and line breaks and a leading control or space before it reads the scheme, so the check does too.
function writableUrl(url: string): boolean {
  if (url.includes('\0')) return false
  const scheme = url.replace(/[\t\n\r]/g, '').replace(/^[\u0001- ]+/, '').toLowerCase()
  if (/^(?:file|javascript|vbscript):/.test(scheme)) return false
  return !scheme.startsWith('data:') || /^data:image\/(?:gif|jpeg|png|webp)/.test(scheme)
}

function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting - depth)
  return json.ok ? success(carryElement('div', json.value.json, carriedText(node))) : json
}

function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  return json.ok ? success(carryElement('span', json.value.json, carriedText(node))) : json
}

function carryElement(tag: string, json: string, text: string): string {
  return `<${tag} class="adf-carry" data-adf="${escapeHtml(json)}">${escapeHtml(text.replaceAll('\0', ''))}</${tag}>`
}

// The text a carried node shows, a line break between its blocks and for each hard break; a reader of the element reads the JSON alone.
function carriedText(node: AdfNode): string {
  let text = ''
  const pending: AdfNode[] = [node]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (text !== '' && (next.type === 'hardBreak' || blockNodeModel(next.type) !== undefined)) text += '\n'
    text += next.text ?? shownText(next) ?? ''
    for (const child of [...nodeContent(next)].reverse()) pending.push(child)
  }
  return text
}

// A carriage return is a character reference, since an HTML parser reads a raw one as a line feed.
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('\r', '&#13;')
}

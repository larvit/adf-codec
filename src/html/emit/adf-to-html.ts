import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { anchorOpener, inlineHtml, writableText } from './inline.ts'
import { carriedBlock, carryElement } from './carry-element.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { holdsOnlyAttributes, isUnmarkedSpellableText, nodeAttrs, nodeContent, writableContent } from '../../adf/document.ts'
import { largestNesting } from '../../nesting.ts'
import { longestOutput, tooLong, withinEngineLimits } from '../../length-bound.ts'
import { htmlValue, optionalAttribute } from './escaping.ts'
import { plainImage } from '../../adf/plain-image.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'

// depth: the nesting level of the block list holding the node, as `largestNesting` counts it; inList: the node is a list's item.
type Block = { depth: number; inList: boolean; node: AdfNode; path: ConvertErrorPath }
type Container = { attributes: string; isList: boolean; tag: string }
type Pending = Block | string

export function adfToHtml(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => writeHtml(document))
}

// A stack rather than recursion, since each level would cost several frames: a block returns its pieces in document order, and only this loop pushes them.
function writeHtml(document: AdfDocument): Result<string> {
  const content = writableContent(document)
  if (!content.ok) return content
  if (content.value === undefined) return success(`${carryElement('div', serializeCanonicalJson(document, 'compact'), '')}\n`)
  const pending: Pending[] = content.value.length === 0 ? [] : [...blockPieces(content.value, [], 0, false), '\n'].reverse()
  let html = ''
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (typeof next === 'string') {
      // Held to the bound as it grows, so every engine stops at the block passing it.
      if (html.length + next.length > longestOutput) return tooLong()
      html += next
      continue
    }
    const pieces = writeBlock(next)
    if (!pieces.ok) return pieces
    for (const piece of pieces.value.reverse()) pending.push(piece)
  }
  return success(html)
}

function blockPieces(nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number, inList: boolean): Pending[] {
  const pieces: Pending[] = []
  for (const [index, node] of nodes.entries()) {
    if (index > 0) pieces.push('\n')
    pieces.push({ depth, inList, node, path: [...path, 'content', index] })
  }
  return pieces
}

function writeBlock(block: Block): Result<Pending[]> {
  const { depth, node, path } = block
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, path)
  if (block.inList) return writeItem(block)
  const container = containerElement(node)
  if (container !== undefined) return success(containerPieces(block, container))
  const html = tryLeafBlock(node, path) ?? carriedBlock(node, path, depth)
  return html.ok ? success([html.value]) : html
}

// `undefined` where the node is no container, or it or a list's item holds what the elements cannot, so the whole node rides the carry.
function containerElement(node: AdfNode): Container | undefined {
  if (node.type === 'blockquote') return holdsOnlyAttributes(node, []) ? { attributes: '', isList: false, tag: 'blockquote' } : undefined
  if (node.type === 'bulletList') return holdsOnlyAttributes(node, []) && listItemsWritable(node) ? { attributes: '', isList: true, tag: 'ul' } : undefined
  if (node.type !== 'orderedList' || !holdsOnlyAttributes(node, ['order']) || !listItemsWritable(node)) return undefined
  const order = nodeAttrs(node)['order']
  if (order === undefined) return { attributes: '', isList: true, tag: 'ol' }
  return typeof order === 'number' && Number.isSafeInteger(order) && !Object.is(order, -0) ? { attributes: ` start="${order}"`, isList: true, tag: 'ol' } : undefined
}

function listItemsWritable(list: AdfNode): boolean {
  return nodeContent(list).every((item) => item.type === 'listItem' && holdsOnlyAttributes(item, []))
}

function containerPieces({ depth, node, path }: Block, { attributes, isList, tag }: Container): Pending[] {
  if (node.content === undefined) return [`<${tag}${attributes}></${tag}>`]
  return [`<${tag}${attributes}>\n`, ...blockPieces(node.content, path, depth + 1, isList), `\n</${tag}>`]
}

// An item's blocks sit at its own level, one below its list, as a markdown list's do; its first paragraph stands bare where it holds content, panel pick, docs/decisions.md §The HTML dialect.
function writeItem({ depth, node, path }: Block): Result<Pending[]> {
  if (node.content === undefined) return success(['<li></li>'])
  const blocks = blockPieces(node.content, path, depth, false)
  const [first] = node.content
  if (first === undefined || first.type !== 'paragraph' || !holdsOnlyAttributes(first, []) || nodeContent(first).length === 0) return success(['<li>\n', ...blocks, '\n</li>'])
  const bare = inlineHtml(nodeContent(first), [...path, 'content', 0])
  if (!bare.ok) return bare
  // The bare paragraph's inline content stands in for its block.
  return success(blocks.length === 1 ? [`<li>${bare.value}</li>`] : [`<li>${bare.value}`, ...blocks.slice(1), '\n</li>'])
}

function tryLeafBlock(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  if (node.type === 'paragraph' && holdsOnlyAttributes(node, [])) return inlineElement('p', nodeContent(node), path)
  if (node.type === 'heading' && holdsOnlyAttributes(node, ['level'])) {
    const level = nodeAttrs(node)['level']
    if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 6) return inlineElement(`h${level}`, nodeContent(node), path)
  }
  const html = tryCodeBlock(node) ?? tryImage(node) ?? (node.type === 'rule' && holdsOnlyAttributes(node, []) && nodeContent(node).length === 0 ? '<hr>' : undefined)
  return html === undefined ? undefined : success(html)
}

function inlineElement(tag: string, nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
  const inline = inlineHtml(nodes, path)
  return inline.ok ? success(`<${tag}>${inline.value}</${tag}>`) : inline
}

// A class holds the language as one token, so a language holding whitespace rides the carry.
function tryCodeBlock(node: AdfNode): string | undefined {
  if (node.type !== 'codeBlock' || !holdsOnlyAttributes(node, ['language'])) return undefined
  const language = nodeAttrs(node)['language']
  if (language !== undefined && (typeof language !== 'string' || !/^[^\t\n\f\r ]+$/.test(language))) return undefined
  const className = optionalAttribute('class', language === undefined ? undefined : `language-${language}`)
  if (className === undefined) return undefined
  if (node.content === undefined) return `<pre><code${className}></code></pre>`
  const [only, ...others] = node.content
  const code = only === undefined || others.length > 0 || !isUnmarkedSpellableText(only) ? undefined : writableText(only.text)
  return code === undefined ? undefined : `<pre><code${className}>${code}</code></pre>`
}

function tryImage(node: AdfNode): string | undefined {
  const image = node.type === 'mediaSingle' ? plainImage(node) : undefined
  if (image === undefined) return undefined
  const src = htmlValue(image.url)
  const alt = optionalAttribute('alt', image.alt)
  if (src === undefined || alt === undefined) return undefined
  const element = `<img src="${src}"${alt}>`
  if (image.link === undefined) return `<p>${element}</p>`
  const anchor = anchorOpener(image.link)
  return anchor === undefined ? undefined : `<p>${anchor}${element}</a></p>`
}

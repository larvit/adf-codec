import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { anchorOpener, optionalAttribute, writableValue } from './escaping.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { carriedBlock, carryElement } from './carry-element.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { holdsOnlyAttributes, isUnmarkedSpellableText, nodeAttrs, nodeContent, writableContent } from '../../adf/document.ts'
import { inlineHtml, writableText } from './inline.ts'
import { largestNesting } from '../../nesting.ts'
import { longestOutput, tooLong, withinEngineLimits } from '../../length-bound.ts'
import { plainImage } from '../../adf/plain-image.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

// depth: the nesting level of the block list holding the node, as `largestNesting` counts it; an item's attributes are its element's, checked by its list.
type Block = { depth: number; kind: 'block'; node: AdfNode; path: ConvertErrorPath }
type Item = { attributes: string; depth: number; kind: 'item'; node: AdfNode; path: ConvertErrorPath }
type Pending = Block | Item | string

export function adfToHtml(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => writeHtml(document))
}

// A stack rather than recursion, since each level would cost several frames: a block returns its pieces in document order, and only this loop pushes them.
function writeHtml(document: AdfDocument): Result<string> {
  const content = writableContent(document)
  if (!content.ok) return content
  if (content.value === undefined) return success(`${carryElement('div', serializeCanonicalJson(document, 'compact'), '')}\n`)
  const pending: Pending[] = content.value.length === 0 ? [] : [...blockPieces(content.value, [], 0), '\n'].reverse()
  let html = ''
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (typeof next === 'string') {
      // Held to the bound as it grows, so every engine stops at the block passing it.
      if (html.length + next.length > longestOutput) return tooLong()
      html += next
      continue
    }
    if (next.depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, next.path)
    const pieces = next.kind === 'item' ? writeItem(next) : writeBlock(next)
    if (!pieces.ok) return pieces
    for (const piece of pieces.value.reverse()) pending.push(piece)
  }
  return success(html)
}

function blockPieces(nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number): Pending[] {
  const pieces: Pending[] = []
  for (const [index, node] of nodes.entries()) {
    if (index > 0) pieces.push('\n')
    pieces.push({ depth, kind: 'block', node, path: [...path, 'content', index] })
  }
  return pieces
}

function writeBlock(block: Block): Result<Pending[]> {
  const { depth, node, path } = block
  const container = node.type === 'blockquote' ? quotePieces(block) : listPieces(block)
  if (container !== undefined) return success(container)
  const html = tryLeafBlock(node, path) ?? carriedBlock(node, path, depth)
  return html.ok ? success([html.value]) : html
}

// The attributes a node holds besides those its element writes, as `data-*` attributes sorted by key, a value that is no string as JSON; `undefined` where the node holds what no attribute writes: a mark, text, an empty key, or an attribute its type does not hold as that kind (docs/decisions.md §The HTML dialect).
function dataAttributes(node: AdfNode, written: readonly string[]): string | undefined {
  const model = blockNodeModel(node.type)
  if (model === undefined || !holdsOnlyAttributes(node, Object.keys(model.attributes))) return undefined
  const pairs = vocabularyPairs(nodeAttrs(node), model.attributes, written)
  if (pairs === undefined) return undefined
  let attributes = ''
  for (const { key, kind, value } of pairs.sort((left, right) => (left.key < right.key ? -1 : 1))) {
    const attribute = optionalAttribute(`data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, kind === 'string' ? value : serializeCanonicalJson(value, 'compact'))
    if (attribute === undefined) return undefined
    attributes += attribute
  }
  return attributes
}

function quotePieces({ depth, node, path }: Block): Pending[] | undefined {
  const attributes = dataAttributes(node, [])
  return attributes === undefined ? undefined : containerPieces('blockquote', attributes, node.content === undefined ? undefined : blockPieces(node.content, path, depth + 1))
}

// `undefined` where the list, or one of its items, holds what the elements cannot, so the whole list rides the carry.
function listPieces({ depth, node, path }: Block): Pending[] | undefined {
  const element = listElement(node)
  if (element === undefined) return undefined
  const items: Pending[] = []
  // The items' blocks sit one level below the list, as a markdown list's do.
  for (const [index, item] of nodeContent(node).entries()) {
    const attributes = item.type === 'listItem' ? dataAttributes(item, []) : undefined
    if (attributes === undefined) return undefined
    if (index > 0) items.push('\n')
    items.push({ attributes, depth: depth + 1, kind: 'item', node: item, path: [...path, 'content', index] })
  }
  return containerPieces(element.tag, element.attributes, node.content === undefined ? undefined : items)
}

function listElement(node: AdfNode): { attributes: string; tag: string } | undefined {
  if (node.type === 'bulletList') {
    const attributes = dataAttributes(node, [])
    return attributes === undefined ? undefined : { attributes, tag: 'ul' }
  }
  if (node.type !== 'orderedList') return undefined
  const order = nodeAttrs(node)['order']
  if (order !== undefined && (typeof order !== 'number' || !Number.isSafeInteger(order) || Object.is(order, -0))) return undefined
  const attributes = dataAttributes(node, ['order'])
  return attributes === undefined ? undefined : { attributes: `${order === undefined ? '' : ` start="${order}"`}${attributes}`, tag: 'ol' }
}

// `children` undefined where the node holds no `content` key, so its element holds nothing.
function containerPieces(tag: string, attributes: string, children: Pending[] | undefined): Pending[] {
  if (children === undefined) return [`<${tag}${attributes}></${tag}>`]
  return [`<${tag}${attributes}>\n`, ...children, `\n</${tag}>`]
}

// An item's blocks sit at its own level, one below its list; its first paragraph stands on the item's line, panel picks, docs/decisions.md §The HTML dialect.
function writeItem({ attributes, depth, node, path }: Item): Result<Pending[]> {
  if (node.content === undefined) return success([`<li${attributes}></li>`])
  const blocks = blockPieces(node.content, path, depth)
  const [first] = node.content
  const line = first?.type === 'paragraph' ? tryFirstParagraph(first, [...path, 'content', 0]) : undefined
  if (line === undefined) return success([`<li${attributes}>\n`, ...blocks, '\n</li>'])
  if (!line.ok) return line
  // The first paragraph, written on the item's line, stands in for its block.
  return success(blocks.length === 1 ? [`<li${attributes}>${line.value}</li>`] : [`<li${attributes}>${line.value}`, ...blocks.slice(1), '\n</li>'])
}

// `undefined` where the paragraph takes a line of its own: where it rides the carry, or holds neither content nor an attribute, which bare would read back as no paragraph.
function tryFirstParagraph(paragraph: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  const attributes = dataAttributes(paragraph, [])
  if (attributes !== '') return inlineElement('p', attributes, nodeContent(paragraph), path)
  return nodeContent(paragraph).length === 0 ? undefined : inlineHtml(nodeContent(paragraph), path)
}

function tryLeafBlock(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  if (node.type === 'paragraph') return inlineElement('p', dataAttributes(node, []), nodeContent(node), path)
  if (node.type === 'heading') {
    const level = nodeAttrs(node)['level']
    if (typeof level === 'number' && Number.isInteger(level) && level >= 1 && level <= 6) return inlineElement(`h${level}`, dataAttributes(node, ['level']), nodeContent(node), path)
  }
  const html = tryCodeBlock(node) ?? tryImage(node) ?? tryRule(node)
  return html === undefined ? undefined : success(html)
}

// `undefined` where the attributes are, so the node rides the carry.
function inlineElement(tag: string, attributes: string | undefined, nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> | undefined {
  if (attributes === undefined) return undefined
  const inline = inlineHtml(nodes, path)
  return inline.ok ? success(`<${tag}${attributes}>${inline.value}</${tag}>`) : inline
}

// A class holds the language as one token, so a language holding whitespace rides the carry.
function tryCodeBlock(node: AdfNode): string | undefined {
  if (node.type !== 'codeBlock') return undefined
  const attributes = dataAttributes(node, ['language'])
  const language = nodeAttrs(node)['language']
  if (attributes === undefined || (language !== undefined && (typeof language !== 'string' || !/^[^\t\n\f\r ]+$/.test(language)))) return undefined
  const className = optionalAttribute('class', language === undefined ? undefined : `language-${language}`)
  if (className === undefined) return undefined
  if (node.content === undefined) return `<pre${attributes}><code${className}></code></pre>`
  const [only, ...others] = node.content
  const code = only === undefined || others.length > 0 || !isUnmarkedSpellableText(only) ? undefined : writableText(only.text)
  return code === undefined ? undefined : `<pre${attributes}><code${className}>${code}</code></pre>`
}

function tryImage(node: AdfNode): string | undefined {
  const image = node.type === 'mediaSingle' ? plainImage(node) : undefined
  if (image === undefined) return undefined
  const src = writableValue(image.url)
  const alt = optionalAttribute('alt', image.alt)
  if (src === undefined || alt === undefined) return undefined
  const element = `<img src="${src}"${alt}>`
  if (image.link === undefined) return `<p>${element}</p>`
  const anchor = anchorOpener(image.link)
  return anchor === undefined ? undefined : `<p>${anchor}${element}</a></p>`
}

function tryRule(node: AdfNode): string | undefined {
  const attributes = node.type === 'rule' && nodeContent(node).length === 0 ? dataAttributes(node, []) : undefined
  return attributes === undefined ? undefined : `<hr${attributes}>`
}

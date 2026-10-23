import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { anchorOpener, languageClass, optionalAttribute, writableValue } from './escaping.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { carriedBlock, carryElement } from './carry-element.ts'
import { dataAttributes } from './data-attributes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { inlineHtml, writableText } from './inline.ts'
import { isUnmarkedSpellableText, nodeAttrs, nodeContent, writableContent } from '../../adf/document.ts'
import { largestNesting } from '../../nesting.ts'
import { longestOutput, tooLong, withinEngineLimits } from '../../length-bound.ts'
import { plainImage } from '../../adf/plain-image.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'

// depth: the nesting level of the block list holding the node, as `largestNesting` counts it; `attributes`: the `<li>`'s `data-*` attributes, built when its list checked the item.
type Block = { depth: number; kind: 'block'; node: AdfNode; path: ConvertErrorPath }
type Item = { attributes: string; depth: number; kind: 'item'; node: AdfNode; path: ConvertErrorPath }
type Pending = Block | Item | string

const headingLevels: readonly unknown[] = [1, 2, 3, 4, 5, 6]

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

function quotePieces({ depth, node, path }: Block): Pending[] | undefined {
  const attributes = dataAttributes(node, blockNodes.blockquote.attributes, [])
  return attributes === undefined ? undefined : containerPieces('blockquote', attributes, node.content === undefined ? undefined : blockPieces(node.content, path, depth + 1))
}

// `undefined` where the list, or one of its items, holds what the elements cannot, so the whole list rides the carry.
function listPieces({ depth, node, path }: Block): Pending[] | undefined {
  const element = listElement(node)
  if (element === undefined) return undefined
  const items: Pending[] = []
  // The items' blocks sit one level below the list, as a markdown list's do.
  for (const [index, item] of nodeContent(node).entries()) {
    const attributes = item.type === 'listItem' ? dataAttributes(item, blockNodes.listItem.attributes, []) : undefined
    if (attributes === undefined) return undefined
    if (index > 0) items.push('\n')
    items.push({ attributes, depth: depth + 1, kind: 'item', node: item, path: [...path, 'content', index] })
  }
  return containerPieces(element.tag, element.attributes, node.content === undefined ? undefined : items)
}

function listElement(node: AdfNode): { attributes: string; tag: string } | undefined {
  if (node.type === 'bulletList') {
    const attributes = dataAttributes(node, blockNodes.bulletList.attributes, [])
    return attributes === undefined ? undefined : { attributes, tag: 'ul' }
  }
  if (node.type !== 'orderedList') return undefined
  const order = nodeAttrs(node)['order']
  if (order !== undefined && (!Number.isSafeInteger(order) || Object.is(order, -0))) return undefined
  const attributes = dataAttributes(node, blockNodes.orderedList.attributes, ['order'])
  return attributes === undefined ? undefined : { attributes: `${order === undefined ? '' : ` start="${order}"`}${attributes}`, tag: 'ol' }
}

// `children` undefined where the node holds no `content` key, so its element holds nothing.
function containerPieces(tag: string, attributes: string, children: Pending[] | undefined): Pending[] {
  if (children === undefined) return [`<${tag}${attributes}></${tag}>`]
  return [`<${tag}${attributes}>\n`, ...children, `\n</${tag}>`]
}

// An item's first paragraph stands on the item's line, as the writer panels picked (docs/decisions.md §The HTML dialect).
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

// `undefined` where the paragraph takes a line of its own: where it rides the carry, or holds neither content nor an attribute: written bare, it would read back as no paragraph.
function tryFirstParagraph(paragraph: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  const attributes = dataAttributes(paragraph, blockNodes.paragraph.attributes, [])
  if (attributes !== '') return inlineElement('p', attributes, nodeContent(paragraph), path)
  return nodeContent(paragraph).length === 0 ? undefined : inlineHtml(nodeContent(paragraph), path)
}

function tryLeafBlock(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  if (node.type === 'paragraph') return inlineElement('p', dataAttributes(node, blockNodes.paragraph.attributes, []), nodeContent(node), path)
  const level = nodeAttrs(node)['level']
  if (node.type === 'heading' && headingLevels.includes(level)) return inlineElement(`h${level}`, dataAttributes(node, blockNodes.heading.attributes, ['level']), nodeContent(node), path)
  const html = tryCodeBlock(node) ?? tryImage(node) ?? tryRule(node)
  return html === undefined ? undefined : success(html)
}

// `undefined` where `attributes` is undefined, so the node rides the carry.
function inlineElement(tag: string, attributes: string | undefined, nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> | undefined {
  if (attributes === undefined) return undefined
  const inline = inlineHtml(nodes, path)
  return inline.ok ? success(`<${tag}${attributes}>${inline.value}</${tag}>`) : inline
}

function tryCodeBlock(node: AdfNode): string | undefined {
  if (node.type !== 'codeBlock') return undefined
  const attributes = dataAttributes(node, blockNodes.codeBlock.attributes, ['language'])
  const className = languageClass(nodeAttrs(node)['language'])
  if (attributes === undefined || className === undefined) return undefined
  if (node.content === undefined) return `<pre${attributes}><code${className}></code></pre>`
  const [only, ...others] = node.content
  const code = only === undefined || others.length > 0 || !isUnmarkedSpellableText(only) ? undefined : writableText(only.text)
  return code === undefined ? undefined : `<pre${attributes}><code${className}>${code}</code></pre>`
}

function tryImage(node: AdfNode): string | undefined {
  const image = plainImage(node)
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
  const attributes = node.type === 'rule' && nodeContent(node).length === 0 ? dataAttributes(node, blockNodes.rule.attributes, []) : undefined
  return attributes === undefined ? undefined : `<hr${attributes}>`
}

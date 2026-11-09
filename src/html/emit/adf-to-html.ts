import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { anchorOpener } from '../anchor-element.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { carriedBlock, carryElement } from './carry-element.ts'
import { carryContent } from '../carry-content.ts'
import { cellAttributes, isHeaderRow } from '../cell-element.ts'
import { containerElements, headingElement, listStart } from '../block-elements.ts'
import { dataAttributes } from '../data-attributes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { firstParagraphForm } from '../first-paragraph.ts'
import { imageElement } from '../image-element.ts'
import { inlineHtml, writableText } from './inline.ts'
import { isUnmarkedSpellableText, nodeAttrs, nodeContent, readAdfDocument, writableContent } from '../../adf/document.ts'
import { languageClass } from '../language-class.ts'
import { largestNesting } from '../../nesting.ts'
import { longestOutput, tooLong, withinEngineLimits } from '../../length-bound.ts'
import { plainImage } from '../../adf/plain-image.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'

// depth: the nesting level of the block list holding the node, as `largestNesting` counts it; `attributes`: the `<li>`'s, `<td>`'s or `<th>`'s, built when its list or table checked it.
type Block = { depth: number; kind: 'block'; node: AdfNode; path: ConvertErrorPath }
type Item = { attributes: string; depth: number; kind: 'item'; node: AdfNode; path: ConvertErrorPath; tag: string }
type Row = { depth: number; kind: 'row'; path: ConvertErrorPath; pieces: Pending[] }
type Pending = Block | Item | Row | string

export function adfToHtml(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => {
    const read = readAdfDocument(document)
    return read.ok ? writeHtml(read.value) : read
  })
}

// A stack rather than recursion, since each level would cost several frames: a block returns its pieces in document order, and only this loop pushes them.
function writeHtml(document: AdfDocument): Result<string> {
  const content = writableContent(document)
  if (!content.ok) return content
  if (content.value === undefined) return success(`${carryElement('div', serializeCanonicalJson(document, 'compact'), carryContent(document, 'div'))}\n`)
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
    const pieces = next.kind === 'row' ? success(next.pieces) : next.kind === 'item' ? writeItem(next) : writeBlock(next)
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
  const container = node.type === 'blockquote' ? quotePieces(block) : node.type === 'table' ? tablePieces(block) : listPieces(block)
  if (container !== undefined) return success(container)
  const html = tryLeafBlock(node, path) ?? carriedBlock(node, path, depth)
  return html.ok ? success([html.value]) : html
}

function quotePieces({ depth, node, path }: Block): Pending[] | undefined {
  const attributes = dataAttributes(node, blockNodes.blockquote.attributes, [])
  return attributes === undefined ? undefined : containerPieces(containerElements.blockquote, attributes, node.content === undefined ? undefined : blockPieces(node.content, path, depth + 1))
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
    items.push({ attributes, depth: depth + 1, kind: 'item', node: item, path: [...path, 'content', index], tag: 'li' })
  }
  return containerPieces(element.tag, element.attributes, node.content === undefined ? undefined : items)
}

// `undefined` where the table, a row or a cell holds what the elements cannot, so the whole table rides the carry.
function tablePieces({ depth, node, path }: Block): Pending[] | undefined {
  const attributes = dataAttributes(node, blockNodes.table.attributes, [])
  if (attributes === undefined) return undefined
  const rows: Row[] = []
  for (const [index, held] of nodeContent(node).entries()) {
    const rowPath = [...path, 'content', index]
    const pieces = held.type === 'tableRow' ? rowPieces(held, rowPath, depth + 2) : undefined
    if (pieces === undefined) return undefined
    rows.push({ depth: depth + 1, kind: 'row', path: rowPath, pieces })
  }
  return containerPieces('table', attributes, node.content === undefined ? undefined : sectionPieces(rows, isHeaderRow(nodeContent(node)[0] ?? {})))
}

function rowPieces(row: AdfNode, path: ConvertErrorPath, depth: number): Pending[] | undefined {
  const attributes = dataAttributes(row, blockNodes.tableRow.attributes, [])
  if (attributes === undefined) return undefined
  const cells: Pending[] = [`<tr${attributes}>`]
  for (const [index, cell] of nodeContent(row).entries()) {
    const tag = cellTag(cell)
    const held = tag === undefined ? undefined : cellAttributes(cell)
    if (tag === undefined || held === undefined) return undefined
    cells.push({ attributes: held, depth, kind: 'item', node: cell, path: [...path, 'content', index], tag })
  }
  cells.push('</tr>')
  return cells
}

function cellTag({ type }: AdfNode): string | undefined {
  if (type === 'tableCell') return 'td'
  return type === 'tableHeader' ? 'th' : undefined
}

function sectionPieces(rows: readonly Row[], headed: boolean): Pending[] {
  const body = headed ? rows.slice(1) : rows
  const head = headed ? ['<thead>\n', ...rows.slice(0, 1), '\n</thead>'] : []
  const parted = body.flatMap((row, index) => (index > 0 ? ['\n', row] : [row]))
  return [...head, ...(headed && parted.length > 0 ? ['\n'] : []), ...(parted.length > 0 ? ['<tbody>\n', ...parted, '\n</tbody>'] : [])]
}

function listElement(node: AdfNode): { attributes: string; tag: string } | undefined {
  if (node.type === 'bulletList') {
    const attributes = dataAttributes(node, blockNodes.bulletList.attributes, [])
    return attributes === undefined ? undefined : { attributes, tag: containerElements.bulletList }
  }
  if (node.type !== 'orderedList') return undefined
  const start = listStart(nodeAttrs(node)['order'])
  const attributes = dataAttributes(node, blockNodes.orderedList.attributes, ['order'])
  return start === undefined || attributes === undefined ? undefined : { attributes: `${start}${attributes}`, tag: containerElements.orderedList }
}

// `children` undefined where the node holds no `content` key, so its element holds nothing.
function containerPieces(tag: string, attributes: string, children: Pending[] | undefined): Pending[] {
  if (children === undefined) return [`<${tag}${attributes}></${tag}>`]
  return [`<${tag}${attributes}>\n`, ...children, `\n</${tag}>`]
}

function writeItem({ attributes, depth, node, path, tag }: Item): Result<Pending[]> {
  if (node.content === undefined) return success([`<${tag}${attributes}></${tag}>`])
  const blocks = blockPieces(node.content, path, depth)
  const [first] = node.content
  const line = first?.type === 'paragraph' ? tryFirstParagraph(first, [...path, 'content', 0]) : undefined
  if (line === undefined) return success([`<${tag}${attributes}>\n`, ...blocks, `\n</${tag}>`])
  if (!line.ok) return line
  // The first paragraph, written on the item's line, stands in for its block.
  return success(blocks.length === 1 ? [`<${tag}${attributes}>${line.value}</${tag}>`] : [`<${tag}${attributes}>${line.value}`, ...blocks.slice(1), `\n</${tag}>`])
}

// `undefined` where the paragraph takes a line of its own.
function tryFirstParagraph(paragraph: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  const form = firstParagraphForm(paragraph)
  if (form === 'block') return undefined
  return form === 'bare' ? inlineHtml(nodeContent(paragraph), path) : tryLeafBlock(paragraph, path)
}

function tryLeafBlock(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  if (node.type === 'paragraph') return inlineElement('p', dataAttributes(node, blockNodes.paragraph.attributes, []), nodeContent(node), path)
  const heading = node.type === 'heading' ? headingElement(nodeAttrs(node)['level']) : undefined
  if (heading !== undefined) return inlineElement(heading, dataAttributes(node, blockNodes.heading.attributes, ['level']), nodeContent(node), path)
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
  const element = image === undefined ? undefined : imageElement(image)
  if (image === undefined || element === undefined) return undefined
  if (image.link === undefined) return `<p>${element}</p>`
  const anchor = anchorOpener(image.link)
  return anchor === undefined ? undefined : `<p>${anchor}${element}</a></p>`
}

function tryRule(node: AdfNode): string | undefined {
  const attributes = node.type === 'rule' ? dataAttributes(node, blockNodes.rule.attributes, []) : undefined
  return attributes === undefined ? undefined : `<hr${attributes}>`
}

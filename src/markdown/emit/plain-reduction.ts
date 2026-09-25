import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { adfDocumentFault, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { commonMarkSpelling, type SpellingMemo } from './adf-to-markdown.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { inlineLeaves, isBlockNodeType, reduceInline, writableHref } from './plain-inline.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'

// depth: the level the node reduced stands at, counted as the emitter counts it.
type Reduction = { depth: number; memo: SpellingMemo; path: ConvertErrorPath }

type BlockReducer = (node: AdfNode, reduction: Reduction) => Result<AdfNode[]>

type PlacedCell = { colspan: number; paragraph: AdfNode; rowspan: number }

type Placed = { index: number; loose: AdfNode[] } | { index: number; loose?: undefined; node: AdfNode }

const alertWords: Readonly<Record<string, string>> = {
  error: 'CAUTION',
  info: 'NOTE',
  note: 'IMPORTANT',
  success: 'TIP',
  tip: 'TIP',
  warning: 'WARNING',
}

const blockReducers: Readonly<Record<string, BlockReducer>> = {
  blockCard: paragraphOfNode,
  blockquote: (node, reduction) => quoted(success([]), node, reduction),
  bulletList: reduceList,
  caption: (node, reduction) => paragraphOf(nodeContent(node), reduction),
  codeBlock: reduceCodeBlock,
  decisionList: (node, reduction) => reduceItems(node, reduction, (child, at) => (child.type === 'decisionItem' ? paragraphOf(nodeContent(child), at) : reduceStanding(child, at))),
  embedCard: paragraphOfNode,
  expand: reduceExpand,
  extension: paragraphOfNode,
  heading: reduceHeading,
  media: reduceMedia,
  mediaSingle: (node, reduction) => concatenated(nodeContent(node).map((child, index) => reduceStanding(child, childReduction(reduction, index)))),
  nestedExpand: reduceExpand,
  orderedList: reduceList,
  panel: (node, reduction) => quoted(success([paragraph([text(`[!${alertWord(nodeAttrs(node)['panelType'])}]`)])]), node, reduction),
  paragraph: (node, reduction) => paragraphOf(nodeContent(node), reduction),
  rule: () => success([{ type: 'rule' }]),
  syncBlock: paragraphOfNode,
  table: reduceTable,
  taskList: reduceTaskList,
}

export function reduceToPlain(document: AdfDocument): Result<AdfDocument> {
  const fault = adfDocumentFault(document)
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  const blocks = reduceBlocks(nodeContent(document), { depth: 0, memo: new Map(), path: [] })
  return blocks.ok ? success({ content: blocks.value, type: 'doc', version: 1 }) : blocks
}

function reduceBlocks(nodes: readonly AdfNode[], reduction: Reduction): Result<AdfNode[]> {
  const placed: Placed[] = []
  for (const [index, node] of nodes.entries()) {
    const previous = placed[placed.length - 1]
    if (!standsInline(node)) placed.push({ index, node })
    else if (previous?.loose !== undefined) previous.loose.push(node)
    else placed.push({ index, loose: [node] })
  }
  const blocks = concatenated(
    placed.map((entry) => {
      const at = { ...reduction, path: [...reduction.path, 'content', entry.index] }
      return entry.loose === undefined ? reduceNode(entry.node, at) : paragraphOf(entry.loose, reduction)
    }),
  )
  return blocks.ok ? plainSequence(blocks.value, reduction) : blocks
}

function reduceNode(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  if (reduction.depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, reduction.path)
  const reducer = Object.hasOwn(blockReducers, node.type) ? blockReducers[node.type] : undefined
  return (reducer ?? reduceBody)(node, reduction)
}

function reduceStanding(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  return standsInline(node) ? paragraphOf([node], reduction) : reduceNode(node, reduction)
}

function standsInline(node: AdfNode): boolean {
  if (node.type === 'text' || inlineNodeModel(node.type) !== undefined) return true
  return !isBlockNodeType(node.type) && node.content === undefined
}

function reduceBody(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  if (blockNodeModel(node.type)?.contentModel === 'inline') return paragraphOf(nodeContent(node), reduction)
  return reduceBlocks(nodeContent(node), { ...reduction, depth: reduction.depth + 1 })
}

function childReduction(reduction: Reduction, index: number): Reduction {
  return { ...reduction, depth: reduction.depth + 1, path: [...reduction.path, 'content', index] }
}

function concatenated(results: readonly Result<AdfNode[]>[]): Result<AdfNode[]> {
  const blocks: AdfNode[] = []
  for (const result of results) {
    if (!result.ok) return result
    for (const block of result.value) blocks.push(block)
  }
  return success(blocks)
}

// A list or a table still taking the directive form gives way to its blocks.
function plainSequence(blocks: readonly AdfNode[], reduction: Reduction): Result<AdfNode[]> {
  let sequence = mergedLists(blocks.filter((block) => block.type !== 'paragraph' || nodeContent(block).length > 0))
  for (let index = 0; index < sequence.length; index += 1) {
    const block = sequence[index]
    if (block === undefined || !['bulletList', 'orderedList', 'table'].includes(block.type)) continue
    if (commonMarkSpelling(block, reduction.path, reduction.depth, reduction.memo)?.ok === true) continue
    sequence = mergedLists([...sequence.slice(0, index), ...heldBlocks(block), ...sequence.slice(index + 1)])
    index = Math.max(-1, index - 2)
  }
  return success(sequence)
}

function heldBlocks(node: AdfNode): AdfNode[] {
  const blocks: AdfNode[] = []
  for (const child of nodeContent(node)) {
    const held = ['listItem', 'tableCell', 'tableHeader', 'tableRow'].includes(child.type) ? heldBlocks(child) : [child]
    for (const block of held) blocks.push(block)
  }
  return blocks
}

function mergedLists(blocks: readonly AdfNode[]): AdfNode[] {
  const merged: AdfNode[] = []
  for (const block of blocks) {
    const previous = merged[merged.length - 1]
    if (previous !== undefined && previous.type === block.type && (block.type === 'bulletList' || block.type === 'orderedList')) {
      merged[merged.length - 1] = { ...previous, content: [...nodeContent(previous), ...nodeContent(block)] }
    } else {
      merged.push(block)
    }
  }
  return merged
}

function paragraph(content: readonly AdfNode[]): AdfNode {
  return { content: [...content], type: 'paragraph' }
}

function text(value: string): AdfNode {
  return { text: value, type: 'text' }
}

function listOf(items: readonly AdfNode[], type: string): AdfNode[] {
  return items.length === 0 ? [] : [{ content: [...items], type }]
}

function paragraphOf(nodes: readonly AdfNode[], reduction: Reduction): Result<AdfNode[]> {
  const content = reduceInline(nodes, 'paragraph', reduction.path, reduction.depth)
  return content.ok ? success(content.value.length === 0 ? [] : [paragraph(content.value)]) : content
}

function paragraphOfNode(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  return paragraphOf([node], reduction)
}

function quoted(head: Result<AdfNode[]>, node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const content = concatenated([head, reduceBlocks(nodeContent(node), { ...reduction, depth: reduction.depth + 1 })])
  return content.ok ? success([{ content: content.value, type: 'blockquote' }]) : content
}

function alertWord(panelType: unknown): string {
  const word = typeof panelType === 'string' && Object.hasOwn(alertWords, panelType) ? alertWords[panelType] : undefined
  return word ?? 'NOTE'
}

function reduceExpand(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const title = nodeAttrs(node)['title']
  const marker = typeof title === 'string' ? `[!NOTE]- ${title.replace(/^[ \t\n\r]+/, '')}` : '[!NOTE]-'
  return quoted(paragraphOf([text(marker)], { ...reduction, depth: reduction.depth + 1 }), node, reduction)
}

function reduceHeading(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const level = nodeAttrs(node)['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) return paragraphOf(nodeContent(node), reduction)
  const content = reduceInline(nodeContent(node), 'heading', reduction.path, reduction.depth)
  return content.ok ? success([{ attrs: { level }, content: content.value, type: 'heading' }]) : content
}

function reduceCodeBlock(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const leaves = inlineLeaves(nodeContent(node), 'paragraph', reduction.path, reduction.depth)
  if (!leaves.ok) return leaves
  const code = leaves.value.map((leaf) => leaf.text ?? '\n').join('')
  const slot = languageSlot(nodeAttrs(node)['language'])
  const block: AdfNode = { content: code === '' ? [] : [text(code)], type: 'codeBlock' }
  return success([slot.kind === 'fence' ? { ...block, attrs: { language: slot.info } } : block])
}

function reduceList(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const listed = reduceItems(node, reduction, (child, at) => (child.type === 'listItem' ? reduceBlocks(nodeContent(child), at) : reduceStanding(child, at)))
  if (!listed.ok || node.type !== 'orderedList') return listed
  const order = nodeAttrs(node)['order']
  const start = typeof order === 'number' && Number.isInteger(order) && order >= 0 ? order : 1
  return success(listed.value.map((list) => ({ ...list, attrs: { order: start } })))
}

function reduceItems(node: AdfNode, reduction: Reduction, itemBlocks: (child: AdfNode, at: Reduction) => Result<AdfNode[]>): Result<AdfNode[]> {
  const items = concatenated(nodeContent(node).map((child, index) => listItem(itemBlocks(child, childReduction(reduction, index)))))
  return items.ok ? success(listOf(items.value, node.type === 'orderedList' ? 'orderedList' : 'bulletList')) : items
}

function listItem(blocks: Result<AdfNode[]>): Result<AdfNode[]> {
  return blocks.ok ? success([itemOf(blocks.value)]) : blocks
}

// A list item holds no line of spaces alone, and a code line of them is what a reader does not see.
function itemOf(blocks: readonly AdfNode[]): AdfNode {
  const content = blocks.map((block) => (block.type === 'codeBlock' ? { ...block, content: nodeContent(block).map(blankedLines) } : block))
  return { content, type: 'listItem' }
}

function blankedLines(code: AdfNode): AdfNode {
  return code.text === undefined ? code : { ...code, text: code.text.replace(/^[ \t]+$/gm, '') }
}

function reduceTaskList(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const items: AdfNode[] = []
  for (const [index, child] of nodeContent(node).entries()) {
    const blocks = taskBlocks(child, childReduction(reduction, index))
    if (!blocks.ok) return blocks
    const previous = child.type === 'taskList' ? items.pop() : undefined
    items.push(itemOf(previous === undefined ? blocks.value : mergedLists([...nodeContent(previous), ...blocks.value])))
  }
  return success(listOf(items, 'bulletList'))
}

function taskBlocks(child: AdfNode, at: Reduction): Result<AdfNode[]> {
  const marker = nodeAttrs(child)['state'] === 'DONE' ? '[x]' : '[ ]'
  if (child.type === 'taskItem') {
    const content = reduceInline(nodeContent(child), 'paragraph', at.path, at.depth)
    return content.ok ? success([paragraph(content.value.length === 0 ? [text(marker)] : [text(`${marker} `), ...content.value])]) : content
  }
  if (child.type !== 'blockTaskItem') return reduceStanding(child, at)
  const blocks = reduceBlocks(nodeContent(child), at)
  if (!blocks.ok) return blocks
  const [first, ...rest] = blocks.value
  if (first?.type === 'paragraph') return success([paragraph([text(`${marker} `), ...nodeContent(first)]), ...rest])
  return success([paragraph([text(marker)]), ...blocks.value])
}

function reduceTable(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const rows: PlacedCell[][] = []
  for (const [rowIndex, row] of nodeContent(node).entries()) {
    const rowReduction = childReduction(reduction, rowIndex)
    const cells: PlacedCell[] = []
    for (const [cellIndex, cell] of (row.type === 'tableRow' ? nodeContent(row) : [row]).entries()) {
      const paragraph = cellParagraph(cell, childReduction(rowReduction, cellIndex))
      if (!paragraph.ok) return paragraph
      cells.push({ colspan: span(nodeAttrs(cell)['colspan']), paragraph: paragraph.value, rowspan: span(nodeAttrs(cell)['rowspan']) })
    }
    rows.push(cells)
  }
  const grid = spannedGrid(rows)
  const width = grid.reduce((widest, cells) => Math.max(widest, cells.length), 0)
  const tableRows = grid.map((cells, rowIndex) => ({
    content: Array.from({ length: width }, (_, column): AdfNode => ({ content: [cells[column] ?? { type: 'paragraph' }], type: rowIndex === 0 ? 'tableHeader' : 'tableCell' })),
    type: 'tableRow',
  }))
  return success(width === 0 ? [] : [{ content: tableRows, type: 'table' }])
}

function span(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 1 ? value : 1
}

// A span keeps its cell under its header by empty cells where it covered; they number no more than the table's cells.
function spannedGrid(rows: readonly PlacedCell[][]): (AdfNode | undefined)[][] {
  const grid: (AdfNode | undefined)[][] = rows.map(() => [])
  const covered = rows.map(() => new Set<number>())
  let padding = rows.reduce((count, cells) => count + cells.length, 0)
  for (const [rowIndex, cells] of rows.entries()) {
    let column = 0
    for (const cell of cells) {
      while (covered[rowIndex]?.has(column) === true) column += 1
      setCell(grid, rowIndex, column, cell.paragraph)
      for (let row = rowIndex; row < Math.min(rows.length, rowIndex + cell.rowspan) && padding > 0; row += 1) {
        for (let spanned = row === rowIndex ? 1 : 0; spanned < cell.colspan && padding > 0; spanned += 1) {
          covered[row]?.add(column + spanned)
          setCell(grid, row, column + spanned, { type: 'paragraph' })
          padding -= 1
        }
      }
      column += 1
    }
  }
  return grid
}

function setCell(grid: (AdfNode | undefined)[][], row: number, column: number, cell: AdfNode): void {
  const cells = grid[row]
  if (cells !== undefined && cells[column] === undefined) cells[column] = cell
}

function cellParagraph(cell: AdfNode, reduction: Reduction): Result<AdfNode> {
  const blocks = cell.type === 'tableCell' || cell.type === 'tableHeader' ? nodeContent(cell) : [cell]
  const content = reduceInline(blocks, 'table-cell', reduction.path, reduction.depth)
  return content.ok ? success(content.value.length === 0 ? { type: 'paragraph' } : paragraph(content.value)) : content
}

function reduceMedia(media: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const attrs = nodeAttrs(media)
  const url = attrs['url']
  if (attrs['type'] !== 'external' || typeof url !== 'string') return paragraphOfNode(media, reduction)
  const held = attrs['alt']
  const alt = typeof held === 'string' ? held.replace(/[\r\u0000]/g, '').replace(/\n/g, ' ').trim() : ''
  const external: AdfNode = { attrs: alt === '' ? { type: 'external', url: writableHref(url) } : { alt, type: 'external', url: writableHref(url) }, type: 'media' }
  const image: AdfNode = { attrs: { layout: 'center' }, content: [external], type: 'mediaSingle' }
  return success([image])
}

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { adfDocumentFault, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { commonMarkSpelling, largestListMarker, writeMarkdown, type SpellingMemo } from './adf-to-markdown.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { inlineLeaves, isBlockNodeType, oneLine, reduceInline, writableHref } from './plain-inline.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { taskMarker } from '../plain-conventions.ts'
import { toEditorNormal } from '../../adf/editor-normal.ts'

// depth: the level the node reduced stands at, counted as the emitter counts it.
type Reduction = { depth: number; memo: SpellingMemo; path: ConvertErrorPath }

type BlockReducer = (node: AdfNode, reduction: Reduction) => Result<AdfNode[]>

type PlacedCell = { colspan: number; paragraph: AdfNode; rowspan: number }

type Placed = { index: number; loose: AdfNode[] } | { index: number; loose?: undefined; node: AdfNode }

const blockReducers: Readonly<Record<string, BlockReducer>> = {
  blockCard: paragraphOfNode,
  blockquote: (node, reduction) => contained({ type: 'blockquote' }, node, reduction),
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
  panel: reducePanel,
  paragraph: (node, reduction) => paragraphOf(nodeContent(node), reduction),
  rule: () => success([{ type: 'rule' }]),
  syncBlock: paragraphOfNode,
  table: reduceTable,
  taskList: reduceTaskList,
}

export function adfToPlainMarkdown(document: AdfDocument): Result<string> {
  const reduced = reduceToPlain(document)
  return reduced.ok ? writeMarkdown(reduced.value, 'plain') : reduced
}

export function reduceToPlain(document: AdfDocument): Result<AdfDocument> {
  const fault = adfDocumentFault(document)
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  // The plain flavour is lossy: it reads and writes editor-normal ADF, whose shapes CommonMark spells.
  const blocks = reduceBlocks(nodeContent(toEditorNormal(document)), { depth: 0, memo: new Map(), path: [] })
  return blocks.ok ? success({ content: nodeContent(toEditorNormal({ content: blocks.value, type: 'doc', version: 1 })).slice(), type: 'doc', version: 1 }) : blocks
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
  const blocks = standsInline(node) ? paragraphOf([node], reduction) : reduceNode(node, reduction)
  return blocks.ok ? plainSequence(blocks.value, reduction) : blocks
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

// A list still taking the directive form gives way to its items' blocks.
function plainSequence(blocks: readonly AdfNode[], reduction: Reduction): Result<AdfNode[]> {
  let sequence = mergedLists(blocks.filter((block) => block.type !== 'paragraph' || nodeContent(block).length > 0))
  for (let index = 0; index < sequence.length; index += 1) {
    const listed = sequence[index]
    if (listed === undefined || (listed.type !== 'bulletList' && listed.type !== 'orderedList')) continue
    const block = numberedPastMarkers(listed)
    const spelled = block === listed && commonMarkSpelling(block, reduction.path, reduction.depth, { flavour: 'plain', memo: reduction.memo })?.ok === true
    if (spelled) continue
    sequence = spliced(sequence, index, block === listed ? nodeContent(block).flatMap(nodeContent) : [block])
    index = Math.max(0, index - 1) - 1
  }
  return success(sequence)
}

// The replacement merges with the lists beside it, so no two lists of one type stand adjacent.
function spliced(sequence: readonly AdfNode[], index: number, replacement: readonly AdfNode[]): AdfNode[] {
  const from = Math.max(0, index - 1)
  return [...sequence.slice(0, from), ...mergedLists([...sequence.slice(from, index), ...replacement, ...sequence.slice(index + 1, index + 2)]), ...sequence.slice(index + 2)]
}

// A numbered list whose markers run past CommonMark's keeps its numbers as text in a bullet list.
function numberedPastMarkers(list: AdfNode): AdfNode {
  const order = nodeAttrs(list)['order']
  if (list.type !== 'orderedList' || typeof order !== 'number' || order + nodeContent(list).length - 1 <= largestListMarker) return list
  return numberedAsText(list)
}

function numberedAsText(list: AdfNode): AdfNode {
  const order = Number(nodeAttrs(list)['order'])
  return { content: nodeContent(list).map((item, offset) => itemOf(marked(nodeContent(item), `${order + offset}.`))), type: 'bulletList' }
}

// Adjacent lists of one marker read back as one list.
function mergedLists(blocks: readonly AdfNode[]): AdfNode[] {
  const merged: AdfNode[] = []
  for (const block of blocks) {
    let next = block
    for (let previous = merged.at(-1); previous !== undefined && listMarker(next) !== undefined && listMarker(previous) === listMarker(next); previous = merged.at(-1)) {
      merged.pop()
      next = joinedLists(previous, next)
    }
    merged.push(next)
  }
  return merged
}

function listMarker(block: AdfNode): string | undefined {
  if (block.type === 'orderedList') return '.'
  return block.type === 'bulletList' || block.type === 'taskList' ? '-' : undefined
}

// Two numbered lists whose numbering breaks between them keep their numbers as text in one bullet list, and a task list joining a bullet list its markers.
function joinedLists(first: AdfNode, second: AdfNode): AdfNode {
  const breaks = first.type === 'orderedList' && nodeAttrs(second)['order'] !== Number(nodeAttrs(first)['order']) + nodeContent(first).length
  const [head, tail] = breaks ? [numberedAsText(first), numberedAsText(second)] : first.type === second.type ? [first, second] : [tasksAsText(first), tasksAsText(second)]
  return { ...head, content: [...nodeContent(head), ...nodeContent(tail)] }
}

// A task keeps its marker as text; a list item stands as one, and anything else nests in the item before it.
function tasksAsText(list: AdfNode): AdfNode {
  if (list.type !== 'taskList') return list
  const items: AdfNode[] = []
  for (const child of nodeContent(list)) {
    const previous = isTask(child) || child.type === 'listItem' ? undefined : items.pop()
    items.push(itemOf(previous === undefined ? taskAsText(child) : mergedLists([...nodeContent(previous), child])))
  }
  return { content: items, type: 'bulletList' }
}

function taskAsText(child: AdfNode): readonly AdfNode[] {
  const marker = taskMarker(nodeAttrs(child)['state'])
  if (child.type === 'taskItem') return [paragraph(nodeContent(child).length === 0 ? [text(marker)] : [text(`${marker} `), ...nodeContent(child)])]
  if (child.type === 'blockTaskItem') return marked(nodeContent(child), marker)
  return child.type === 'listItem' ? nodeContent(child) : [child]
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

function contained(shell: AdfNode, node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const content = reduceBlocks(nodeContent(node), { ...reduction, depth: reduction.depth + 1 })
  return content.ok ? success([{ ...shell, content: content.value }]) : content
}

function reducePanel(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const panelType = nodeAttrs(node)['panelType']
  return contained(typeof panelType === 'string' ? { attrs: { panelType }, type: 'panel' } : { type: 'panel' }, node, reduction)
}

function reduceExpand(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const held = nodeAttrs(node)['title']
  const title = typeof held === 'string' ? withoutTrailingBlanks(oneLine(held).replace(/^[ \t]+/, '')) : ''
  return contained(title === '' ? { type: node.type } : { attrs: { title }, type: node.type }, node, reduction)
}

// A backward scan: an unanchored-end regex retries from every blank in a long run.
function withoutTrailingBlanks(text: string): string {
  let end = text.length
  while (end > 0 && (text.charAt(end - 1) === ' ' || text.charAt(end - 1) === '\t')) end -= 1
  return text.slice(0, end)
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

// A list item's first line reads as no rule and holds no line of spaces alone: the rule and the spaces give way.
function itemOf(blocks: readonly AdfNode[]): AdfNode {
  const rules = blocks.findIndex((block) => block.type !== 'rule')
  const content = blankedCode(blocks.slice(rules === -1 ? blocks.length : rules))
  return content.length === 0 ? { type: 'listItem' } : { content, type: 'listItem' }
}

function blankedCode(blocks: readonly AdfNode[]): AdfNode[] {
  return blocks.map((block) => (block.type === 'codeBlock' ? { ...block, content: blankedLines(nodeContent(block)) } : block))
}

function blankedLines(code: readonly AdfNode[]): AdfNode[] {
  const blanked = code.map((leaf) => leaf.text ?? '').join('').replace(/^[ \t]+$/gm, '')
  return blanked === '' ? [] : [text(blanked)]
}

// A task list opening with a task and holding tasks and task lists alone keeps its spelling, a list nesting in the task before it; any other keeps its markers as text. A child reducing to nothing counts for neither.
function reduceTaskList(node: AdfNode, reduction: Reduction): Result<AdfNode[]> {
  const kept: { blocks: AdfNode[]; child: AdfNode }[] = []
  for (const [index, child] of nodeContent(node).entries()) {
    const at = childReduction(reduction, index)
    const reduced = isTask(child) ? reduceTask(child, at) : reduceStanding(child, at)
    if (!reduced.ok) return reduced
    if (reduced.value.length > 0) kept.push({ blocks: reduced.value, child })
  }
  const regular = isTask(kept[0]?.child) && kept.every(({ child }) => isTask(child) || child.type === 'taskList')
  const tasks: AdfNode[] = []
  let nested: AdfNode[] = []
  for (const { blocks, child } of kept) {
    if (!regular) {
      const standsAlone = !isTask(child) && child.type !== 'taskList'
      for (const block of standsAlone ? [{ content: blocks, type: 'listItem' }] : blocks) tasks.push(block)
      continue
    }
    if (isTask(child)) {
      nestIn(tasks, nested)
      nested = []
    }
    for (const block of blocks) (isTask(child) ? tasks : nested).push(block)
  }
  nestIn(tasks, nested)
  if (regular) return success([{ content: tasks, type: 'taskList' }])
  return success(listOf(nodeContent(tasksAsText({ content: tasks, type: 'taskList' })), 'bulletList'))
}

// The writer nests a list in the task before it, so one closing a block task item's blocks merges with it.
function nestIn(tasks: AdfNode[], nested: readonly AdfNode[]): void {
  const previous = tasks.at(-1)
  if (previous?.type === 'blockTaskItem') tasks[tasks.length - 1] = { ...previous, content: mergedLists([...nodeContent(previous), ...nested]) }
  else for (const block of mergedLists(nested)) tasks.push(block)
}

function isTask(node: AdfNode | undefined): boolean {
  return node?.type === 'taskItem' || node?.type === 'blockTaskItem'
}

function reduceTask(task: AdfNode, at: Reduction): Result<AdfNode[]> {
  const attrs = { state: nodeAttrs(task)['state'] === 'DONE' ? 'DONE' : 'TODO' }
  if (task.type === 'taskItem') {
    const content = reduceInline(nodeContent(task), 'paragraph', at.path, at.depth)
    return content.ok ? success([{ attrs, content: content.value, type: 'taskItem' }]) : content
  }
  const blocks = reduceBlocks(nodeContent(task), at)
  return blocks.ok ? success([{ attrs, content: blankedCode(blocks.value), type: 'blockTaskItem' }]) : blocks
}

// The marker leads the first paragraph, or stands as one where the blocks open with another.
function marked(blocks: readonly AdfNode[], marker: string): AdfNode[] {
  const [first, ...rest] = blocks
  if (first?.type === 'paragraph') return [paragraph([text(`${marker} `), ...nodeContent(first)]), ...rest]
  return [paragraph([text(marker)]), ...blocks]
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
  const alt = typeof held === 'string' ? oneLine(held).trim() : ''
  const external: AdfNode = { attrs: alt === '' ? { type: 'external', url: writableHref(url) } : { alt, type: 'external', url: writableHref(url) }, type: 'media' }
  const image: AdfNode = { attrs: { layout: 'center' }, content: [external], type: 'mediaSingle' }
  return success([image])
}

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block } from '../parse/blocks.ts'
import type { ConvertError, ConvertErrorPath, ParseError, Result, SourcePosition } from '../../result.ts'
import type { FlavourBlockReaders, FlavourReading, Reading } from '../parse/markdown-to-adf.ts'
import { containerNode, contentNode, listNode, readBlocks, readDocument, tooDeep } from '../parse/markdown-to-adf.ts'
import { largestNesting } from '../../nesting.ts'
import { leadingMarker, readAlertMarker, readTaskMarker } from './conventions.ts'
import { mintTaskIds } from './task-ids.ts'
import { parseInlineContent } from '../parse/inline-content.ts'
import { pathTo, splitTaskList } from './task-list.ts'
import { positioned, success } from '../../result.ts'

type Paragraph = Extract<Block, { kind: 'paragraph' }>

// The paragraph a task marker opens: a task item holds no image, so a lone one there reads as its linked alt text.
type TaskParagraph = { kind: 'taskParagraph'; position: SourcePosition; text: string }

// inExpand: whether an expand holds the blocks, which makes a folded callout a nestedExpand.
function blockReaders(inExpand: boolean): FlavourBlockReaders {
  return { bulletList: bulletBlocks, quote: (blocks, reading, path, depth) => quoteNode(blocks, reading, path, depth, inExpand) }
}

const expandBlockReaders = blockReaders(true)
const portableBlockReaders = blockReaders(false)

export function portableMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError> {
  const read = readDocument(markdown, { blocks: portableBlockReaders, flavour: 'portable' })
  if (read.ok) mintTaskIds(read.value, markdown)
  return read
}

function markerLed<T extends { length: number }>(block: Block | undefined, read: (text: string) => T | undefined): { marker: T; position: SourcePosition; text: string } | undefined {
  if (block?.kind !== 'paragraph') return undefined
  const marker = leadingMarker(block.text, read)
  return marker === undefined ? undefined : { marker, position: block.position, text: block.text.slice(marker.length) }
}

function markerLine(text: string): { line: string; rest: string } {
  const lineEnd = text.indexOf('\n')
  const line = lineEnd === -1 ? text : text.slice(0, lineEnd)
  const hardBreak = lineEnd !== -1 && /(?:^|[^\\])(?:\\\\)*\\$/.test(line)
  return { line: (hardBreak ? line.slice(0, -1) : line).replace(/^[ \t]+/, ''), rest: lineEnd === -1 ? '' : text.slice(lineEnd + 1) }
}

// docs/decisions.md, An image reads as an image only alone in its paragraph: a marker or title line stands apart from the lines after it.
function paragraphsOf(position: SourcePosition, ...texts: string[]): Paragraph[] {
  return texts.filter((text) => text !== '').map((text) => ({ kind: 'paragraph', position, text }))
}

function quoteNode(blocks: readonly Block[], reading: FlavourReading, path: ConvertErrorPath, depth: number, inExpand: boolean): Result<AdfNode> {
  const [first, ...body] = blocks
  const led = markerLed(first, readAlertMarker)
  if (led === undefined) return containerNode({ type: 'blockquote' }, blocks, reading, path, depth)
  const { folded, panelType } = led.marker
  const { line, rest } = markerLine(led.text)
  if (!folded) return filledNode({ attrs: { panelType }, type: 'panel' }, readBlocks([...paragraphsOf(led.position, line, rest), ...body], reading, path, depth + 1))
  const title = parseInlineContent(line, reading.definitions, path, 'paragraph', reading.flavour)
  if (!title.ok) return title
  const text = titleText(title.value.nodes)
  const type = inExpand ? 'nestedExpand' : 'expand'
  return filledNode(text === '' ? { type } : { attrs: { title: text }, type }, readBlocks([...paragraphsOf(led.position, rest), ...body], { ...reading, blocks: expandBlockReaders }, path, depth + 1))
}

// docs/decisions.md, A callout title keeps its link targets.
function titleText(nodes: readonly AdfNode[]): string {
  let text = ''
  let linked = ''
  for (const [index, node] of nodes.entries()) {
    const href = linkTarget(node)
    text += node.text ?? ''
    linked += href === undefined ? '' : node.text ?? ''
    if (href === undefined || linkTarget(nodes[index + 1]) === href) continue
    if (href !== linked && href !== `mailto:${linked}`) text += ` (${href})`
    linked = ''
  }
  return text
}

function linkTarget(node: AdfNode | undefined): string | undefined {
  const href = node?.marks?.find((mark) => mark.type === 'link')?.attrs?.href
  return typeof href === 'string' ? href : undefined
}

// Atlassian's schema requires a panel and an expand to hold a block.
function filledNode(node: AdfNode, content: Result<AdfNode[]>): Result<AdfNode> {
  if (!content.ok) return content
  return success({ ...node, content: content.value.length === 0 ? [{ type: 'paragraph' }] : content.value })
}

function taskItems(items: readonly Block[][]) {
  const led = []
  for (const [first, ...others] of items) {
    const marked = markerLed(first, readTaskMarker)
    if (marked === undefined) return undefined
    led.push({ ...marked, others })
  }
  return led
}

function bulletBlocks(items: readonly Block[][], reading: Reading, path: ConvertErrorPath, depth: number, listIndex: number): Result<AdfNode[]> {
  const tasks = taskBlocks(items, reading, path, depth)
  if (tasks === undefined) {
    const list = listNode({ type: 'bulletList' }, items, reading, path, depth)
    return list.ok ? success([list.value]) : list
  }
  if (!tasks.ok) return tasks
  const { nodes: blocks, refusal } = tasks.value
  if (refusal === undefined) return success(blocks)
  const place = pathTo(blocks, refusal.marker)
  // task-list.test.ts pins that the split keeps the marker; were it lost, the error keeps its pre-split path, since nothing here throws.
  if (place === undefined) return { error: refusal.error, ok: false }
  const [blockIndex, ...steps] = place
  return { error: { ...refusal.error, path: [...path.slice(0, -1), listIndex + blockIndex, ...steps.slice(0, -2), ...refusal.within] }, ok: false }
}

// A block a task list refused. Its placeholder holds `marker` as its one child and stands where the block's node would, so the one split that builds the list places it; `within` is the error's path below that node.
type Refusal = { error: ConvertError; marker: AdfNode; within: ConvertErrorPath }

// Nodes read from task blocks and the first refusal among them; a list is read up to the task holding its refusal.
type TaskNodes = { nodes: AdfNode[]; refusal: Refusal | undefined }

function taskBlocks(items: readonly Block[][], reading: Reading, path: ConvertErrorPath, depth: number): Result<TaskNodes> | undefined {
  const led = taskItems(items)
  if (led === undefined) return undefined
  if (depth + 1 > largestNesting) return tooDeep([...path, 'content', 0])
  const tasks: AdfNode[] = []
  let refusal: Refusal | undefined
  for (const [index, { marker, others, position, text }] of led.entries()) {
    const body = text.replace(/^(?:[ \t\n]|\\\n)+/, '')
    const marked: TaskParagraph[] = body === '' ? [] : [{ kind: 'taskParagraph', position, text: body }]
    const task: AdfNode & { content: AdfNode[] } = { attrs: { state: marker.state }, content: [], type: 'blockTaskItem' }
    for (const block of [...marked, ...others]) {
      const read = readTaskBlock(block, reading, [...path, 'content', index], depth + 1)
      for (const node of read.nodes) task.content.push(node)
      refusal ??= read.refusal
    }
    tasks.push(task)
    if (refusal !== undefined) break
  }
  return success({ nodes: splitTaskList({ content: tasks, type: 'taskList' }), refusal })
}

// A refused block reads to a placeholder. The split tells only paragraphs and task lists from other blocks, so a paragraph that failed to read stays a paragraph.
function readTaskBlock(block: Block | TaskParagraph, reading: Reading, path: ConvertErrorPath, depth: number): TaskNodes {
  const nodePath = [...path, 'content', 0]
  const nested = block.kind === 'bulletList' ? taskBlocks(block.items, reading, nodePath, depth) : undefined
  if (nested?.ok) return nested.value
  const read = positioned(nested ?? (block.kind === 'taskParagraph' ? taskParagraph(block, reading, nodePath) : readBlocks([block], reading, path, depth)), block.position)
  if (read.ok) return { nodes: read.value, refusal: undefined }
  const marker: AdfNode = { text: '', type: 'text' }
  const type = block.kind === 'taskParagraph' ? 'paragraph' : nested === undefined ? block.kind : 'taskList'
  return { nodes: [{ content: [marker], type }], refusal: { error: read.error, marker, within: read.error.path.slice(nodePath.length) } }
}

function taskParagraph(paragraph: TaskParagraph, reading: Reading, path: ConvertErrorPath): Result<AdfNode[]> {
  const node = contentNode({ type: 'paragraph' }, paragraph.text, reading, path, 'paragraph')
  return node.ok ? success([node.value]) : node
}

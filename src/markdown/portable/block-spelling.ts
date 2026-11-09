import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath, Result } from '../../result.ts'
import type { EmittedBlock, FlavourBlockWriters, PlacedBlock, PlacedBlocks, Writing, WrittenAs } from '../emit/adf-to-markdown.ts'
import { alertMarker, foldedAlertMarker, leadingMarker, markerOpening, readAlertMarker, readTaskMarker, taskMarker } from './conventions.ts'
import { blockText, emptyLine, joinedText, opening, prefixedText, type BlockText } from '../emit/block-text.ts'
import { emitBlock, joinBlocks, quotedBlocks, spelledList, walkBlocks } from '../emit/adf-to-markdown.ts'
import { emitInlineLine } from '../emit/inline-line.ts'
import { failure, success } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { nodeAttrs, nodeContent } from '../../adf/document.ts'
import { taskListItems } from './task-list.ts'

const portableBlockWriters: FlavourBlockWriters = {
  // GitHub reads a task marker opening any item's first paragraph as a checkbox, whatever its siblings hold.
  claimsItem: (text) => leadsWithMarker(text, readTaskMarker),
  claimsQuote: (text) => leadsWithMarker(text, readAlertMarker),
  spell: spellPortableBlock,
}

export const portableWriting: WrittenAs = { blocks: portableBlockWriters, flavour: 'portable' }

// The portable flavour's nodes, in the shapes the portable reduction leaves them.
function spellPortableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  if (node.type === 'panel') return quotedBlocks(node, path, depth, writing, headed(alertMarker(nodeAttrs(node)['panelType'])))
  if (node.type === 'taskList') return tryTaskList(node, path, depth, writing)
  if (node.type !== 'expand' && node.type !== 'nestedExpand') return undefined
  const title = nodeAttrs(node)['title']
  if (typeof title !== 'string') return quotedBlocks(node, path, depth, writing, headed(foldedAlertMarker))
  const line = emitInlineLine([{ text: title, type: 'text' }], 'paragraph', path, writing.flavour)
  return line.ok ? quotedBlocks(node, path, depth, writing, headed(`${foldedAlertMarker} ${line.value}`)) : line
}

// Reading a concatenated line copies it whole, so the first character is checked before the line is read.
function leadsWithMarker(text: BlockText, read: (text: string) => { length: number } | undefined): boolean {
  return text.first.character === markerOpening && leadingMarker(opening(text), read) !== undefined
}

function headed(head: string): (body: BlockText) => BlockText {
  return (body) => (body.length === 0 ? blockText(head) : joinedText([blockText(head), emptyLine, body]))
}

function tryTaskList(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const items = taskListItems(nodeContent(node))
  // The portable reduction opens every task list with a task.
  if (items === undefined) return failure('unsupported-node-shape', 'a task list opens with a child other than a task', path)
  const inners: BlockText[] = []
  let headroom = largestNesting - depth - 1
  for (const { after, task } of items) {
    const blocks: PlacedBlock[] = []
    const walks = [taskBlocks(task, path, depth + 1, writing), ...after.map((child) => placedBlock(child, path, depth + 1, writing))]
    for (const walk of walks) {
      if (!walk.ok) return walk
      headroom = Math.min(headroom, walk.value.headroom)
      for (const block of walk.value.blocks) blocks.push(block)
    }
    inners.push(joinBlocks(blocks, 'list-item'))
  }
  const list = spelledList(inners, undefined, headroom)
  // The portable reduction leaves no task a list item cannot hold: a directive here would break the flavour.
  return list === undefined ? failure('unsupported-node-shape', 'a task holds blocks no list item spells', path) : success(list)
}

function placedBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  const block = emitBlock(node, path, depth, writing)
  return block.ok ? success({ blocks: [{ ...block.value, node }], headroom: block.value.headroom }) : block
}

function taskBlocks(task: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  const marker = taskMarker(nodeAttrs(task)['state'])
  if (task.type === 'taskItem') {
    const content = nodeContent(task)
    const line = content.length === 0 ? success('') : emitInlineLine(content, 'paragraph', path, writing.flavour)
    if (!line.ok) return line
    return success({ blocks: [{ node: { type: 'paragraph' }, spelling: 'commonmark', text: blockText(line.value === '' ? marker : `${marker} ${line.value}`) }], headroom: Number.POSITIVE_INFINITY })
  }
  // `itemParts` in task-list.ts leaves a block task item holding only paragraphs, two or more, so the marker leads the first.
  const walk = walkBlocks(nodeContent(task), path, depth, writing)
  if (!walk.ok) return walk
  const blocks = walk.value.blocks.map((block, index) => (index === 0 ? { ...block, text: prefixedText(`${marker} `, '', block.text) } : block))
  return success({ blocks, headroom: walk.value.headroom })
}

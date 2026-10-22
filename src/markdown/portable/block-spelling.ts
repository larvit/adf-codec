import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath, Result } from '../../result.ts'
import type { EmittedBlock, FlavourBlockWriters, PlacedBlock, PlacedBlocks, Writing, WrittenAs } from '../emit/adf-to-markdown.ts'
import { alertMarker, foldedAlertMarker, leadingMarker, readAlertMarker, readTaskMarker, taskMarker } from './conventions.ts'
import { emitBlock, joinBlocks, quotedBlocks, spelledList, walkBlocks } from '../emit/adf-to-markdown.ts'
import { emitInlineLine } from '../emit/inline-line.ts'
import { failure, success } from '../../result.ts'
import { isTaskItem } from '../../adf/block-nodes.ts'
import { largestNesting } from '../../nesting.ts'
import { nodeAttrs, nodeContent } from '../../adf/document.ts'

const portableBlockWriters: FlavourBlockWriters = {
  // GitHub reads a task marker opening any item's first paragraph as a checkbox, whatever its siblings hold.
  claimsItem: (text) => leadingMarker(text, readTaskMarker) !== undefined,
  claimsQuote: (text) => leadingMarker(text, readAlertMarker) !== undefined,
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

function headed(head: string): (body: string) => string {
  return (body) => (body === '' ? head : `${head}\n\n${body}`)
}

function tryTaskList(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const items: PlacedBlock[][] = []
  let headroom = largestNesting - depth - 1
  // A child other than a task nests in the task before it.
  for (const [index, child] of nodeContent(node).entries()) {
    const task = isTaskItem(child)
    const walk = task ? taskBlocks(child, [...path, 'content', index], depth + 1, writing) : placedBlock(child, [...path, 'content', index], depth + 1, writing)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    const previous = items.at(-1)
    if (task || previous === undefined) items.push([...walk.value.blocks])
    else for (const block of walk.value.blocks) previous.push(block)
  }
  const list = spelledList(items.map((blocks) => joinBlocks(blocks, 'list-item')), undefined, headroom)
  // The portable reduction leaves no task a list item cannot hold: a directive here would break the flavour.
  return list === undefined ? failure('unsupported-node-shape', 'a task holds blocks no list item spells', path) : success(list)
}

function placedBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  const block = emitBlock(node, path, depth, writing)
  return block.ok ? success({ blocks: [{ ...block.value, node }], headroom: block.value.headroom }) : block
}

// The marker leads the first paragraph, or stands as one where the blocks open with another.
function taskBlocks(task: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  const marker = taskMarker(nodeAttrs(task)['state'])
  const markerBlock: PlacedBlock = { node: { type: 'paragraph' }, spelling: 'commonmark', text: marker }
  if (task.type === 'taskItem') {
    const content = nodeContent(task)
    const line = content.length === 0 ? success('') : emitInlineLine(content, 'paragraph', path, writing.flavour)
    if (!line.ok) return line
    return success({ blocks: [{ ...markerBlock, text: line.value === '' ? marker : `${marker} ${line.value}` }], headroom: Number.POSITIVE_INFINITY })
  }
  const walk = walkBlocks(nodeContent(task), path, depth, writing)
  if (!walk.ok) return walk
  const [first, ...rest] = walk.value.blocks
  const blocks = first?.node.type === 'paragraph' ? [{ ...first, text: `${marker} ${first.text}` }, ...rest] : [markerBlock, ...walk.value.blocks]
  return success({ blocks, headroom: walk.value.headroom })
}

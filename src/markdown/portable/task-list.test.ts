import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../../adf/document.ts'
import { pathTo, splitTaskList } from './task-list.ts'

test('names the steps from a block to a node deep in it, and none for a node it does not hold', () => {
  const target: AdfNode = { text: 'x', type: 'text' }
  const blocks: AdfNode[] = [{ type: 'rule' }, { content: [{ content: [{ type: 'paragraph' }, { content: [target], type: 'paragraph' }], type: 'blockquote' }], type: 'panel' }]
  assert.deepEqual(pathTo(blocks, target), [1, 'content', 0, 'content', 1, 'content', 0])
  assert.deepEqual(pathTo(blocks, blocks[0] ?? target), [0])
  assert.equal(pathTo(blocks, { text: 'x', type: 'text' }), undefined)
})

test('keeps the inline nodes of a lone paragraph in the taskItem it becomes, so pathTo still finds them', () => {
  const inline: AdfNode = { text: 'x', type: 'text' }
  const item: AdfNode = { attrs: { state: 'TODO' }, content: [{ content: [inline], type: 'paragraph' }], type: 'blockTaskItem' }
  const blocks = splitTaskList({ content: [item], type: 'taskList' })
  assert.deepEqual(pathTo(blocks, inline), [0, 'content', 0, 'content', 0])
})

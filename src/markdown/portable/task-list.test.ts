import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../../adf/document.ts'
import { pathTo, splitTaskList, taskListItems } from './task-list.ts'

test('names the steps from a block to a node deep in it', () => {
  const target: AdfNode = { text: 'x', type: 'text' }
  const blocks: AdfNode[] = [{ type: 'rule' }, { content: [{ content: [{ type: 'paragraph' }, { content: [target], type: 'paragraph' }], type: 'blockquote' }], type: 'panel' }]
  assert.deepEqual(pathTo(blocks, target), [1, 'content', 0, 'content', 1, 'content', 0])
  assert.deepEqual(pathTo(blocks, blocks[0] ?? target), [0])
})

test('names no steps to a node the blocks do not hold', () => {
  assert.equal(pathTo([{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], { text: 'x', type: 'text' }), undefined)
})

test('keeps the inline nodes of a lone paragraph in the taskItem it becomes, so pathTo still finds them', () => {
  const inline: AdfNode = { text: 'x', type: 'text' }
  const item: AdfNode = { attrs: { state: 'TODO' }, content: [{ content: [inline], type: 'paragraph' }], type: 'blockTaskItem' }
  const blocks = splitTaskList([{ after: [], task: item }])
  assert.deepEqual(pathTo(blocks, inline), [0, 'content', 0, 'content', 0])
})

test('groups a task list into tasks, each with the children after it up to the next task', () => {
  const first: AdfNode = { attrs: { state: 'TODO' }, type: 'taskItem' }
  const nested: AdfNode = { content: [first], type: 'taskList' }
  const second: AdfNode = { attrs: { state: 'DONE' }, content: [{ type: 'paragraph' }], type: 'blockTaskItem' }
  assert.deepEqual(taskListItems({ content: [first, nested, nested, second], type: 'taskList' }), [
    { after: [nested, nested], task: first },
    { after: [], task: second },
  ])
  assert.deepEqual(taskListItems({ type: 'taskList' }), [])
})

test('groups no task list a child other than a task opens', () => {
  const task: AdfNode = { attrs: { state: 'TODO' }, type: 'taskItem' }
  assert.equal(taskListItems({ content: [{ type: 'paragraph' }, task], type: 'taskList' }), undefined)
  assert.equal(taskListItems({ content: [{ content: [task], type: 'taskList' }, task], type: 'taskList' }), undefined)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { portableWriting } from './block-spelling.ts'
import { writeMarkdown } from '../emit/adf-to-markdown.ts'

test('refuses a task list a child other than a task opens, where the portable reduction would have left none', () => {
  const list = { content: [{ content: [{ text: 'stray', type: 'text' }], type: 'paragraph' }, { attrs: { state: 'TODO' }, type: 'taskItem' }], type: 'taskList' }
  const written = writeMarkdown({ content: [{ type: 'rule' }, list], type: 'doc', version: 1 }, portableWriting)
  assert.deepEqual(written.ok ? written.value : [written.error.code, written.error.path], ['unsupported-node-shape', ['content', 1]])
})

test('names the path of a failure inside a task list by the child it writes', () => {
  const task = { attrs: { state: 'TODO' }, content: [{ text: 't', type: 'text' }], type: 'taskItem' }
  const unwritable = { attrs: { state: 'TODO' }, content: [{ marks: [{ type: 'strong' }, { type: 'strong' }], text: 'x', type: 'text' }], type: 'taskItem' }
  const list = { content: [task, { content: [task], type: 'taskList' }, unwritable], type: 'taskList' }
  const written = writeMarkdown({ content: [list], type: 'doc', version: 1 }, portableWriting)
  assert.deepEqual(written.ok ? written.value : written.error.path, ['content', 0, 'content', 2, 'content', 0])
})

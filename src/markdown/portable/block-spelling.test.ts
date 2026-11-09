import assert from 'node:assert/strict'
import test from 'node:test'

import { portableWriting } from './block-spelling.ts'
import { writeMarkdown } from '../emit/adf-to-markdown.ts'

test('refuses a task list that opens with a child other than a task', () => {
  const list = { content: [{ content: [{ text: 'stray', type: 'text' }], type: 'paragraph' }, { attrs: { state: 'TODO' }, type: 'taskItem' }], type: 'taskList' }
  const written = writeMarkdown({ content: [{ type: 'rule' }, list], type: 'doc', version: 1 }, portableWriting)
  assert.deepEqual(written.ok ? written.value : [written.error.code, written.error.path], ['unsupported-node-shape', ['content', 1]])
})

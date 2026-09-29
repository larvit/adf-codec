import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { mintTaskIds } from './task-ids.ts'

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function taskIds(document: AdfDocument): unknown[] {
  const ids: unknown[] = []
  const pending: AdfNode[] = [...(document.content ?? [])].reverse()
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (['blockTaskItem', 'taskItem', 'taskList'].includes(node.type)) ids.push(node.attrs?.['localId'])
    for (const child of [...(node.content ?? [])].reverse()) pending.push(child)
  }
  return ids
}

function tasks(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

test('mints each task node lacking a localId a UUID v4 in document order, unique and the same every run', () => {
  const unminted = (): AdfDocument => tasks({ content: [{ attrs: { state: 'TODO' }, type: 'taskItem' }, { content: [{ attrs: { state: 'DONE' }, type: 'blockTaskItem' }], type: 'taskList' }], type: 'taskList' })
  const minted = unminted()
  mintTaskIds(minted, '- [ ] a\n')
  const ids = taskIds(minted)
  assert.equal(ids.length, 4)
  for (const id of ids) assert.match(String(id), uuidV4)
  assert.equal(new Set(ids).size, 4)
  const again = unminted()
  mintTaskIds(again, '- [ ] a\n')
  assert.deepEqual(taskIds(again), ids)
  const other = unminted()
  mintTaskIds(other, '- [ ] b\n')
  assert.equal(taskIds(other).some((id) => ids.includes(id)), false)
})

test('keeps a localId the document spells and skips it when minting, a carried one too', () => {
  const first = tasks({ type: 'taskList' })
  mintTaskIds(first, 'x')
  const [taken] = taskIds(first)
  const spelled = tasks({ type: 'taskList' }, { content: [{ attrs: { localId: String(taken) }, type: 'taskList' }], type: 'futureBlock' })
  mintTaskIds(spelled, 'x')
  const [minted, kept] = taskIds(spelled)
  assert.equal(kept, taken)
  assert.notEqual(minted, taken)
  assert.match(String(minted), uuidV4)
})

test('leaves a task node inside a node type this version does not know as carried', () => {
  const carried: AdfNode = { content: [{ type: 'taskList' }], type: 'futureBlock' }
  const document = tasks(carried)
  mintTaskIds(document, 'x')
  assert.deepEqual(document, tasks({ content: [{ type: 'taskList' }], type: 'futureBlock' }))
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { adfDocumentFault, isAdfDocument } from './document.ts'

function fault(value: unknown): string {
  return adfDocumentFault(value) ?? 'accepted'
}

test('accepts an editor-normal document', () => {
  assert.equal(isAdfDocument({ content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(isAdfDocument({ type: 'doc', version: 1 }), true)
  assert.equal(fault({ content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }), 'accepted')
})

test('names the check anything that is not a doc node failed', () => {
  assert.equal(isAdfDocument(null), false)
  assert.equal(fault(null), 'an ADF document is an object: found null')
  assert.equal(fault(undefined), 'an ADF document is an object: found undefined')
  assert.equal(fault([]), 'an ADF document is an object: found an array')
  assert.equal(fault('doc'), 'an ADF document is an object: found "doc"')
  assert.equal(fault({ fields: { description: { type: 'doc', version: 1 } } }), 'an ADF document holds content, type and version alone: found the key fields')
  assert.equal(fault({ extra: 1, type: 'doc', version: 1 }), 'an ADF document holds content, type and version alone: found the key extra')
  assert.equal(fault({ version: 1 }), 'an ADF document holds type "doc": found no type field')
  assert.equal(fault({ type: 'document', version: 1 }), 'an ADF document holds type "doc": found "document"')
  assert.equal(fault({ type: 'paragraph', version: 1 }), 'an ADF document holds type "doc": found "paragraph"')
  assert.equal(fault({ type: 1, version: 1 }), 'an ADF document holds type "doc": found 1')
  assert.equal(fault({ type: 'doc' }), 'an ADF document holds a version number: found no version field')
  assert.equal(fault({ type: 'doc', version: '1' }), 'an ADF document holds a version number: found "1"')
  assert.equal(fault({ type: 'doc', version: Number.NaN }), 'an ADF document holds a version number: found NaN')
})

test('rejects a node whose shape ProseMirror JSON cannot hold', () => {
  assert.equal(fault({ content: {}, type: 'doc', version: 1 }), "an ADF document's content is an array: found an object")
  assert.equal(fault({ content: [{ type: 1 }], type: 'doc', version: 1 }), "an ADF document's content holds ADF nodes: one of them is not")
  assert.equal(isAdfDocument({ content: [{ type: 1 }], type: 'doc', version: 1 }), false)
  assert.equal(isAdfDocument({ content: [{ text: 1, type: 'text' }], type: 'doc', version: 1 }), false)
  assert.equal(isAdfDocument({ content: [{ node: 'x', type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(isAdfDocument({ content: [{ content: {}, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(isAdfDocument({ content: [{ marks: [{ type: 1 }], text: 'x', type: 'text' }], type: 'doc', version: 1 }), false)
  assert.equal(isAdfDocument({ content: [{ attrs: { a: Number.POSITIVE_INFINITY }, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(isAdfDocument({ content: [{ attrs: [], type: 'paragraph' }], type: 'doc', version: 1 }), false)
})

test('accepts the JSON values an attribute may hold', () => {
  assert.equal(isAdfDocument({ content: [{ attrs: { a: [1, 'x', null, true, { b: 2 }] }, type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(isAdfDocument({ content: [{ attrs: { a: [() => 1] }, type: 'paragraph' }], type: 'doc', version: 1 }), false)
})

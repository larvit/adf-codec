import assert from 'node:assert/strict'
import test from 'node:test'

import { isAdfDocument } from './adf-document.ts'

test('accepts an editor-normal document', () => {
  assert.equal(isAdfDocument({ content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(isAdfDocument({ type: 'doc', version: 1 }), true)
})

test('rejects anything that is not a doc node', () => {
  assert.equal(isAdfDocument(null), false)
  assert.equal(isAdfDocument([]), false)
  assert.equal(isAdfDocument('doc'), false)
  assert.equal(isAdfDocument({ type: 'paragraph', version: 1 }), false)
  assert.equal(isAdfDocument({ type: 'doc' }), false)
  assert.equal(isAdfDocument({ type: 'doc', version: Number.NaN }), false)
  assert.equal(isAdfDocument({ extra: 1, type: 'doc', version: 1 }), false)
})

test('rejects a node whose shape ProseMirror JSON cannot hold', () => {
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

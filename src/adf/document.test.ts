import assert from 'node:assert/strict'
import test from 'node:test'

import type { JsonValue } from '../json-value.ts'
import { adfDocumentFault, isAdfDocument } from './document.ts'
import { largestNesting } from '../nesting.ts'

function fault(value: unknown): string {
  return adfDocumentFault(value)?.message ?? 'accepted'
}

function faultCode(value: unknown): string {
  return adfDocumentFault(value)?.code ?? 'accepted'
}

function nested(levels: number): JsonValue {
  let value: JsonValue = 1
  for (let level = 0; level < levels; level += 1) value = [value]
  return value
}

function withAttribute(value: JsonValue): unknown {
  return { content: [{ attrs: { a: value }, type: 'paragraph' }], type: 'doc', version: 1 }
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
  assert.equal(fault('x'.repeat(200000)), `an ADF document is an object: found "${'x'.repeat(40)}…"`)
  assert.equal(fault(function named(first: number, second: number) { return first + second }), 'an ADF document is an object: found a function')
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

test('names the attribute nesting past the levels the parser reads one at, and still calls the value a document', () => {
  const deeper = (key: string, type: string): string => `the ${key} attribute of ${type} nests deeper than the ${largestNesting} levels an attribute carries`
  assert.equal(fault(withAttribute(nested(largestNesting))), 'accepted')
  assert.equal(fault(withAttribute(nested(largestNesting + 1))), deeper('a', 'paragraph'))
  assert.equal(faultCode(withAttribute(nested(largestNesting + 1))), 'unsupported-nesting-depth')
  assert.equal(isAdfDocument(withAttribute(nested(largestNesting + 1))), true)
  const marked = (levels: number): unknown => ({ content: [{ marks: [{ attrs: { a: nested(levels) }, type: 'link' }], text: 'x', type: 'text' }], type: 'doc', version: 1 })
  assert.equal(fault(marked(largestNesting)), 'accepted')
  assert.equal(fault(marked(largestNesting + 1)), deeper('a', 'link'))
  assert.equal(isAdfDocument(marked(largestNesting + 1)), true)
})

test('accepts the JSON values an attribute may hold', () => {
  assert.equal(isAdfDocument({ content: [{ attrs: { a: [1, 'x', null, true, { b: 2 }] }, type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(isAdfDocument({ content: [{ attrs: { a: [() => 1] }, type: 'paragraph' }], type: 'doc', version: 1 }), false)
})

test("reads a node's siblings as a walk rather than as one call's arguments", () => {
  const wide = { content: [{ content: Array.from({ length: 200000 }, () => ({ type: 'rule' })), type: 'blockquote' }], type: 'doc', version: 1 }
  assert.equal(isAdfDocument(wide), true)
  assert.equal(fault(wide), 'accepted')
})

test('refuses a node or an attribute value holding itself, and accepts one shared', () => {
  const holdsItself = 'an ADF document is a tree: an object in it holds itself'
  const paragraph: { content: unknown[]; type: string } = { content: [], type: 'paragraph' }
  paragraph.content.push(paragraph)
  assert.equal(fault({ content: [paragraph], type: 'doc', version: 1 }), holdsItself)
  const document: { content: unknown[]; type: string; version: number } = { content: [], type: 'doc', version: 1 }
  document.content.push(document)
  assert.equal(fault(document), holdsItself)
  const attrs: Record<string, unknown> = {}
  attrs['a'] = [attrs]
  assert.equal(fault({ content: [{ attrs, type: 'paragraph' }], type: 'doc', version: 1 }), holdsItself)
  assert.equal(fault({ content: [{ marks: [{ attrs, type: 'link' }], text: 'x', type: 'text' }], type: 'doc', version: 1 }), holdsItself)
  assert.equal(isAdfDocument({ content: [{ attrs, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  const notANode = "an ADF document's content holds ADF nodes: one of them is not"
  const inherits: { content?: unknown[] } = {}
  const heir: Record<string, unknown> = Object.create(inherits)
  heir['type'] = 'paragraph'
  inherits.content = [heir]
  assert.equal(fault({ content: [heir], type: 'doc', version: 1 }), notANode)
  const hidden: Record<string, unknown> = { type: 'paragraph' }
  Object.defineProperty(hidden, 'content', { value: [hidden] })
  assert.equal(fault({ content: [hidden], type: 'doc', version: 1 }), notANode)
  const link: Record<string, unknown> = Object.create({ attrs })
  link['type'] = 'link'
  assert.equal(fault({ content: [{ marks: [link], text: 'x', type: 'text' }], type: 'doc', version: 1 }), notANode)
  const bold = { type: 'strong' }
  const text = { marks: [bold], text: 'x', type: 'text' }
  const shared = { content: [text, text], type: 'paragraph' }
  const values = { b: 1 }
  assert.equal(fault({ content: [shared, shared, { attrs: { a: [values, values] }, type: 'paragraph' }], type: 'doc', version: 1 }), 'accepted')
})

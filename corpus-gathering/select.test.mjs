import assert from 'node:assert/strict'
import { test } from 'node:test'

import { features, selectDocuments } from './select.mjs'

function paragraph(...content) {
  return { content: [{ content, type: 'paragraph' }], type: 'doc', version: 1 }
}

test('names node and mark types, attribute keys and nesting', () => {
  const found = features(paragraph({ marks: [{ attrs: { href: 'x' }, type: 'link' }], text: 'a', type: 'text' }))
  for (const feature of ['node:doc', 'node:paragraph', 'node:text', 'mark:link', 'attr:link.href', 'child:paragraph>text']) assert.ok(found.has(feature), feature)
})

test('names a node attribute', () => {
  assert.ok(features(paragraph({ attrs: { level: 2 }, type: 'heading' })).has('attr:heading.level'))
})

test('names no mark for a node without marks, and no parent for the document', () => {
  assert.deepEqual([...features({ type: 'doc' })], ['node:doc'])
})

test('names marks held together', () => {
  assert.ok(features(paragraph({ marks: [{ type: 'strong' }, { type: 'em' }], text: 'a', type: 'text' })).has('marks:em+strong'))
})

test('names no marks held together for one mark, or for marks on a node other than text', () => {
  const found = [...features(paragraph({ marks: [{ type: 'strong' }], text: 'a', type: 'text' }, { marks: [{ type: 'strong' }, { type: 'em' }], type: 'mediaInline' }))]
  assert.deepEqual(found.filter((feature) => feature.startsWith('marks:')), [])
})

test('names bold beside a code span and italics beside a hard break', () => {
  const found = features(paragraph({ marks: [{ type: 'strong' }], text: 'a', type: 'text' }, { marks: [{ type: 'code' }], text: 'b', type: 'text' }, { type: 'hardBreak' }, { marks: [{ type: 'em' }], text: 'c', type: 'text' }))
  assert.ok(found.has('beside:text[strong]|text[code]'))
  assert.ok(found.has('beside:hardBreak|text[em]'))
})

test('takes the smaller of two candidates showing the same features, and stops when nothing is new', () => {
  const big = { features: new Set(['a', 'b']), size: 100 }
  const small = { features: new Set(['a', 'b']), size: 10 }
  const other = { features: new Set(['c']), size: 50 }
  assert.deepEqual(selectDocuments([big, small, other], 10), [small, other])
})

test('takes a candidate showing a new node or mark type ahead of any other', () => {
  const rare = { features: new Set(['mark:breakout']), size: 1000 }
  const cheap = { features: new Set(['beside:a|b', 'beside:b|c']), size: 10 }
  assert.deepEqual(selectDocuments([cheap, rare], 1), [rare])
})

test('takes a candidate showing a new type wherever it stands among the candidates', () => {
  const rare = { features: new Set(['mark:breakout']), size: 1000 }
  const cheap = { features: new Set(['beside:a|b', 'beside:b|c']), size: 10 }
  assert.deepEqual(selectDocuments([rare, cheap], 1), [rare])
})

test('counts a feature naming a type only by its opening', () => {
  const rare = { features: new Set(['beside:node:x']), size: 1000 }
  const cheap = { features: new Set(['beside:a|b', 'beside:b|c']), size: 10 }
  assert.deepEqual(selectDocuments([rare, cheap], 1), [cheap])
})

test('stops at the limit', () => {
  const candidates = [{ features: new Set(['a']), size: 1 }, { features: new Set(['b']), size: 1 }]
  assert.equal(selectDocuments(candidates, 1).length, 1)
})

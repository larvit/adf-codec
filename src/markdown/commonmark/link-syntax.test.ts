import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readInlineTarget, targetMemo } from './link-syntax.ts'

// Every `](` of the text, read in order through one memo, as a reader closes its brackets.
function targets(text: string): unknown[] {
  const memo = targetMemo(text)
  const read: unknown[] = []
  for (let offset = text.indexOf('](') + 1; offset > 0; offset = text.indexOf('](', offset) + 1) {
    const target = readInlineTarget(text, offset, memo)
    read.push(target === undefined ? undefined : { ...target.definition(), length: target.length })
  }
  return read
}

test('a target nothing closes reads as none, at every `](`', () => {
  assert.deepEqual(targets('[a](b'.repeat(3)), [undefined, undefined, undefined])
})

test('targets sharing a destination end share its failure', () => {
  assert.deepEqual(targets('[a](b[c](d "t" x)'), [undefined, undefined])
  assert.deepEqual(targets('[a](b[c](d "t"   x'), [undefined, undefined])
})

test('an unbracketed destination ends at its first unmatched `)`', () => {
  assert.deepEqual(targets('[a](b(c)d) [e](f)'), [{ destination: 'b(c)d', length: 7 }, { destination: 'f', length: 3 }])
  assert.deepEqual(targets('[a](b\\)c)'), [{ destination: 'b)c', length: 6 }])
})

test('a target reads whitespace and a title around its destination, bracketed, unbracketed or empty', () => {
  assert.deepEqual(targets('[a]( b\n "t" ) [c](<d e> \'f\') [g]()'), [
    { destination: 'b', length: 10, title: 't' },
    { destination: 'd e', length: 11, title: 'f' },
    { destination: '', length: 2 },
  ])
})

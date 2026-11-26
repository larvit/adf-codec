import assert from 'node:assert/strict'
import test from 'node:test'

import type { JsonValue } from './json-value.ts'
import { canonicalJsonPieces, serializeCanonicalJson, spellsCanonicalJson } from './canonical-json.ts'
import { longestOutput } from './length-bound.ts'

test('sorts object keys recursively', () => {
  const value = { b: 1, a: { d: 2, c: 3 } }
  assert.equal(serializeCanonicalJson(value, 'compact'), '{"a":{"c":3,"d":2},"b":1}')
})

test('spells two-space indentation the way the corpus holds it', () => {
  const value = { content: [{ text: 'x', type: 'text' }], type: 'doc', version: 1 }
  assert.equal(
    serializeCanonicalJson(value, 'two-space'),
    [
      '{',
      '  "content": [',
      '    {',
      '      "text": "x",',
      '      "type": "text"',
      '    }',
      '  ],',
      '  "type": "doc",',
      '  "version": 1',
      '}',
    ].join('\n'),
  )
})

test('indents five levels and spells a value nested deeper compact on its line', () => {
  const value = { a: { b: { c: { d: { e: { f: { g: 1 }, h: [1, 2] }, i: [] } } } } }
  assert.equal(
    serializeCanonicalJson(value, 'five-level'),
    [
      '{',
      '  "a": {',
      '    "b": {',
      '      "c": {',
      '        "d": {',
      '          "e": {"f":{"g":1},"h":[1,2]},',
      '          "i": []',
      '        }',
      '      }',
      '    }',
      '  }',
      '}',
    ].join('\n'),
  )
})

test('spells five-level indentation in a length linear in the compact spelling', () => {
  const levels = 200000
  const array = nested(levels, (inner) => [inner])
  const added = '\n'.length * 10 + 2 * (1 + 2 + 3 + 4 + 5) + 2 * (4 + 3 + 2 + 1)
  assert.equal(serializeCanonicalJson(array, 'five-level').length, serializeCanonicalJson(array, 'compact').length + added)
})

test('keeps empty objects and arrays on one line in both spellings', () => {
  assert.equal(serializeCanonicalJson({ a: {}, b: [] }, 'two-space'), '{\n  "a": {},\n  "b": []\n}')
  assert.equal(serializeCanonicalJson({ a: {}, b: [] }, 'compact'), '{"a":{},"b":[]}')
})

test('leaves non-ASCII raw', () => {
  assert.equal(serializeCanonicalJson({ text: '🎉 räksmörgås' }, 'compact'), '{"text":"🎉 räksmörgås"}')
})

test('spells scalars in canonical JSON', () => {
  assert.equal(serializeCanonicalJson([null, true, false, 0, -1.5, 'a"b'], 'compact'), '[null,true,false,0,-1.5,"a\\"b"]')
})

test('spells a value nesting far past the levels a recursive walk survives', () => {
  const levels = 200000
  const array = nested(levels, (inner) => [inner])
  const object = nested(levels, (inner) => ({ a: inner }))
  assert.equal(serializeCanonicalJson(array, 'compact'), `${'['.repeat(levels)}1${']'.repeat(levels)}`)
  assert.equal(serializeCanonicalJson(object, 'compact'), `${'{"a":'.repeat(levels)}1${'}'.repeat(levels)}`)
})

test('holds a text to the canonical spelling, whole', () => {
  const value = { a: [1, 2] }
  assert.ok(spellsCanonicalJson(value, 'compact', '{"a":[1,2]}'))
  assert.ok(spellsCanonicalJson(value, 'two-space', serializeCanonicalJson(value, 'two-space')))
  assert.ok(!spellsCanonicalJson(value, 'compact', '{"a":[1,2]} '))
  assert.ok(!spellsCanonicalJson(value, 'compact', '{"a":[1,2]'))
  assert.ok(!spellsCanonicalJson(value, 'two-space', '{"a":[1,2]}'))
  const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } }
  assert.ok(spellsCanonicalJson(deep, 'five-level', serializeCanonicalJson(deep, 'five-level')))
  assert.ok(!spellsCanonicalJson(deep, 'five-level', serializeCanonicalJson(deep, 'two-space')))
  assert.ok(!spellsCanonicalJson(1e21, 'compact', '1e21'))
})

test('holds a text to the canonical spelling with each piece respelled', () => {
  const upper = (piece: string): string => piece.toUpperCase()
  assert.ok(spellsCanonicalJson({ a: 'b' }, 'compact', '{"A":"B"}', upper))
  assert.ok(!spellsCanonicalJson({ a: 'b' }, 'compact', '{"a":"b"}', upper))
})

function lengthAndLast(value: JsonValue): { last: string | undefined; length: number } {
  let last: string | undefined
  let length = 0
  for (const piece of canonicalJsonPieces(value, 'compact')) {
    last = piece
    length += piece.length
  }
  return { last, length }
}

test('yields unspelled a string that passes the bound only with its quotes counted', () => {
  const { last, length } = lengthAndLast('a'.repeat(longestOutput - 1))
  assert.equal(last, '""')
  assert.ok(length > longestOutput)
})

test('yields the second of two strings that together pass the bound unspelled', () => {
  const long = 'a'.repeat(2 ** 28)
  const { last, length } = lengthAndLast({ first: long, second: long })
  assert.equal(last, '""')
  assert.ok(length > longestOutput)
})

test('yields a key unspelled where it and the string before it together pass the bound', () => {
  const { last, length } = lengthAndLast({ a: 'a'.repeat(2 ** 28), ['b'.repeat(2 ** 28 - 10)]: 0 })
  assert.equal(last, '""')
  assert.ok(length > longestOutput)
})

test('spells a string whose spelling is exactly as long as the bound', () => {
  const { last, length } = lengthAndLast('a'.repeat(longestOutput - 2))
  assert.equal(last?.length, longestOutput)
  assert.equal(length, longestOutput)
})

test('counts what is spelled before a string, so one that would pass the bound by a character is not spelled', () => {
  const { last } = lengthAndLast(['a'.repeat(longestOutput - 2)])
  assert.equal(last, '""')
})

test('throws V8\'s error for a string past the bound, as on every engine', () => {
  assert.throws(() => serializeCanonicalJson('a'.repeat(longestOutput - 1), 'compact'), new RangeError('Invalid string length'))
})

test('finds that a text of exactly the bound spells a string', () => {
  const text = 'a'.repeat(longestOutput - 2)
  assert.ok(spellsCanonicalJson(text, 'compact', `"${text}"`))
})

test('finds that no text spells a string past the bound, whatever its pieces are respelled to', () => {
  assert.ok(!spellsCanonicalJson('a'.repeat(longestOutput - 1), 'compact', '', () => ''))
})

test('finds that no text spells a string past the bound', () => {
  assert.ok(!spellsCanonicalJson('a'.repeat(longestOutput - 1), 'compact', ''))
})

function nested(levels: number, wrap: (inner: JsonValue) => JsonValue): JsonValue {
  let value: JsonValue = 1
  for (let level = 0; level < levels; level += 1) value = wrap(value)
  return value
}

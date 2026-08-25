import assert from 'node:assert/strict'
import test from 'node:test'

import { serializeCanonicalJson } from './canonical-json.ts'

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

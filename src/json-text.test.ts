import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { JsonSpelling } from './canonical-json.ts'
import { jsonValue, propertyRuns } from './conformance/property-harness.ts'
import { parseJsonText } from './json-text.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

test('reads every JSON value kind', () => {
  assert.deepEqual(parseJsonText(' {"a":[1,-0.5e2,true,false,null,"x"],"b":{}} '), { value: { a: [1, -50, true, false, null, 'x'], b: {} } })
  assert.deepEqual(parseJsonText('[]'), { value: [] })
  assert.deepEqual(parseJsonText('[ ]'), { value: [] })
  assert.deepEqual(parseJsonText('{ }'), { value: {} })
  assert.deepEqual(parseJsonText('[[],{}]'), { value: [[], {}] })
  assert.ok(Object.is(parseJsonText('-0')?.value, -0))
})

test('decodes every string escape', () => {
  assert.deepEqual(parseJsonText('"\\"\\\\\\/\\b\\f\\n\\r\\t\\u00e9\\uD83C\\uDF89\\ud800"'), { value: '"\\/\b\f\n\r\té\u{1f389}\ud800' })
})

test('keys stay the keys the text spells after V8 has read a colliding key (https://issues.chromium.org/issues/521080746)', () => {
  const canary = '{"\\r":1,"\\f":2}'
  JSON.parse(canary)
  JSON.parse('{"\\r":3,"\\\\":4}')
  assert.deepEqual(Object.keys(parseJsonText(canary)?.value ?? {}), ['\r', '\f'])
})

test('a __proto__ key is an own key', () => {
  const read = parseJsonText('{"__proto__":{"a":1}}')?.value
  assert.deepEqual(Object.keys(read ?? {}), ['__proto__'])
  assert.equal(Object.getPrototypeOf(read), Object.prototype)
})

test('a repeated key keeps its first position and its last value, as JSON.parse does', () => {
  const read = parseJsonText('{"a":1,"b":2,"a":3}')?.value
  assert.deepEqual(read, { a: 3, b: 2 })
  assert.deepEqual(Object.keys(read ?? {}), ['a', 'b'])
})

test('a number past the double range reads as JSON.parse reads it', () => {
  assert.deepEqual(parseJsonText('1e999'), { value: Infinity })
})

test('refuses text JSON.parse refuses', () => {
  const refused = ['', ' ', '{', '[', '[1', '[1,', '[1,]', '{"a"}', '{"a":}', '{"a":1,}', '{a:1}', '{"a" 1}', '{,}', '01', '1.', '.5', '-', '1e', '+1', '"a', '"\u0001"', '"\\x"', '"\\u12"', '"\\u12g4"', 'tru', 'nul', '1 2', '[1]]', '}', "'a'", 'NaN', ' 1']
  for (const text of refused) {
    assert.throws(() => JSON.parse(text), SyntaxError, text)
    assert.equal(parseJsonText(text), undefined, text)
  }
})

test('reads a value nested far past the call stack without recursing', () => {
  const depth = 100_000
  assert.ok(parseJsonText(`${'['.repeat(depth)}${']'.repeat(depth)}`) !== undefined)
  assert.ok(parseJsonText(`${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`) !== undefined)
})

test('reads back every value the canonical serializer writes', () => {
  fc.assert(
    fc.property(jsonValue, fc.constantFrom<JsonSpelling>('compact', 'two-space'), (value, spelling) => {
      assert.deepEqual(parseJsonText(serializeCanonicalJson(value, spelling)), { value })
    }),
    propertyRuns(500),
  )
})

test('accepts exactly the text JSON.parse accepts', () => {
  const jsonish = fc.string({ maxLength: 12, unit: fc.constantFrom(...'{}[],:"\\ \n-+.0123456789eEtruefalsn/bu\u0001x') })
  fc.assert(
    fc.property(jsonish, (text) => {
      let accepted = true
      try {
        JSON.parse(text)
      } catch {
        accepted = false
      }
      assert.equal(parseJsonText(text) !== undefined, accepted)
    }),
    propertyRuns(2000),
  )
})

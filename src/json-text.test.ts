import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfDocument, AdfNode } from './adf/document.ts'
import type { JsonSpelling } from './canonical-json.ts'
import { adfToHtml } from './html/emit/adf-to-html.ts'
import { adfToLosslessMarkdown } from './markdown/emit/adf-to-markdown.ts'
import { adfToPortableMarkdown } from './markdown/portable/adf-to-portable-markdown.ts'
import { htmlToAdf } from './html/parse/html-to-adf.ts'
import { jsonValue, propertyRuns } from './conformance/property-harness.ts'
import { losslessMarkdownToAdf } from './markdown/parse/markdown-to-adf.ts'
import { parseJsonText } from './json-text.ts'
import { portableMarkdownToAdf } from './markdown/portable/portable-markdown-to-adf.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

test('reads every JSON value kind', () => {
  assert.deepEqual(parseJsonText(' {"a":[1,-0.5e2,true,false,null,"x"],"b":{}} '), { value: { a: [1, -50, true, false, null, 'x'], b: {} } })
  assert.deepEqual(parseJsonText('[]'), { value: [] })
  assert.deepEqual(parseJsonText('[ ]'), { value: [] })
  assert.deepEqual(parseJsonText('{ }'), { value: {} })
  assert.deepEqual(parseJsonText('[[],{}]'), { value: [[], {}] })
  assert.ok(Object.is(parseJsonText('-0').value, -0))
})

test('decodes every string escape', () => {
  assert.deepEqual(parseJsonText('"\\"\\\\\\/\\b\\f\\n\\r\\t\\u00e9\\uD83C\\uDF89\\ud800"'), { value: '"\\/\b\f\n\r\té\u{1f389}\ud800' })
})

test('keys stay the keys the text spells after JSON.parse has read a key holding a backslash (https://issues.chromium.org/issues/521080746)', () => {
  const canary = '{"\\r":1,"\\f":2}'
  JSON.parse(canary)
  JSON.parse('{"\\r":3,"\\\\":4}')
  assert.deepEqual(Object.keys(parseJsonText(canary).value ?? {}), ['\r', '\f'])
})

test('a __proto__ key is an own key', () => {
  const read = parseJsonText('{"__proto__":{"a":1}}').value
  assert.deepEqual(Object.keys(read ?? {}), ['__proto__'])
  assert.equal(Object.getPrototypeOf(read), Object.prototype)
})

test('a repeated key keeps its first position and its last value, as JSON.parse does', () => {
  const read = parseJsonText('{"a":1,"b":2,"a":3}').value
  assert.deepEqual(read, { a: 3, b: 2 })
  assert.deepEqual(Object.keys(read ?? {}), ['a', 'b'])
})

test('refuses a number past the double range, which JSON.parse reads as Infinity', () => {
  assert.deepEqual(parseJsonText('1e999'), { refusal: 'non-finite' })
  assert.deepEqual(parseJsonText('[-1e999]'), { refusal: 'non-finite' })
  assert.deepEqual(parseJsonText('[1e999,'), { refusal: 'syntax' })
})

test('refuses text JSON.parse refuses', () => {
  const refused = ['', ' ', '{', '[', '[1', '[1,', '[1,]', '{"a"}', '{"a":}', '{"a":1,}', '{a:1}', '{"a" 1}', '{,}', '01', '1.', '.5', '-', '1e', '+1', '"a', '"\u0001"', '"\\x"', '"\\u12"', '"\\u12g4"', 'tru', 'nul', '1 2', '[1]]', '}', "'a'", 'NaN', '\u00a01']
  for (const text of refused) {
    assert.throws(() => JSON.parse(text), SyntaxError, text)
    assert.deepEqual(parseJsonText(text), { refusal: 'syntax' }, text)
  }
})

test('reads a value nested far past the call stack without recursing', () => {
  const depth = 100_000
  assert.ok(parseJsonText(`${'['.repeat(depth)}${']'.repeat(depth)}`).value !== undefined)
  assert.ok(parseJsonText(`${'{"a":'.repeat(depth)}1${'}'.repeat(depth)}`).value !== undefined)
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
      assert.equal(parseJsonText(text).refusal !== 'syntax', accepted)
    }),
    propertyRuns(2000),
  )
})

test('no reader reads JSON text with JSON.parse, which parseJsonText stands in for', () => {
  const unknownBlock: AdfNode = { attrs: { a: [1, { b: 'c' }] }, content: [{ text: 'x', type: 'text' }], type: 'unknownBlock' }
  const unknownInline: AdfNode = { attrs: { a: { b: 2 } }, type: 'unknownInline' }
  const table: AdfNode = {
    content: [{ content: [{ attrs: { colwidth: [100, 200] }, content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'tableCell' }], type: 'tableRow' }],
    type: 'table',
  }
  const marked: AdfNode = { content: [{ marks: [{ attrs: { color: '#fff' }, type: 'textColor' }], text: 'x', type: 'text' }, unknownInline], type: 'paragraph' }
  const document: AdfDocument = { content: [unknownBlock, table, marked, { attrs: { panelType: 'info' }, content: [marked], type: 'panel' }], type: 'doc', version: 1 }
  const spellings = [adfToLosslessMarkdown(document), adfToPortableMarkdown(document), adfToHtml(document)]
  const [lossless, portable, html] = spellings.map((spelled) => (spelled.ok ? spelled.value : undefined))
  assert.ok(lossless !== undefined && portable !== undefined && html !== undefined)
  const parse = JSON.parse
  let called = 0
  JSON.parse = (...args: Parameters<typeof JSON.parse>) => {
    called += 1
    return parse(...args)
  }
  try {
    const read = [losslessMarkdownToAdf(lossless), portableMarkdownToAdf(portable), htmlToAdf(html)]
    assert.deepEqual(
      read.map((result) => result.ok),
      [true, true, true],
    )
  } finally {
    JSON.parse = parse
  }
  assert.equal(called, 0)
})

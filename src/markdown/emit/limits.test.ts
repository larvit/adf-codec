import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessMarkdown, losslessMarkdownToAdf } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : { content, type: 'paragraph' }
}

function code(result: Result<string>): string {
  return result.ok ? `emitted ${JSON.stringify(result.value)}` : result.error.code
}

function markdown(result: Result<string>): string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function path(result: Result<string>): readonly (number | string)[] {
  return result.ok ? ['emitted'] : result.error.path
}

function position(result: Result<string>): unknown {
  return result.ok ? 'emitted' : result.error.position
}

test('names the node a refusal came from, and no source the emitter never read', () => {
  const unspellable: AdfNode = { text: 'x', type: 'paragraph' }
  const list: AdfNode = { content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }, { content: [unspellable], type: 'listItem' }], type: 'bulletList' }
  assert.deepEqual(path(adfToLosslessMarkdown(document(paragraph({ text: 'x', type: 'text' }), list))), ['content', 1, 'content', 1, 'content', 0])
  assert.deepEqual(path(adfToLosslessMarkdown(document(paragraph({ text: 'x', type: 'text' }, { text: 'x', type: 'status' })))), ['content', 0, 'content', 1])
  assert.deepEqual(path(adfToLosslessMarkdown({ type: 'doc', version: 2 })), [])
  assert.equal(position(adfToLosslessMarkdown(document(paragraph({ text: 'x', type: 'text' }), list))), undefined)
})

test('refuses a node whose carry nests too deep ahead of a later node in its line', () => {
  let id: JsonValue = 'a'
  for (let depth = 0; depth < largestNesting; depth += 1) id = { id }
  const twiceStrong: AdfNode = { marks: [{ type: 'strong' }, { type: 'strong' }], text: 'x', type: 'text' }
  const refused = adfToLosslessMarkdown(document(paragraph({ attrs: { id }, type: 'mention' }, twiceStrong)))
  assert.equal(code(refused), 'unsupported-nesting-depth')
  assert.deepEqual(path(refused), ['content', 0, 'content', 0])
})

test('refuses a carried run at the node whose carry nests too deep, among the run\'s own nodes', () => {
  let deep: JsonValue = 'a'
  for (let depth = 0; depth < largestNesting - 1; depth += 1) deep = { deep }
  const carriedEm: AdfNode = { marks: [{ attrs: { deep }, type: 'em' }], text: 'x', type: 'text' }
  const twiceStrong: AdfNode = { marks: [{ type: 'strong' }, { type: 'strong' }], text: 'y', type: 'text' }
  const refused = adfToLosslessMarkdown(document(paragraph({ text: 'ok', type: 'text' }, carriedEm, twiceStrong)))
  assert.equal(code(refused), 'unsupported-nesting-depth')
  assert.deepEqual(path(refused), ['content', 0, 'content', 1])
})

test('refuses a value that is not an ADF document, naming the check it failed', () => {
  assert.equal(markdown(adfToLosslessMarkdown({ type: 'doc', version: Number.NaN })), 'not-an-adf-document: an ADF document holds a version number: found NaN')
})

// The code, and the bound the message names.
function pastTheBound(result: Result<string>): boolean {
  return !result.ok && result.error.code === 'unsupported-node-shape' && result.error.message.includes('536870888')
}

// A code block of 300 lines; two of these together fall some 1000 characters short of V8's longest string, so only what their spelling adds passes it.
function nearlyHalfTheBound(): AdfNode {
  return { attrs: {}, content: [{ text: `${'a'.repeat(894_782)}\n`.repeat(300), type: 'text' }], type: 'codeBlock' }
}

// About 556 million characters of carry JSON: past V8's longest string, short of JavaScriptCore's and SpiderMonkey's.
test('refuses a carry whose JSON would run past V8\'s longest string, on every engine', () => {
  let value: JsonValue = new Array<JsonValue>(560_000).fill(0)
  for (let level = 0; level < 495; level += 1) value = [value]
  const result = adfToLosslessMarkdown(document({ attrs: { value }, type: 'unknownBlock' }))
  assert.equal(pastTheBound(result), true)
})

test('refuses a quote whose prefixed lines would pass V8\'s longest string', () => {
  const code = nearlyHalfTheBound()
  assert.equal(pastTheBound(adfToLosslessMarkdown(document({ content: [code, code], type: 'blockquote' }))), true)
})

// A code block written as its text plus 53 characters; a blank line parts two blocks, and the markdown ends with a line break.
function codeBlockOf(textLength: number): AdfNode {
  return { attrs: {}, content: [{ text: `${'a'.repeat(textLength - 1)}\n`, type: 'text' }], type: 'codeBlock' }
}

test('refuses markdown one character past V8\'s longest string', () => {
  const code = codeBlockOf(268_435_390)
  assert.equal(pastTheBound(adfToLosslessMarkdown(document(code, code))), true)
})

test('writes markdown exactly as long as V8\'s longest string', () => {
  const code = codeBlockOf(178_956_908)
  const written = adfToLosslessMarkdown(document(code, code, code))
  assert.equal(written.ok && written.value.length, 536870888)
})

test('refuses text past V8\'s longest string', () => {
  const long = 'a'.repeat(2 ** 28)
  const result = adfToLosslessMarkdown(document(paragraph({ text: long, type: 'text' }, { text: long, type: 'text' }, { text: long, type: 'text' })))
  assert.equal(pastTheBound(result), true)
})

// Bun stops a test after 5 s by default, and this one writes and reads back a line of 33 million characters.
test('escapes more characters in a line than V8\'s Set holds', { timeout: 60000 }, () => {
  const stars = '*'.repeat(2 ** 24 + 1)
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ text: stars, type: 'text' })))), `${'\\*'.repeat(2 ** 24 + 1)}\n`)
})

test('refuses a document version the markdown cannot carry', () => {
  assert.equal(code(adfToLosslessMarkdown({ type: 'doc', version: 2 })), 'unsupported-document-version')
})

test('refuses a carried node nested deeper than the levels its position leaves', () => {
  let node: AdfNode = { type: 'blockCard' }
  for (let depth = 0; depth < 600; depth += 1) node = { content: [node], type: 'blockCard' }
  assert.equal(code(adfToLosslessMarkdown(document(node))), 'unsupported-nesting-depth')
  assert.equal(code(adfToLosslessMarkdown(document(paragraph(node)))), 'unsupported-nesting-depth')
  let shallow: AdfNode = { type: 'blockCard' }
  for (let depth = 0; depth < 200; depth += 1) shallow = { content: [shallow], type: 'blockCard' }
  assert.ok(adfToLosslessMarkdown(document(shallow)).ok)
  let quoted: AdfNode = shallow
  for (let depth = 0; depth < 150; depth += 1) quoted = { content: [quoted], type: 'blockquote' }
  assert.equal(code(adfToLosslessMarkdown(document(quoted))), 'unsupported-nesting-depth')
})

test('refuses marks and attributes nested deeper than the emitter carries', () => {
  const marks: AdfMark[] = Array.from({ length: 600 }, (_, index) => ({ type: index % 2 === 0 ? 'em' : 'strong' }))
  assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks, text: 'x', type: 'text' })))), 'unsupported-nesting-depth')
  const deepest: AdfMark[] = Array.from({ length: 20_000 }, (_, index) => ({ type: index % 2 === 0 ? 'em' : 'strong' }))
  assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks: deepest, text: 'x', type: 'text' }, { type: 'hardBreak' }, { marks: deepest, text: 'y', type: 'text' })))), 'unsupported-nesting-depth')
  let attrs: AdfMark['attrs'] = { depth: 'x' }
  for (let depth = 0; depth < 600; depth += 1) attrs = { depth: attrs }
  const deeper = (key: string, type: string): string =>
    `unsupported-nesting-depth: the ${key} attribute of ${type} nests deeper than the ${largestNesting} levels an attribute carries`
  const nested = (levels: number): JsonValue => {
    let value: JsonValue = 1
    for (let level = 0; level < levels; level += 1) value = [value]
    return value
  }
  const card = (levels: number): AdfNode => ({ attrs: { data: nested(levels), url: 'https://example.com/a' }, type: 'inlineCard' })
  const marked = (levels: number): AdfNode => ({
    attrs: { panelType: 'info' },
    content: [paragraph({ text: 'x', type: 'text' })],
    marks: [{ attrs: { deep: nested(levels) }, type: 'em' }],
    type: 'panel',
  })
  const roundTrips = (node: AdfNode): void => {
    const spelled = adfToLosslessMarkdown(document(node))
    assert.ok(spelled.ok, spelled.ok ? '' : spelled.error.message)
    const read = losslessMarkdownToAdf(spelled.value)
    assert.ok(read.ok, read.ok ? '' : read.error.message)
    assert.deepEqual(read.value, document(node))
  }

  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ attrs, type: 'em' }], text: 'x', type: 'text' })))), deeper('depth', 'em'))
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ attrs: { deep: nested(largestNesting) }, type: 'em' }], text: 'x', type: 'text' })))),
    `unsupported-nesting-depth: a carried node's JSON nests deeper than the ${largestNesting} levels its position leaves`,
  )
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph(card(largestNesting + 1))))), deeper('data', 'inlineCard'))
  assert.deepEqual(path(adfToLosslessMarkdown(document(paragraph(card(largestNesting + 1))))), [])
  roundTrips(paragraph(card(largestNesting)))
  assert.equal(markdown(adfToLosslessMarkdown(document(marked(largestNesting - 2)))), deeper('marks', 'panel'))
  assert.deepEqual(path(adfToLosslessMarkdown(document(marked(largestNesting - 2)))), ['content', 0])
  const markedCode: AdfNode = { content: [{ text: 'x', type: 'text' }], marks: [{ attrs: { deep: nested(largestNesting - 2) }, type: 'em' }], type: 'codeBlock' }
  assert.equal(markdown(adfToLosslessMarkdown(document(markedCode))), deeper('marks', 'codeBlock'))
  roundTrips(marked(largestNesting - 3))
})

test('refuses a document nested deeper than the emitter carries', () => {
  let node: AdfNode = paragraph({ text: 'x', type: 'text' })
  for (let depth = 0; depth < 600; depth += 1) node = { content: [node], type: 'blockquote' }
  assert.equal(code(adfToLosslessMarkdown(document(node))), 'unsupported-nesting-depth')
  let carried: AdfNode = paragraph({ text: 'x', type: 'text' })
  for (let depth = 0; depth < 500; depth += 1) carried = { content: [carried], type: 'blockquote' }
  assert.ok(adfToLosslessMarkdown(document(carried)).ok)
  const listed = (levels: number, first: readonly AdfNode[]): AdfNode => {
    let list: AdfNode = { content: [{ content: [...first], type: 'listItem' }], type: 'bulletList' }
    for (let level = 1; level < levels; level += 1) list = { content: [{ content: [...first, list], type: 'listItem' }], type: 'bulletList' }
    return list
  }
  assert.ok(adfToLosslessMarkdown(document(listed(largestNesting, [paragraph({ text: 'x', type: 'text' })]))).ok)
  assert.equal(code(adfToLosslessMarkdown(document(listed(largestNesting + 1, [paragraph({ text: 'x', type: 'text' })])))), 'unsupported-nesting-depth')
  const directiveLists = largestNesting / 2
  const deep = document(listed(directiveLists, [{ type: 'rule' }]))
  assert.deepEqual(losslessMarkdownToAdf(markdown(adfToLosslessMarkdown(deep))), { ok: true, value: deep })
  assert.equal(code(adfToLosslessMarkdown(document(listed(directiveLists + 1, [{ type: 'rule' }])))), 'unsupported-nesting-depth')
  assert.equal(code(adfToLosslessMarkdown(document({ content: [listed(directiveLists, [{ type: 'rule' }])], type: 'panel' }))), 'unsupported-nesting-depth')
  const chain = (levels: number): AdfNode => {
    let card: AdfNode = { type: 'blockCard' }
    for (let level = 0; level < levels; level += 1) card = { content: [card], type: 'blockCard' }
    return card
  }
  const carriedInItem = (levels: number): AdfDocument => document(listed(1, [{ type: 'rule' }, chain(levels)]))
  assert.deepEqual(losslessMarkdownToAdf(markdown(adfToLosslessMarkdown(carriedInItem(248)))), { ok: true, value: carriedInItem(248) })
  assert.equal(code(adfToLosslessMarkdown(carriedInItem(249))), 'unsupported-nesting-depth')
})

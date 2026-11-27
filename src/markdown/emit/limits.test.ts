import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessMarkdown, adfToPortableMarkdown, losslessMarkdownToAdf } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'
import { success } from '../../result.ts'

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
	const id = wrapped<JsonValue>(largestNesting, 'a', (inner) => ({ id: inner }))
	const twiceStrong: AdfNode = { marks: [{ type: 'strong' }, { type: 'strong' }], text: 'x', type: 'text' }
	const refused = adfToLosslessMarkdown(document(paragraph({ attrs: { id }, type: 'mention' }, twiceStrong)))
	assert.equal(code(refused), 'unsupported-nesting-depth')
	assert.deepEqual(path(refused), ['content', 0, 'content', 0])
	const listed = adfToLosslessMarkdown(document({ content: [{ content: [paragraph({ attrs: { id }, type: 'mention' })], type: 'listItem' }], type: 'bulletList' }))
	assert.deepEqual(path(listed), ['content', 0, 'content', 0, 'content', 0, 'content', 0])
})

test('refuses a carried run at the node whose carry nests too deep, among the run\'s own nodes', () => {
	const deep = wrapped<JsonValue>(largestNesting - 1, 'a', (inner) => ({ deep: inner }))
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

// Indented at every level, this carry's JSON ran to about 556 million characters, past V8's longest string.
test('writes a carry of deeply nested JSON in a length linear in the JSON, and reads it back', () => {
	const value = wrapped<JsonValue>(495, new Array<JsonValue>(560_000).fill(0), (inner) => [inner])
	const carried = document({ attrs: { value }, type: 'unknownBlock' })
	const written = adfToLosslessMarkdown(carried)
	assert.ok(written.ok)
	assert.ok(written.value.length < 1.01 * JSON.stringify(value).length)
	assert.deepEqual(losslessMarkdownToAdf(written.value), success(carried))
})

test('refuses a carry whose JSON alone would run past V8\'s longest string', () => {
	const shared = 'a'.repeat(2 ** 24)
	const attrs = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`key${index}`, shared]))
	assert.equal(pastTheBound(adfToLosslessMarkdown(document({ attrs, type: 'unknownBlock' }))), true)
})

test('refuses a carry whose two strings of 2^28 characters together pass V8\'s longest string, before spelling the second', { timeout: 60000 }, () => {
	const long = 'a'.repeat(2 ** 28)
	assert.equal(pastTheBound(adfToLosslessMarkdown(document({ attrs: { first: long, second: long }, type: 'unknownBlock' }))), true)
})

test('writes a carry holding one key of 2^28 characters', { timeout: 60000 }, () => {
	assert.equal(adfToLosslessMarkdown(document({ attrs: { ['a'.repeat(2 ** 28)]: 1 }, type: 'unknownBlock' })).ok, true)
})

test('refuses a quote whose prefixed lines would pass V8\'s longest string', { timeout: 60000 }, () => {
	const code = nearlyHalfTheBound()
	assert.equal(pastTheBound(adfToLosslessMarkdown(document({ content: [code, code], type: 'blockquote' }))), true)
})

// A code block written as its text plus 53 characters; a blank line parts two blocks, and the markdown ends with a line break.
function codeBlockOf(textLength: number): AdfNode {
	return { attrs: {}, content: [{ text: `${'a'.repeat(textLength - 1)}\n`, type: 'text' }], type: 'codeBlock' }
}

test('refuses markdown one character past V8\'s longest string', { timeout: 60000 }, () => {
	const code = codeBlockOf(268_435_390)
	assert.equal(pastTheBound(adfToLosslessMarkdown(document(code, code))), true)
})

test('writes markdown exactly as long as V8\'s longest string', { timeout: 60000 }, () => {
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

function refusedLine(result: Result<string>): string {
	return result.ok ? 'emitted' : `${result.error.code} ${JSON.stringify(result.error.path)} ${result.error.message.includes('33554432')}`
}

test('refuses a line of text one character past 2^25, at its paragraph', { timeout: 60000 }, () => {
	const text = 'a'.repeat(2 ** 25 + 1)
	assert.equal(refusedLine(adfToLosslessMarkdown(document(paragraph({ text, type: 'text' })))), 'unsupported-node-shape ["content",0] true')
})

// Bun stops a test after 5 s by default, and this one writes and reads back a line of 2^25 characters.
test('writes a line of text of exactly 2^25 characters', { timeout: 60000 }, () => {
	const text = 'a'.repeat(2 ** 25)
	assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ text, type: 'text' })))), `${text}\n`)
})

test('writes an image as a line of exactly 2^25 characters', { timeout: 60000 }, () => {
	const url = `https://example.com/${'a'.repeat(2 ** 25 - 25)}`
	const image = { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url }, type: 'media' }], type: 'mediaSingle' }
	assert.equal(markdown(adfToLosslessMarkdown(document(image))), `![](${url})\n`)
})

test('refuses a link line one character past 2^25, at its heading', { timeout: 60000 }, () => {
	const href = `https://example.com/${'a'.repeat(2 ** 25 - 24)}`
	const link = { attrs: { href }, type: 'link' }
	const heading = { attrs: { level: 1 }, content: [{ marks: [link], text: 'a', type: 'text' }], type: 'heading' }
	assert.equal(refusedLine(adfToLosslessMarkdown(document(heading))), 'unsupported-node-shape ["content",0] true')
})

test('writes an image whose url runs past 2^25 characters as its directive', { timeout: 60000 }, () => {
	const image = { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: `https://example.com/${'a'.repeat(2 ** 25)}` }, type: 'media' }], type: 'mediaSingle' }
	const written = adfToLosslessMarkdown(document(image))
	assert.equal(written.ok && written.value.startsWith('!adf:mediaSingle {layout=center}\n!adf:media {type=external url="https://example.com/'), true)
})

test('refuses an image line one character past 2^25 in portable markdown, at its block', { timeout: 60000 }, () => {
	const image = { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: `https://example.com/${'a'.repeat(2 ** 25 - 24)}` }, type: 'media' }], type: 'mediaSingle' }
	assert.equal(refusedLine(adfToPortableMarkdown(document(image))), 'unsupported-node-shape ["content",0] true')
})

test('refuses a document version the markdown cannot carry', () => {
	assert.equal(code(adfToLosslessMarkdown({ type: 'doc', version: 2 })), 'unsupported-document-version')
})

test('refuses a carried node nested deeper than the levels its position leaves', () => {
	const node = wrapped<AdfNode>(600, { type: 'blockCard' }, (inner) => ({ content: [inner], type: 'blockCard' }))
	assert.equal(code(adfToLosslessMarkdown(document(node))), 'unsupported-nesting-depth')
	assert.equal(code(adfToLosslessMarkdown(document(paragraph(node)))), 'unsupported-nesting-depth')
	const shallow = wrapped<AdfNode>(200, { type: 'blockCard' }, (inner) => ({ content: [inner], type: 'blockCard' }))
	assert.ok(adfToLosslessMarkdown(document(shallow)).ok)
	const quoted = wrapped<AdfNode>(150, shallow, (inner) => ({ content: [inner], type: 'blockquote' }))
	assert.equal(code(adfToLosslessMarkdown(document(quoted))), 'unsupported-nesting-depth')
})

test('refuses marks and attributes nested deeper than the emitter carries', () => {
	const marks: AdfMark[] = Array.from({ length: 600 }, (_, index) => ({ type: index % 2 === 0 ? 'em' : 'strong' }))
	assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks, text: 'x', type: 'text' })))), 'unsupported-nesting-depth')
	const deepest: AdfMark[] = Array.from({ length: 20_000 }, (_, index) => ({ type: index % 2 === 0 ? 'em' : 'strong' }))
	assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks: deepest, text: 'x', type: 'text' }, { type: 'hardBreak' }, { marks: deepest, text: 'y', type: 'text' })))), 'unsupported-nesting-depth')
	const attrs = wrapped<AdfAttributes>(600, { depth: 'x' }, (inner) => ({ depth: inner }))
	const deeper = (key: string, type: string): string =>
		`unsupported-nesting-depth: the ${key} attribute of ${type} nests deeper than the ${largestNesting} levels an attribute carries`
	const nested = (levels: number): JsonValue => wrapped<JsonValue>(levels, 1, (inner) => [inner])
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
	const node = wrapped<AdfNode>(600, paragraph({ text: 'x', type: 'text' }), (inner) => ({ content: [inner], type: 'blockquote' }))
	assert.equal(code(adfToLosslessMarkdown(document(node))), 'unsupported-nesting-depth')
	const carried = wrapped<AdfNode>(500, paragraph({ text: 'x', type: 'text' }), (inner) => ({ content: [inner], type: 'blockquote' }))
	assert.ok(adfToLosslessMarkdown(document(carried)).ok)
	const listed = (levels: number, first: readonly AdfNode[]): AdfNode => {
		return wrapped<AdfNode>(levels - 1, { content: [{ content: [...first], type: 'listItem' }], type: 'bulletList' }, (inner) => ({ content: [{ content: [...first, inner], type: 'listItem' }], type: 'bulletList' }))
	}
	assert.ok(adfToLosslessMarkdown(document(listed(largestNesting, [paragraph({ text: 'x', type: 'text' })]))).ok)
	assert.equal(code(adfToLosslessMarkdown(document(listed(largestNesting + 1, [paragraph({ text: 'x', type: 'text' })])))), 'unsupported-nesting-depth')
	const directiveLists = largestNesting / 2
	const deep = document(listed(directiveLists, [{ type: 'rule' }]))
	assert.deepEqual(losslessMarkdownToAdf(markdown(adfToLosslessMarkdown(deep))), { ok: true, value: deep })
	assert.equal(code(adfToLosslessMarkdown(document(listed(directiveLists + 1, [{ type: 'rule' }])))), 'unsupported-nesting-depth')
	assert.equal(code(adfToLosslessMarkdown(document({ content: [listed(directiveLists, [{ type: 'rule' }])], type: 'panel' }))), 'unsupported-nesting-depth')
	const chain = (levels: number): AdfNode => {
		return wrapped<AdfNode>(levels, { type: 'blockCard' }, (inner) => ({ content: [inner], type: 'blockCard' }))
	}
	const carriedInItem = (levels: number): AdfDocument => document(listed(1, [{ type: 'rule' }, chain(levels)]))
	assert.deepEqual(losslessMarkdownToAdf(markdown(adfToLosslessMarkdown(carriedInItem(248)))), { ok: true, value: carriedInItem(248) })
	assert.equal(code(adfToLosslessMarkdown(carriedInItem(249))), 'unsupported-nesting-depth')
})

function wrapped<T>(levels: number, innermost: T, wrap: (inner: T) => T): T {
	let value = innermost
	for (let level = 0; level < levels; level += 1) value = wrap(value)
	return value
}

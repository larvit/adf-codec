import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import { editorNormalForm, sourceIndex, toEditorNormal } from './editor-normal.ts'

function firstChildren(outermost: AdfNode | undefined): AdfNode[] {
	const nodes: AdfNode[] = []
	for (let node = outermost; node !== undefined; node = node.content?.[0]) nodes.push(node)
	return nodes
}

function nested<T>(levels: number, innermost: T, wrap: (inner: T) => T): T {
	let node = innermost
	for (let level = 0; level < levels; level += 1) node = wrap(node)
	return node
}

test('merges adjacent text nodes carrying identical marks, at every level', () => {
	const content: AdfNode[] = [
		{ text: 'a', type: 'text' },
		{ text: 'b', type: 'text' },
		{ marks: [{ type: 'strong' }], text: 'c', type: 'text' },
		{ marks: [{ attrs: {}, type: 'strong' }], text: 'd', type: 'text' },
		{ type: 'hardBreak' },
		{ text: 'e', type: 'text' },
		{ attrs: { localId: '01a0a06b-5281-7f27-9022-8d3a74b0ab0d' }, text: 'f', type: 'text' },
		{ text: 'g', type: 'text' },
		{ attrs: {}, text: 'h', type: 'text' },
	]
	assert.deepEqual(toEditorNormal({ content: [{ attrs: { panelType: 'info' }, content: [{ content, type: 'paragraph' }], type: 'panel' }], type: 'doc', version: 1 }), {
		content: [
			{
				attrs: { panelType: 'info' },
				content: [
					{
						content: [
							{ text: 'ab', type: 'text' },
							{ marks: [{ type: 'strong' }], text: 'cd', type: 'text' },
							{ type: 'hardBreak' },
							{ text: 'e', type: 'text' },
							{ attrs: { localId: '01a0a06b-5281-7f27-9022-8d3a74b0ab0d' }, text: 'f', type: 'text' },
							{ text: 'gh', type: 'text' },
						],
						type: 'paragraph',
					},
				],
				type: 'panel',
			},
		],
		type: 'doc',
		version: 1,
	})
})

test('reads negative zero as zero, as JSON does', () => {
	const marks = [{ attrs: { size: -0 }, type: 'border' }]
	assert.deepEqual(
		toEditorNormal({ content: [{ attrs: { a: -0, b: [{ c: -0 }, null, 'd'] }, content: [{ marks, text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: -0 }),
		{ content: [{ attrs: { a: 0, b: [{ c: 0 }, null, 'd'] }, content: [{ marks: [{ attrs: { size: 0 }, type: 'border' }], text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 0 },
	)
})

test('reads an empty attrs object, marks array or content array as the absent key, except on doc', () => {
	const paragraph: AdfNode = { attrs: {}, content: [{ attrs: {}, marks: [], text: 'a', type: 'text' }, { marks: [{ attrs: {}, type: 'em' }], text: 'b', type: 'text' }], marks: [], type: 'paragraph' }
	assert.deepEqual(toEditorNormal({ content: [paragraph, { content: [], type: 'rule' }], type: 'doc', version: 1 }), {
		content: [{ content: [{ text: 'a', type: 'text' }, { marks: [{ type: 'em' }], text: 'b', type: 'text' }], type: 'paragraph' }, { type: 'rule' }],
		type: 'doc',
		version: 1,
	})
	assert.deepEqual(toEditorNormal({ content: [], type: 'doc', version: 1 }), { content: [], type: 'doc', version: 1 })
	assert.deepEqual(toEditorNormal({ type: 'doc', version: 1 }), { type: 'doc', version: 1 })
})

test('normalizes blocks and mark attributes nesting far past the levels a recursive walk survives', () => {
	const levels = 100000
	const node = nested<AdfNode>(levels, { content: [], type: 'paragraph' }, (inner) => ({ content: [inner], type: 'blockquote' }))
	const normal = firstChildren(toEditorNormal({ content: [node], type: 'doc', version: 1 }).content?.[0])
	assert.equal(normal.length, levels + 1)
	assert.deepEqual(normal.at(-1), { type: 'paragraph' })
	const deep = nested<JsonValue>(2 * levels, 1, (inner) => [inner])
	const marks = [{ attrs: { deep }, type: 'textColor' }]
	const merged = toEditorNormal({ content: [{ content: [{ marks, text: 'a', type: 'text' }, { marks, text: 'b', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 })
	assert.deepEqual(merged.content?.[0]?.content?.map((text) => text.text), ['ab'])
})

test('drops the content a text node holds, and joins the node as any other', () => {
	const holding: AdfNode = { content: [{ text: 'dropped', type: 'text' }], text: 'a', type: 'text' }
	const normal = (content: AdfNode[]): AdfNode[] | undefined => toEditorNormal({ content: [{ content, type: 'paragraph' }], type: 'doc', version: 1 }).content
	assert.deepEqual(normal([holding, { text: 'b', type: 'text' }]), [{ content: [{ text: 'ab', type: 'text' }], type: 'paragraph' }])
	assert.deepEqual(normal([{ text: 'b', type: 'text' }, holding]), [{ content: [{ text: 'ba', type: 'text' }], type: 'paragraph' }])
})

test('counts a node\'s index in a run of its siblings, or alone, in the document it was normalized from', () => {
	const rule: AdfNode = { type: 'rule' }
	const { normal, sources } = editorNormalForm({ content: [rule, { text: 'a', type: 'text' }, { text: 'b', type: 'text' }, { type: 'mention' }, { type: 'rule' }], type: 'doc', version: 1 })
	const content = normal.content ?? []
	assert.deepEqual(content.map((_, index) => sourceIndex(content, index, sources)), [0, 1, 3, 4])
	assert.deepEqual([sourceIndex(content.slice(1, 3), 1, sources), sourceIndex(content.slice(2, 3), 0, sources)], [2, 0])
	assert.equal(sourceIndex([rule], 0, sources), 0)
})

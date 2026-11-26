import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { ConvertErrorCode, ParseError, Result, SourcePosition } from '../../result.ts'
import { adfToLosslessMarkdown, adfToPortableMarkdown, commonMarkToAdf, losslessMarkdownToAdf, portableMarkdownToAdf } from '../../index.ts'

function document(...content: AdfNode[]): AdfDocument {
	return { content, type: 'doc', version: 1 }
}

function text(value: string, ...marks: AdfMark[]): AdfNode {
	return marks.length === 0 ? { text: value, type: 'text' } : { marks, text: value, type: 'text' }
}

function node(type: string, attrs: AdfAttributes, ...content: AdfNode[]): AdfNode {
	const built: AdfNode = Object.keys(attrs).length === 0 ? { type } : { attrs, type }
	return content.length === 0 ? built : { ...built, content }
}

function said(localId: string | undefined, value: string): AdfNode {
	return node('paragraph', localId === undefined ? {} : { localId }, text(value))
}

function written(result: Result<string>): string {
	return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function read(result: Result<AdfDocument, ParseError>): AdfNode[] | string {
	return result.ok ? (result.value.content ?? []) : `${result.error.code}: ${result.error.message}`
}

function spells(content: AdfNode[], markdown: string): void {
	assert.equal(written(adfToLosslessMarkdown(document(...content))), markdown)
	assert.deepEqual(read(losslessMarkdownToAdf(markdown)), content)
}

function errorPath(result: Result<AdfDocument, ParseError>): readonly (number | string)[] {
	return result.ok ? ['built'] : result.error.path
}

function refused(markdown: string, code: ConvertErrorCode, at: SourcePosition, ...facts: string[]): void {
	const result = losslessMarkdownToAdf(markdown)
	assert.equal(result.ok ? `built ${JSON.stringify(result.value)}` : result.error.code, code, markdown)
	if (result.ok) return
	assert.deepEqual(result.error.position, at, markdown)
	for (const fact of facts) assert.ok(result.error.message.includes(fact), `${JSON.stringify(result.error.message)} names ${fact}`)
}

const jiraDescription = [
	node('heading', { level: 2, localId: 'a1b2c3d40001' }, text('Background')),
	node('paragraph', { localId: 'a1b2c3d40002' }, text('Exports time out for accounts with more than '), text('10 000', { type: 'strong' }), text(' rows.')),
	node('heading', { level: 2, localId: 'a1b2c3d40003' }, text('Acceptance criteria')),
	node(
		'bulletList',
		{ localId: 'a1b2c3d40008' },
		node('listItem', { localId: 'a1b2c3d40005' }, said('a1b2c3d40004', 'An export of 50 000 rows finishes within 30 seconds.')),
		node('listItem', { localId: 'a1b2c3d40007' }, said('a1b2c3d40006', 'The user sees progress while it runs.')),
	),
	node('panel', { localId: 'a1b2c3d40009', panelType: 'warning' }, said('a1b2c3d4000a', "Don't change the CSV column order.")),
]

test('writes a Jira description in CommonMark, each id in a marker, and the panel alone as a directive', () => {
	spells(
		jiraDescription,
		[
			'## Background !adf:{localId=a1b2c3d40001}',
			'',
			'!adf:{localId=a1b2c3d40002}',
			'Exports time out for accounts with more than **10 000** rows.',
			'',
			'## Acceptance criteria !adf:{localId=a1b2c3d40003}',
			'',
			'!adf:{localId=a1b2c3d40008}',
			'- !adf:{localId=a1b2c3d40005} An export of 50 000 rows finishes within 30 seconds. !adf:{localId=a1b2c3d40004}',
			'- !adf:{localId=a1b2c3d40007} The user sees progress while it runs. !adf:{localId=a1b2c3d40006}',
			'',
			'!adf:panel warning {localId=a1b2c3d40009}',
			'!adf:{localId=a1b2c3d4000a}',
			"Don't change the CSV column order.",
			'!adf:/panel',
			'',
		].join('\n'),
	)
})

test('writes a paragraph id on the line above it, and on the end of the last line where the paragraph opens a quote or a list item', () => {
	spells([node('paragraph', { localId: 'p1' }, text('first line'), { type: 'hardBreak' }, text('second line'))], '!adf:{localId=p1}\nfirst line\\\nsecond line\n')
	spells([node('blockquote', { localId: 'q1' }, said('p3', 'Quoted text'), said('p4', 'More'))], '!adf:{localId=q1}\n> Quoted text !adf:{localId=p3}\n>\n> !adf:{localId=p4}\n> More\n')
	spells([node('blockquote', {}, node('paragraph', { localId: 'p3' }, text('a'), { type: 'hardBreak' }, text('b')))], '> a\\\n> b !adf:{localId=p3}\n')
	spells([node('bulletList', {}, node('listItem', {}, said('p1', 'First item'), said('p2', 'More')))], '- First item !adf:{localId=p1}\n\n  !adf:{localId=p2}\n  More\n')
})

test('writes a heading id at the end of its line, wherever the heading stands', () => {
	spells([node('heading', { level: 2, localId: 'h1' }, text('Background'))], '## Background !adf:{localId=h1}\n')
	spells([node('blockquote', {}, said(undefined, 'a'), node('heading', { level: 1, localId: 'h 2' }, text('b')))], '> a\n>\n> # b !adf:{localId="h 2"}\n')
	spells([node('bulletList', {}, node('listItem', {}, node('heading', { level: 3, localId: 'h3' }, text('c'))))], '- ### c !adf:{localId=h3}\n')
})

test('writes a list id on the line above the list, and each item id after its marker', () => {
	const items = [node('listItem', { localId: 'i1' }, said('p1', 'First item')), node('listItem', { localId: 'i2' }, said(undefined, 'Second item'))]
	spells([node('bulletList', { localId: 'l1' }, ...items)], '!adf:{localId=l1}\n- !adf:{localId=i1} First item !adf:{localId=p1}\n- !adf:{localId=i2} Second item\n')
	spells([node('orderedList', { localId: 'l1', order: 1 }, ...items)], '!adf:{localId=l1}\n1. !adf:{localId=i1} First item !adf:{localId=p1}\n2. !adf:{localId=i2} Second item\n')
	spells([node('orderedList', { localId: 'l1', order: 2 }, ...items)], '!adf:{localId=l1}\n\n2. !adf:{localId=i1} First item !adf:{localId=p1}\n3. !adf:{localId=i2} Second item\n')
	spells([node('bulletList', {}, node('listItem', {}, said(undefined, 'a'), node('bulletList', { localId: 'l2' }, node('listItem', {}, said(undefined, 'b')))))], '- a\n  !adf:{localId=l2}\n  - b\n')
	const list = node('bulletList', {}, node('listItem', {}, said(undefined, 'a')))
	spells([list, node('bulletList', { localId: 'l2' }, node('listItem', {}, said(undefined, 'b')))], '- a\n\n!adf:{localId=l2}\n* b\n')
	spells([node('bulletList', { localId: 'l3' }, node('listItem', {}), node('listItem', {}, said(undefined, 'b')))], '!adf:{localId=l3}\n\n-\n- b\n')
})

test('writes a quote, code block and rule id on the line above, a blank line parting it from the rule', () => {
	spells([node('blockquote', { localId: 'q1' }, said(undefined, 'a'))], '!adf:{localId=q1}\n> a\n')
	spells([node('codeBlock', { language: 'rust', localId: 'c1' }, text('fn main() {}'))], '!adf:{localId=c1}\n```rust\nfn main() {}\n```\n')
	spells([node('rule', { localId: 'r1' })], '!adf:{localId=r1}\n\n---\n')
	spells([node('blockquote', {}, node('codeBlock', { localId: 'c1' }, text('x')))], '> !adf:{localId=c1}\n> ```\n> x\n> ```\n')
})

test('keeps the directive form where an id has no place beside the CommonMark spelling, or the node carries more', () => {
	spells([node('paragraph', { localId: 'p1' })], '!adf:paragraph {localId=p1}\n!adf:/paragraph\n')
	spells([node('heading', { level: 1, localId: 'h1' })], '!adf:heading {level=1 localId=h1}\n!adf:/heading\n')
	spells([{ attrs: { localId: 'p1' }, content: [text('a')], marks: [{ attrs: { align: 'center' }, type: 'alignment' }], type: 'paragraph' }], '!adf:paragraph {localId=p1 marks="alignment{align=center}"}\na\n!adf:/paragraph\n')
	spells([node('rule', { localId: 'r1', style: 'dashed' })], '!adf:rule {localId=r1 style=dashed}\n')
	spells([node('bulletList', {}, node('listItem', {}, node('codeBlock', { localId: 'c1' }, text('x'))))], '!adf:bulletList\n!adf:listItem\n!adf:{localId=c1}\n```\nx\n```\n!adf:/listItem\n!adf:/bulletList\n')
	spells([node('bulletList', {}, node('listItem', { localId: 'i1' }, node('heading', { level: 1 }, text('h'))))], '!adf:bulletList\n!adf:listItem {localId=i1}\n# h\n!adf:/listItem\n!adf:/bulletList\n')
	spells([node('bulletList', { localId: 'l1' }, node('listItem', { localId: 'i1' }), node('listItem', {}, said('p1', 'b')))], '!adf:bulletList {localId=l1}\n!adf:listItem {localId=i1}\n!adf:/listItem\n!adf:listItem\n!adf:{localId=p1}\nb\n!adf:/listItem\n!adf:/bulletList\n')
	const aligned: AdfNode = { content: [text('a')], marks: [{ attrs: { align: 'center' }, type: 'alignment' }], type: 'paragraph' }
	spells([node('bulletList', {}, node('listItem', { localId: 'i1' }, aligned, said(undefined, 'b')))], '!adf:bulletList\n!adf:listItem {localId=i1}\n!adf:paragraph {marks="alignment{align=center}"}\na\n!adf:/paragraph\nb\n!adf:/listItem\n!adf:/bulletList\n')
	assert.equal(written(adfToLosslessMarkdown(document(node('paragraph', { localId: 5 }, text('a'))))), '```adf:paragraph\n{\n  "attrs": {\n    "localId": 5\n  },\n  "content": [\n    {\n      "text": "a",\n      "type": "text"\n    }\n  ]\n}\n```\n')
})

test('escapes a literal text spelling a marker, and spells an id holding one in quotes', () => {
	spells([said(undefined, 'a !adf:{localId=x}')], 'a \\!adf:{localId=x}\n')
	spells([said(undefined, '!adf:{localId=x}')], '\\!adf:{localId=x}\n')
	spells([node('blockquote', {}, said('p', 'a !adf:{localId=x}'))], '> a \\!adf:{localId=x} !adf:{localId=p}\n')
	spells([node('blockquote', {}, said(' !adf:{x=y}', 'a'))], '> a !adf:{localId=" !adf:{x=y}"}\n')
	spells([node('heading', { level: 1, localId: '' }, text('a'))], '# a !adf:{localId=""}\n')
	spells([node('blockquote', {}, said(' !adf:{', 'a'))], '> a !adf:{localId=" !adf:{"}\n')
})

test('reads an item opening with braces after other text as text', () => {
	assert.deepEqual(read(losslessMarkdownToAdf('- abcde{a=b} c\n')), [node('bulletList', {}, node('listItem', {}, said(undefined, 'abcde{a=b} c')))])
})

test('reads the directive form 0.3 wrote for a node holding only an id', () => {
	const directives = [
		'!adf:heading {level=2 localId=a1b2c3d40001}', 'Background', '!adf:/heading', '',
		'!adf:paragraph {localId=a1b2c3d40002}', 'Exports time out for accounts with more than **10 000** rows.', '!adf:/paragraph', '',
		'!adf:heading {level=2 localId=a1b2c3d40003}', 'Acceptance criteria', '!adf:/heading', '',
		'!adf:bulletList {localId=a1b2c3d40008}',
		'!adf:listItem {localId=a1b2c3d40005}', '!adf:paragraph {localId=a1b2c3d40004}', 'An export of 50 000 rows finishes within 30 seconds.', '!adf:/paragraph', '!adf:/listItem',
		'!adf:listItem {localId=a1b2c3d40007}', '!adf:paragraph {localId=a1b2c3d40006}', 'The user sees progress while it runs.', '!adf:/paragraph', '!adf:/listItem',
		'!adf:/bulletList', '',
		'!adf:panel warning {localId=a1b2c3d40009}', '!adf:paragraph {localId=a1b2c3d4000a}', "Don't change the CSV column order.", '!adf:/paragraph', '!adf:/panel', '',
	]
	assert.deepEqual(read(losslessMarkdownToAdf(directives.join('\n'))), jiraDescription)
	assert.deepEqual(read(losslessMarkdownToAdf('!adf:bulletList\n!adf:listItem {localId=i1}\na\n!adf:/listItem\n!adf:/bulletList\n')), [node('bulletList', {}, node('listItem', { localId: 'i1' }, said(undefined, 'a')))])
	assert.deepEqual(read(losslessMarkdownToAdf('!adf:orderedList {localId=l1 order=3}\n!adf:listItem\na\n!adf:/listItem\n!adf:/orderedList\n')), [node('orderedList', { localId: 'l1', order: 3 }, node('listItem', {}, said(undefined, 'a')))])
	assert.deepEqual(read(losslessMarkdownToAdf('!adf:blockquote {localId=q1}\na\n!adf:/blockquote\n')), [node('blockquote', { localId: 'q1' }, said(undefined, 'a'))])
	assert.deepEqual(read(losslessMarkdownToAdf('!adf:codeBlock {localId=c1}\n```rust\nx\n```\n!adf:/codeBlock\n')), [node('codeBlock', { language: 'rust', localId: 'c1' }, text('x'))])
	assert.deepEqual(read(losslessMarkdownToAdf('!adf:rule {localId=r1}\n')), [node('rule', { localId: 'r1' })])
	assert.deepEqual(read(losslessMarkdownToAdf('- !adf:paragraph {localId=p1}\n  a\n  !adf:/paragraph\n')), [node('bulletList', {}, node('listItem', {}, said('p1', 'a')))])
	assert.deepEqual(read(losslessMarkdownToAdf('!adf:orderedList {order=1}\n!adf:listItem {localId=i1}\na\n!adf:/listItem\n!adf:/orderedList\n')), [node('orderedList', { order: 1 }, node('listItem', { localId: 'i1' }, said(undefined, 'a')))])
	const items = '!adf:listItem {localId=i1}\na\n!adf:/listItem\n!adf:listItem\nb\n!adf:/listItem\n'
	assert.deepEqual(read(losslessMarkdownToAdf(`!adf:bulletList\n${items}!adf:/bulletList\n`)), [node('bulletList', {}, node('listItem', { localId: 'i1' }, said(undefined, 'a')), node('listItem', {}, said(undefined, 'b')))])
	refused('!adf:blockquote\n!adf:{localId=p}\na\n!adf:/blockquote\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'CommonMark spelling')
})

test('names a marker with no block below it to carry its id', () => {
	refused('!adf:{localId=p}\n', 'malformed-directive', { line: 1, offset: 0 }, 'no block')
	refused('Part.\n\n> !adf:{localId=p}\n', 'malformed-directive', { line: 3, offset: 7 }, 'no block')
	refused('!adf:{localId=p}\n!adf:{localId=q}\nPart.\n', 'malformed-directive', { line: 2, offset: 17 }, 'two')
	assert.deepEqual(errorPath(losslessMarkdownToAdf('!adf:{localId=p}\n')), ['content', 0])
	assert.deepEqual(errorPath(losslessMarkdownToAdf('Part.\n\n> !adf:{localId=p}\n')), ['content', 1, 'content', 0])
})

test('refuses a marker whose blank line does not match its block', () => {
	refused('!adf:{localId=p}\n\nPart.\n', 'malformed-directive', { line: 1, offset: 0 }, 'right above')
	refused('!adf:{localId=r}\n---\n', 'malformed-directive', { line: 1, offset: 0 }, 'blank line')
	refused('!adf:{localId=l}\n2. a\n', 'malformed-directive', { line: 1, offset: 0 }, 'blank line')
	refused('!adf:{localId=a}\n[x]: y\n---\n', 'malformed-directive', { line: 1, offset: 0 }, 'blank line')
	refused('!adf:{localId=a}\n[x]: y\nPart.\n', 'malformed-directive', { line: 1, offset: 0 }, 'right above')
})

test('names a marker standing inline in the wrong place', () => {
	refused('a !adf:{localId=a}\nb\n', 'malformed-directive', { line: 1, offset: 0 }, 'marker', 'end of a paragraph')
	refused('[a !adf:{localId=a}](u)\n', 'malformed-directive', { line: 1, offset: 0 }, 'marker', 'end of a paragraph')
	refused('*a !adf:{localId=a}*\n', 'malformed-directive', { line: 1, offset: 0 }, 'marker', 'end of a paragraph')
})

test('refuses a marker line above a block that takes its id another way or has none', () => {
	refused('!adf:{localId=h}\n# Part\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'heading', 'end of its line')
	refused('> !adf:{localId=p}\n> Part.\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'end of its last line')
	refused('- !adf:{localId=p}\n  Part.\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'list item')
	refused('!adf:{localId=t}\n| a |\n| - |\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'table')
	refused('!adf:{localId=x}\n!adf:panel info\n!adf:/panel\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'panel')
	refused('!adf:{localId=x}\n```adf:blockCard\n{}\n```\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'blockCard')
	refused('!adf:{localId=x}\n![a](/u)\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'mediaSingle')
})

test('names a trailing marker standing where the id takes the line above, or on no CommonMark spelling', () => {
	refused('Part !adf:{localId=p}\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'line above')
	refused('> a\n>\n> Part !adf:{localId=p}\n', 'unsupported-node-shape', { line: 3, offset: 6 }, 'line above')
	refused('!adf:paragraph {localId=p}\nPart !adf:{localId=q}\n!adf:/paragraph\n', 'unsupported-node-shape', { line: 2, offset: 27 }, 'directive')
	refused('!adf:{localId=a}\nPart !adf:{localId=b}\n', 'malformed-directive', { line: 2, offset: 17 }, 'two')
	refused('> Part  !adf:{localId=p}\n', 'malformed-directive', { line: 1, offset: 0 }, 'one space')
	refused('> Part\t !adf:{localId=p}\n', 'malformed-directive', { line: 1, offset: 0 }, 'one space')
	refused('> ![a](/u) !adf:{localId=p}\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'mediaSingle', 'directive')
	refused('## Part\t!adf:{localId=h}\n', 'malformed-directive', { line: 1, offset: 0 }, 'marker')
})

test('reads a trailing marker before the link reference definitions and the setext underline of its paragraph', () => {
	refused('> [a]: /u !adf:{localId=p}\n', 'malformed-directive', { line: 1, offset: 0 }, 'link reference definitions')
	refused('[a]: /u !adf:{localId=h}\n===\n', 'malformed-directive', { line: 1, offset: 0 }, 'link reference definitions')
	assert.deepEqual(read(losslessMarkdownToAdf('Part !adf:{localId=h}\n===\n')), [node('heading', { level: 1, localId: 'h' }, text('Part'))])
	assert.deepEqual(read(losslessMarkdownToAdf('> [a]: /u\n> Part !adf:{localId=p}\n')), [node('blockquote', {}, said('p', 'Part'))])
})

test('names an item marker standing before no paragraph', () => {
	refused('- !adf:{localId=i} # Part\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'paragraph')
	refused('- !adf:{localId=i} ![a](/u)\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'paragraph')
	refused('- !adf:{localId=i} [a]: /u\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'opens with no paragraph')
	refused('- !adf:{localId=i} \n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'first line')
})

test('names a marker spelled outside its one canonical form', () => {
	refused('!adf:{localId="p"}\nPart.\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'localId=p')
	refused('!adf:{level=2}\nPart.\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'localId alone', 'level')
	refused('!adf:{}\nPart.\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'localId alone', 'no key')
	refused('- !adf:{localId=i style=x} Part\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'localId alone', 'style')
	refused('# Part !adf:{localId="h"}\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'localId=h')
	refused('!adf:{localId=p b=1}\nPart.\n', 'malformed-directive', { line: 1, offset: 0 }, 'alphabetical')
	refused('!adf:{localId=p} Part.\n', 'malformed-directive', { line: 1, offset: 0 }, 'a line of its own')
	refused('> !adf:{localId=p} Part.\n', 'malformed-directive', { line: 1, offset: 0 }, 'a line of its own')
	refused('- !adf:{localId=i}Part\n', 'malformed-directive', { line: 1, offset: 0 }, 'a line of its own')
	refused('- !adf:{localId=i}  Part\n', 'malformed-directive', { line: 1, offset: 0 }, 'a line of its own')
	refused('- !adf:{localId=i} \tPart\n', 'malformed-directive', { line: 1, offset: 0 }, 'a line of its own')
	refused('- !adf:{localId=i Part\n', 'malformed-directive', { line: 1, offset: 0 }, 'key=value')
	refused('!adf:{a=1 localId=p}\nPart.\n', 'unsupported-node-shape', { line: 1, offset: 0 }, 'holds a;')
})

test('reads an `!adf:{…}` as text where the reader claims no directive, and the portable writer drops the ids', () => {
	assert.deepEqual(read(portableMarkdownToAdf('!adf:{localId=p}\nPart.\n')), [said(undefined, '!adf:{localId=p} Part.')])
	assert.deepEqual(read(commonMarkToAdf('- !adf:{localId=i} Part !adf:{localId=p}\n')), [node('bulletList', {}, node('listItem', {}, said(undefined, '!adf:{localId=i} Part !adf:{localId=p}')))])
	assert.equal(written(adfToPortableMarkdown(document(...jiraDescription))), [
		'## Background',
		'',
		'Exports time out for accounts with more than **10 000** rows.',
		'',
		'## Acceptance criteria',
		'',
		'- An export of 50 000 rows finishes within 30 seconds.',
		'- The user sees progress while it runs.',
		'',
		'> [!WARNING]',
		'>',
		"> Don't change the CSV column order.",
		'',
	].join('\n'))
})

test('reads no trailing marker from inside a link destination, and reads one standing after a link or holding a link in its id', () => {
	const linked = (href: string): AdfNode => text('a', { attrs: { href }, type: 'link' })
	const inside = '[a](<u !adf:{localId=">)"}'
	assert.deepEqual(read(losslessMarkdownToAdf(inside)), [node('paragraph', {}, linked('u !adf:{localId="'), text('"}'))])
	assert.deepEqual(read(losslessMarkdownToAdf(`# ${inside}`)), [node('heading', { level: 1 }, linked('u !adf:{localId="'), text('"}'))])
	assert.deepEqual(read(losslessMarkdownToAdf(`> ${inside} !adf:{localId=p}`)), [node('blockquote', {}, node('paragraph', { localId: 'p' }, linked('u !adf:{localId="'), text('"}')))])
	assert.deepEqual(read(losslessMarkdownToAdf('# [a](<u>) !adf:{localId=h}')), [node('heading', { level: 1, localId: 'h' }, linked('u'))])
	assert.deepEqual(read(losslessMarkdownToAdf('# Title !adf:{localId=h}')), [node('heading', { level: 1, localId: 'h' }, text('Title'))])
	assert.deepEqual(read(losslessMarkdownToAdf('# Title !adf:{localId="[a](b)"}')), [node('heading', { level: 1, localId: '[a](b)' }, text('Title'))])
})

const linkJoiningText = '[a](<u'
const linkJoiningBlocks: [string, AdfNode][] = [
	['a heading', node('heading', { level: 2, localId: '>)' }, text(linkJoiningText))],
	['a quoted paragraph', node('blockquote', {}, node('paragraph', { localId: '>)' }, text(linkJoiningText)))],
	['a listed paragraph', node('bulletList', {}, node('listItem', {}, node('paragraph', { localId: '>)' }, text(linkJoiningText))))],
]

for (const [where, block] of linkJoiningBlocks) {
	test(`writes the id of ${where} after text that would join its marker to a link as the directive form, which reads back`, () => {
		const markdown = written(adfToLosslessMarkdown(document(block)))
		assert.deepEqual(read(losslessMarkdownToAdf(markdown)), [block], markdown)
	})
}

import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from './adf-document.ts'
import type { Result } from './result.ts'
import { adfToMarkdown } from './index.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return { content, type: 'paragraph' }
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

test('names the node a refusal came from', () => {
  const unspellable: AdfNode = { attrs: { localId: 'a' }, type: 'paragraph' }
  const list: AdfNode = { content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }, { content: [unspellable], type: 'listItem' }], type: 'bulletList' }
  assert.deepEqual(path(adfToMarkdown(document(paragraph({ text: 'x', type: 'text' }), list))), ['content', 1, 'content', 1, 'content', 0])
  assert.deepEqual(path(adfToMarkdown(document(paragraph({ text: 'x', type: 'text' }, { type: 'blockCard' })))), ['content', 0, 'content', 1])
  assert.deepEqual(path(adfToMarkdown({ type: 'doc', version: 2 })), [])
})

test('refuses a value that is not an ADF document', () => {
  assert.equal(code(adfToMarkdown({ type: 'doc', version: Number.NaN })), 'not-an-adf-document')
})

test('refuses a document version the markdown cannot carry', () => {
  assert.equal(code(adfToMarkdown({ type: 'doc', version: 2 })), 'unsupported-document-version')
})

test('refuses an attribute the canonical form does not spell', () => {
  assert.equal(code(adfToMarkdown(document({ attrs: { localId: 'a' }, type: 'paragraph' }))), 'unspelled-node-attribute')
  assert.equal(code(adfToMarkdown(document({ attrs: { wrap: true }, type: 'codeBlock' }))), 'unspelled-node-attribute')
  assert.equal(code(adfToMarkdown(document(paragraph({ attrs: { localId: 'a' }, type: 'hardBreak' }, { text: 'x', type: 'text' })))), 'unspelled-node-attribute')
})

test('refuses marks on a block node', () => {
  assert.equal(code(adfToMarkdown(document({ marks: [{ type: 'border' }], type: 'blockquote' }))), 'unspelled-block-marks')
})

test('refuses an ordered list whose markdown start is ambiguous', () => {
  const items: AdfNode[] = [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }]
  assert.equal(code(adfToMarkdown(document({ content: items, type: 'orderedList' }))), 'ambiguous-attribute-spelling')
  assert.equal(code(adfToMarkdown(document({ attrs: { order: 1 }, content: items, type: 'orderedList' }))), 'ambiguous-attribute-spelling')
  assert.equal(markdown(adfToMarkdown(document({ attrs: { order: 2 }, content: items, type: 'orderedList' }))), '2. x\n')
})

test('refuses the code block info strings the fence cannot hold', () => {
  assert.equal(code(adfToMarkdown(document({ attrs: { language: '' }, type: 'codeBlock' }))), 'ambiguous-attribute-spelling')
  assert.equal(code(adfToMarkdown(document({ attrs: { language: 'adf' }, type: 'codeBlock' }))), 'reserved-adf-language')
  assert.equal(code(adfToMarkdown(document({ attrs: { language: 'a`b' }, type: 'codeBlock' }))), 'unspellable-code-block-language')
  assert.equal(code(adfToMarkdown(document({ attrs: { language: ' sql' }, type: 'codeBlock' }))), 'unspellable-code-block-language')
})

test('refuses a link destination CommonMark cannot spell', () => {
  const link = (href: string): AdfDocument => document(paragraph({ marks: [{ attrs: { href }, type: 'link' }], text: 't', type: 'text' }))
  assert.equal(code(adfToMarkdown(link('https://example.com/a)b'))), 'unspellable-link-destination')
  assert.equal(code(adfToMarkdown(link('https://example.com/a b>c'))), 'unspellable-link-destination')
  assert.equal(code(adfToMarkdown(link('<https://example.com/'))), 'unspellable-link-destination')
  assert.equal(code(adfToMarkdown(link('https://example.com/a\\b'))), 'unspellable-link-destination')
  assert.equal(code(adfToMarkdown(link('https://example.com/?a=1&amp;b=2'))), 'unspellable-link-destination')
  assert.equal(code(adfToMarkdown(link('https://example.com/a\nb'))), 'unspellable-link-destination')
  const entity = 'https://example.com/?a=1&amp;b=2'
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ attrs: { href: entity }, type: 'link' }], text: entity, type: 'text' })))), 'unspellable-link-destination')
  assert.equal(markdown(adfToMarkdown(link('https://en.example.com/a_(b)'))), '[t](https://en.example.com/a_(b))\n')
})

test('refuses a link title CommonMark cannot spell', () => {
  const titled = (title: string): AdfDocument =>
    document(paragraph({ marks: [{ attrs: { href: 'https://example.com/', title }, type: 'link' }], text: 't', type: 'text' }))
  assert.equal(code(adfToMarkdown(titled('He said "hi"'))), 'unspellable-link-title')
  assert.equal(code(adfToMarkdown(titled('a\nb'))), 'unspellable-link-title')
})

test('refuses a link attribute no markdown spelling holds', () => {
  assert.equal(
    code(adfToMarkdown(document(paragraph({ marks: [{ attrs: { href: 'https://example.com/', id: 'x' }, type: 'link' }], text: 't', type: 'text' })))),
    'unspellable-mark',
  )
})

test('refuses a mark the canonical spellings cannot nest', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'annotation' }], text: 'x', type: 'text' })))), 'unspellable-mark')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'code' }, { type: 'strong' }], text: 'x', type: 'text' })))), 'unspellable-mark')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ attrs: { colour: 'red' }, type: 'em' }], text: 'x', type: 'text' })))), 'unspellable-mark')
})

test('refuses whitespace CommonMark cannot hold', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ text: '\fa', type: 'text' })))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'a\rb', type: 'text' })))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'em' }], text: 'x ', type: 'text' }, { text: 'y', type: 'text' })))), 'unspellable-mark')
})

test('refuses a line whose start block parsing would claim', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'code' }], text: '```', type: 'text' })))), 'unspellable-line-start')
})

test('refuses two adjacent lists of the same kind', () => {
  const list: AdfNode = { content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(code(adfToMarkdown(document(list, list))), 'unspellable-adjacent-lists')
})

test('refuses a node type the canonical form does not cover', () => {
  assert.equal(code(adfToMarkdown(document({ type: 'blockCard' }))), 'unsupported-node-type')
  assert.equal(code(adfToMarkdown(document({ type: 'toString' }))), 'unsupported-node-type')
  assert.equal(code(adfToMarkdown(document(paragraph({ type: 'blockCard' })))), 'unsupported-node-type')
})

test('refuses a node whose content model the canonical form cannot emit', () => {
  assert.equal(code(adfToMarkdown(document({ type: 'listItem' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ content: [paragraph()], type: 'codeBlock' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ content: [paragraph()], type: 'bulletList' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ type: 'bulletList' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ attrs: { order: 2 }, content: [], type: 'orderedList' }))), 'unsupported-node-shape')
})

test('refuses an ordered list no marker spells', () => {
  const item: AdfNode = { content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }
  const list = (order: number, items: number): AdfDocument =>
    document({ attrs: { order }, content: Array.from({ length: items }, () => item), type: 'orderedList' })
  assert.equal(code(adfToMarkdown(list(1.5, 1))), 'unsupported-node-shape')
  assert.equal(markdown(adfToMarkdown(list(999999999, 1))), '999999999. x\n')
  assert.equal(code(adfToMarkdown(list(999999999, 2))), 'unspellable-list-marker')
})

test('refuses a code span over anything but one text node', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'code' }], type: 'hardBreak' })))), 'unspellable-mark')
})

test('refuses a heading level outside the ATX range', () => {
  assert.equal(code(adfToMarkdown(document({ attrs: { level: 7 }, content: [{ text: 'x', type: 'text' }], type: 'heading' }))), 'unsupported-heading-level')
  assert.equal(code(adfToMarkdown(document({ content: [{ text: 'x', type: 'text' }], type: 'heading' }))), 'unsupported-heading-level')
})

test('escapes only text that would otherwise open a construct', () => {
  const emitted = (text: string): string => markdown(adfToMarkdown(document(paragraph({ text, type: 'text' }))))
  assert.equal(emitted('<div>'), '\\<div>\n')
  assert.equal(emitted('a < b'), 'a < b\n')
  assert.equal(emitted('&amp; & x'), '\\&amp; & x\n')
  assert.equal(emitted('| a | b |'), '\\| a | b |\n')
  assert.equal(emitted(':mention[@x]{id=1}'), '\\:mention[@x]{id=1}\n')
  assert.equal(emitted(':::panel info'), '\\:::panel info\n')
  assert.equal(emitted('10:30 tomorrow'), '10:30 tomorrow\n')
  assert.equal(emitted('[a](b)'), '\\[a](b)\n')
  assert.equal(emitted('**bold**'), '\\*\\*bold**\n')
  assert.equal(emitted('a `x` b'), 'a \\`x` b\n')
  assert.equal(emitted('~~struck~~'), '\\~~struck~~\n')
  assert.equal(emitted('a \\* b'), 'a \\\\* b\n')
  assert.equal(emitted('1. not a list'), '1\\. not a list\n')
  assert.equal(emitted('*"quoted"*'), '\\*"quoted"*\n')
  assert.equal(emitted('x"_y"'), 'x"\\_y"\n')
})

test('escapes a heading closing sequence', () => {
  const heading = (text: string): string => markdown(adfToMarkdown(document({ attrs: { level: 2 }, content: [{ text, type: 'text' }], type: 'heading' })))
  assert.equal(heading('done #'), '## done \\#\n')
  assert.equal(heading('#tag first'), '## #tag first\n')
})

test('wraps adjacent nodes carrying one mark once, and a differing mark twice', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToMarkdown(document(paragraph(...content))))
  assert.equal(emitted(marked('a', { type: 'strong' }), marked('b', { type: 'strong' }, { type: 'em' })), '**a*b***\n')
  assert.equal(emitted(marked('a', { type: 'strong' }), marked('b', { type: 'em' })), '**a**_b_\n')
  const link = (href: string): AdfMark => ({ attrs: { href }, type: 'link' })
  assert.equal(emitted(marked('a', link('http://x')), marked('b', link('http://y'))), '[a](http://x)[b](http://y)\n')
})

test('refuses a mark spelling that cannot open or close where it sits', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToMarkdown(document(paragraph(...content))))
  const strong: AdfMark = { type: 'strong' }
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'un', type: 'text' }, marked('-real', strong), { text: 'istic', type: 'text' })))), 'unspellable-mark')
  assert.equal(code(adfToMarkdown(document(paragraph(marked('C++', { type: 'em' }), { text: 'ish', type: 'text' })))), 'unspellable-mark')
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'x', type: 'text' }, marked('.a', strong))))), 'unspellable-mark')
  assert.equal(emitted({ text: 'un ', type: 'text' }, marked('-real', strong), { text: ' istic', type: 'text' }), 'un **-real** istic\n')
  assert.equal(emitted(marked('a.', strong)), '**a.**\n')
  assert.equal(emitted({ text: 'x', type: 'text' }, marked('a', strong), { text: 'y', type: 'text' }), 'x**a**y\n')
  const em: AdfMark = { type: 'em' }
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'x', type: 'text' }, marked('a.', em), marked('b', strong))))), 'unspellable-mark')
  assert.equal(emitted({ text: 'x', type: 'text' }, marked('ab', em, strong), { text: 'y', type: 'text' }), 'x***ab***y\n')
})

test('refuses a node carrying one mark type twice', () => {
  const em: AdfMark = { type: 'em' }
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [em, em], text: 'x', type: 'text' })))), 'unsupported-node-shape')
})

test('refuses a nested list the tight spelling would swallow', () => {
  const item = (...content: AdfNode[]): AdfNode => ({ content, type: 'listItem' })
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const outer = (...content: AdfNode[]): AdfDocument => document({ content: [item(...content)], type: 'bulletList' })
  const ordered: AdfNode = { attrs: { order: 2 }, content: [item(text('b'))], type: 'orderedList' }
  assert.equal(code(adfToMarkdown(outer(text('a'), ordered))), 'unspellable-line-start')
  assert.equal(code(adfToMarkdown(outer(text('a'), { content: [item()], type: 'bulletList' }))), 'unspellable-line-start')
  assert.equal(markdown(adfToMarkdown(outer(text('a'), { content: [item(text('b'))], type: 'bulletList' }))), '- a\n  - b\n')
})

test('refuses marks and attributes nested deeper than the emitter carries', () => {
  const marks: AdfMark[] = Array.from({ length: 600 }, (_, index) => ({ type: index % 2 === 0 ? 'em' : 'strong' }))
  assert.equal(code(adfToMarkdown(document(paragraph({ marks, text: 'x', type: 'text' })))), 'unsupported-node-shape')
  let attrs: AdfMark['attrs'] = { depth: 'x' }
  for (let depth = 0; depth < 600; depth += 1) attrs = { depth: attrs }
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ attrs, type: 'em' }], text: 'x', type: 'text' })))), 'not-an-adf-document')
})

test('escapes a literal delimiter that would merge with an emitted one', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToMarkdown(document(paragraph(...content))))
  assert.equal(emitted(marked('a_', { type: 'em' })), '_a\\__\n')
  assert.equal(emitted(marked('_a', { type: 'em' })), '_\\_a_\n')
  assert.equal(emitted(marked('a*', { type: 'strong' })), '**a\\***\n')
  assert.equal(emitted(marked('~a', { type: 'strike' })), '~~\\~a~~\n')
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'x', type: 'text' }, marked('~a', { type: 'strike' }))))), 'unspellable-mark')
  assert.equal(emitted({ text: '`', type: 'text' }, marked('x', { type: 'code' })), '\\``x`\n')
  assert.equal(emitted(marked('x', { type: 'code' }), { text: '`', type: 'text' }), '`x`\\`\n')
  assert.equal(emitted({ text: '!', type: 'text' }, marked('x', { attrs: { href: 'https://example.com/' }, type: 'link' })), '\\![x](https://example.com/)\n')
  assert.equal(emitted(marked('x', { type: 'underline' }), { text: '{}', type: 'text' }), ':underline[x]\\{}\n')
  assert.equal(emitted({ attrs: { text: '' }, type: 'status' }, { text: '{color=red}', type: 'text' }), ':status[]\\{color=red}\n')
  assert.equal(emitted(marked('x', { attrs: { href: 'https://example.com/' }, type: 'link' }), { text: '{}', type: 'text' }), '[x](https://example.com/){}\n')
})

test('escapes a hyphen underline a hard break would expose', () => {
  const line = (text: string): string => markdown(adfToMarkdown(document(paragraph({ text: 'foo', type: 'text' }, { type: 'hardBreak' }, { text, type: 'text' }))))
  assert.equal(line('--'), 'foo\\\n\\--\n')
  assert.equal(line('=='), 'foo\\\n\\==\n')
})

test('refuses a list item whose marker completes a thematic break', () => {
  const item = (...content: AdfNode[]): AdfNode => ({ content, type: 'listItem' })
  assert.equal(code(adfToMarkdown(document({ content: [item({ type: 'rule' })], type: 'bulletList' }))), 'unspellable-line-start')
  const nested: AdfNode = { content: [item({ content: [item()], type: 'bulletList' })], type: 'bulletList' }
  assert.equal(markdown(adfToMarkdown(document(nested))), '- -\n')
  assert.equal(code(adfToMarkdown(document({ content: [item(nested)], type: 'bulletList' }))), 'unspellable-line-start')
})

test('refuses the characters CommonMark rewrites', () => {
  assert.equal(code(adfToMarkdown(document({ content: [{ text: 'a\rb', type: 'text' }], type: 'codeBlock' }))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'a\u0000b', type: 'text' })))), 'unspellable-character')
  assert.equal(code(adfToMarkdown(document({ content: [{ text: 'a\u0000b', type: 'text' }], type: 'codeBlock' }))), 'unspellable-character')
  assert.equal(code(adfToMarkdown(document({ content: [{ text: '', type: 'text' }], type: 'codeBlock' }))), 'unsupported-node-shape')
})

test('refuses a text node carrying no text at all', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ text: '', type: 'text' })))), 'unsupported-node-shape')
})

test('refuses a mark run whose edge holds whitespace CommonMark flanking counts', () => {
  const em = { type: 'em' }
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [em], text: 'a', type: 'text' }, { marks: [em], type: 'hardBreak' }, { text: 'b', type: 'text' })))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [em], text: '\u00a0a', type: 'text' })))), 'unspellable-whitespace')
})

test('pads a code span whose edges CommonMark would strip', () => {
  assert.equal(markdown(adfToMarkdown(document(paragraph({ marks: [{ type: 'code' }], text: ' \t ', type: 'text' })))), '`  \t  `\n')
})

test('spells one code span over a run of code-marked nodes', () => {
  const code_ = { type: 'code' }
  assert.equal(
    markdown(adfToMarkdown(document(paragraph({ marks: [code_], text: 'a', type: 'text' }, { marks: [code_], text: 'b', type: 'text' })))),
    '`ab`\n',
  )
})

test('refuses a document nested deeper than the emitter carries', () => {
  let node: AdfNode = paragraph({ text: 'x', type: 'text' })
  for (let depth = 0; depth < 600; depth += 1) node = { content: [node], type: 'blockquote' }
  assert.equal(code(adfToMarkdown(document(node))), 'unsupported-node-shape')
})

test('emits an empty list item without trailing whitespace', () => {
  assert.equal(markdown(adfToMarkdown(document({ content: [{ type: 'listItem' }], type: 'bulletList' }))), '-\n')
})

test('spells a block directive as its node type, arg and attributes', () => {
  const panel = (attrs: AdfAttributes): AdfDocument => document({ attrs, content: [paragraph({ text: 'x', type: 'text' })], type: 'panel' })
  assert.equal(markdown(adfToMarkdown(panel({ panelType: 'warning' }))), ':::panel warning\nx\n:::\n')
  assert.equal(markdown(adfToMarkdown(panel({}))), ':::panel\nx\n:::\n')
  assert.equal(markdown(adfToMarkdown(document({ type: 'caption' }))), ':::caption\n:::\n')
  assert.equal(markdown(adfToMarkdown(document({ attrs: { localId: 'a' }, type: 'syncBlock' }))), '::syncBlock {localId=a}\n')
})

test('refuses a directive attribute no section spells', () => {
  assert.equal(code(adfToMarkdown(document({ attrs: { rounded: true }, type: 'panel' }))), 'unspelled-node-attribute')
  assert.equal(code(adfToMarkdown(document({ attrs: { toString: 'x' }, type: 'panel' }))), 'unspelled-node-attribute')
  assert.equal(code(adfToMarkdown(document({ attrs: { localId: 4 }, type: 'panel' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ attrs: { width: '50' }, type: 'layoutColumn' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ attrs: { isNumberColumnEnabled: 'true' }, type: 'table' }))), 'unsupported-node-shape')
})

test('refuses an arg slot value no bare token spells', () => {
  assert.equal(code(adfToMarkdown(document({ attrs: { panelType: 'extra info' }, type: 'panel' }))), 'unspelled-node-attribute')
  assert.equal(code(adfToMarkdown(document({ attrs: { state: 2 }, type: 'taskItem' }))), 'unspelled-node-attribute')
})

test('carries a block node mark in the reserved attribute', () => {
  const section = (...marks: AdfMark[]): AdfDocument => document({ marks, type: 'layoutSection' })
  assert.equal(markdown(adfToMarkdown(section({ type: 'breakout' }))), ':::layoutSection {marks="[{\\"type\\":\\"breakout\\"}]"}\n:::\n')
  assert.equal(markdown(adfToMarkdown(section({ attrs: {}, type: 'breakout' }))), ':::layoutSection {marks="[{\\"type\\":\\"breakout\\"}]"}\n:::\n')
})

test('refuses the content a directive body has no room for', () => {
  assert.equal(code(adfToMarkdown(document({ content: [paragraph()], type: 'media' }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(document({ text: 'x', type: 'panel' }))), 'unsupported-node-shape')
})

test('separates two directive blocks in a container body by one line, two CommonMark blocks by a blank one', () => {
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const panel = (...content: AdfNode[]): AdfDocument => document({ attrs: { panelType: 'info' }, content, type: 'panel' })
  assert.equal(markdown(adfToMarkdown(panel(text('a'), text('b')))), ':::panel info\na\n\nb\n:::\n')
  assert.equal(markdown(adfToMarkdown(panel({ type: 'caption' }, { type: 'caption' }))), '::::panel info\n:::caption\n:::\n:::caption\n:::\n::::\n')
  assert.equal(code(adfToMarkdown(panel(text('a'), { type: 'caption' }))), 'unspelled-block-separation')
  assert.equal(code(adfToMarkdown(panel({ type: 'caption' }, text('a')))), 'unspelled-block-separation')
  assert.equal(code(adfToMarkdown(panel(paragraph(), text('a')))), 'unspelled-block-separation')
})

test('spells the image form for exactly the centered external media shape', () => {
  const url = 'https://example.com/moon.png'
  const single = (attrs: AdfAttributes, ...content: AdfNode[]): AdfDocument =>
    document({ attrs: { layout: 'center' }, content: [{ attrs, content, type: 'media' }], type: 'mediaSingle' })
  assert.equal(markdown(adfToMarkdown(single({ alt: 'The moon', type: 'external', url }))), `![The moon](${url})\n`)
  assert.equal(markdown(adfToMarkdown(single({ type: 'external', url }))), `![](${url})\n`)
  assert.equal(markdown(adfToMarkdown(single({ alt: 'a [b] c', type: 'external', url }))), `![a \\[b\\] c](${url})\n`)
  const fallback = (attrs: AdfAttributes): boolean => markdown(adfToMarkdown(single(attrs))).startsWith(':::mediaSingle {layout=center}')
  assert.ok(fallback({ alt: '', type: 'external', url }))
  assert.ok(fallback({ alt: 'a\nb', type: 'external', url }))
  assert.ok(fallback({ alt: 'a\u0000b', type: 'external', url }))
  assert.ok(fallback({ type: 'external', url: 'https://example.com/a b>c' }))
  assert.ok(fallback({ alt: ' moon ', type: 'external', url }))
  assert.equal(code(adfToMarkdown(single({ alt: 4, type: 'external', url }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(single({ type: 'external', url: 4 }))), 'unsupported-node-shape')
  assert.equal(code(adfToMarkdown(single({ type: 'external', url }, paragraph()))), 'unsupported-node-shape')
})

test('spells a mediaSingle the image form does not fit as a directive', () => {
  const media: AdfNode = { attrs: { type: 'external', url: 'https://example.com/moon.png' }, type: 'media' }
  const single: AdfNode = { attrs: { layout: 'center' }, content: [media], marks: [{ type: 'border' }], type: 'mediaSingle' }
  assert.equal(
    markdown(adfToMarkdown(document(single))),
    ':::mediaSingle {layout=center marks="[{\\"type\\":\\"border\\"}]"}\n::media {type=external url="https://example.com/moon.png"}\n:::\n',
  )
})

test('spells a table as a pipe table only where every row and cell is plain', () => {
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const cell = (type: string, ...content: AdfNode[]): AdfNode => ({ content, type })
  const row = (...cells: AdfNode[]): AdfNode => ({ content: cells, type: 'tableRow' })
  const table = (...rows: AdfNode[]): AdfDocument => document({ content: rows, type: 'table' })
  const directive = (result: Result<string>): boolean => markdown(result).startsWith(':')
  const header = row(cell('tableHeader', text('Part')))
  assert.equal(markdown(adfToMarkdown(table(header, row(cell('tableCell', text('Bolt M8')))))), '| Part |\n| --- |\n| Bolt M8 |\n')
  assert.equal(markdown(adfToMarkdown(table(row(cell('tableHeader', text('a|b')))))), '| a\\|b |\n| --- |\n')
  assert.ok(directive(adfToMarkdown(table())))
  assert.ok(directive(adfToMarkdown(table(row()))))
  assert.ok(directive(adfToMarkdown(table({ type: 'tableRow' }))))
  assert.ok(directive(adfToMarkdown(table(header, row()))))
  assert.ok(directive(adfToMarkdown(table(row(cell('tableCell', text('Bolt M8')))))))
  assert.ok(directive(adfToMarkdown(table(cell('tableHeader', text('Part'))))))
  assert.ok(directive(adfToMarkdown(table(row(cell('tableHeader'))))))
  assert.ok(directive(adfToMarkdown(table(row(cell('tableHeader', text('a'), text('b')))))))
  assert.equal(code(adfToMarkdown(table(row(cell('tableHeader', { attrs: { localId: 'a' }, type: 'paragraph' }))))), 'unspelled-node-attribute')
  assert.equal(code(adfToMarkdown(table(row(cell('tableHeader', { content: [{ type: 'blockCard' }], type: 'paragraph' }))))), 'unsupported-node-type')
  assert.equal(code(adfToMarkdown(table(row(cell('tableHeader', { content: [{ text: '\fa', type: 'text' }], type: 'paragraph' }))))), 'unspellable-whitespace')
  assert.ok(directive(adfToMarkdown(table(row(cell('tableHeader', { attrs: { level: 1 }, type: 'heading' }))))))
  assert.equal(markdown(adfToMarkdown(table(row(cell('tableHeader', { content: [{ text: ' a', type: 'text' }], type: 'paragraph' }))))), '| :text{text=" "}a |\n| --- |\n')
  const marked = (mark: AdfMark): AdfDocument => table(row(cell('tableHeader', { content: [{ marks: [mark], text: 'l', type: 'text' }], type: 'paragraph' })))
  assert.ok(directive(adfToMarkdown(marked({ attrs: { href: 'https://example.com/?x|y' }, type: 'link' }))))
  assert.ok(directive(adfToMarkdown(marked({ attrs: { href: 'https://example.com/', title: 'a|b' }, type: 'link' }))))
  const fallsBack = (node: AdfNode): boolean => directive(adfToMarkdown(table(row(cell('tableHeader', { content: [node], type: 'paragraph' })))))
  assert.ok(fallsBack({ marks: [{ type: 'code' }], text: 'a|b', type: 'text' }))
  assert.ok(fallsBack({ attrs: { style: 'a|b' }, type: 'status' }))
  assert.equal(markdown(adfToMarkdown(marked({ attrs: { href: 'https://example.com/x' }, type: 'link' }))), '| [l](https://example.com/x) |\n| --- |\n')
})

test('spells an inline node as a directive with its content slot and attributes', () => {
  const emitted = (node: AdfNode): string => markdown(adfToMarkdown(document(paragraph(node))))
  assert.equal(emitted({ attrs: { timestamp: '1756080000000' }, type: 'date' }), ':date{timestamp=1756080000000}\n')
  assert.equal(emitted({ type: 'mention' }), ':mention{}\n')
  assert.equal(emitted({ attrs: { text: '' }, type: 'status' }), ':status[]\n')
  assert.equal(emitted({ attrs: { color: 'yellow', text: 'In review' }, type: 'status' }), ':status[In review]{color=yellow}\n')
  assert.equal(emitted({ attrs: { id: '1f389', text: 'a]b' }, type: 'emoji' }), ':emoji[a\\]b]{id=1f389}\n')
  assert.equal(emitted({ attrs: { data: { url: 'https://example.com/' } }, type: 'inlineCard' }), ':inlineCard{data="{\\"url\\":\\"https://example.com/\\"}"}\n')
  assert.equal(emitted({ attrs: { height: 24 }, type: 'mediaInline' }), ':mediaInline{height=24}\n')
})

test('refuses an inline node attribute no section spells', () => {
  const refused = (node: AdfNode): string => code(adfToMarkdown(document(paragraph(node))))
  assert.equal(refused({ attrs: { rounded: true }, type: 'status' }), 'unspelled-node-attribute')
  assert.equal(refused({ attrs: { toString: 'x' }, type: 'status' }), 'unspelled-node-attribute')
  assert.equal(refused({ attrs: { color: 4 }, type: 'status' }), 'unsupported-node-shape')
  assert.equal(refused({ attrs: { width: '2' }, type: 'mediaInline' }), 'unsupported-node-shape')
})

test('refuses the content and slot an inline directive has no room for', () => {
  const refused = (node: AdfNode): string => code(adfToMarkdown(document(paragraph(node, { text: 'y', type: 'text' }))))
  assert.equal(refused({ content: [{ text: 'x', type: 'text' }], type: 'status' }), 'unsupported-node-shape')
  assert.equal(refused({ text: 'x', type: 'status' }), 'unsupported-node-shape')
  assert.equal(refused({ content: [{ text: 'x', type: 'text' }], type: 'hardBreak' }), 'unsupported-node-shape')
  assert.equal(refused({ text: 'x', type: 'hardBreak' }), 'unsupported-node-shape')
  assert.equal(refused({ attrs: { text: 4 }, type: 'status' }), 'unsupported-node-shape')
  assert.equal(refused({ attrs: { text: 'a\nb' }, type: 'status' }), 'unspellable-whitespace')
  assert.equal(refused({ attrs: { text: 'a\u0000b' }, type: 'status' }), 'unspellable-character')
})

test('spells the directive marks around the longest run they cover', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToMarkdown(document(paragraph(...content))))
  const underline: AdfMark = { type: 'underline' }
  assert.equal(emitted(marked('x', underline)), ':underline[x]\n')
  assert.equal(emitted(marked('a', underline), marked('b', underline)), ':underline[ab]\n')
  assert.equal(emitted(marked('x', { attrs: { type: 'sub' }, type: 'subsup' })), ':subsup[x]{type=sub}\n')
  assert.equal(emitted(marked('x', { attrs: { color: '#ae2e24' }, type: 'textColor' })), ':textColor[x]{color="#ae2e24"}\n')
  assert.equal(emitted(marked('x', { attrs: { color: '#091e42', size: 2 }, type: 'border' })), ':border[x]{color="#091e42" size=2}\n')
  assert.equal(emitted(marked('x', { type: 'em' }, underline)), '_:underline[x]_\n')
  assert.equal(emitted(marked('x', underline, { type: 'em' })), ':underline[_x_]\n')
  assert.equal(emitted(marked('a', underline), { marks: [underline], type: 'hardBreak' }, marked('b', underline)), ':underline[a:hardBreak{}b]\n')
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(
    emitted(marked('a', underline, link), { marks: [underline, link], type: 'hardBreak' }, marked('b', underline, link)),
    ':underline[[a:hardBreak{}b](https://example.com/)]\n',
  )
  assert.equal(
    emitted(marked('a', link), { marks: [link], type: 'hardBreak' }, marked('b', link)),
    '[a\\\nb](https://example.com/)\n',
  )
})

test('refuses a mark directive attribute no spelling holds', () => {
  const refused = (mark: AdfMark): string => code(adfToMarkdown(document(paragraph({ marks: [mark], text: 'x', type: 'text' }))))
  assert.equal(refused({ attrs: { width: 2 }, type: 'border' }), 'unspellable-mark')
  assert.equal(refused({ attrs: { size: '2' }, type: 'border' }), 'unspellable-mark')
})

test('carries whitespace CommonMark strips in the reserved text directive', () => {
  const emitted = (...content: AdfNode[]): string => markdown(adfToMarkdown(document(paragraph(...content))))
  assert.equal(emitted({ text: '  lead', type: 'text' }), ':text{text="  "}lead\n')
  assert.equal(emitted({ text: 'trail ', type: 'text' }), 'trail:text{text=" "}\n')
  assert.equal(emitted({ text: 'a\nb', type: 'text' }), 'a:text{text="\\n"}b\n')
  assert.equal(emitted({ text: '\t', type: 'text' }), ':text{text="\\t"}\n')
  assert.equal(emitted({ text: 'a ', type: 'text' }, { type: 'hardBreak' }, { text: ' b', type: 'text' }), 'a:text{text=" "}\\\n:text{text=" "}b\n')
  assert.equal(emitted({ marks: [{ type: 'em' }], text: ' a ', type: 'text' }), '_:text{text=" "}a:text{text=" "}_\n')
  assert.equal(markdown(adfToMarkdown(document({ attrs: { level: 1 }, content: [{ text: 'x ', type: 'text' }], type: 'heading' }))), '# x:text{text=" "}\n')
})

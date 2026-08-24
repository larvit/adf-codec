import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from './adf-document.ts'
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
  assert.equal(code(adfToMarkdown(document({ content: items, type: 'orderedList' }))), 'ambiguous-ordered-list-start')
  assert.equal(code(adfToMarkdown(document({ attrs: { order: 1 }, content: items, type: 'orderedList' }))), 'ambiguous-ordered-list-start')
  assert.equal(markdown(adfToMarkdown(document({ attrs: { order: 2 }, content: items, type: 'orderedList' }))), '2. x\n')
})

test('refuses the code block info strings the fence cannot hold', () => {
  assert.equal(code(adfToMarkdown(document({ attrs: { language: '' }, type: 'codeBlock' }))), 'ambiguous-empty-code-block-language')
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
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'underline' }], text: 'x', type: 'text' })))), 'unspellable-mark')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'code' }, { type: 'strong' }], text: 'x', type: 'text' })))), 'unspellable-mark')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ attrs: { colour: 'red' }, type: 'em' }], text: 'x', type: 'text' })))), 'unspellable-mark')
})

test('refuses whitespace CommonMark cannot hold', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ text: '  lead', type: 'text' })))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'trail ', type: 'text' })))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ text: 'a\nb', type: 'text' })))), 'unspellable-whitespace')
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'em' }], text: 'x ', type: 'text' }, { text: 'y', type: 'text' })))), 'unspellable-whitespace')
})

test('refuses a line whose start block parsing would claim', () => {
  assert.equal(code(adfToMarkdown(document(paragraph({ marks: [{ type: 'code' }], text: '```', type: 'text' })))), 'unspellable-line-start')
})

test('refuses two adjacent lists of the same kind', () => {
  const list: AdfNode = { content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(code(adfToMarkdown(document(list, list))), 'unspellable-adjacent-lists')
})

test('refuses a node type the canonical form does not cover', () => {
  assert.equal(code(adfToMarkdown(document({ type: 'panel' }))), 'unsupported-node-type')
  assert.equal(code(adfToMarkdown(document(paragraph({ type: 'mention' })))), 'unsupported-node-type')
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

test('emits an empty list item without trailing whitespace', () => {
  assert.equal(markdown(adfToMarkdown(document({ content: [{ type: 'listItem' }], type: 'bulletList' }))), '-\n')
})

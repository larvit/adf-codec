import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessMarkdown, losslessMarkdownToAdf } from '../../index.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : { content, type: 'paragraph' }
}

function markdown(result: Result<string>): string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function readsBack(doc: AdfDocument): string {
  const spelled = markdown(adfToLosslessMarkdown(doc))
  assert.deepEqual(losslessMarkdownToAdf(spelled), { ok: true, value: doc }, `reading ${JSON.stringify(spelled)}`)
  return spelled
}

test('spells a code span opening a line, whose backticks open no fence', () => {
  const fence: AdfNode = { marks: [{ type: 'code' }], text: '``', type: 'text' }
  assert.equal(readsBack(document(paragraph(fence))), '``` `` ```\n')
  assert.equal(readsBack(document(paragraph({ text: 'a', type: 'text' }, { type: 'hardBreak' }, fence))), 'a\\\n``` `` ```\n')
})

test('escapes the delimiter row a hard break leaves opening a pipe table with no leading pipe', () => {
  const broken = (second: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ text: 'a | b', type: 'text' }, { type: 'hardBreak' }, { text: second, type: 'text' }))))
  assert.equal(broken('--- | ---'), 'a | b\\\n\\--- | ---\n')
  assert.equal(broken(':--- | ---:'), 'a | b\\\n\\:--- | ---:\n')
  assert.equal(broken('c | d'), 'a | b\\\nc | d\n')
  const oneColumn = markdown(adfToLosslessMarkdown(document(paragraph({ text: 'a |', type: 'text' }, { type: 'hardBreak' }, { text: '--- |', type: 'text' }))))
  assert.equal(oneColumn, 'a |\\\n\\--- |\n')
})

test('escapes only text that would otherwise open a construct', () => {
  const emitted = (text: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ text, type: 'text' }))))
  assert.equal(emitted('<div>'), '\\<div>\n')
  assert.equal(emitted('<div'), '\\<div\n')
  assert.equal(emitted('<div and more'), '\\<div and more\n')
  assert.equal(emitted('<pre'), '\\<pre\n')
  assert.equal(emitted('<!x'), '\\<!x\n')
  assert.equal(emitted('<!-- x'), '\\<!-- x\n')
  assert.equal(emitted('<?php'), '\\<?php\n')
  assert.equal(emitted('<![CDATA[x'), '\\<![CDATA[x\n')
  assert.equal(emitted('<span'), '<span\n')
  assert.equal(emitted('a < b'), 'a < b\n')
  assert.equal(emitted('&amp; & x'), '\\&amp; & x\n')
  assert.equal(emitted('&notareference; x'), '&notareference; x\n')
  assert.equal(emitted('a <b@c.d> e'), 'a \\<b@c.d> e\n')
  assert.equal(emitted('a <b 2'), 'a <b 2\n')
  assert.equal(emitted('a <div b'), 'a <div b\n')
  assert.equal(emitted('a <!-- b'), 'a <!-- b\n')
  assert.equal(emitted('a <!-- b --> c'), 'a \\<!-- b --> c\n')
  const later = paragraph({ text: 'a', type: 'text' }, { type: 'hardBreak' }, { text: '<div', type: 'text' })
  assert.equal(markdown(adfToLosslessMarkdown(document(later))), 'a\\\n\\<div\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph({ text: '<!-- x', type: 'text' })], type: 'blockquote' }))), '> \\<!-- x\n')
  assert.equal(emitted('| a | b |'), '\\| a | b |\n')
  assert.equal(emitted('!adf:mention[@x]{id=1}'), '\\!adf:mention[@x]{id=1}\n')
  assert.equal(emitted('!adf: completes nothing'), '\\!adf: completes nothing\n')
  assert.equal(emitted('!adfx and a! alone'), '!adfx and a! alone\n')
  assert.equal(emitted('!adf:/panel'), '\\!adf:/panel\n')
  assert.equal(emitted('!adf:rule'), '\\!adf:rule\n')
  assert.equal(emitted(':::panel info'), ':::panel info\n')
  assert.equal(emitted('10:30 tomorrow'), '10:30 tomorrow\n')
  assert.equal(emitted('[a](b)'), '\\[a](b)\n')
  assert.equal(emitted('[a]: b'), '\\[a]: b\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { level: 1 }, content: [{ text: '[a]: b', type: 'text' }], type: 'heading' }))), '# [a]: b\n')
  assert.equal(emitted('**bold**'), '\\*\\*bold\\*\\*\n')
  assert.equal(emitted('a `x` b'), 'a \\`x` b\n')
  assert.equal(emitted('~~struck~~'), '\\~~struck\\~~\n')
  assert.equal(emitted('a \\* b'), 'a \\\\\\* b\n')
  assert.equal(emitted('1. not a list'), '1\\. not a list\n')
  assert.equal(emitted('*"quoted"*'), '\\*"quoted"\\*\n')
  assert.equal(emitted('x"_y"'), 'x"\\_y"\n')
})

test('escapes every text bracket in a line where one opens link text and every text backtick where one opens a code span, and none where none does', () => {
  const emitted = (text: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ text, type: 'text' }))))
  assert.equal(emitted('[a](b) [c]'), '\\[a](b) \\[c]\n')
  assert.equal(emitted('see [1] and [docs](url) [2]'), 'see \\[1] and \\[docs](url) \\[2]\n')
  assert.equal(emitted('[a] b](c'), '[a] b](c\n')
  assert.equal(emitted('[x]('), '[x](\n')
  assert.equal(emitted('Use ` or ``code`` syntax'), 'Use \\` or \\`\\`code\\`\\` syntax\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ type: 'code' }], text: 'c', type: 'text' }, { text: 'a ` b', type: 'text' })))), '`c`a ` b\n')
})

test('keeps a text backtick bare in a line where a text bracket opens a link the reader refuses', () => {
  const refused = paragraph({ text: 'a ` [', type: 'text' }, { attrs: { id: '1' }, type: 'mention' }, { text: '](u)', type: 'text' })
  assert.equal(markdown(adfToLosslessMarkdown(document(refused))), 'a ` \\[!adf:mention{id=1}](u)\n')
})

test('escapes a heading closing sequence', () => {
  const heading = (text: string): string => markdown(adfToLosslessMarkdown(document({ attrs: { level: 2 }, content: [{ text, type: 'text' }], type: 'heading' })))
  assert.equal(heading('done #'), '## done \\#\n')
  assert.equal(heading('#tag first'), '## #tag first\n')
})

test('escapes a literal delimiter that would merge with an emitted one', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  assert.equal(emitted(marked('a_', { type: 'em' })), '_a\\__\n')
  assert.equal(emitted(marked('_a', { type: 'em' })), '_\\_a_\n')
  assert.equal(emitted(marked('a*', { type: 'strong' })), '**a\\***\n')
  assert.equal(emitted(marked('~a', { type: 'strike' })), '~~\\~a~~\n')
  assert.equal(
    emitted({ text: 'x', type: 'text' }, marked('~a', { type: 'strike' })),
    'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strike\\"}],\\"text\\":\\"~a\\",\\"type\\":\\"text\\"}"}\n',
  )
  assert.equal(emitted({ text: '`', type: 'text' }, marked('x', { type: 'code' })), '\\``x`\n')
  assert.equal(emitted(marked('x', { type: 'code' }), { text: '`', type: 'text' }), '`x`\\`\n')
  assert.equal(emitted({ text: '`a', type: 'text' }, marked('b', { type: 'code' })), '\\`a`b`\n')
  assert.equal(
    emitted({ text: '<https://example.com/', type: 'text' }, { attrs: { url: 'x>' }, type: 'inlineCard' }),
    '\\<https://example.com/!adf:inlineCard{url="x>"}\n',
  )
  assert.equal(emitted({ text: '!', type: 'text' }, marked('x', { attrs: { href: 'https://example.com/' }, type: 'link' })), '\\![x](https://example.com/)\n')
  assert.equal(emitted({ text: '[a', type: 'text' }, marked('x', { attrs: { href: 'https://example.com/' }, type: 'link' })), '[a[x](https://example.com/)\n')
  assert.equal(emitted({ text: '[a](b)', type: 'text' }), '\\[a](b)\n')
  assert.equal(emitted(marked('x', { type: 'underline' }), { text: '{}', type: 'text' }), '!adf:underline[x]\\{}\n')
  assert.equal(emitted({ attrs: { text: '' }, type: 'status' }, { text: '{color=red}', type: 'text' }), '!adf:status[]\\{color=red}\n')
  assert.equal(emitted(marked('x', { attrs: { href: 'https://example.com/' }, type: 'link' }), { text: '{}', type: 'text' }), '[x](https://example.com/){}\n')
})

test('escapes a literal delimiter run that only closes', () => {
  const emitted = (text: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ text, type: 'text' }))))
  assert.equal(emitted('a* b'), 'a\\* b\n')
  assert.equal(emitted('2 * 3'), '2 * 3\n')
})

test('escapes a hyphen underline a hard break would expose', () => {
  const line = (text: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ text: 'foo', type: 'text' }, { type: 'hardBreak' }, { text, type: 'text' }))))
  assert.equal(line('--'), 'foo\\\n\\--\n')
  assert.equal(line('=='), 'foo\\\n\\==\n')
})

test('spells the characters CommonMark rewrites', () => {
  assert.equal(readsBack(document(paragraph({ text: 'a\r\r\nb', type: 'text' }))), 'a&#13;&#13;!adf:text{text="\\n"}b\n')
  assert.equal(readsBack(document(paragraph({ marks: [{ type: 'strong' }], text: '\u0000\u0000a\u0000', type: 'text' }))), '**!adf:text{text="\\u0000\\u0000"}a!adf:text{text="\\u0000"}**\n')
  assert.equal(readsBack(document(paragraph({ marks: [{ attrs: { href: 'u' }, type: 'link' }], text: 'a\rb\u0000', type: 'text' }))), '[a&#13;b!adf:text{text="\\u0000"}](u)\n')
  assert.equal(readsBack(document({ attrs: { level: 1 }, content: [{ text: '\r', type: 'text' }], type: 'heading' })), '# &#13;\n')
  assert.equal(readsBack(document({ content: [{ text: 'a\rb', type: 'text' }], type: 'codeBlock' })), '```adf:codeBlock\n{\n  "content": [\n    {\n      "text": "a\\rb",\n      "type": "text"\n    }\n  ]\n}\n```\n')
  readsBack(document({ content: [{ text: 'a\u0000b', type: 'text' }], type: 'codeBlock' }))
  readsBack(document(paragraph({ marks: [{ type: 'code' }], text: 'a\u0000b', type: 'text' })))
})

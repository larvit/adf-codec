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

test('carries every inline node of a line that only the carry spells', () => {
  const odd: AdfNode = { attrs: { id: 'a', odd: 'b' }, type: 'mention' }
  const carriedOdd = '!adf:carry{json="{\\"attrs\\":{\\"id\\":\\"a\\",\\"odd\\":\\"b\\"},\\"type\\":\\"mention\\"}"}'
  const unlinked = '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"link\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}'
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph(odd, { text: ' ', type: 'text' }, { marks: [{ type: 'link' }], text: 'x', type: 'text' }, { text: ' ', type: 'text' }, odd)))),
    `${carriedOdd} ${unlinked} ${carriedOdd}\n`,
  )
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ text: 'a', type: 'text' }, { attrs: { foo: 1 }, type: 'hardBreak' }, { text: 'b', type: 'text' })))),
    'a!adf:carry{json="{\\"attrs\\":{\\"foo\\":1},\\"type\\":\\"hardBreak\\"}"}b\n',
  )
})

test('carries an inline node holding a mark Atlassian\'s schema withholds from it', () => {
  const carried = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(paragraph(node))))
  assert.equal(carried({ attrs: { id: 'b1c2', text: '@A' }, marks: [{ type: 'strong' }], type: 'mention' }), '!adf:carry{json="{\\"attrs\\":{\\"id\\":\\"b1c2\\",\\"text\\":\\"@A\\"},\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"type\\":\\"mention\\"}"}\n')
  assert.equal(carried({ attrs: { id: 'm1' }, marks: [{ type: 'em' }], type: 'mediaInline' }), '!adf:carry{json="{\\"attrs\\":{\\"id\\":\\"m1\\"},\\"marks\\":[{\\"type\\":\\"em\\"}],\\"type\\":\\"mediaInline\\"}"}\n')
  assert.equal(carried({ attrs: { id: 'm1' }, marks: [{ attrs: { href: '/u' }, type: 'link' }], type: 'mediaInline' }), '[!adf:mediaInline{id=m1}](/u)\n')
  assert.equal(carried({ marks: [{ type: 'strong' }, { type: 'code' }], text: 'x', type: 'text' }), '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"},{\\"type\\":\\"code\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n')
  assert.equal(carried({ marks: [{ attrs: { href: '/u' }, type: 'link' }, { type: 'code' }], text: 'x', type: 'text' }), '[`x`](/u)\n')
  const border: AdfMark = { attrs: { color: '#091e42', size: 2 }, type: 'border' }
  const bordered = '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"color\\":\\"#091e42\\",\\"size\\":2},\\"type\\":\\"border\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}'
  assert.equal(carried({ marks: [border], text: 'x', type: 'text' }), `${bordered}\n`)
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ type: 'em' }], text: 'a', type: 'text' }, { marks: [border], text: 'x', type: 'text' })))), `_a_${bordered}\n`)
})

test('carries a text node holding no text, or holding content', () => {
  const nested: AdfNode[] = [{ text: 'lost', type: 'text' }]
  assert.equal(readsBack(document(paragraph({ text: '', type: 'text' }))), '!adf:carry{json="{\\"text\\":\\"\\",\\"type\\":\\"text\\"}"}\n')
  assert.equal(readsBack(document(paragraph({ type: 'text' }, { text: 'a', type: 'text' }))), '!adf:carry{json="{\\"type\\":\\"text\\"}"}a\n')
  readsBack(document(paragraph({ marks: [{ type: 'code' }], text: '', type: 'text' })))
  readsBack(document(paragraph({ marks: [{ type: 'em' }], text: 'a', type: 'text' }, { marks: [{ type: 'em' }], text: '', type: 'text' })))
  readsBack(document(paragraph({ content: nested, text: 'x', type: 'text' })))
  readsBack(document(paragraph({ content: nested, marks: [{ type: 'code' }], text: 'x', type: 'text' })))
  readsBack(document({ content: [{ text: '', type: 'text' }], type: 'codeBlock' }))
  readsBack(document({ content: [{ text: 'a', type: 'text' }, { type: 'text' }], type: 'codeBlock' }))
})

test('spells an inline node as a directive with its content slot and attributes', () => {
  const emitted = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(paragraph(node))))
  assert.equal(emitted({ attrs: { timestamp: '1756080000000' }, type: 'date' }), '!adf:date{timestamp=1756080000000}\n')
  assert.equal(emitted({ type: 'mention' }), '!adf:mention{}\n')
  assert.equal(emitted({ attrs: { text: '' }, type: 'status' }), '!adf:status[]\n')
  assert.equal(emitted({ attrs: { color: 'yellow', text: 'In review' }, type: 'status' }), '!adf:status[In review]{color=yellow}\n')
  assert.equal(emitted({ attrs: { id: '1f389', text: 'a]b' }, type: 'emoji' }), '!adf:emoji[a\\]b]{id=1f389}\n')
  assert.equal(emitted({ attrs: { data: { url: 'https://example.com/' } }, type: 'inlineCard' }), '!adf:inlineCard{data="{\\"url\\":\\"https://example.com/\\"}"}\n')
  assert.equal(emitted({ attrs: { height: 24 }, type: 'mediaInline' }), '!adf:mediaInline{height=24}\n')
  assert.equal(emitted({ attrs: { url: 'a`b&c<d|e' }, type: 'inlineCard' }), '!adf:inlineCard{url="a\\u0060b\\u0026c\\u003cd\\u007ce"}\n')
})

test('carries an inline node attribute no section spells', () => {
  const carried = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(paragraph(node))))
  assert.equal(carried({ attrs: { rounded: true }, type: 'status' }), '!adf:carry{json="{\\"attrs\\":{\\"rounded\\":true},\\"type\\":\\"status\\"}"}\n')
  assert.equal(carried({ attrs: { toString: 'x' }, type: 'status' }), '!adf:carry{json="{\\"attrs\\":{\\"toString\\":\\"x\\"},\\"type\\":\\"status\\"}"}\n')
  assert.equal(carried({ attrs: { color: 4 }, type: 'status' }), '!adf:carry{json="{\\"attrs\\":{\\"color\\":4},\\"type\\":\\"status\\"}"}\n')
  assert.equal(carried({ attrs: { width: '2' }, type: 'mediaInline' }), '!adf:carry{json="{\\"attrs\\":{\\"width\\":\\"2\\"},\\"type\\":\\"mediaInline\\"}"}\n')
  assert.equal(carried({ attrs: { text: 4 }, type: 'status' }), '!adf:carry{json="{\\"attrs\\":{\\"text\\":4},\\"type\\":\\"status\\"}"}\n')
})

test('refuses the content and slot an inline directive has no room for', () => {
  const refused = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(paragraph(node, { text: 'y', type: 'text' }))))
  const neither = (type: string, held: string): string => `unsupported-node-shape: a node of type ${type} holds neither content nor text: this one holds ${held}`
  assert.equal(refused({ content: [{ text: 'x', type: 'text' }], type: 'status' }), neither('status', 'content'))
  assert.equal(refused({ text: 'x', type: 'status' }), neither('status', 'text'))
  assert.equal(refused({ content: [{ text: 'x', type: 'text' }], type: 'hardBreak' }), neither('hardBreak', 'content'))
  assert.equal(refused({ text: 'x', type: 'hardBreak' }), neither('hardBreak', 'text'))
})

test('carries an inline node whose content slot holds a line ending or a null character', () => {
  assert.equal(readsBack(document(paragraph({ attrs: { text: 'a\nb' }, type: 'status' }))), '!adf:carry{json="{\\"attrs\\":{\\"text\\":\\"a\\\\nb\\"},\\"type\\":\\"status\\"}"}\n')
  readsBack(document(paragraph({ attrs: { text: 'a\rb' }, type: 'emoji' })))
  readsBack(document(paragraph({ attrs: { id: 'x', text: 'a\u0000b' }, type: 'mention' })))
})

test('carries a hard break holding marks, which Atlassian\'s schema withholds', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(
    readsBack(document(paragraph({ marks: [link], text: 'a', type: 'text' }, { marks: [link], type: 'hardBreak' }, { marks: [link], text: 'b', type: 'text' }))),
    '[a](https://example.com/)!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"href\\":\\"https://example.com/\\"},\\"type\\":\\"link\\"}],\\"type\\":\\"hardBreak\\"}"}[b](https://example.com/)\n',
  )
})

test('carries whitespace CommonMark strips in the reserved text directive', () => {
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  assert.equal(emitted({ text: '  lead', type: 'text' }), '!adf:text{text="  "}lead\n')
  assert.equal(emitted({ text: 'trail ', type: 'text' }), 'trail!adf:text{text=" "}\n')
  assert.equal(emitted({ text: 'a\nb', type: 'text' }), 'a!adf:text{text="\\n"}b\n')
  assert.equal(emitted({ text: '\t', type: 'text' }), '!adf:text{text="\\t"}\n')
  assert.equal(emitted({ text: 'a ', type: 'text' }, { type: 'hardBreak' }, { text: ' b', type: 'text' }), 'a!adf:text{text=" "}\\\n!adf:text{text=" "}b\n')
  assert.equal(emitted({ marks: [{ type: 'em' }], text: ' a ', type: 'text' }), '_!adf:text{text=" "}a!adf:text{text=" "}_\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { level: 1 }, content: [{ text: 'x ', type: 'text' }], type: 'heading' }))), '# x!adf:text{text=" "}\n')
  // CommonMark strips spaces and tabs alone, so the whitespace beside them is plain text.
  assert.equal(emitted({ text: '\va\f', type: 'text' }), '\va\f\n')
})

test("joins a mark run's segments as a walk rather than as one call's arguments", () => {
  const run = Array.from({ length: 200000 }, (): AdfNode => ({ marks: [{ type: 'strong' }], text: 'a', type: 'text' }))
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: run, type: 'paragraph' }))), `**${Array.from({ length: 200000 }, () => 'a').join('!adf:textBreak{}')}**\n`)
})

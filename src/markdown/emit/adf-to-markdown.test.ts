import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
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

test('refuses a value that is not an ADF document, naming the check it failed', () => {
  assert.equal(markdown(adfToLosslessMarkdown({ type: 'doc', version: Number.NaN })), 'not-an-adf-document: an ADF document holds a version number: found NaN')
})

test('refuses a document version the markdown cannot carry', () => {
  assert.equal(code(adfToLosslessMarkdown({ type: 'doc', version: 2 })), 'unsupported-document-version')
})

test('carries a text node attribute no spelling holds', () => {
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ attrs: { localId: 'a' }, text: 'x', type: 'text' })))),
    '!adf:carry{json="{\\"attrs\\":{\\"localId\\":\\"a\\"},\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
  )
})

test('spells a CommonMark block as a directive where its own spelling holds neither attribute nor mark', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { localId: 'a' }, type: 'paragraph' }))), '!adf:paragraph {localId=a}\n!adf:/paragraph\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { wrap: true }, type: 'codeBlock' }))), '!adf:codeBlock {wrap=true}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ attrs: { localId: 'a' }, type: 'hardBreak' }, { text: 'x', type: 'text' })))), '!adf:hardBreak{localId=a}x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ marks: [{ type: 'border' }], type: 'blockquote' }))), '!adf:blockquote {marks="[{\\"type\\":\\"border\\"}]"}\n!adf:/blockquote\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'listItem' }))), '!adf:listItem\n!adf:/listItem\n')
})

test('spells an ordered list from the order attribute its first marker is', () => {
  const items: AdfNode[] = [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }]
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: items, type: 'orderedList' }))), '!adf:orderedList\n!adf:listItem\nx\n!adf:/listItem\n!adf:/orderedList\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { order: 1 }, content: items, type: 'orderedList' }))), '1. x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { order: 2 }, content: items, type: 'orderedList' }))), '2. x\n')
})

test('spells a code block language no info string holds as an attribute', () => {
  const language = (value: string): string => markdown(adfToLosslessMarkdown(document({ attrs: { language: value }, type: 'codeBlock' })))
  assert.equal(language(''), '!adf:codeBlock {language=""}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('a`b'), '!adf:codeBlock {language="a\\u0060b"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language(' sql'), '!adf:codeBlock {language=" sql"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('&#97;df'), '!adf:codeBlock {language="\\u0026#97;df"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('foo\\+bar'), '!adf:codeBlock {language="foo\\\\+bar"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('a\u0000b'), '!adf:codeBlock {language="a\\u0000b"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('a\tb'), '!adf:codeBlock {language="a\\tb"}\n```\n```\n!adf:/codeBlock\n')
})

test('spells a link destination CommonMark cannot as the directive link', () => {
  const link = (href: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ attrs: { href }, type: 'link' }], text: 't', type: 'text' }))))
  assert.equal(link('https://example.com/a b>c'), '!adf:link[t]{href="https://example.com/a b>c"}\n')
  assert.equal(link('<https://example.com/'), '!adf:link[t]{href="\\u003chttps://example.com/"}\n')
  assert.equal(link('https://example.com/a\\b'), '!adf:link[t]{href="https://example.com/a\\\\b"}\n')
  assert.equal(link('https://example.com/?a=1&amp;b=2'), '!adf:link[t]{href="https://example.com/?a=1\\u0026amp;b=2"}\n')
  assert.equal(link('https://example.com/a\nb'), '!adf:link[t]{href="https://example.com/a\\nb"}\n')
  const entity = 'https://example.com/?a=1&amp;b=2'
  const autolinkShaped = document(paragraph({ marks: [{ attrs: { href: entity }, type: 'link' }], text: entity, type: 'text' }))
  assert.equal(markdown(adfToLosslessMarkdown(autolinkShaped)), '!adf:link[https://example.com/?a=1\\&amp;b=2]{href="https://example.com/?a=1\\u0026amp;b=2"}\n')
})

test('spells a link carrying an attribute CommonMark cannot as the directive link, and refuses none', () => {
  const link = (attrs: Record<string, string>): string =>
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ attrs, type: 'link' }], text: 't', type: 'text' }))))
  assert.equal(link({ collection: 'c', href: 'https://example.com/' }), '!adf:link[t]{collection=c href="https://example.com/"}\n')
  assert.equal(link({ href: 'https://example.com/', id: 'i' }), '!adf:link[t]{href="https://example.com/" id=i}\n')
  assert.equal(link({ href: 'https://example.com/', occurrenceKey: 'k' }), '!adf:link[t]{href="https://example.com/" occurrenceKey=k}\n')
  assert.equal(link({ href: 'https://example.com/', id: 'i', title: 'a\nb' }), '!adf:link[t]{href="https://example.com/" id=i title="a\\nb"}\n')
})

test('escapes the parenthesis a link destination leaves unbalanced, and no other', () => {
  const link = (href: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ attrs: { href }, type: 'link' }], text: 't', type: 'text' }))))
  assert.equal(link('https://en.example.com/a_(b)'), '[t](https://en.example.com/a_(b))\n')
  assert.equal(link('https://example.com/a)b'), '[t](https://example.com/a\\)b)\n')
  assert.equal(link('https://example.com/a(b'), '[t](https://example.com/a\\(b)\n')
  assert.equal(link('https://example.com/)(') , '[t](https://example.com/\\)\\()\n')
  assert.equal(link('https://example.com/a (b'), '[t](<https://example.com/a (b>)\n')
})

test('escapes the quote a link title holds, and spells the rest as the directive link', () => {
  const titled = (title: string): string =>
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ attrs: { href: 'https://example.com/', title }, type: 'link' }], text: 't', type: 'text' }))))
  assert.equal(titled('He said "hi"'), '[t](https://example.com/ "He said \\"hi\\"")\n')
  assert.equal(titled('a\nb'), '!adf:link[t]{href="https://example.com/" title="a\\nb"}\n')
  assert.equal(titled('a\\b'), '!adf:link[t]{href="https://example.com/" title="a\\\\b"}\n')
  assert.equal(titled('a &amp; b'), '!adf:link[t]{href="https://example.com/" title="a \\u0026amp; b"}\n')
})

test('carries a link mark the link spelling cannot write', () => {
  const carried = (mark: AdfMark): string => markdown(adfToLosslessMarkdown(document(paragraph({ marks: [mark], text: 't', type: 'text' }))))
  assert.equal(
    carried({ attrs: { href: 'x', rel: 'y' }, type: 'link' }),
    '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"href\\":\\"x\\",\\"rel\\":\\"y\\"},\\"type\\":\\"link\\"}],\\"text\\":\\"t\\",\\"type\\":\\"text\\"}"}\n',
  )
  assert.equal(carried({ attrs: { href: 4 }, type: 'link' }), '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"href\\":4},\\"type\\":\\"link\\"}],\\"text\\":\\"t\\",\\"type\\":\\"text\\"}"}\n')
  assert.equal(carried({ type: 'link' }), '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"link\\"}],\\"text\\":\\"t\\",\\"type\\":\\"text\\"}"}\n')
})

test('carries a mark the canonical spellings cannot nest', () => {
  const carried = (...marks: AdfMark[]): string => markdown(adfToLosslessMarkdown(document(paragraph({ marks, text: 'x', type: 'text' }))))
  assert.equal(carried({ type: 'annotation' }), '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"annotation\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n')
  assert.equal(
    carried({ type: 'code' }, { type: 'strong' }),
    '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"code\\"},{\\"type\\":\\"strong\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
  )
  assert.equal(
    carried({ attrs: { colour: 'red' }, type: 'em' }),
    '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"colour\\":\\"red\\"},\\"type\\":\\"em\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
  )
  assert.equal(
    carried({ attrs: { localId: 'x' }, type: 'code' }),
    '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"localId\\":\\"x\\"},\\"type\\":\\"code\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
  )
})

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
})

test('alternates the marker between adjacent lists of a kind, the marker change being what parts them', () => {
  const list: AdfNode = { content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(list, list, list))), '- x\n\n* x\n\n- x\n')
  const ordered: AdfNode = { attrs: { order: 9 }, content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }, { content: [paragraph({ text: 'y', type: 'text' }), paragraph({ text: 'z', type: 'text' })], type: 'listItem' }], type: 'orderedList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(ordered, ordered))), '9. x\n10. y\n\n    z\n\n9) x\n10) y\n\n    z\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(list, ordered, list))), '- x\n\n9. x\n10. y\n\n    z\n\n- x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { panelType: 'info' }, content: [list, list], type: 'panel' }))), '!adf:panel info\n- x\n\n* x\n!adf:/panel\n')
  const nested: AdfNode = { content: [{ content: [list, list], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(nested))), '- - x\n  * x\n')
  const stars: AdfNode = { content: [{ content: [paragraph({ text: '* *', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(list, stars))), '- x\n\n* \\* *\n')
  const strong: AdfNode = { content: [{ content: [paragraph({ text: '**', type: 'text' }), paragraph({ text: 'y', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(strong))), '- **\n\n  y\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(list, strong))), '- x\n\n* \\**\n\n  y\n')
  const carried: AdfNode = { ...list, attrs: { unknown: 'x' } }
  assert.ok(markdown(adfToLosslessMarkdown(document(carried, carried))).includes('```\n\n```adf:bulletList\n'))
  assert.ok(markdown(adfToLosslessMarkdown(document(carried, list))).endsWith('```\n\n- x\n'))
  assert.ok(markdown(adfToLosslessMarkdown(document(list, carried))).startsWith('- x\n\n```adf:bulletList\n'))
})

test('carries a node type no section spells, the fence naming the type wherever an info string carries it', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'blockCard' }))), '```adf:blockCard\n{}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'toString' }))), '```adf:toString\n{}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ type: 'blockCard' })))), '!adf:carry{json="{\\"type\\":\\"blockCard\\"}"}\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ text: 'x', type: 'text' }))), '```adf:text\n{\n  "text": "x"\n}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'hardBreak' }))), '```adf:hardBreak\n{}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'a&amp;b' }))), '```adf:\n{\n  "type": "a&amp;b"\n}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'a\\b' }))), '```adf:\n{\n  "type": "a\\\\b"\n}\n```\n')
})

test('spells the code block whose language opens with the reserved info string prefix', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { language: 'adf:x' }, type: 'codeBlock' }))), '!adf:codeBlock {language="adf:x"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { language: 'carry' }, type: 'codeBlock' }))), '```carry\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { language: 'adf' }, type: 'codeBlock' }))), '```adf\n```\n')
})

test('breaks a mark run at the node it carries', () => {
  const strong: AdfMark = { type: 'strong' }
  const carried: AdfNode = { marks: [strong], type: 'placeholder' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [strong], text: 'a', type: 'text' }, carried, { marks: [strong], text: 'b', type: 'text' })))),
    '**a**!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"type\\":\\"placeholder\\"}"}**b**\n',
  )
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

test('carries a code block holding a node no fence holds', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph()], type: 'codeBlock' }))), '```adf:codeBlock\n{\n  "content": [\n    {\n      "type": "paragraph"\n    }\n  ]\n}\n```\n')
  for (const child of [{ attrs: {}, text: 'x', type: 'text' }, { content: [], text: 'x', type: 'text' }, { marks: [], text: 'x', type: 'text' }, { content: [{ text: 'lost', type: 'text' }], text: 'x', type: 'text' }]) {
    assert.ok(markdown(adfToLosslessMarkdown(document({ content: [child], type: 'codeBlock' }))).startsWith('```adf:codeBlock\n'), JSON.stringify(child))
  }
})

test('spells a list its own content shape cannot hold as a directive', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph()], type: 'bulletList' }))), '!adf:bulletList\n!adf:paragraph\n!adf:/paragraph\n!adf:/bulletList\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'bulletList' }))), '!adf:bulletList\n!adf:/bulletList\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { order: 2 }, content: [], type: 'orderedList' }))), '!adf:orderedList {content=empty order=2}\n!adf:/orderedList\n')
})

test('spells an ordered list no marker fits as a directive', () => {
  const item: AdfNode = { content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }
  const list = (order: number, items: number): AdfDocument =>
    document({ attrs: { order }, content: Array.from({ length: items }, () => item), type: 'orderedList' })
  assert.equal(markdown(adfToLosslessMarkdown(list(1.5, 1))), '!adf:orderedList {order="1.5"}\n!adf:listItem\nx\n!adf:/listItem\n!adf:/orderedList\n')
  assert.equal(markdown(adfToLosslessMarkdown(list(999999999, 1))), '999999999. x\n')
  assert.equal(markdown(adfToLosslessMarkdown(list(999999999, 2))), '!adf:orderedList {order=999999999}\n!adf:listItem\nx\n!adf:/listItem\n!adf:listItem\nx\n!adf:/listItem\n!adf:/orderedList\n')
})

test('carries a code mark over anything but text', () => {
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ type: 'code' }], type: 'hardBreak' })))),
    '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"code\\"}],\\"type\\":\\"hardBreak\\"}"}\n',
  )
})

test('spells a heading level no ATX heading fits as a directive', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { level: 7 }, content: [{ text: 'x', type: 'text' }], type: 'heading' }))), '!adf:heading {level=7}\nx\n!adf:/heading\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [{ text: 'x', type: 'text' }], type: 'heading' }))), '!adf:heading\nx\n!adf:/heading\n')
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
  assert.equal(emitted('**bold**'), '\\*\\*bold\\*\\*\n')
  assert.equal(emitted('a `x` b'), 'a \\`x` b\n')
  assert.equal(emitted('~~struck~~'), '\\~~struck\\~~\n')
  assert.equal(emitted('a \\* b'), 'a \\\\\\* b\n')
  assert.equal(emitted('1. not a list'), '1\\. not a list\n')
  assert.equal(emitted('*"quoted"*'), '\\*"quoted"\\*\n')
  assert.equal(emitted('x"_y"'), 'x"\\_y"\n')
})

test('escapes a heading closing sequence', () => {
  const heading = (text: string): string => markdown(adfToLosslessMarkdown(document({ attrs: { level: 2 }, content: [{ text, type: 'text' }], type: 'heading' })))
  assert.equal(heading('done #'), '## done \\#\n')
  assert.equal(heading('#tag first'), '## #tag first\n')
})

test('wraps adjacent nodes carrying one mark once, and a differing mark twice', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  assert.equal(emitted(marked('a', { type: 'strong' }), marked('b', { type: 'strong' }, { type: 'em' })), '**a*b***\n')
  assert.equal(emitted(marked('a', { type: 'strong' }), marked('b', { type: 'em' })), '**a**_b_\n')
  const link = (href: string): AdfMark => ({ attrs: { href }, type: 'link' })
  assert.equal(emitted(marked('a', link('http://x')), marked('b', link('http://y'))), '[a](http://x)[b](http://y)\n')
})

test('carries a mark spelling that cannot open or close where it sits', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  const strong: AdfMark = { type: 'strong' }
  assert.equal(
    emitted({ text: 'un', type: 'text' }, marked('-real', strong), { text: 'istic', type: 'text' }),
    'un!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"text\\":\\"-real\\",\\"type\\":\\"text\\"}"}istic\n',
  )
  assert.equal(
    emitted(marked('C++', { type: 'em' }), { text: 'ish', type: 'text' }),
    '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\"C++\\",\\"type\\":\\"text\\"}"}ish\n',
  )
  assert.equal(
    emitted({ text: 'x', type: 'text' }, marked('.a', strong)),
    'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"text\\":\\".a\\",\\"type\\":\\"text\\"}"}\n',
  )
  assert.equal(emitted({ text: 'un ', type: 'text' }, marked('-real', strong), { text: ' istic', type: 'text' }), 'un **-real** istic\n')
  assert.equal(emitted(marked('a.', strong)), '**a.**\n')
  assert.equal(emitted({ text: 'x', type: 'text' }, marked('a', strong), { text: 'y', type: 'text' }), 'x**a**y\n')
  const em: AdfMark = { type: 'em' }
  assert.equal(
    emitted({ text: 'x', type: 'text' }, marked('a.', em), marked('b', strong)),
    'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\"a.\\",\\"type\\":\\"text\\"}"}**b**\n',
  )
  assert.equal(emitted({ text: 'x', type: 'text' }, marked('ab', em, strong), { text: 'y', type: 'text' }), 'x***ab***y\n')
})

test('refuses a node carrying one mark type twice', () => {
  const em: AdfMark = { type: 'em' }
  assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks: [em, em], text: 'x', type: 'text' })))), 'unsupported-node-shape')
})

test('parts a nested list the tight spelling would swallow from the block above it', () => {
  const item = (...content: AdfNode[]): AdfNode => (content.length === 0 ? { type: 'listItem' } : { content, type: 'listItem' })
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const outer = (...content: AdfNode[]): AdfDocument => document({ content: [item(...content)], type: 'bulletList' })
  const ordered: AdfNode = { attrs: { order: 2 }, content: [item(text('b'))], type: 'orderedList' }
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), ordered))), '- a\n\n  2. b\n')
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), { ...ordered, attrs: { order: 1 } }))), '- a\n  1. b\n')
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), { content: [item()], type: 'bulletList' }))), '- a\n\n  -\n')
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), { content: [item(text('b'))], type: 'bulletList' }))), '- a\n  - b\n')
  const list: AdfNode = { content: [item(text('b'))], type: 'bulletList' }
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [text('p')], type: 'panel' }
  assert.equal(markdown(adfToLosslessMarkdown(outer(panel, list))), '- !adf:panel info\n  p\n  !adf:/panel\n\n  - b\n')
  assert.ok(markdown(adfToLosslessMarkdown(outer(text('a'), { ...list, attrs: { unknown: 'x' } }))).startsWith('- a\n\n  ```adf:bulletList\n'))
})

test('refuses marks and attributes nested deeper than the emitter carries', () => {
  const marks: AdfMark[] = Array.from({ length: 600 }, (_, index) => ({ type: index % 2 === 0 ? 'em' : 'strong' }))
  assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks, text: 'x', type: 'text' })))), 'unsupported-nesting-depth')
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

test("spells a mark run CommonMark's matching pairs as written", () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  const em: AdfMark = { type: 'em' }
  const strong: AdfMark = { type: 'strong' }
  assert.equal(emitted({ text: 'un', type: 'text' }, marked('a', em, strong), { text: 'istic', type: 'text' }), 'un***a***istic\n')
  assert.equal(emitted({ text: 're', type: 'text' }, marked('structure', strong), { text: ' the code', type: 'text' }), 're**structure** the code\n')
  assert.equal(
    emitted({ text: 'un', type: 'text' }, marked('a', em), marked('b', em, strong), marked('c', em), { text: 'istic', type: 'text' }),
    'un*a**b**c*istic\n',
  )
})

test('escapes a hyphen underline a hard break would expose', () => {
  const line = (text: string): string => markdown(adfToLosslessMarkdown(document(paragraph({ text: 'foo', type: 'text' }, { type: 'hardBreak' }, { text, type: 'text' }))))
  assert.equal(line('--'), 'foo\\\n\\--\n')
  assert.equal(line('=='), 'foo\\\n\\==\n')
})

test('spells a list item whose marker completes a thematic break as a directive', () => {
  const item = (...content: AdfNode[]): AdfNode => (content.length === 0 ? { type: 'listItem' } : { content, type: 'listItem' })
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [item({ type: 'rule' })], type: 'bulletList' }))), '!adf:bulletList\n!adf:listItem\n---\n!adf:/listItem\n!adf:/bulletList\n')
  const nested: AdfNode = { content: [item({ content: [item()], type: 'bulletList' })], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(nested))), '- -\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [item(nested)], type: 'bulletList' }))), '!adf:bulletList\n!adf:listItem\n- -\n!adf:/listItem\n!adf:/bulletList\n')
  assert.equal(
    markdown(adfToLosslessMarkdown(document({ content: [item(paragraph({ text: 'a', type: 'text' }), nested), item({ type: 'rule' })], type: 'bulletList' }))),
    '!adf:bulletList\n!adf:listItem\na\n\n- -\n!adf:/listItem\n!adf:listItem\n---\n!adf:/listItem\n!adf:/bulletList\n',
  )
  const spaced: AdfNode = { content: [{ text: 'a\n \nb', type: 'text' }], type: 'codeBlock' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document({ attrs: { order: 3 }, content: [item(spaced)], type: 'orderedList' }))),
    '!adf:orderedList {order=3}\n!adf:listItem\n```\na\n \nb\n```\n!adf:/listItem\n!adf:/orderedList\n',
  )
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

test('carries a mark run whose edge holds whitespace CommonMark flanking counts', () => {
  const em = { type: 'em' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [em], text: '\u00a0a', type: 'text' })))),
    '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\"\u00a0a\\",\\"type\\":\\"text\\"}"}\n',
  )
})

test('pads a code span whose edges CommonMark would strip', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ type: 'code' }], text: ' \t ', type: 'text' })))), '`  \t  `\n')
})

test('spells a code span per code-marked node, parted by the text break', () => {
  const code_ = { type: 'code' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [code_], text: 'a', type: 'text' }, { marks: [code_], text: 'b', type: 'text' })))),
    '`a`!adf:textBreak{}`b`\n',
  )
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

test('emits an empty list item without trailing whitespace', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [{ type: 'listItem' }], type: 'bulletList' }))), '-\n')
})

test('spells a block directive as its node type, arg and attributes', () => {
  const panel = (attrs: AdfAttributes): AdfDocument => document({ attrs, content: [paragraph({ text: 'x', type: 'text' })], type: 'panel' })
  assert.equal(markdown(adfToLosslessMarkdown(panel({ panelType: 'warning' }))), '!adf:panel warning\nx\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel({}))), '!adf:panel {attrs=empty}\nx\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [{ text: 'x', type: 'text' }], type: 'caption' }))), '!adf:caption\nx\n!adf:/caption\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'caption' }))), '!adf:caption\n!adf:/caption\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { localId: 'a' }, type: 'syncBlock' }))), '!adf:syncBlock {localId=a}\n')
})

test('carries a directive attribute no section spells', () => {
  const carried = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(node)))
  assert.equal(carried({ attrs: { rounded: true }, type: 'panel' }), '```adf:panel\n{\n  "attrs": {\n    "rounded": true\n  }\n}\n```\n')
  assert.equal(carried({ attrs: { toString: 'x' }, type: 'panel' }), '```adf:panel\n{\n  "attrs": {\n    "toString": "x"\n  }\n}\n```\n')
  assert.equal(carried({ attrs: { localId: 4 }, type: 'panel' }), '```adf:panel\n{\n  "attrs": {\n    "localId": 4\n  }\n}\n```\n')
  assert.equal(
    carried({ attrs: { width: '50' }, type: 'layoutColumn' }),
    '```adf:layoutColumn\n{\n  "attrs": {\n    "width": "50"\n  }\n}\n```\n',
  )
  assert.equal(
    carried({ attrs: { isNumberColumnEnabled: 'true' }, type: 'table' }),
    '```adf:table\n{\n  "attrs": {\n    "isNumberColumnEnabled": "true"\n  }\n}\n```\n',
  )
  assert.equal(
    carried({ content: [{ attrs: { alt: 4 }, type: 'media' }], type: 'mediaGroup' }),
    '!adf:mediaGroup\n```adf:media\n{\n  "attrs": {\n    "alt": 4\n  }\n}\n```\n!adf:/mediaGroup\n',
  )
})

test('carries an arg slot value no bare token spells', () => {
  const carried = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(node)))
  assert.equal(
    carried({ attrs: { panelType: 'extra info' }, type: 'panel' }),
    '```adf:panel\n{\n  "attrs": {\n    "panelType": "extra info"\n  }\n}\n```\n',
  )
  assert.equal(carried({ attrs: { state: 2 }, type: 'taskItem' }), '```adf:taskItem\n{\n  "attrs": {\n    "state": 2\n  }\n}\n```\n')
})

test('carries a block node mark in the reserved attribute', () => {
  const section = (...marks: AdfMark[]): AdfDocument => document({ marks, type: 'layoutSection' })
  assert.equal(markdown(adfToLosslessMarkdown(section({ type: 'breakout' }))), '!adf:layoutSection {marks="[{\\"type\\":\\"breakout\\"}]"}\n!adf:/layoutSection\n')
  assert.equal(markdown(adfToLosslessMarkdown(section({ attrs: {}, type: 'breakout' }))), '!adf:layoutSection {marks="[{\\"attrs\\":{},\\"type\\":\\"breakout\\"}]"}\n!adf:/layoutSection\n')
  assert.equal(markdown(adfToLosslessMarkdown(section())), '!adf:layoutSection {marks=empty}\n!adf:/layoutSection\n')
})

test('refuses the content a directive body has no room for', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph()], type: 'media' }))), 'unsupported-node-shape: a media holds no content: this one holds some')
  assert.equal(markdown(adfToLosslessMarkdown(document({ text: 'x', type: 'panel' }))), 'unsupported-node-shape: a panel carries no text: this one holds text')
})

test('separates blocks in a container body by a blank line only where a directive line is not separation already', () => {
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const panel = (...content: AdfNode[]): AdfDocument => document({ attrs: { panelType: 'info' }, content, type: 'panel' })
  assert.equal(markdown(adfToLosslessMarkdown(panel(text('a'), text('b')))), '!adf:panel info\na\n\nb\n!adf:/panel\n')
  const caption: AdfNode = { content: [{ text: 'c', type: 'text' }], type: 'caption' }
  assert.equal(markdown(adfToLosslessMarkdown(panel(caption, caption))), '!adf:panel info\n!adf:caption\nc\n!adf:/caption\n!adf:caption\nc\n!adf:/caption\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel(text('a'), caption))), '!adf:panel info\na\n!adf:caption\nc\n!adf:/caption\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel(caption, text('a')))), '!adf:panel info\n!adf:caption\nc\n!adf:/caption\na\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel(paragraph(), text('a')))), '!adf:panel info\n!adf:paragraph\n!adf:/paragraph\na\n!adf:/panel\n')
})

test('spells the image form for exactly the centered external media shape', () => {
  const url = 'https://example.com/moon.png'
  const single = (attrs: AdfAttributes, ...content: AdfNode[]): AdfDocument =>
    document({ attrs: { layout: 'center' }, content: [content.length === 0 ? { attrs, type: 'media' } : { attrs, content, type: 'media' }], type: 'mediaSingle' })
  assert.equal(markdown(adfToLosslessMarkdown(single({ alt: 'The moon', type: 'external', url }))), `![The moon](${url})\n`)
  assert.equal(markdown(adfToLosslessMarkdown(single({ type: 'external', url }))), `![](${url})\n`)
  assert.equal(markdown(adfToLosslessMarkdown(single({ alt: 'a [b] c', type: 'external', url }))), `![a \\[b\\] c](${url})\n`)
  const fallback = (attrs: AdfAttributes): boolean => markdown(adfToLosslessMarkdown(single(attrs))).startsWith('!adf:mediaSingle {layout=center}')
  assert.ok(fallback({ alt: '', type: 'external', url }))
  assert.ok(fallback({ alt: 'a\nb', type: 'external', url }))
  assert.ok(fallback({ alt: 'a\u0000b', type: 'external', url }))
  assert.ok(fallback({ type: 'external', url: 'https://example.com/a b>c' }))
  assert.ok(fallback({ alt: ' moon ', type: 'external', url }))
  assert.ok(fallback({ alt: 4, type: 'external', url }))
  assert.ok(fallback({ type: 'external', url: 4 }))
  assert.equal(code(adfToLosslessMarkdown(single({ type: 'external', url }, paragraph()))), 'unsupported-node-shape')
  const media: AdfNode = { attrs: { type: 'external', url }, type: 'media' }
  assert.equal(code(adfToLosslessMarkdown(document({ attrs: { layout: 'center' }, content: [media], text: 'x', type: 'mediaSingle' }))), 'unsupported-node-shape')
  assert.equal(code(adfToLosslessMarkdown(document({ attrs: { layout: 'center' }, content: [{ ...media, text: 'x' }], type: 'mediaSingle' }))), 'unsupported-node-shape')
})

test('spells a mediaSingle the image form does not fit as a directive', () => {
  const media: AdfNode = { attrs: { type: 'external', url: 'https://example.com/moon.png' }, type: 'media' }
  const single: AdfNode = { attrs: { layout: 'center' }, content: [media], marks: [{ type: 'border' }], type: 'mediaSingle' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document(single))),
    '!adf:mediaSingle {layout=center marks="[{\\"type\\":\\"border\\"}]"}\n!adf:media {type=external url="https://example.com/moon.png"}\n!adf:/mediaSingle\n',
  )
})

test('spells a table as a pipe table only where every row and cell is plain', () => {
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const cell = (type: string, ...content: AdfNode[]): AdfNode => ({ content, type })
  const row = (...cells: AdfNode[]): AdfNode => ({ content: cells, type: 'tableRow' })
  const table = (...rows: AdfNode[]): AdfDocument => document({ content: rows, type: 'table' })
  const directive = (result: Result<string>): boolean => markdown(result).startsWith('!adf:table')
  const header = row(cell('tableHeader', text('Part')))
  assert.equal(markdown(adfToLosslessMarkdown(table(header, row(cell('tableCell', text('Bolt M8')))))), '| Part |\n| --- |\n| Bolt M8 |\n')
  assert.equal(markdown(adfToLosslessMarkdown(table(row(cell('tableHeader', text('a|b')))))), '| a\\|b |\n| --- |\n')
  assert.ok(directive(adfToLosslessMarkdown(table())))
  assert.ok(directive(adfToLosslessMarkdown(table(row()))))
  assert.ok(directive(adfToLosslessMarkdown(table({ type: 'tableRow' }))))
  assert.ok(directive(adfToLosslessMarkdown(table(header, row()))))
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableCell', text('Bolt M8')))))))
  assert.ok(directive(adfToLosslessMarkdown(table(cell('tableHeader', text('Part'))))))
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader'))))))
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader', text('a'), text('b')))))))
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader', { attrs: { localId: 'a' }, type: 'paragraph' }))))))
  assert.equal(
    markdown(adfToLosslessMarkdown(table(row(cell('tableHeader', { content: [{ attrs: { url: 'a|b' }, type: 'blockCard' }], type: 'paragraph' }))))),
    '| !adf:carry{json="{\\"attrs\\":{\\"url\\":\\"a\\u007cb\\"},\\"type\\":\\"blockCard\\"}"} |\n| --- |\n',
  )
  assert.equal(markdown(adfToLosslessMarkdown(table(row(cell('tableHeader', { content: [{ text: '\fa', type: 'text' }], type: 'paragraph' }))))), '| \fa |\n| --- |\n')
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader', { attrs: { level: 1 }, type: 'heading' }))))))
  assert.equal(markdown(adfToLosslessMarkdown(table(row(cell('tableHeader', { content: [{ text: ' a', type: 'text' }], type: 'paragraph' }))))), '| !adf:text{text=" "}a |\n| --- |\n')
  const marked = (mark: AdfMark): AdfDocument => table(row(cell('tableHeader', { content: [{ marks: [mark], text: 'l', type: 'text' }], type: 'paragraph' })))
  assert.ok(directive(adfToLosslessMarkdown(marked({ attrs: { href: 'https://example.com/?x|y' }, type: 'link' }))))
  assert.ok(directive(adfToLosslessMarkdown(marked({ attrs: { href: 'https://example.com/', title: 'a|b' }, type: 'link' }))))
  const codeSpan: AdfNode = { marks: [{ type: 'code' }], text: 'a|b', type: 'text' }
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader', { content: [codeSpan], type: 'paragraph' }))))))
  assert.equal(markdown(adfToLosslessMarkdown(marked({ attrs: { href: 'https://example.com/x' }, type: 'link' }))), '| [l](https://example.com/x) |\n| --- |\n')
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
  const neither = (type: string, held: string): string => `unsupported-node-shape: a ${type} node holds neither content nor text: this one holds ${held}`
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

test('spells the directive marks around the longest run they cover', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  const underline: AdfMark = { type: 'underline' }
  assert.equal(emitted(marked('x', underline)), '!adf:underline[x]\n')
  assert.equal(emitted(marked('a', underline), marked('b', underline)), '!adf:underline[a!adf:textBreak{}b]\n')
  assert.equal(emitted(marked('a', { attrs: {}, type: 'underline' }), marked('b', underline)), '!adf:underline[a]{attrs=empty}!adf:underline[b]\n')
  assert.equal(emitted(marked('x', { attrs: { type: 'sub' }, type: 'subsup' })), '!adf:subsup[x]{type=sub}\n')
  assert.equal(emitted(marked('x', { attrs: { color: '#ae2e24' }, type: 'textColor' })), '!adf:textColor[x]{color="#ae2e24"}\n')
  assert.equal(emitted(marked('x', { attrs: { color: '#091e42', size: 2 }, type: 'border' })), '!adf:border[x]{color="#091e42" size=2}\n')
  assert.equal(emitted(marked('x', { type: 'em' }, underline)), '_!adf:underline[x]_\n')
  assert.equal(emitted(marked('x', underline, { type: 'em' })), '!adf:underline[_x_]\n')
  assert.equal(emitted(marked('a', underline), { type: 'hardBreak' }, marked('b', underline)), '!adf:underline[a]\\\n!adf:underline[b]\n')
})

test('closes a mark run at the hard break between two nodes holding the mark', () => {
  const em: AdfMark = { type: 'em' }
  const link: AdfMark = { attrs: { href: '/u' }, type: 'link' }
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const hardBreak: AdfNode = { type: 'hardBreak' }
  assert.equal(readsBack(document(paragraph(marked('a', em), hardBreak, marked('b', em)))), '_a_\\\n_b_\n')
  assert.equal(readsBack(document(paragraph(marked('a', link), hardBreak, marked('b', link)))), '[a](/u)\\\n[b](/u)\n')
  assert.equal(readsBack(document(paragraph(marked('a', em, link), hardBreak, marked('b', em)))), '_[a](/u)_\\\n_b_\n')
  assert.equal(readsBack(document(paragraph(marked('a', em), hardBreak, hardBreak, marked('b', em)))), '_a_\\\n\\\n_b_\n')
  const directive: AdfMark = { attrs: { href: '/u', id: 'x' }, type: 'link' }
  assert.equal(readsBack(document(paragraph(marked('a', directive), hardBreak, marked('b', directive)))), '!adf:link[a]{href="/u" id=x}\\\n!adf:link[b]{href="/u" id=x}\n')
  readsBack(document(paragraph(marked(']: /x', link, { type: 'code' }), hardBreak, marked('b', link))))
  assert.equal(readsBack(document(paragraph({ text: 'x', type: 'text' }, marked('.', em), hardBreak, marked('b', em)))), 'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\".\\",\\"type\\":\\"text\\"}"}\\\n_b_\n')
})

test('carries a hard break holding marks, which Atlassian\'s schema withholds', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(
    readsBack(document(paragraph({ marks: [link], text: 'a', type: 'text' }, { marks: [link], type: 'hardBreak' }, { marks: [link], text: 'b', type: 'text' }))),
    '[a](https://example.com/)!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"href\\":\\"https://example.com/\\"},\\"type\\":\\"link\\"}],\\"type\\":\\"hardBreak\\"}"}[b](https://example.com/)\n',
  )
})

test('carries a mark directive attribute no spelling holds', () => {
  const carried = (mark: AdfMark): string => markdown(adfToLosslessMarkdown(document(paragraph({ marks: [mark], text: 'x', type: 'text' }))))
  assert.equal(
    carried({ attrs: { width: 2 }, type: 'border' }),
    '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"width\\":2},\\"type\\":\\"border\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
  )
  assert.equal(
    carried({ attrs: { size: '2' }, type: 'border' }),
    '!adf:carry{json="{\\"marks\\":[{\\"attrs\\":{\\"size\\":\\"2\\"},\\"type\\":\\"border\\"}],\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
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

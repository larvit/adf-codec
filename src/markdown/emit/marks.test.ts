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

function code(result: Result<string>): string {
  return result.ok ? `emitted ${JSON.stringify(result.value)}` : result.error.code
}

function markdown(result: Result<string>): string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function readsBack(doc: AdfDocument): string {
  const spelled = markdown(adfToLosslessMarkdown(doc))
  assert.deepEqual(losslessMarkdownToAdf(spelled), { ok: true, value: doc }, `reading ${JSON.stringify(spelled)}`)
  return spelled
}

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

test('breaks a mark run at the node it carries', () => {
  const strong: AdfMark = { type: 'strong' }
  const carried: AdfNode = { marks: [strong], type: 'placeholder' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [strong], text: 'a', type: 'text' }, carried, { marks: [strong], text: 'b', type: 'text' })))),
    '**a**!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"type\\":\\"placeholder\\"}"}**b**\n',
  )
})

test('carries a code mark over anything but text', () => {
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ marks: [{ type: 'code' }], type: 'hardBreak' })))),
    '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"code\\"}],\\"type\\":\\"hardBreak\\"}"}\n',
  )
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
  const carriedR = '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"text\\":\\"-r\\",\\"type\\":\\"text\\"}"}'
  assert.equal(emitted({ text: 'un', type: 'text' }, marked('-r', strong), { text: 'un', type: 'text' }, marked('-r', strong), { text: 'un', type: 'text' }), `un${carriedR}un${carriedR}un\n`)
  assert.equal(
    emitted({ text: 'x', type: 'text' }, marked('[', { type: 'em' }, { type: 'strike' }), marked('a', { type: 'em' })),
    'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"},{\\"type\\":\\"strike\\"}],\\"text\\":\\"[\\",\\"type\\":\\"text\\"}"}_a_\n',
  )
  assert.equal(emitted(marked('a.', strong)), '**a.**\n')
  assert.equal(emitted({ text: 'x', type: 'text' }, marked('a', strong), { text: 'y', type: 'text' }), 'x**a**y\n')
  const em: AdfMark = { type: 'em' }
  assert.equal(
    emitted({ text: 'x', type: 'text' }, marked('a.', em), marked('b', strong)),
    'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\"a.\\",\\"type\\":\\"text\\"}"}**b**\n',
  )
  assert.equal(emitted({ text: 'x', type: 'text' }, marked('ab', em, strong), { text: 'y', type: 'text' }), 'x***ab***y\n')
})

test('carries the mark spelling that cannot close where it sits, and keeps the later one the reader would pair it with', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  const b: AdfNode = { text: 'b', type: 'text' }
  assert.equal(emitted(marked(':', { type: 'em' }), b, marked('c', { type: 'em' })), '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\":\\",\\"type\\":\\"text\\"}"}b*c*\n')
  assert.equal(emitted(marked(')', { type: 'strong' }), b, marked('c', { type: 'strong' })), '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"text\\":\\")\\",\\"type\\":\\"text\\"}"}b**c**\n')
  assert.equal(emitted(marked('^', { type: 'strike' }), b, marked('c', { type: 'strike' })), '!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strike\\"}],\\"text\\":\\"^\\",\\"type\\":\\"text\\"}"}b~~c~~\n')
})

test('carries every node holding em, strike or strong, and no other, in a line still misread after 32 passes', () => {
  const marked = (text: string, ...types: string[]): AdfNode => ({ marks: types.map((type) => ({ type })), text, type: 'text' })
  const carry = (node: AdfNode): string => `!adf:carry{json="${JSON.stringify(node).replaceAll('"', '\\"')}"}`
  const repeat = [marked(' ~~ ', 'em', 'strong'), marked(')', 'em', 'strike', 'strong'), { text: 'a', type: 'text' }, marked('.unun', 'strike', 'strong')]
  const written = repeat.map((node) => (node.marks === undefined ? 'a' : carry(node))).join('')
  const line = [...Array.from({ length: 40 }, () => repeat).flat(), { text: ' ', type: 'text' }, { marks: [{ attrs: { href: 'u' }, type: 'link' }], text: 'b', type: 'text' }]
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph(...line)))), `${written.repeat(40)} [b](u)\n`)
})

test('refuses a node carrying one mark type twice', () => {
  const em: AdfMark = { type: 'em' }
  assert.equal(code(adfToLosslessMarkdown(document(paragraph({ marks: [em, em], text: 'x', type: 'text' })))), 'unsupported-node-shape')
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

test('spells the directive marks around the longest run they cover', () => {
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const emitted = (...content: AdfNode[]): string => markdown(adfToLosslessMarkdown(document(paragraph(...content))))
  const underline: AdfMark = { type: 'underline' }
  assert.equal(emitted(marked('x', underline)), '!adf:underline[x]\n')
  assert.equal(emitted(marked('a', underline), marked('b', underline)), '!adf:underline[a!adf:textBreak{}b]\n')
  assert.equal(emitted(marked('a', { attrs: {}, type: 'underline' }), marked('b', underline)), '!adf:underline[a]{attrs=empty}!adf:underline[b]\n')
  assert.equal(emitted(marked('x', { attrs: { type: 'sub' }, type: 'subsup' })), '!adf:subsup[x]{type=sub}\n')
  assert.equal(emitted(marked('x', { attrs: { color: '#ae2e24' }, type: 'textColor' })), '!adf:textColor[x]{color="#ae2e24"}\n')
  assert.equal(emitted(marked('x', { type: 'em' }, underline)), '_!adf:underline[x]_\n')
  assert.equal(emitted(marked('x', underline, { type: 'em' })), '!adf:underline[_x_]\n')
  assert.equal(emitted(marked('a', underline), { type: 'hardBreak' }, marked('b', underline)), '!adf:underline[a]\\\n!adf:underline[b]\n')
})

test('spells an emphasis or link run once across the hard breaks between two nodes holding the mark', () => {
  const em: AdfMark = { type: 'em' }
  const link: AdfMark = { attrs: { href: '/u' }, type: 'link' }
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const hardBreak: AdfNode = { type: 'hardBreak' }
  assert.equal(readsBack(document(paragraph(marked('a', em), { marks: [], type: 'hardBreak' }, marked('b', em)))), '_a_!adf:hardBreak{marks=empty}_b_\n')
  assert.equal(readsBack(document(paragraph(marked('a', em), { attrs: { id: 'x', text: '@A' }, marks: [], type: 'mention' }, marked('b', em)))), '_a_!adf:mention[@A]{id=x marks=empty}_b_\n')
  assert.equal(readsBack(document(paragraph(marked('One', em), hardBreak, marked('Two', em)))), '_One\\\nTwo_\n')
  assert.equal(readsBack(document(paragraph(marked('a', link), hardBreak, marked('b', link)))), '[a\\\nb](/u)\n')
  assert.equal(readsBack(document(paragraph(marked('a', em, link), hardBreak, marked('b', em)))), '_[a](/u)\\\nb_\n')
  assert.equal(readsBack(document(paragraph(marked('a', em), hardBreak, hardBreak, marked('b', em)))), '_a\\\n\\\nb_\n')
  assert.equal(readsBack(document(paragraph(marked('a', em), hardBreak, { text: 'b', type: 'text' }))), '_a_\\\nb\n')
  const directive: AdfMark = { attrs: { href: '/u', id: 'x' }, type: 'link' }
  assert.equal(readsBack(document(paragraph(marked('a', directive), hardBreak, marked('b', directive)))), '!adf:link[a!adf:hardBreak{}b]{href="/u" id=x}\n')
  readsBack(document(paragraph(marked(']: /x', link, { type: 'code' }), hardBreak, marked('b', link))))
  assert.equal(readsBack(document(paragraph({ text: 'x', type: 'text' }, marked('.', em), hardBreak, marked('b', em)))), 'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"em\\"}],\\"text\\":\\".\\",\\"type\\":\\"text\\"}"}\\\n_b_\n')
})

test('parts every run on a line that needs a fallback, whichever run needs it', () => {
  const em: AdfMark = { type: 'em' }
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  assert.equal(
    readsBack(document(paragraph({ text: 'x', type: 'text' }, marked('.', { type: 'strong' }), { text: 'y ', type: 'text' }, marked('a', em), { type: 'hardBreak' }, marked('b', em)))),
    'x!adf:carry{json="{\\"marks\\":[{\\"type\\":\\"strong\\"}],\\"text\\":\\".\\",\\"type\\":\\"text\\"}"}y _a_\\\n_b_\n',
  )
})

test('spells an emphasis run once across the code spans, mentions, dates and inline media between two nodes holding the mark', () => {
  const strong: AdfMark = { type: 'strong' }
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  const mention: AdfNode = { attrs: { id: 'x', text: '@A' }, type: 'mention' }
  assert.equal(readsBack(document(paragraph(marked('Ping ', strong), mention, marked(' now', strong)))), '**Ping !adf:mention[@A]{id=x} now**\n')
  assert.equal(readsBack(document(paragraph(marked('Run ', strong), marked('npm ci', { type: 'code' }), marked(' first', strong)))), '**Run `npm ci` first**\n')
  assert.equal(readsBack(document(paragraph(marked('a ', strong), { attrs: { timestamp: '0' }, type: 'date' }, marked(' b', strong)))), '**a !adf:date{timestamp=0} b**\n')
  assert.equal(readsBack(document(paragraph(marked('a ', strong), { attrs: { id: 'm' }, type: 'mediaInline' }, marked(' b', strong)))), '**a !adf:mediaInline{id=m} b**\n')
  assert.equal(readsBack(document(paragraph(marked('a ', strong), marked('c', { type: 'code' }), mention, { type: 'hardBreak' }, marked(' b', strong)))), '**a `c`!adf:mention[@A]{id=x}\\\n!adf:text{text=" "}b**\n')
  assert.equal(readsBack(document(paragraph(marked('a', strong), marked('https://x/', { attrs: { href: 'https://x/' }, type: 'link' }, { type: 'code' }), marked('b', strong)))), '**a[`https://x/`](https://x/)b**\n')
})

test('spells a link run once across the mentions and inline cards between two nodes holding it, and parts it at code and inline media that do not hold it', () => {
  const link: AdfMark = { attrs: { href: '/u' }, type: 'link' }
  const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
  assert.equal(readsBack(document(paragraph(marked('a ', link), { attrs: { id: 'x', text: '@A' }, type: 'mention' }, marked(' b', link)))), '[a !adf:mention[@A]{id=x} b](/u)\n')
  assert.equal(readsBack(document(paragraph(marked('a', link), { attrs: { url: 'https://c/' }, type: 'inlineCard' }, marked('b', link)))), '[a!adf:inlineCard{url="https://c/"}b](/u)\n')
  assert.equal(readsBack(document(paragraph(marked('a', link), marked('c', { type: 'code' }), marked('b', link)))), '[a](/u)`c`[b](/u)\n')
  assert.equal(readsBack(document(paragraph(marked('a', link), { attrs: { id: 'm' }, type: 'mediaInline' }, marked('b', link)))), '[a](/u)!adf:mediaInline{id=m}[b](/u)\n')
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

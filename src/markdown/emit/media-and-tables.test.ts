import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
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

test('spells a media only a link marks as the image the link wraps', () => {
  const url = 'https://example.com/moon.png'
  const linked = (alt: string | undefined, ...marks: AdfMark[]): AdfDocument =>
    document({ attrs: { layout: 'center' }, content: [{ attrs: alt === undefined ? { type: 'external', url } : { alt, type: 'external', url }, marks, type: 'media' }], type: 'mediaSingle' })
  const link = (attrs: AdfAttributes): AdfMark => ({ attrs, type: 'link' })
  const spelled = (written: AdfDocument, expected: string): void => {
    assert.equal(markdown(adfToLosslessMarkdown(written)), expected)
    assert.deepEqual(losslessMarkdownToAdf(expected), { ok: true, value: written })
  }
  spelled(linked('The moon', link({ href: 'https://example.com/docs' })), `[![The moon](${url})](https://example.com/docs)\n`)
  spelled(linked(undefined, link({ href: 'https://example.com/docs', title: 'Docs "v2"' })), `[![](${url})](https://example.com/docs "Docs \\"v2\\"")\n`)
  spelled(linked('a [b] c', link({ href: '/a b' })), `[![a \\[b\\] c](${url})](</a b>)\n`)
  spelled(linked('m', link({ href: '' })), `[![m](${url})]()\n`)
  const fallback = (document: AdfDocument): boolean => markdown(adfToLosslessMarkdown(document)).startsWith('!adf:mediaSingle {layout=center}')
  assert.ok(fallback(linked('m', link({ href: '/d', id: 'x' }))))
  assert.ok(fallback(linked('m', link({ href: '/d' }), { attrs: { color: '#000', size: 1 }, type: 'border' })))
  assert.ok(fallback(linked('m', link({ href: 'a\\b' }))))
  assert.ok(fallback(linked('m', link({ title: 't' }))))
  assert.ok(fallback(linked('m', link({ href: '/d', title: 4 }))))
  const captioned: AdfNode = { attrs: { layout: 'center' }, content: [{ attrs: { alt: 'm', type: 'external', url }, type: 'media' }, { content: [{ text: 'c', type: 'text' }], type: 'caption' }], type: 'mediaSingle' }
  assert.ok(fallback(document(captioned)))
})

test('spells a mediaSingle the image form does not fit as a directive', () => {
  const media: AdfNode = { attrs: { type: 'external', url: 'https://example.com/moon.png' }, type: 'media' }
  const single: AdfNode = { attrs: { layout: 'center' }, content: [media], marks: [{ type: 'border' }], type: 'mediaSingle' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document(single))),
    '!adf:mediaSingle {layout=center marks=border}\n!adf:media {type=external url="https://example.com/moon.png"}\n!adf:/mediaSingle\n',
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
  assert.ok(directive(adfToLosslessMarkdown(marked({ attrs: { href: 'https://example.com/|' }, type: 'link' }))))
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader', { content: [{ marks: [{ type: 'code' }], text: 'a\\|b', type: 'text' }], type: 'paragraph' }))))))
  const codeSpan: AdfNode = { marks: [{ type: 'code' }], text: 'a|b', type: 'text' }
  assert.ok(directive(adfToLosslessMarkdown(table(row(cell('tableHeader', { content: [codeSpan], type: 'paragraph' }))))))
  assert.equal(markdown(adfToLosslessMarkdown(marked({ attrs: { href: 'https://example.com/x' }, type: 'link' }))), '| [l](https://example.com/x) |\n| --- |\n')
})

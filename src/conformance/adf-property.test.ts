import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfNode } from '../adf/document.ts'
import { adfDocument, blockTaskItemChildren, propertyRuns, propertyTimeout } from './property-harness.ts'
import { adfToHtml } from '../html/emit/adf-to-html.ts'
import { adfToLosslessMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { adfToPortableMarkdown, reduceToPortable } from '../markdown/portable/adf-to-portable-markdown.ts'
import { losslessMarkdownToAdf } from '../markdown/parse/markdown-to-adf.ts'
import { portableMarkdownToAdf } from '../markdown/portable/portable-markdown-to-adf.ts'
import { toEditorNormal } from '../markdown/portable/editor-normal.ts'

const gateRuns = 1600
// What HTML text cannot hold (WHATWG HTML §13.1.3), and the line feed a carry element shows as a line break.
const unshown = /\n|(?![\t\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/gu

// Every text node's text in document order.
function documentTexts(nodes: readonly AdfNode[]): string[] {
  const texts: string[] = []
  const pending = [...nodes].reverse()
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.text !== undefined) texts.push(node.text)
    for (const child of [...(node.content ?? [])].reverse()) pending.push(child)
  }
  return texts
}

// Each block's text, an expand's title and an image's alt and url, in document order: what the portable pair keeps.
function shownText(nodes: readonly AdfNode[]): string[] {
  const shown: string[] = []
  for (const node of nodes) {
    const attrs = node.attrs ?? {}
    if ((node.type === 'expand' || node.type === 'nestedExpand') && typeof attrs['title'] === 'string') shown.push(attrs['title'])
    if (node.type === 'media') shown.push(`${JSON.stringify(attrs['alt'] ?? '')} ${JSON.stringify(attrs['url'])}`)
    const content = node.content ?? []
    if (content.some((child) => child.type === 'text' || child.type === 'hardBreak')) shown.push(content.map((child) => child.text ?? '\n').join(''))
    else for (const text of shownText(content)) shown.push(text)
  }
  return shown.filter((text) => text !== '')
}

test('a generated document emits markdown that reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const emitted = adfToLosslessMarkdown(document)
      assert.ok(emitted.ok, emitted.ok ? '' : `${emitted.error.code}: ${emitted.error.message}`)
      const read = losslessMarkdownToAdf(emitted.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(emitted.value)}`)
      assert.deepEqual(read.value, document, `reading ${JSON.stringify(emitted.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes portable markdown refusing only what the guard refuses, and that markdown reads back to its text, to itself and to block task items of paragraphs alone', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToPortableMarkdown(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      const read = portableMarkdownToAdf(written.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(blockTaskItemChildren(read.value.content ?? []).filter((type) => type !== 'paragraph'), [], `reading ${JSON.stringify(written.value)}`)
      const reduced = reduceToPortable(document)
      assert.deepEqual(shownText(read.value.content ?? []), reduced.ok ? shownText(reduced.value.content ?? []) : reduced, `reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(adfToPortableMarkdown(read.value), written, `reading ${JSON.stringify(written.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes HTML holding no character HTML cannot hold, and showing every text node\'s text in document order', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToHtml(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      assert.ok(!/(?![\t\n\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/u.test(written.value), `writing ${JSON.stringify(document)}`)
      const page = written.value.replace(/<[^>]*>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&').replace(unshown, '')
      let from = 0
      for (const text of documentTexts(document.content ?? [])) {
        const shown = text.replace(unshown, '')
        const at = page.indexOf(shown, from)
        assert.ok(at >= 0, `writing ${JSON.stringify(document)}: ${JSON.stringify(shown)} is not shown after ${from}`)
        from = at + shown.length
      }
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes the portable markdown its editor-normal form writes', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      assert.deepEqual(adfToPortableMarkdown(document), adfToPortableMarkdown(toEditorNormal(document)))
    }),
    propertyRuns(gateRuns),
  )
})

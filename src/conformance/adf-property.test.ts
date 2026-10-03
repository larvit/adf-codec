import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfNode } from '../adf/document.ts'
import { adfDocument, propertyRuns, propertyTimeout } from './property-harness.ts'
import { adfToMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { adfToPlainMarkdown, reduceToPlain } from '../markdown/emit/plain-reduction.ts'
import { directivePrefix } from '../markdown/directive-syntax.ts'
import { markdownToAdf, plainMarkdownToAdf } from '../markdown/parse/markdown-to-adf.ts'
import { toEditorNormal } from '../adf/editor-normal.ts'

const gateRuns = 1600
const renamedPrefix = '!adg:'

// Renaming the prefix changes what markdown reads only where a directive was read.
function readsNoDirective(markdown: string): boolean {
  const read = markdownToAdf(markdown)
  const renamed = markdownToAdf(markdown.replaceAll(directivePrefix, renamedPrefix))
  return read.ok && renamed.ok && JSON.stringify(read.value).replaceAll(directivePrefix, renamedPrefix) === JSON.stringify(renamed.value)
}

// Each block's text, an expand's title and an image's alt and url, in document order: what the plain pair keeps.
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

test('a generated document refuses to emit, or its markdown reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const emitted = adfToMarkdown(document)
      if (!emitted.ok) return
      const read = markdownToAdf(emitted.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(emitted.value)}`)
      assert.deepEqual(read.value, document, `reading ${JSON.stringify(emitted.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes plain markdown refusing only what the guard refuses, and that markdown reads back to its text and to itself', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToPlainMarkdown(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      assert.ok(readsNoDirective(written.value), `a directive in ${JSON.stringify(written.value)}`)
      const read = plainMarkdownToAdf(written.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(written.value)}`)
      const reduced = reduceToPlain(document)
      assert.deepEqual(shownText(read.value.content ?? []), reduced.ok ? shownText(reduced.value.content ?? []) : reduced, `reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(adfToPlainMarkdown(read.value), written, `reading ${JSON.stringify(written.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes the plain markdown its editor-normal form writes', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      assert.deepEqual(adfToPlainMarkdown(document), adfToPlainMarkdown(toEditorNormal(document)))
    }),
    propertyRuns(gateRuns),
  )
})

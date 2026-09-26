import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { adfDocument, propertyRuns, propertyTimeout } from './property-harness.ts'
import { adfToMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { adfToPlainMarkdown } from '../markdown/emit/plain-reduction.ts'
import { directivePrefix } from '../markdown/directive-syntax.ts'
import { markdownToAdf } from '../markdown/parse/markdown-to-adf.ts'
import { plainMarkdownToAdf } from '../markdown/parse/plain-lift.ts'
import { toEditorNormal } from '../adf/editor-normal.ts'

const gateRuns = 1600
const renamedPrefix = '!adg:'

// Renaming the prefix changes what markdown reads only where a directive was read.
function readsNoDirective(markdown: string): boolean {
  const read = markdownToAdf(markdown)
  const renamed = markdownToAdf(markdown.replaceAll(directivePrefix, renamedPrefix))
  return read.ok && renamed.ok && JSON.stringify(read.value).replaceAll(directivePrefix, renamedPrefix) === JSON.stringify(renamed.value)
}

test('a generated document refuses to emit, or its markdown reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const emitted = adfToMarkdown(document)
      if (!emitted.ok) return
      const read = markdownToAdf(emitted.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(emitted.value)}`)
      assert.deepEqual(toEditorNormal(read.value), document, `reading ${JSON.stringify(emitted.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes plain markdown refusing only what the guard refuses, and that markdown reads back to itself', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToPlainMarkdown(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      assert.ok(readsNoDirective(written.value), `a directive in ${JSON.stringify(written.value)}`)
      const read = plainMarkdownToAdf(written.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(adfToPlainMarkdown(read.value), written, `reading ${JSON.stringify(written.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

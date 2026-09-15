import fc from 'fast-check'
import assert from 'node:assert/strict'
import test from 'node:test'

import { adfDocument, propertyRuns, propertyTimeout } from './property-generators.ts'
import { adfToMarkdown } from './markdown/emit/adf-to-markdown.ts'
import { markdownToAdf } from './markdown/parse/markdown-to-adf.ts'
import { toEditorNormal } from './adf/editor-normal.ts'

const gateRuns = 1600

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

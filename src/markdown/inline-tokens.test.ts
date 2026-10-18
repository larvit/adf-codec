import type { AdfDocument } from '../adf/document.ts'
import assert from 'node:assert/strict'
import test from 'node:test'

import { adfToLosslessMarkdown } from './emit/adf-to-markdown.ts'
import { flavourClaims } from './portable/conventions.ts'
import { inlineSource, readInlineToken } from './inline-tokens.ts'
import { losslessMarkdownToAdf } from './parse/markdown-to-adf.ts'

const constructs = ['<!A>', '<??>', '<![CDATA[]]>']

test('an HTML construct whose terminator starts right after its opener reads as HTML', () => {
  for (const construct of constructs) assert.equal(readInlineToken(inlineSource(`a ${construct}`), 2, flavourClaims.commonmark).kind, 'html', construct)
})

test('text spelling such a construct round-trips', () => {
  for (const construct of constructs) {
    const document: AdfDocument = { content: [{ content: [{ text: `a ${construct}`, type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }
    const written = adfToLosslessMarkdown(document)
    assert.ok(written.ok)
    assert.deepEqual(losslessMarkdownToAdf(written.value), { ok: true, value: document }, construct)
  }
})

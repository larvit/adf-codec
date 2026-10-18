import type { AdfDocument } from '../adf/document.ts'
import assert from 'node:assert/strict'
import test from 'node:test'

import { adfToLosslessMarkdown } from './emit/adf-to-markdown.ts'
import { flavourClaims } from './portable/conventions.ts'
import { inlineSource, readInlineToken } from './inline-tokens.ts'
import { losslessMarkdownToAdf } from './parse/markdown-to-adf.ts'

const constructs = ['<!A>', '<??>', '<![CDATA[]]>']

// CommonMark 0.31.2, Raw HTML: the terminator must start after the opener, and may start right after it.
test('an HTML opener reads as HTML only where its terminator starts after it', () => {
  const cases: [string, string][] = [...constructs.map((text): [string, string] => [text, 'html']), ['<!---->', 'html'], ['?> <? ?>', 'html'], ['?> <?', 'text'], ['<?>', 'text']]
  for (const [text, kind] of cases) {
    const at = text.lastIndexOf('<')
    assert.equal(readInlineToken(inlineSource(`a ${text}`), at + 2, flavourClaims.commonmark).kind, kind, text)
  }
})

test('text spelling such a construct round-trips', () => {
  for (const construct of constructs) {
    const document: AdfDocument = { content: [{ content: [{ text: `a ${construct}`, type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }
    const written = adfToLosslessMarkdown(document)
    assert.ok(written.ok)
    assert.deepEqual(losslessMarkdownToAdf(written.value), { ok: true, value: document }, construct)
  }
})

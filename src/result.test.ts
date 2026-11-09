import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AdfDocument, AdfMark } from './adf/document.ts'
import type { ConvertErrorCode, Result } from './result.ts'
import type { JsonValue } from './json-value.ts'
import { adfToLosslessMarkdown } from './markdown/emit/adf-to-markdown.ts'
import { htmlToAdf } from './html/parse/html-to-adf.ts'
import { largestNesting } from './nesting.ts'
import { losslessMarkdownToAdf } from './markdown/parse/markdown-to-adf.ts'
import { readAdfDocument } from './adf/document.ts'
import { withinEngineLimits } from './length-bound.ts'

const em: AdfMark = { type: 'em' }
const duplicateMarks: AdfDocument = { content: [{ content: [{ marks: [em, em], text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }

// The Record type fails the typecheck where a code has no entry, or an entry names no code.
const causes: Record<ConvertErrorCode, () => Result<unknown>> = {
  'engine-limit': () =>
    withinEngineLimits(() => {
      throw new RangeError('Invalid array length')
    }),
  'malformed-directive': () => losslessMarkdownToAdf('!adf:/panel\n'),
  'malformed-pipe-table': () => losslessMarkdownToAdf('| Part | Qty |\n'),
  'not-a-string': () => Reflect.apply(losslessMarkdownToAdf, undefined, [null]),
  'not-an-adf-document': () => readAdfDocument(null),
  'unknown-directive-name': () => losslessMarkdownToAdf('!adf:widget[a]\n'),
  'unmappable-html': () => htmlToAdf('<table><tr></tr></table>\n'),
  'unsupported-document-version': () => adfToLosslessMarkdown({ type: 'doc', version: 2 }),
  'unsupported-nesting-depth': () => adfToLosslessMarkdown(nestedAttribute(largestNesting + 1)),
  'unsupported-node-shape': () => adfToLosslessMarkdown(duplicateMarks),
}

function nestedAttribute(depth: number): AdfDocument {
  let value: JsonValue = 1
  for (let level = 0; level < depth; level += 1) value = { a: value }
  return { content: [{ attrs: { a: value }, type: 'paragraph' }], type: 'doc', version: 1 }
}

// Removing a code is breaking (docs/decisions.md §The code list), so a code must not outlive its cause.
for (const [code, cause] of Object.entries(causes)) {
  test(`${code} is the code of a refusal the library makes`, () => {
    const result = cause()
    assert.equal(!result.ok && result.error.code, code)
  })
}

// A code added or removed must reach the README's tables, which are the contract a consumer switches on.
test('the README error tables list exactly the codes ConvertErrorCode holds', () => {
  const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf8')
  const section = readme.slice(readme.indexOf('\n## The errors\n'))
  const listed = new Set<string>()
  for (const line of section.slice(1, section.indexOf('\n## ', 1)).split('\n')) {
    const code = /^\| `([a-z-]+)` \|/.exec(line)?.[1]
    if (code !== undefined) listed.add(code)
  }
  assert.deepEqual([...listed].sort(), Object.keys(causes).sort())
})

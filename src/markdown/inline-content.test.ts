import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../adf/document.ts'
import type { Result } from '../result.ts'
import type { InlineContent } from './inline-content.ts'
import { parseInlineContent } from './inline-content.ts'

function read(source: string): Result<InlineContent & { openingSpellableLink: boolean }> {
  return parseInlineContent(source, new Map(), [], 'paragraph', 'lossless')
}

function nodes(result: Result<InlineContent>): AdfNode[] | string {
  return result.ok ? result.value.nodes : result.error.code
}

test('reports a directive link opening the line that CommonMark could spell', () => {
  const opening = read('!adf:link[a]{href="/u"}')
  assert.equal(opening.ok && opening.value.openingSpellableLink, true)
  assert.deepEqual(nodes(opening), [{ marks: [{ attrs: { href: '/u' }, type: 'link' }], text: 'a', type: 'text' }])
})

test('reports no spellable opening link where the line opens with text', () => {
  const text = read('See a')
  assert.equal(text.ok && text.value.openingSpellableLink, false)
})

test('reports the opening link whose CommonMark spelling would open a link definition, leaving the writer to answer', () => {
  const definition = read('!adf:link[`]: a`]{href="/u"}')
  assert.equal(definition.ok && definition.value.openingSpellableLink, true)
})

test('still refuses a spellable directive link past the opening of the line', () => {
  assert.equal(nodes(read('See !adf:link[a]{href="/u"}.')), 'unsupported-node-shape')
})

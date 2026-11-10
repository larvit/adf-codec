import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../adf/document.ts'
import type { Result } from '../result.ts'
import type { InlineContent, OutermostContent } from './inline-content.ts'
import { parseInlineContent } from './inline-content.ts'

function read(source: string): Result<OutermostContent> {
  return parseInlineContent(source, new Map(), [], 'paragraph', 'lossless')
}

function nodes(result: Result<InlineContent>): AdfNode[] | string {
  return result.ok ? result.value.nodes : result.error.code
}

test('reports a directive link that CommonMark could spell opening the line', () => {
  const opening = read('!adf:link[a]{href="/u"}')
  assert.equal(opening.ok && opening.value.openingSpellableLink, true)
  assert.deepEqual(nodes(opening), [{ marks: [{ attrs: { href: '/u' }, type: 'link' }], text: 'a', type: 'text' }])
})

test('reports no spellable opening link where the line opens with text', () => {
  const text = read('See a')
  assert.equal(text.ok && text.value.openingSpellableLink, false)
})

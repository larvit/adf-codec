import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import { toEditorNormal } from './editor-normal.ts'

test('merges adjacent text nodes carrying identical marks, at every level', () => {
  const content: AdfNode[] = [
    { text: 'a', type: 'text' },
    { text: 'b', type: 'text' },
    { marks: [{ type: 'strong' }], text: 'c', type: 'text' },
    { marks: [{ attrs: {}, type: 'strong' }], text: 'd', type: 'text' },
    { type: 'hardBreak' },
    { text: 'e', type: 'text' },
    { attrs: { localId: '01a0a06b-5281-7f27-9022-8d3a74b0ab0d' }, text: 'f', type: 'text' },
    { text: 'g', type: 'text' },
    { attrs: {}, text: 'h', type: 'text' },
  ]
  assert.deepEqual(toEditorNormal({ content: [{ attrs: { panelType: 'info' }, content: [{ content, type: 'paragraph' }], type: 'panel' }], type: 'doc', version: 1 }), {
    content: [
      {
        attrs: { panelType: 'info' },
        content: [
          {
            content: [
              { text: 'ab', type: 'text' },
              { marks: [{ type: 'strong' }], text: 'cd', type: 'text' },
              { type: 'hardBreak' },
              { text: 'e', type: 'text' },
              { attrs: { localId: '01a0a06b-5281-7f27-9022-8d3a74b0ab0d' }, text: 'f', type: 'text' },
              { text: 'gh', type: 'text' },
            ],
            type: 'paragraph',
          },
        ],
        type: 'panel',
      },
    ],
    type: 'doc',
    version: 1,
  })
})

test('reads negative zero as zero, as JSON does', () => {
  const marks = [{ attrs: { size: -0 }, type: 'border' }]
  assert.deepEqual(
    toEditorNormal({ content: [{ attrs: { a: -0, b: [{ c: -0 }, null, 'd'] }, content: [{ marks, text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: -0 }),
    { content: [{ attrs: { a: 0, b: [{ c: 0 }, null, 'd'] }, content: [{ marks: [{ attrs: { size: 0 }, type: 'border' }], text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 0 },
  )
})

test('reads an empty attrs object, marks array or content array as the absent key, but on doc', () => {
  const paragraph: AdfNode = { attrs: {}, content: [{ attrs: {}, marks: [], text: 'a', type: 'text' }, { marks: [{ attrs: {}, type: 'em' }], text: 'b', type: 'text' }], marks: [], type: 'paragraph' }
  assert.deepEqual(toEditorNormal({ content: [paragraph, { content: [], type: 'rule' }], type: 'doc', version: 1 }), {
    content: [{ content: [{ text: 'a', type: 'text' }, { marks: [{ type: 'em' }], text: 'b', type: 'text' }], type: 'paragraph' }, { type: 'rule' }],
    type: 'doc',
    version: 1,
  })
  assert.deepEqual(toEditorNormal({ content: [], type: 'doc', version: 1 }), { content: [], type: 'doc', version: 1 })
  assert.deepEqual(toEditorNormal({ type: 'doc', version: 1 }), { type: 'doc', version: 1 })
})

test('normalizes blocks and mark attributes nesting far past the levels a recursive walk survives', () => {
  const levels = 100000
  let node: AdfNode = { content: [], type: 'paragraph' }
  for (let level = 0; level < levels; level += 1) node = { content: [node], type: 'blockquote' }
  let normal = toEditorNormal({ content: [node], type: 'doc', version: 1 }).content?.[0]
  let depth = 0
  for (; normal?.content !== undefined; depth += 1) normal = normal.content[0]
  assert.equal(depth, levels)
  assert.deepEqual(normal, { type: 'paragraph' })
  let deep: JsonValue = 1
  for (let level = 0; level < 2 * levels; level += 1) deep = [deep]
  const marks = [{ attrs: { deep }, type: 'textColor' }]
  const merged = toEditorNormal({ content: [{ content: [{ marks, text: 'a', type: 'text' }, { marks, text: 'b', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 })
  assert.deepEqual(merged.content?.[0]?.content?.map((text) => text.text), ['ab'])
})

test('joins a text node holding content to its neighbour, as editor-normal forms hold no content to part them', () => {
  const paragraph: AdfNode = { content: [{ content: [{ text: 'lost', type: 'text' }], text: 'a', type: 'text' }, { text: 'b', type: 'text' }], type: 'paragraph' }
  assert.deepEqual(toEditorNormal({ content: [paragraph], type: 'doc', version: 1 }).content, [{ content: [{ content: [{ text: 'lost', type: 'text' }], text: 'ab', type: 'text' }], type: 'paragraph' }])
})

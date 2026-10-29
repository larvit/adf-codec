import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { emitInlineLine } from './inline-line.ts'
import { lineContainer, markedLine, propertyRuns } from '../../conformance/property-harness.ts'

test('spells a line alike taking every fallback a pass finds or the first alone', () => {
  fc.assert(
    fc.property(markedLine, lineContainer, (nodes, container) => {
      assert.deepEqual(emitInlineLine(nodes, container, [], 'lossless'), emitInlineLine(nodes, container, [], 'lossless', 'first'))
    }),
    // Lines where carrying one run lets a neighbour read as written, which the seed's runs rarely reach.
    {
      ...propertyRuns(3000),
      examples: [
        [[{ marks: [{ type: 'em' }], text: '-', type: 'text' }, { text: '0', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: 'un', type: 'text' }, { text: '0', type: 'text' }], 'paragraph'],
        [[{ marks: [{ type: 'em' }, { type: 'strike' }], text: 'a', type: 'text' }, { text: 'a', type: 'text' }, { marks: [{ type: 'strong' }, { type: 'em' }], text: 'a', type: 'text' }, { marks: [{ type: 'strong' }], text: 'a', type: 'text' }], 'paragraph'],
        [[{ marks: [{ type: 'em' }], text: 'a', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strike' }, { type: 'strong' }], text: 'a', type: 'text' }, { text: 'a', type: 'text' }], 'paragraph'],
      ],
    },
  )
})

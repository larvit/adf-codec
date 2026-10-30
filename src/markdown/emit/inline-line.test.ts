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
    // Lines the fixed seed rarely generates: carrying one run lets a neighbour or its holder read as written, or one pass carries every copy of a repeated mark run.
    {
      ...propertyRuns(3000),
      examples: [
        [[{ marks: [{ type: 'em' }], text: '-', type: 'text' }, { text: '0', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: 'un', type: 'text' }, { text: '0', type: 'text' }], 'paragraph'],
        [[{ marks: [{ type: 'em' }, { type: 'strike' }], text: 'a', type: 'text' }, { text: 'a', type: 'text' }, { marks: [{ type: 'strong' }, { type: 'em' }], text: 'a', type: 'text' }, { marks: [{ type: 'strong' }], text: 'a', type: 'text' }], 'paragraph'],
        [[{ marks: [{ type: 'em' }], text: 'a', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strike' }, { type: 'strong' }], text: 'a', type: 'text' }, { text: 'a', type: 'text' }], 'paragraph'],
        [[1, 2, 3].flatMap(() => [{ text: 'un', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }]), 'paragraph'],
        [[{ text: 'un', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }, { marks: [{ type: 'strike' }], text: 'un', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }, { text: 'z', type: 'text' }], 'paragraph'],
        [[{ marks: [{ type: 'strike' }], text: ' b', type: 'text' }, { marks: [{ type: 'em' }], text: '!-', type: 'text' }], 'paragraph'],
        [[{ marks: [{ type: 'strike' }], text: 'r', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'strong' }, { type: 'em' }], text: '[ ', type: 'text' }, ...[1, 2, 3, 4, 5].map(() => ({ marks: [{ type: 'strike' }], text: ' ', type: 'text' }))], 'heading'],
        [[{ text: 'a', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strike' }], text: '(', type: 'text' }, { marks: [{ type: 'em' }], text: 'a', type: 'text' }], 'paragraph'],
        [[{ text: 'b', type: 'text' }, { marks: [{ type: 'strong' }], text: '(a', type: 'text' }, { marks: [{ type: 'em' }], text: '(b', type: 'text' }, { text: 'c', type: 'text' }], 'paragraph'],
      ],
    },
  )
})

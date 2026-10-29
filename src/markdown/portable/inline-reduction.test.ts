import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { lineContainer, markedLine, propertyRuns } from '../../conformance/property-harness.ts'
import { reduceInline } from './inline-reduction.ts'

test('reduces a line alike dropping every run a pass may or the first alone', () => {
  fc.assert(
    fc.property(markedLine, lineContainer, (nodes, container) => {
      assert.deepEqual(reduceInline(nodes, container, [], 0), reduceInline(nodes, container, [], 0, 'first'))
    }),
    // Lines holding a later run that must not drop with the first, which the seed's runs rarely reach.
    {
      ...propertyRuns(3000),
      examples: [
        [[{ attrs: { id: 'a' }, type: 'mention' }, { marks: [{ type: 'strike' }, { type: 'strong' }], text: 'un*', type: 'text' }, { marks: [{ type: 'strong' }], text: '[', type: 'text' }, { text: 'a ', type: 'text' }, { text: ' ', type: 'text' }], 'heading'],
        [[{ marks: [{ type: 'strong' }], text: '-', type: 'text' }, { text: '0', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: 'un ', type: 'text' }, { text: ' ', type: 'text' }], 'heading'],
      ],
    },
  )
})

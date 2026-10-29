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
    propertyRuns(3000),
  )
})

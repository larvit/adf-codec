import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { markerOpening, readAlertMarker, readTaskMarker } from './conventions.ts'
import { propertyRuns } from '../../conformance/property-harness.ts'

test('reads a task or alert marker only where the text opens with the marker opening', () => {
  fc.assert(
    fc.property(fc.array(fc.constantFrom(' ', '!', '+', '-', 'N', 'x', '[', '\\', ']', '[ ] ', '[x]', '[!NOTE]'), { maxLength: 4 }).map((pieces) => pieces.join('')), (text) => {
      if (readTaskMarker(text) !== undefined || readAlertMarker(text) !== undefined) assert.equal(text.charAt(0), markerOpening)
    }),
    propertyRuns(2000),
  )
})

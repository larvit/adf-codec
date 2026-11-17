import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { colourNames } from './colour-names.ts'

test("holds the table as it was when checked against CSS Color Module Level 4's 148 named colours, by the table's digest", () => {
  assert.equal(createHash('sha256').update(JSON.stringify(colourNames)).digest('hex'), 'b0342a8a5a0071cd9f90a78f9490277db0c3632a976b2a9745d08aa8e51eb1fa')
})

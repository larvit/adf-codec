import assert from 'node:assert/strict'
import test from 'node:test'

import { backtickCloser } from './backtick-runs.ts'

test('a code span closes on the first later run of exactly its opener length', () => {
  const closer = backtickCloser('`a``b```c`')
  assert.equal(closer(1, 1), 9)
  assert.equal(closer(1, 2), 2)
  assert.equal(closer(1, 3), 5)
  assert.equal(closer(1, 4), undefined)
})

test('a run before the opener closes nothing', () => {
  const closer = backtickCloser('``a``b')
  assert.equal(closer(2, 2), 3)
  assert.equal(closer(5, 2), undefined)
})

test('an ask from earlier in the text than the last finds the earlier closer', () => {
  const closer = backtickCloser('`a`b`c`')
  assert.equal(closer(5, 1), 6)
  assert.equal(closer(1, 1), 2)
})

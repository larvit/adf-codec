import assert from 'node:assert/strict'
import test from 'node:test'

import { backtickRuns, closingRun } from './backtick-runs.ts'

test('a code span closes on the first later run of exactly its opener length', () => {
  const runs = backtickRuns('`a``b```c`')
  assert.equal(closingRun(runs, 1, 1), 9)
  assert.equal(closingRun(runs, 1, 2), 2)
  assert.equal(closingRun(runs, 1, 3), 5)
  assert.equal(closingRun(runs, 1, 4), undefined)
})

test('a run before the opener closes nothing', () => {
  const runs = backtickRuns('``a``b')
  assert.equal(closingRun(runs, 2, 2), 3)
  assert.equal(closingRun(runs, 5, 2), undefined)
})

test('an ask from earlier in the text than the last finds the earlier closer', () => {
  const runs = backtickRuns('`a`b`c`')
  assert.equal(closingRun(runs, 5, 1), 6)
  assert.equal(closingRun(runs, 1, 1), 2)
})

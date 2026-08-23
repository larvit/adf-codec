import assert from 'node:assert/strict'
import test from 'node:test'

test('the test harness runs TypeScript', () => {
  const answer: number = 42
  assert.equal(answer, 42)
})

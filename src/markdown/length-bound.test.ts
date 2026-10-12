import assert from 'node:assert/strict'
import test from 'node:test'

import type { Result } from '../result.ts'
import { boundedThen, joinedWithin, separatedBy, tooLong, withinEngineLimits } from './length-bound.ts'
import { success } from '../result.ts'

function thrown(name: string, message: string): () => Result<string> {
  return () => {
    const error = new Error(message)
    error.name = name
    throw error
  }
}

test('joins pieces up to the bound, and builds nothing past it', () => {
  assert.equal(joinedWithin(separatedBy(', ', [['a', 'b'], ['c']])), 'ab, c')
  const half = 'a'.repeat(2 ** 28)
  assert.equal(joinedWithin([half, half]), undefined)
})

test('refuses where a bounded builder stopped, and goes on with what it built', () => {
  assert.deepEqual(boundedThen(undefined, success), tooLong())
  assert.deepEqual(boundedThen('x', (text) => success(`${text}!`)), success('x!'))
})

test('refuses a string past the bound as too long on every engine, and names any other engine limit', () => {
  assert.deepEqual(withinEngineLimits(thrown('RangeError', 'Invalid string length')), tooLong())
  assert.deepEqual(withinEngineLimits(thrown('InternalError', 'allocation size overflow')), tooLong())
  assert.deepEqual(withinEngineLimits(thrown('RangeError', 'Out of memory')), {
    error: { code: 'unsupported-node-shape', message: 'the output would be longer than the longest string or array this JavaScript engine builds (Out of memory)', path: [] },
    ok: false,
  })
  assert.equal(withinEngineLimits(thrown('RangeError', 'Invalid array length')).ok, false)
  assert.deepEqual(
    withinEngineLimits(() => success('x')),
    { ok: true, value: 'x' },
  )
})

test('lets a stack overflow or any other throw through', () => {
  assert.throws(() => withinEngineLimits(thrown('RangeError', 'Maximum call stack size exceeded')))
  assert.throws(() => withinEngineLimits(thrown('TypeError', 'a bug')))
  assert.throws(() =>
    withinEngineLimits(() => {
      throw 'a string'
    }),
  )
})

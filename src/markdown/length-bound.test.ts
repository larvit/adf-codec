import assert from 'node:assert/strict'
import test from 'node:test'

import type { Result } from '../result.ts'
import { joinedWithin, tooLong, withinEngineLimits, withinLongest } from './length-bound.ts'
import { success } from '../result.ts'

function thrown(name: string, message: string): () => Result<string> {
  return () => {
    const error = new Error(message)
    error.name = name
    throw error
  }
}

test('joins pieces up to the bound, and builds nothing past it', () => {
  assert.deepEqual(joinedWithin(['a', 'b']), success('ab'))
  const half = 'a'.repeat(2 ** 28)
  assert.deepEqual(joinedWithin([half, half]), tooLong())
})

test('passes a text within the bound', () => {
  assert.deepEqual(withinLongest('x'), success('x'))
})

test('refuses a string past the bound as too long on every engine, and names any other engine limit', () => {
  assert.deepEqual(withinEngineLimits(thrown('RangeError', 'Invalid string length')), tooLong())
  assert.deepEqual(withinEngineLimits(thrown('InternalError', 'allocation size overflow')), tooLong())
  assert.deepEqual(withinEngineLimits(thrown('RangeError', 'Out of memory')), {
    error: { code: 'unsupported-node-shape', message: 'the conversion passed this JavaScript engine\'s longest string or array, or its heap (Out of memory)', path: [] },
    ok: false,
  })
  assert.equal(withinEngineLimits(thrown('RangeError', 'Invalid array length')).ok, false)
  assert.equal(withinEngineLimits(thrown('RangeError', 'Array buffer allocation failed')).ok, false)
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

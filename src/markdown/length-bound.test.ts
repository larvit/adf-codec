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

test('refuses a string past the bound as too long on every engine, and any other engine limit as engine-limit', () => {
  assert.deepEqual(withinEngineLimits(thrown('RangeError', 'Invalid string length')), tooLong())
  assert.deepEqual(withinEngineLimits(thrown('InternalError', 'allocation size overflow')), tooLong())
  assert.deepEqual(withinEngineLimits(thrown('RangeError', 'Out of memory')), {
    error: { code: 'engine-limit', message: 'the conversion passed a limit of this JavaScript engine on a string, array, Map or Set, or ran it out of memory (Out of memory)', path: [] },
    ok: false,
  })
  const code = (message: string): string | undefined => {
    const refused = withinEngineLimits(thrown('RangeError', message))
    return refused.ok ? undefined : refused.error.code
  }
  assert.equal(code('Invalid array length'), 'engine-limit')
  assert.equal(code('Array buffer allocation failed'), 'engine-limit')
  assert.equal(code('Map maximum size exceeded'), 'engine-limit')
  assert.equal(code('Set maximum size exceeded'), 'engine-limit')
  assert.equal(code('invalid array length'), 'engine-limit')
  assert.deepEqual(
    withinEngineLimits(() => {
      throw 'out of memory'
    }),
    { error: { code: 'engine-limit', message: 'the conversion passed a limit of this JavaScript engine on a string, array, Map or Set, or ran it out of memory (out of memory)', path: [] }, ok: false },
  )
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

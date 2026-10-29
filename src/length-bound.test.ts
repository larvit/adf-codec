import assert from 'node:assert/strict'
import test from 'node:test'

import type { Result } from './result.ts'
import { joinedWithin, longestOutput, withinEngineLimits, withinLongest } from './length-bound.ts'
import { success } from './result.ts'

// The code at the document's path, and the bound the message names.
function pastTheBound(result: Result<string>): boolean {
  return !result.ok && result.error.code === 'unsupported-node-shape' && result.error.path.length === 0 && result.error.message.includes('536870888')
}

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
  assert.equal(pastTheBound(joinedWithin([half, half])), true)
})

test('passes a value whose length is within the bound, and refuses one past it', () => {
  assert.deepEqual(withinLongest(longestOutput, 'x'), success('x'))
  assert.equal(pastTheBound(withinLongest(longestOutput + 1, 'x')), true)
})

test('refuses a string past the bound as too long on every engine, and any other engine limit as engine-limit', () => {
  assert.equal(pastTheBound(withinEngineLimits(thrown('RangeError', 'Invalid string length'))), true)
  assert.equal(pastTheBound(withinEngineLimits(thrown('InternalError', 'allocation size overflow'))), true)
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

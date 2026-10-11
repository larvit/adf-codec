import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

import { success, withinEngineLimits, type Result } from './result.ts'

function code(result: Result<string>): string {
  return result.ok ? `converted ${result.value}` : result.error.code
}

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const union = /export type ConvertErrorCode =\n((?:\s+\| '[a-z-]+'\n)+)/
const declared = /'([a-z-]+)'/g
const callSite = /(?:failure\(|code: )'([a-z-]+)'/g

function declaredCodes(): string[] {
  const source = readFileSync(join(sourceRoot, 'result.ts'), 'utf8')
  const members = union.exec(source)?.[1]
  assert.notEqual(members, undefined, 'result.ts declares no ConvertErrorCode union')
  return [...(members ?? '').matchAll(declared)].map(([, name]) => name ?? '').sort()
}

function calledCodes(): string[] {
  const called = new Set<string>()
  for (const name of readdirSync(sourceRoot, { encoding: 'utf8', recursive: true })) {
    if (!name.endsWith('.ts') || name.endsWith('.test.ts') || name === 'result.ts') continue
    for (const [, code] of readFileSync(join(sourceRoot, name), 'utf8').matchAll(callSite)) called.add(code ?? '')
  }
  return [...called].sort()
}

// Removing a code is breaking (docs/decisions.md §The code list), so a code must not outlive its cause.
test('every ConvertErrorCode is the code of a production call site, and every call site names a declared one', () => {
  assert.deepEqual(calledCodes(), declaredCodes())
})

test('refuses where SpiderMonkey runs out of string, and lets a stack overflow or any other throw through', () => {
  const overflow = new Error('allocation size overflow')
  overflow.name = 'InternalError'
  assert.deepEqual(
    withinEngineLimits(() => {
      throw overflow
    }),
    { error: { code: 'unsupported-node-shape', message: 'the output would be longer than the longest string or array this JavaScript engine builds (allocation size overflow)', path: [] }, ok: false },
  )
  assert.equal(
    code(
      withinEngineLimits(() => {
        throw new RangeError('Invalid array length')
      }),
    ),
    'unsupported-node-shape',
  )
  assert.throws(() =>
    withinEngineLimits(() => {
      throw new RangeError('Maximum call stack size exceeded')
    }),
  )
  assert.throws(() =>
    withinEngineLimits(() => {
      throw new TypeError('a bug')
    }),
  )
  assert.deepEqual(
    withinEngineLimits(() => success('x')),
    { ok: true, value: 'x' },
  )
})

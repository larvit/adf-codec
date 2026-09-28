import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

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

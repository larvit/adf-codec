import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function strings(value: unknown): string[] {
  assert.ok(Array.isArray(value))
  return value.map((item: unknown) => {
    assert.equal(typeof item, 'string')
    return String(item)
  })
}

function field(value: unknown, key: string): unknown {
  assert.ok(typeof value === 'object' && value !== null)
  return Object.entries(value).find(([name]) => name === key)?.[1]
}

function listed(path: string, key: string): string[] {
  return strings(field(JSON.parse(read(path)), key))
}

// The one list: the files the package does not ship. docs/decisions.md §The size ratchet.
const unshipped = listed('tsconfig.build.json', 'exclude').sort()
const testFiles = unshipped.filter(glob => glob.endsWith('.test.ts'))

test('the lint ceiling skips exactly the unshipped files', () => {
  assert.deepEqual(listed('.oxlintrc.json', 'ignorePatterns').sort(), unshipped)
})

test('the coverage report leaves out exactly the unshipped files', () => {
  const script = String(field(field(JSON.parse(read('package.json')), 'scripts'), 'test'))
  const excluded = [...script.matchAll(/--test-coverage-exclude=("[^"]+"|\S+)/g)].map(match => String(match[1]).replaceAll('"', ''))
  assert.deepEqual(excluded.sort(), unshipped)
})

test('the mutation run leaves out exactly the unshipped files, spelled as a git pathspec', () => {
  const pathspec = [...read('mutation-tests/run.sh').matchAll(/':!([^']+)'/g)].map(match => String(match[1]))
  // A pathspec's `*` crosses `/`, so it spells `src/**/*.test.ts` as `src/*.test.ts`.
  assert.deepEqual(pathspec.sort(), unshipped.map(glob => glob.replace('**/', '')))
})

test('the mutation run runs every test file and nothing else', () => {
  const config = read('mutation-tests/stryker.config.mjs')
  const run = [...config.matchAll(/testFiles: \[([^\]]*)\]/g)].map(match => String(match[1]).split(',').map(glob => glob.trim().replaceAll("'", '')))
  assert.deepEqual(run, [testFiles])
})

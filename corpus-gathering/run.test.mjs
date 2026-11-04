import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const repo = new URL('..', import.meta.url).pathname

function run(...args) {
  return spawnSync('sh', ['corpus-gathering/run.sh', ...args], { cwd: repo, encoding: 'utf8' })
}

test('refuses a raw folder inside the repo', () => {
  const { status, stderr } = run('corpus')
  assert.equal(status, 2)
  assert.match(stderr, /outside the repo/)
})

test('refuses the repo itself as the raw folder', () => {
  assert.equal(run('.').status, 2)
})

test('names its argument when it is missing', () => {
  const { status, stderr } = run()
  assert.equal(status, 2)
  assert.match(stderr, /Usage: corpus-gathering\/run\.sh <raw folder>/)
})

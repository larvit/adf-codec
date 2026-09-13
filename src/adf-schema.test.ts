import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'adf-schema')

test('the ADF JSON Schemas are @atlaskit/adf-schema 57.4.9, vendored byte-exact', () => {
  const digest = (name: string) => createHash('sha256').update(readFileSync(join(root, name))).digest('hex')
  assert.equal(digest('full.json'), '75f080928a970250eb8289e9cae5374e3c2a6c0ac3ca22478acaa9d3f39484a3')
  assert.equal(digest('stage-0.json'), '56747e5a71c0d5f8c58f94180d69e4482f62c08020d66aaf327333681fcc1c8f')
})

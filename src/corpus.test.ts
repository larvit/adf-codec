import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { adfToMarkdown } from './adf-to-markdown.ts'
import { isAdfDocument } from './adf-document.ts'
import { isJsonValue } from './json-value.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

const corpusRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus')
const roundTripRoot = join(corpusRoot, 'round-trip')

const emittingDirectories = ['commonmark-subset']
const pendingDirectories = ['block-nodes', 'inline-nodes']

function directoryNames(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function fixtureNames(directory: string, extension: string): string[] {
  return readdirSync(join(roundTripRoot, directory))
    .filter((name) => name.endsWith(extension))
    .map((name) => name.slice(0, -extension.length))
    .sort()
}

function corpusJsonPaths(): string[] {
  return readdirSync(corpusRoot, { encoding: 'utf8', recursive: true })
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(corpusRoot, name))
    .sort()
}

test('every round-trip directory is either emitting or explicitly pending', () => {
  assert.deepEqual(directoryNames(roundTripRoot), [...emittingDirectories, ...pendingDirectories].sort())
})

for (const directory of [...emittingDirectories, ...pendingDirectories].sort()) {
  test(`${directory} pairs every .json with a .md`, () => {
    assert.deepEqual(fixtureNames(directory, '.json'), fixtureNames(directory, '.md'))
  })
}

for (const directory of emittingDirectories) {
  const names = [...new Set([...fixtureNames(directory, '.json'), ...fixtureNames(directory, '.md')])].sort()

  test(`${directory} holds fixtures`, () => {
    assert.ok(names.length > 0, `${directory} is expected to emit but holds no fixture pairs`)
  })

  for (const name of names) {
    test(`${directory}/${name} emits its markdown byte for byte`, () => {
      const parsed: unknown = JSON.parse(readFileSync(join(roundTripRoot, directory, `${name}.json`), 'utf8'))
      assert.ok(isAdfDocument(parsed), `${name}.json is not an ADF document`)
      const result = adfToMarkdown(parsed)
      assert.ok(result.ok, result.ok ? '' : `${result.error.code}: ${result.error.message}`)
      const expected = readFileSync(join(roundTripRoot, directory, `${name}.md`))
      const emitted = Buffer.from(result.value, 'utf8')
      if (!emitted.equals(expected)) assert.equal(result.value, expected.toString('utf8'))
      assert.ok(emitted.equals(expected))
    })
  }
}

test('the corpus holds JSON to gate', () => {
  assert.ok(corpusJsonPaths().length > 0)
})

for (const path of corpusJsonPaths()) {
  test(`${path.slice(corpusRoot.length + 1)} re-serializes to itself`, () => {
    const raw = readFileSync(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    assert.ok(isJsonValue(parsed), `${path} does not hold a JSON value`)
    assert.equal(`${serializeCanonicalJson(parsed, 'two-space')}\n`, raw)
  })
}

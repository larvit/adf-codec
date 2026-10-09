import assert from 'node:assert/strict'
import { basename, dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

import { adfToLosslessMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { isAdfDocument } from '../adf/document.ts'
import { isJsonValue } from '../json-value.ts'
import { losslessMarkdownToAdf } from '../markdown/parse/markdown-to-adf.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

const corpusRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'corpus')
const errorsRoot = join(corpusRoot, 'errors')
const normalizationRoot = join(corpusRoot, 'normalization')
const realPayloadsRoot = join(corpusRoot, 'real-payloads')
const roundTripRoot = join(corpusRoot, 'round-trip')

const roundTripDirectories = ['block-nodes', 'combinations', 'commonmark-subset', 'inline-nodes', 'opaque-carry']

function directoryNames(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function fixtureNames(directory: string, extension: string): string[] {
  return names(join(roundTripRoot, directory), extension)
}

function names(root: string, extension: string): string[] {
  return readdirSync(root)
    .filter((name) => name.endsWith(extension))
    .map((name) => name.slice(0, -extension.length))
    .sort()
}

// One kind's fixture pairs, its two tests declared with them.
function pairedNames(root: string, first: string, second: string): string[] {
  const kind = basename(root)

  test(`${kind} pairs every ${first} with a ${second}`, () => {
    assert.deepEqual(names(root, first), names(root, second))
  })

  test(`${kind} holds fixtures`, () => {
    assert.ok(names(root, first).length > 0)
  })

  return names(root, first)
}

function corpusJsonPaths(): string[] {
  return readdirSync(corpusRoot, { encoding: 'utf8', recursive: true })
    .filter((name) => name.endsWith('.json'))
    .filter((name) => name !== `commonmark-spec${sep}spec.json`)
    .map((name) => join(corpusRoot, name))
    .sort()
}

test('every corpus directory is a kind the runner reads', () => {
  assert.deepEqual(directoryNames(corpusRoot), ['commonmark-spec', 'errors', 'normalization', 'real-payloads', 'round-trip'])
})

test('every round-trip directory is a kind the runner reads', () => {
  assert.deepEqual(directoryNames(roundTripRoot), [...roundTripDirectories].sort())
})

for (const directory of roundTripDirectories) {
  const names = [...new Set([...fixtureNames(directory, '.json'), ...fixtureNames(directory, '.md')])].sort()

  test(`${directory} pairs every .json with a .md`, () => {
    assert.ok(names.length > 0, `${directory} is expected to emit but holds no fixture pairs`)
    assert.deepEqual(fixtureNames(directory, '.json'), fixtureNames(directory, '.md'))
  })

  for (const name of names) {
    test(`${directory}/${name} emits its markdown byte for byte`, () => {
      const parsed: unknown = JSON.parse(readFileSync(join(roundTripRoot, directory, `${name}.json`), 'utf8'))
      assert.ok(isAdfDocument(parsed), `${name}.json is not an ADF document`)
      const result = adfToLosslessMarkdown(parsed)
      assert.ok(result.ok, result.ok ? '' : `${result.error.code}: ${result.error.message}`)
      const expected = readFileSync(join(roundTripRoot, directory, `${name}.md`))
      const emitted = Buffer.from(result.value, 'utf8')
      if (!emitted.equals(expected)) assert.equal(result.value, expected.toString('utf8'))
      assert.ok(emitted.equals(expected))
    })
  }
}

for (const directory of roundTripDirectories) {
  for (const name of fixtureNames(directory, '.md')) {
    test(`${directory}/${name} reads its markdown back to the document beside it`, () => {
      const expected: unknown = JSON.parse(readFileSync(join(roundTripRoot, directory, `${name}.json`), 'utf8'))
      assert.ok(isAdfDocument(expected), `${name}.json is not an ADF document`)
      const result = losslessMarkdownToAdf(readFileSync(join(roundTripRoot, directory, `${name}.md`), 'utf8'))
      assert.ok(result.ok, result.ok ? '' : `${result.error.code}: ${result.error.message}`)
      assert.deepEqual(result.value, expected)
    })
  }
}

function roundTripFixtures(): { name: string; path: string }[] {
  return roundTripDirectories.flatMap((directory) =>
    fixtureNames(directory, '.json').map((name) => ({ name: `${directory}/${name}`, path: join(roundTripRoot, directory, `${name}.json`) })),
  )
}

test('no round-trip fixture repeats the document another holds', () => {
  const documents = new Map<string, string>()
  for (const fixture of roundTripFixtures()) {
    const parsed: unknown = JSON.parse(readFileSync(fixture.path, 'utf8'))
    assert.ok(isJsonValue(parsed), `${fixture.name} does not hold a JSON value`)
    const document = serializeCanonicalJson(parsed, 'compact')
    assert.equal(documents.get(document), undefined, `${fixture.name} repeats the document ${documents.get(document)} holds`)
    documents.set(document, fixture.name)
  }
})

for (const name of pairedNames(normalizationRoot, '.md', '.json')) {
  test(`normalization/${name} parses to the document beside it, which emits and reads back to itself`, () => {
    const expected: unknown = JSON.parse(readFileSync(join(normalizationRoot, `${name}.json`), 'utf8'))
    assert.ok(isAdfDocument(expected), `${name}.json is not an ADF document`)
    const result = losslessMarkdownToAdf(readFileSync(join(normalizationRoot, `${name}.md`), 'utf8'))
    assert.ok(result.ok, result.ok ? '' : `${result.error.code}: ${result.error.message}`)
    assert.deepEqual(result.value, expected)
    const emitted = adfToLosslessMarkdown(result.value)
    assert.ok(emitted.ok, emitted.ok ? '' : `${emitted.error.code}: ${emitted.error.message}`)
    const again = losslessMarkdownToAdf(emitted.value)
    assert.ok(again.ok, again.ok ? '' : `${again.error.code}: ${again.error.message}`)
    assert.deepEqual(again.value, expected)
  })
}

test('real-payloads holds payloads', () => {
  assert.ok(names(realPayloadsRoot, '.json').length > 0)
})

for (const name of names(realPayloadsRoot, '.json')) {
  test(`real-payloads/${name} emits markdown that reads back to it`, () => {
    const payload: unknown = JSON.parse(readFileSync(join(realPayloadsRoot, `${name}.json`), 'utf8'))
    assert.ok(isAdfDocument(payload), `${name}.json is not an ADF document`)
    const emitted = adfToLosslessMarkdown(payload)
    assert.ok(emitted.ok, emitted.ok ? '' : `${emitted.error.code}: ${emitted.error.message}`)
    const parsed = losslessMarkdownToAdf(emitted.value)
    assert.ok(parsed.ok, parsed.ok ? '' : `${parsed.error.code}: ${parsed.error.message}`)
    assert.deepEqual(parsed.value, payload)
  })
}

// The position the input itself gives an offset, recomputed rather than trusted from the parser.
function lineStarting(markdown: string, offset: number): { line: number; offset: number } | undefined {
  const before = markdown.slice(0, offset)
  if (offset !== 0 && !/(?:\r\n|[\n\r])$/.test(before)) return undefined
  return { line: before.split(/\r\n|[\n\r]/).length, offset }
}

for (const name of pairedNames(errorsRoot, '.md', '.error')) {
  test(`errors/${name} is refused with the error it names, at a line of its own input`, () => {
    const markdown = readFileSync(join(errorsRoot, `${name}.md`), 'utf8')
    const result = losslessMarkdownToAdf(markdown)
    assert.ok(!result.ok, result.ok ? `built ${JSON.stringify(result.value)}` : '')
    assert.equal(result.error.code, readFileSync(join(errorsRoot, `${name}.error`), 'utf8').trimEnd())
    const { position } = result.error
    assert.deepEqual(position, lineStarting(markdown, position.offset))
  })
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

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
const unspellableRoot = join(corpusRoot, 'unspellable')

const emittingDirectories = ['block-nodes', 'commonmark-subset', 'inline-nodes', 'opaque-carry']

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

function corpusJsonPaths(): string[] {
  return readdirSync(corpusRoot, { encoding: 'utf8', recursive: true })
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(corpusRoot, name))
    .sort()
}

test('every round-trip directory emits', () => {
  assert.deepEqual(directoryNames(roundTripRoot), [...emittingDirectories].sort())
})

for (const directory of emittingDirectories) {
  const names = [...new Set([...fixtureNames(directory, '.json'), ...fixtureNames(directory, '.md')])].sort()

  test(`${directory} pairs every .json with a .md`, () => {
    assert.ok(names.length > 0, `${directory} is expected to emit but holds no fixture pairs`)
    assert.deepEqual(fixtureNames(directory, '.json'), fixtureNames(directory, '.md'))
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

// spec/flavour.md, Directives: the container fence rule, checked against the emitted bytes.
function fenceNestingFault(markdown: string): string | undefined {
  const open: number[] = []
  let codeFence: string | undefined
  for (const line of markdown.split('\n')) {
    const content = line.replace(/^[ \t]*(?:(?:> ?|[-*+] |\d{1,9}[.)] )[ \t]*)*/, '')
    const backticks = /^(`{3,}|~{3,})/.exec(content)?.[1]
    if (codeFence !== undefined) {
      if (backticks !== undefined && backticks[0] === codeFence[0] && backticks.length >= codeFence.length) codeFence = undefined
      continue
    }
    if (backticks !== undefined) {
      codeFence = backticks
      continue
    }
    const colons = /^(:{2,})(.*)$/.exec(content)
    if (colons === null) continue
    const run = colons[1]?.length ?? 0
    const enclosing = open[open.length - 1]
    if (colons[2] === '') {
      open.pop()
      continue
    }
    if (enclosing !== undefined && run >= enclosing) return `${JSON.stringify(line)} sits in a container fenced with ${enclosing} colons`
    if (run > 2) open.push(run)
  }
  return undefined
}

test('the fence nesting check catches a fence a container cannot hold', () => {
  assert.equal(fenceNestingFault(':::panel info\n- :::panel warning\n  B\n  :::\n:::'), '"- :::panel warning" sits in a container fenced with 3 colons')
  assert.equal(fenceNestingFault(':::panel info\n- - :::panel warning\n    B\n    :::\n:::'), '"- - :::panel warning" sits in a container fenced with 3 colons')
  assert.equal(fenceNestingFault(':::panel info\n10. :::panel warning\n    B\n    :::\n:::'), '"10. :::panel warning" sits in a container fenced with 3 colons')
  assert.equal(fenceNestingFault('::::panel info\n- - :::panel warning\n    B\n    :::\n::::'), undefined)
  assert.equal(fenceNestingFault(':::tableCell\n```text\n:::::::panel warning\n:::\n```\n:::'), undefined)
})

for (const directory of emittingDirectories) {
  for (const name of fixtureNames(directory, '.md')) {
    test(`${directory}/${name} fences every container longer than its body`, () => {
      assert.equal(fenceNestingFault(readFileSync(join(roundTripRoot, directory, `${name}.md`), 'utf8')), undefined)
    })
  }
}

test('unspellable pairs every .json with an .error', () => {
  assert.deepEqual(names(unspellableRoot, '.json'), names(unspellableRoot, '.error'))
})

test('unspellable holds fixtures', () => {
  assert.ok(names(unspellableRoot, '.json').length > 0)
})

for (const name of names(unspellableRoot, '.json')) {
  test(`unspellable/${name} is refused with the error it names`, () => {
    const parsed: unknown = JSON.parse(readFileSync(join(unspellableRoot, `${name}.json`), 'utf8'))
    assert.ok(isAdfDocument(parsed), `${name}.json is not an ADF document`)
    const result = adfToMarkdown(parsed)
    assert.ok(!result.ok, result.ok ? `emitted ${JSON.stringify(result.value)}` : '')
    assert.equal(result.error.code, readFileSync(join(unspellableRoot, `${name}.error`), 'utf8').trimEnd())
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

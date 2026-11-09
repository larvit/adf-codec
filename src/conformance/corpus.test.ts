import assert from 'node:assert/strict'
import { basename, dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

import type { AdfDocument } from '../adf/document.ts'
import { adfToHtml } from '../html/emit/adf-to-html.ts'
import { adfToLosslessMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { blockNodes } from '../adf/block-nodes.ts'
import { htmlToAdf } from '../html/parse/html-to-adf.ts'
import { inlineNodes } from '../adf/inline-nodes.ts'
import { isRecord, readAdfDocument } from '../adf/document.ts'
import { isJsonValue } from '../json-value.ts'
import { losslessMarkdownToAdf } from '../markdown/parse/markdown-to-adf.ts'
import { markVocabularies } from '../adf/mark-attributes.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

const corpusRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'corpus')
const errorsRoot = join(corpusRoot, 'errors')
const normalizationRoot = join(corpusRoot, 'normalization')
const realPayloadsRoot = join(corpusRoot, 'real-payloads')
const realWorldRoot = join(corpusRoot, 'real-world')
const roundTripRoot = join(corpusRoot, 'round-trip')

const roundTripDirectories = ['block-nodes', 'combinations', 'commonmark-subset', 'inline-nodes', 'opaque-carry']
const typesNoFetchedDocumentHolds = ['bodiedSyncBlock', 'decisionItem', 'decisionList', 'extensionFrame', 'fragment', 'multiBodiedExtension', 'syncBlock']

function documentIn(json: unknown, name: string): AdfDocument {
  const read = readAdfDocument(json)
  assert.ok(read.ok, `${name}.json is not an ADF document`)
  return read.value
}

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
  assert.deepEqual(directoryNames(corpusRoot), ['commonmark-spec', 'errors', 'normalization', 'real-payloads', 'real-world', 'round-trip'])
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
      const parsed = documentIn(JSON.parse(readFileSync(join(roundTripRoot, directory, `${name}.json`), 'utf8')), name)
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
      const expected = documentIn(JSON.parse(readFileSync(join(roundTripRoot, directory, `${name}.json`), 'utf8')), name)
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
    const expected = documentIn(JSON.parse(readFileSync(join(normalizationRoot, `${name}.json`), 'utf8')), name)
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

for (const root of [realPayloadsRoot, realWorldRoot]) {
  const kind = basename(root)

  test(`${kind} holds payloads`, () => {
    assert.ok(names(root, '.json').length > 0)
  })

  for (const name of names(root, '.json')) {
    test(`${kind}/${name} emits markdown that reads back to it`, () => {
      const payload = documentIn(JSON.parse(readFileSync(join(root, `${name}.json`), 'utf8')), name)
      const emitted = adfToLosslessMarkdown(payload)
      assert.ok(emitted.ok, emitted.ok ? '' : `${emitted.error.code}: ${emitted.error.message}`)
      const parsed = losslessMarkdownToAdf(emitted.value)
      assert.ok(parsed.ok, parsed.ok ? '' : `${parsed.error.code}: ${parsed.error.message}`)
      assert.deepEqual(parsed.value, payload)
    })

    test(`${kind}/${name} writes HTML that reads back to it`, () => {
      const payload = documentIn(JSON.parse(readFileSync(join(root, `${name}.json`), 'utf8')), name)
      const written = adfToHtml(payload)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      assert.deepEqual(htmlToAdf(written.value), { ok: true, value: payload })
    })
  }
}

// The opening tag of each block type, for a block whose only attributes are `localId`, `level` and `order`, as Atlassian's editor writes it.
const blockElements: Readonly<Record<string, string>> = { blockquote: '<blockquote', bulletList: '<ul', heading: '<h', orderedList: '<ol', paragraph: '<p', rule: '<hr' }

for (const root of [realPayloadsRoot, realWorldRoot]) {
  for (const name of names(root, '.json')) {
    test(`${basename(root)}/${name} writes each block holding only its id as its element`, () => {
      const payload = documentIn(JSON.parse(readFileSync(join(root, `${name}.json`), 'utf8')), name)
      assert.ok(adfToHtml(payload).ok)
      for (const block of payload.content ?? []) {
        const opening = Object.hasOwn(blockElements, block.type) ? blockElements[block.type] : undefined
        if (opening === undefined || block.marks !== undefined || Object.keys(block.attrs ?? {}).some((key) => !['level', 'localId', 'order'].includes(key))) continue
        // A heading without `level` has no element to write: it rides the carry.
        if (block.type === 'heading' && block.attrs?.['level'] === undefined) continue
        const written = adfToHtml({ content: [block], type: 'doc', version: 1 })
        assert.ok(written.ok && written.value.startsWith(opening), `${block.type} wrote ${written.ok ? written.value.slice(0, 80) : written.error.code}`)
      }
    })
  }
}

function typesHeld(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) typesHeld(item, found)
  } else if (isRecord(value)) {
    if (typeof value['type'] === 'string') found.add(value['type'])
    typesHeld(value['content'], found)
    typesHeld(value['marks'], found)
  }
}

test('real-world holds every type the flavour spells except the ones no fetched document holds', () => {
  const found = new Set<string>()
  for (const name of names(realWorldRoot, '.json')) typesHeld(JSON.parse(readFileSync(join(realWorldRoot, `${name}.json`), 'utf8')), found)
  const spelled = [...Object.keys(blockNodes), ...Object.keys(inlineNodes), ...markVocabularies.keys()]
  assert.deepEqual(spelled.filter((type) => !found.has(type)).sort(), [...typesNoFetchedDocumentHolds].sort())
})

const realWorldSources: unknown = JSON.parse(readFileSync(join(corpusRoot, 'real-world-sources.json'), 'utf8'))
const realWorldSites: unknown = JSON.parse(readFileSync(join(corpusRoot, '..', 'corpus-gathering', 'sites.json'), 'utf8'))

test('real-world-sources.json has an entry for each real-world document', () => {
  assert.ok(isRecord(realWorldSources))
  assert.deepEqual(Object.keys(realWorldSources).sort(), names(realWorldRoot, '.json'))
})

for (const [name, source] of Object.entries(isRecord(realWorldSources) ? realWorldSources : {})) {
  test(`real-world-sources.json records ${name}'s page, licence and retrieval`, () => {
    assert.ok(isRecord(source))
    const [, site = '', product = ''] = /^(.+)-(jira|wiki)-/.exec(name) ?? []
    const entry: unknown = Array.isArray(realWorldSites) ? realWorldSites.find((held: unknown) => isRecord(held) && held['site'] === site) : undefined
    assert.ok(isRecord(entry) && isRecord(entry['products']))
    const { licence, licenceSource, retrieved, url } = source
    assert.deepEqual({ licence, licenceSource }, entry['products'][product])
    assert.deepEqual(Object.keys(source).sort(), ['licence', 'licenceSource', 'retrieved', 'url'])
    assert.equal(new Date(String(retrieved)).toISOString(), retrieved)
    // A page's title or an attachment's name in the link would put original text in the repo.
    assert.match(String(url), new RegExp(`^https://${site}\\.atlassian\\.net/(browse/[A-Z0-9-]+|wiki/spaces/[^/?]+/(overview|pages/\\d+|blog/\\d+/\\d+/\\d+/\\d+))(\\?focusedCommentId=\\d+)?$`))
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

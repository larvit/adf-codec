import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { readFileSync, readdirSync } from 'node:fs'

import { adfToHtml } from '../dist/index.js'

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' }
const driver = 'http://127.0.0.1:4444'
const repoRoot = join(import.meta.dirname, '..')
const corpusRoot = join(repoRoot, 'corpus')
const corpusEntries = readdirSync(corpusRoot, { encoding: 'utf8', recursive: true })

function checking(name, result, assertions) {
  assert.equal(result?.name, name, `the browser answered ${JSON.stringify(result?.name)} where ${name} was sent`)
  try {
    assertions()
  } catch (cause) {
    throw new Error(`${name} in the browser — ${cause.message}`, { cause })
  }
}

async function command(method, path, body) {
  const response = await fetch(`${driver}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method,
    signal: AbortSignal.timeout(180_000),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(`webdriver ${method} ${path}: ${JSON.stringify(payload.value)}`)
  return payload.value
}

function fileBody(file) {
  try {
    return readFileSync(file)
  } catch {
    return undefined
  }
}

function fixture(name, extension) {
  return readFileSync(join(corpusRoot, `${name}${extension}`), 'utf8')
}

function fixtureNames(kind, extension) {
  return corpusEntries
    .filter((name) => name.startsWith(`${kind}/`) && name.endsWith(extension))
    .map((name) => name.slice(0, -extension.length))
    .sort()
}

// convert-corpus.js tags -0 so it survives WebDriver's JSON.
function revived(text) {
  return JSON.parse(text, (_, value) => (value === '\u0000-0' ? -0 : value))
}

function refusal(result) {
  return result.ok ? '' : `${result.error.code}: ${result.error.message}`
}

async function whenDriverAnswers() {
  const deadline = Date.now() + 60_000
  for (;;) {
    const status = await command('GET', '/status').catch(() => undefined)
    if (status?.ready === true) return
    if (Date.now() > deadline) throw new Error(`no WebDriver answered ${driver}/status within 60s`)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

// Documents holding what a browser's innerHTML spells other than adfToHtml does (WHATWG HTML §13.3): a raw ", &nbsp;, and in an attribute value < and > escaped or not, by version.
const text = (value, ...marks) => (marks.length === 0 ? { text: value, type: 'text' } : { marks, text: value, type: 'text' })
const browserDocuments = [
  {
    json: JSON.stringify({
      content: [
        { content: [text('Say "hi"\u00a0now & <then>'), text(' link', { attrs: { href: 'https://example.com/?a<b>c&d="e"', title: 'A "title"\u00a0<here>' }, type: 'link' })], type: 'paragraph' },
        { attrs: { language: 'js' }, content: [text('if (a < b) say("x\u00a0y")\n  done()')], type: 'codeBlock' },
        { content: [{ attrs: { id: '0199f4c2-8b1e-7d03-9a6f-2c5e8d71b4a0', text: 'Say "hi"\u00a0now' }, type: 'mention' }], type: 'paragraph' },
        { attrs: { panelType: 'info' }, content: [{ content: [text('A "quote"\u00a0here', { type: 'underline' }, { attrs: { href: 'https://example.com/?a<b>', title: 'T"\u00a0' }, type: 'link' })], type: 'paragraph' }], type: 'panel' },
      ],
      type: 'doc',
      version: 1,
    }),
    name: 'quotes, no-break spaces and angle brackets',
  },
]
const corpus = {
  browserDocuments,
  errors: fixtureNames('errors', '.md').map((name) => ({ markdown: fixture(name, '.md'), name })),
  normalization: fixtureNames('normalization', '.md').map((name) => ({ markdown: fixture(name, '.md'), name })),
  realPayloads: fixtureNames('real-payloads', '.json').map((name) => ({ json: fixture(name, '.json'), name })),
  roundTrip: fixtureNames('round-trip', '.json').map((name) => ({ json: fixture(name, '.json'), markdown: fixture(name, '.md'), name })),
}
assert.deepEqual(
  readdirSync(corpusRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== 'commonmark-spec')
    .sort(),
  ['errors', 'normalization', 'real-payloads', 'round-trip'],
  'a corpus kind the browser leg does not convert',
)
for (const [kind, fixtures] of Object.entries(corpus)) assert.ok(fixtures.length > 0, `the browser leg found no ${kind} fixture to convert`)

const server = createServer((request, response) => {
  const file = join(repoRoot, new URL(request.url ?? '/', 'http://127.0.0.1').pathname)
  const body = file.startsWith(repoRoot) ? fileBody(file) : undefined
  if (body === undefined) response.writeHead(404).end()
  else response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream' }).end(body)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

await whenDriverAnswers()
const session = await command('POST', '/session', {
  capabilities: { alwaysMatch: { browserName: 'firefox', 'moz:firefoxOptions': { args: ['-headless'] }, timeouts: { pageLoad: 60_000, script: 120_000 } } },
})
await command('POST', `/session/${session.sessionId}/url`, { url: `http://127.0.0.1:${server.address().port}/browser-tests/page.html` })
const results = await command('POST', `/session/${session.sessionId}/execute/sync`, {
  args: [corpus],
  script: 'if (!window.convertCorpus) throw new Error(window.adfCodecFault ?? "the page defined no convertCorpus"); return window.convertCorpus(arguments[0])',
})
server.close()

for (const [index, { json, markdown, name }] of corpus.roundTrip.entries()) {
  const result = results.roundTrip[index]
  checking(name, result, () => {
    assert.ok(result.isDocument, `${name}.json is no ADF document`)
    assert.ok(result.emitted.ok, `it did not emit — ${refusal(result.emitted)}`)
    assert.equal(result.emitted.value, markdown)
    assert.ok(result.parsed.ok, `it did not parse — ${refusal(result.parsed)}`)
    assert.deepEqual(revived(result.parsed.value), JSON.parse(json))
  })
}

for (const [index, { name }] of corpus.normalization.entries()) {
  const result = results.normalization[index]
  checking(name, result, () => {
    assert.ok(result.parsed.ok, `it did not parse — ${refusal(result.parsed)}`)
    assert.deepEqual(revived(result.parsed.value), JSON.parse(fixture(name, '.json')))
  })
}

for (const [index, { json, name }] of corpus.realPayloads.entries()) {
  const result = results.realPayloads[index]
  checking(name, result, () => {
    assert.ok(result.isDocument, `${name}.json is no ADF document`)
    assert.ok(result.emitted.ok, `it did not emit — ${refusal(result.emitted)}`)
    assert.ok(result.parsed.ok, `it did not parse back — ${refusal(result.parsed)}`)
    assert.deepEqual(revived(result.parsed.value), JSON.parse(json))
    assert.deepEqual(result.html, adfToHtml(JSON.parse(json)), 'it wrote other HTML than Node wrote')
    assert.ok(result.htmlParsed.ok, `its HTML did not read back — ${refusal(result.htmlParsed)}`)
    assert.deepEqual(revived(result.htmlParsed.value), JSON.parse(json))
    assert.ok(result.innerHtml.parsed.ok, `its innerHTML did not read back — ${refusal(result.innerHtml.parsed)}`)
    assert.deepEqual(revived(result.innerHtml.parsed.value), JSON.parse(json))
  })
}

for (const [index, { json, name }] of corpus.browserDocuments.entries()) {
  const result = results.browserDocuments[index]
  checking(name, result, () => {
    assert.ok(result.parsed.ok, `its innerHTML did not read back — ${refusal(result.parsed)}`)
    assert.deepEqual(revived(result.parsed.value), JSON.parse(json))
  })
}

for (const [index, { name }] of corpus.errors.entries()) {
  const result = results.errors[index]
  checking(name, result, () => {
    assert.ok(!result.parsed.ok, `it was not refused, it built ${JSON.stringify(result.parsed.value)}`)
    assert.equal(result.parsed.error.code, fixture(name, '.error').trimEnd())
  })
}

console.log(
  `Firefox ${session.capabilities.browserVersion} converted ${corpus.roundTrip.length} round-trip, ${corpus.normalization.length} normalization and ${corpus.errors.length} error fixtures, ${corpus.realPayloads.length} real payloads, and read the real payloads and ${corpus.browserDocuments.length} hand-built document(s) back through innerHTML`,
)

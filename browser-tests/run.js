import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript' }
const driver = 'http://127.0.0.1:4444'
const repoRoot = join(import.meta.dirname, '..')
const corpusRoot = join(repoRoot, 'corpus')
const corpusEntries = readdirSync(corpusRoot, { encoding: 'utf8', recursive: true })

function checking(name, assertions) {
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

function refusal(result) {
  return result.ok ? '' : `${result.error.code}: ${result.error.message}`
}

async function whenDriverAnswers() {
  const deadline = Date.now() + 60_000
  for (;;) {
    const status = await command('GET', '/status').catch(() => undefined)
    if (status?.ready === true) return
    if (Date.now() > deadline) throw new Error(`no geckodriver answered ${driver}/status within 60s`)
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

const corpus = {
  errors: fixtureNames('errors', '.md').map((name) => ({ markdown: fixture(name, '.md'), name })),
  normalization: fixtureNames('normalization', '.md').map((name) => ({ markdown: fixture(name, '.md'), name })),
  roundTrip: fixtureNames('round-trip', '.json').map((name) => ({ json: fixture(name, '.json'), markdown: fixture(name, '.md'), name })),
}
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

for (const [index, result] of results.roundTrip.entries()) {
  const { json, markdown, name } = corpus.roundTrip[index]
  checking(name, () => {
    assert.ok(result.isDocument, `${name}.json is no ADF document`)
    assert.ok(result.emitted.ok, `it did not emit — ${refusal(result.emitted)}`)
    assert.equal(result.emitted.value, markdown)
    assert.ok(result.parsed.ok, `it did not parse — ${refusal(result.parsed)}`)
    assert.deepEqual(result.parsed.value, JSON.parse(json))
  })
}

for (const [index, result] of results.normalization.entries()) {
  const { name } = corpus.normalization[index]
  checking(name, () => {
    assert.ok(result.ok, `it did not parse — ${refusal(result)}`)
    assert.deepEqual(result.value, JSON.parse(fixture(name, '.json')))
  })
}

for (const [index, result] of results.errors.entries()) {
  const { name } = corpus.errors[index]
  checking(name, () => {
    assert.ok(!result.ok, `it was not refused, it built ${JSON.stringify(result.value)}`)
    assert.equal(result.error.code, fixture(name, '.error').trimEnd())
  })
}

console.log(
  `Firefox ${session.capabilities.browserVersion} converted ${corpus.roundTrip.length} round-trip, ${corpus.normalization.length} normalization and ${corpus.errors.length} error fixtures`,
)

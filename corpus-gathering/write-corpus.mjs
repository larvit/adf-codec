// Usage: node write-corpus.mjs <sites.json> <raw folder> <documents folder> <sources file>. The raw folder holds fetch.mjs's documents and run.sh's draws.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { anonymize, leakedTokens, shapeDifferences } from './anonymize.mjs'
import { features, selectDocuments } from './select.mjs'

const documentLimit = 150
const largestDocument = 64 * 1024
const [sitesPath, rawFolder, corpusFolder, sourcesPath] = process.argv.slice(2)

function lines(name) {
  return readFileSync(join(rawFolder, 'draws', `${name}.txt`), 'utf8').split('\n').filter((line) => line !== '')
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
}

function canonical(value) {
  return `${JSON.stringify(sorted(value), null, 2)}\n`
}

const licences = new Map(JSON.parse(readFileSync(sitesPath, 'utf8')).flatMap(({ products, site }) => Object.entries(products).map(([product, licence]) => [`${site}-${product}`, licence])))
const draws = { digits: lines('digits'), hex: lines('hex'), letters: lines('letters'), persons: lines('persons'), uuids: lines('uuids'), words: lines('words') }
const documentsFolder = join(rawFolder, 'documents')
const candidates = readdirSync(documentsFolder).flatMap((file) => {
  const path = join(documentsFolder, file)
  const text = readFileSync(path, 'utf8')
  if (text.length > largestDocument) return []
  const { document, source } = JSON.parse(text)
  const name = file.slice(0, -'.json'.length)
  const written = anonymize(document, draws)
  const differences = shapeDifferences(document, written)
  const leaks = leakedTokens(document, written)
  if (differences.length > 0 || leaks.length > 0) {
    console.error(`${name} left out: ${differences.length} shape differences, ${leaks.length} tokens still held`)
    return []
  }
  return [{ features: features(document), name, retrieved: statSync(path).mtime.toISOString().slice(0, 10), size: text.length, source, written }]
})

rmSync(corpusFolder, { force: true, recursive: true })
mkdirSync(corpusFolder, { recursive: true })
const sources = {}
for (const { name, retrieved, source, written } of selectDocuments(candidates, documentLimit)) {
  writeFileSync(join(corpusFolder, `${name}.json`), canonical(written))
  const [, site, product] = /^(.+)-(jira|wiki)-/.exec(name)
  sources[name] = { ...licences.get(`${site}-${product}`), retrieved, url: source }
}
writeFileSync(sourcesPath, canonical(sources))
console.error(`${Object.keys(sources).length} documents of ${candidates.length} candidates`)

import { join } from 'node:path'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { anonymizeChecked } from './anonymize.mjs'
import { features, selectDocuments } from './select.mjs'

// Selection prefers small documents, which keeps the corpus near 660 KB.
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
const draws = { digits: lines('digits'), hex: lines('hex'), letters: lines('letters'), uuids: lines('uuids'), words: lines('words') }
const documentsFolder = join(rawFolder, 'documents')
const candidates = readdirSync(documentsFolder).flatMap((file) => {
  const text = readFileSync(join(documentsFolder, file), 'utf8')
  if (text.length > largestDocument) return []
  const { document, retrieved, source } = JSON.parse(text)
  const name = file.slice(0, -'.json'.length)
  const checked = anonymizeChecked(document, draws)
  if (!checked.ok) {
    console.error(`${name} left out: ${checked.differences.length} shape differences, ${checked.leaks.length} tokens still held`)
    return []
  }
  return [{ features: features(document), name, retrieved, size: text.length, source, written: checked.written }]
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

import { readFileSync, writeFileSync } from 'node:fs'
import * as library from '@larvit/adf-codec'

import { renderFeatureTable } from './render.mjs'

const pagePath = new URL('../docs/feature-table.md', import.meta.url)
const readJson = (url) => JSON.parse(readFileSync(url, 'utf8'))

const examples = readJson(new URL('examples.json', import.meta.url)).map(({ id, name }) => ({ doc: readJson(new URL(`../corpus/round-trip/${id}.json`, import.meta.url)), name }))
const page = renderFeatureTable(examples, library)

if (!process.argv.includes('--check')) writeFileSync(pagePath, page)
else if (readFileSync(pagePath, 'utf8') !== page) {
  console.error('docs/feature-table.md differs from what the examples and the build give: run ./feature-table/write.sh')
  process.exitCode = 1
}

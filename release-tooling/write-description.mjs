import { readFileSync, writeFileSync } from 'node:fs'

import { readmeTagline } from './tagline.mjs'

const packagePath = new URL('../package.json', import.meta.url)
const tagline = readmeTagline(readFileSync(new URL('../README.md', import.meta.url), 'utf8'))
if (!tagline.ok) {
  console.error(tagline.error)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
writeFileSync(packagePath, `${JSON.stringify({ ...manifest, description: tagline.value }, null, 2)}\n`)

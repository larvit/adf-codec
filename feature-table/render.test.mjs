import assert from 'node:assert/strict'
import { test } from 'node:test'

import { renderFeatureTable } from './render.mjs'

const doc = { content: [], type: 'doc', version: 1 }
const held = { ok: true, value: doc }
const refused = { error: { code: 'unsupported-node-shape' }, ok: false }

function library(overrides) {
  const writes = (value) => () => ({ ok: true, value })
  return { adfToHtml: writes('<p>a</p>\n'), adfToLosslessMarkdown: writes('a\n'), adfToPortableMarkdown: writes('a\n'), htmlToAdf: () => held, losslessMarkdownToAdf: () => held, portableMarkdownToAdf: () => held, ...overrides }
}

test('leads with a row per example linking its section, then the section labels each output', () => {
  const page = renderFeatureTable([{ doc, name: 'Some example' }], library())
  assert.ok(page.includes('| [Some example](#some-example) | holds | holds | holds |\n'))
  assert.ok(page.includes(`## Some example\n\nADF:\n\n\`\`\`json\n${JSON.stringify(doc)}\n\`\`\`\n\n\`adfToLosslessMarkdown\`, round-trip holds:\n\n\`\`\`markdown\na\n\`\`\`\n`))
  assert.ok(page.includes('`adfToHtml`, round-trip holds:\n\n```html\n<p>a</p>\n```\n'))
})

test('says the round-trip loses where the output reads back to another document', () => {
  const page = renderFeatureTable([{ doc, name: 'Some example' }], library({ portableMarkdownToAdf: () => ({ ok: true, value: { ...doc, content: [{ type: 'rule' }] } }) }))
  assert.ok(page.includes('| holds | loses | holds |'))
  assert.ok(page.includes('`adfToPortableMarkdown`, round-trip loses:'))
})

test('compares documents whatever their key order', () => {
  const page = renderFeatureTable([{ doc, name: 'Some example' }], library({ htmlToAdf: () => ({ ok: true, value: { version: 1, type: 'doc', content: [] } }) }))
  assert.ok(page.includes('| holds | holds | holds |'))
})

test('names the code where a writer or a reader refuses', () => {
  const page = renderFeatureTable([{ doc, name: 'Some example' }], library({ adfToHtml: () => refused, losslessMarkdownToAdf: () => refused }))
  assert.ok(page.includes('| refused | holds | refused |'))
  assert.ok(page.includes('`adfToLosslessMarkdown`, round-trip refused with `unsupported-node-shape`:\n\n```markdown\na\n```\n'))
  assert.ok(page.includes('`adfToHtml` refuses with `unsupported-node-shape`.\n'))
})

test('fences an output in more backticks than it holds', () => {
  const page = renderFeatureTable([{ doc, name: 'Some example' }], library({ adfToLosslessMarkdown: () => ({ ok: true, value: '````js\nx\n````\n' }) }))
  assert.ok(page.includes('`````markdown\n````js\nx\n````\n`````\n'))
})

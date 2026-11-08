import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { readmeTagline } from './tagline.mjs'

const title = '# @larvit/pkg — a title\n\n[![npm](https://img.example/npm.svg)](https://example.com)\n[![CI](https://img.example/ci.svg)](https://example.com)\n\n'

test('is the first paragraph after the title and the badges', () => {
  assert.deepEqual(readmeTagline(`${title}Convert A to B.\n\nFor people who need it.\n\n## Install\n`), { ok: true, value: 'Convert A to B.' })
})

test('joins a paragraph wrapped over lines with single spaces', () => {
  assert.deepEqual(readmeTagline(`${title}Convert A to B,\nand back.\n\nMore.\n`), { ok: true, value: 'Convert A to B, and back.' })
})

test('refuses a README with no paragraph before its first section', () => {
  assert.equal(readmeTagline(`${title}## Install\n`).ok, false)
})

test('refuses markup, which npm would show as raw characters', () => {
  for (const markup of ['`code`', '[link](https://example.com)', '**bold**', '_em_', '<b>x</b>']) {
    assert.equal(readmeTagline(`${title}Convert ${markup}.\n`).ok, false, markup)
  }
})

test('reads the real README', () => {
  const tagline = readmeTagline(readFileSync(new URL('../README.md', import.meta.url), 'utf8'))
  assert.ok(tagline.ok, tagline.error)
  assert.ok(tagline.value.includes('Jira'))
})

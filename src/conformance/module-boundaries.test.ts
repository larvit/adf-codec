import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'

const markdown = join(dirname(fileURLToPath(import.meta.url)), '..', 'markdown')
const importSpecifier = /\bfrom '([^']+)'/g

function importsOf(directory: string): { file: string; specifier: string }[] {
  const imports: { file: string; specifier: string }[] = []
  for (const file of readdirSync(join(markdown, directory)).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))) {
    for (const match of readFileSync(join(markdown, directory, file), 'utf8').matchAll(importSpecifier)) {
      imports.push({ file: `${directory}/${file}`, specifier: match[1] ?? '' })
    }
  }
  return imports
}

// docs/decisions.md §The source parts by ADF and format
test('parse/ asks emit/ only through the module that names its questions', () => {
  const reached = importsOf('parse').filter(({ specifier }) => specifier.startsWith('../emit/'))
  assert.ok(reached.length > 0)
  assert.deepEqual(
    reached.filter(({ specifier }) => specifier !== '../emit/spelling-questions.ts'),
    [],
  )
})

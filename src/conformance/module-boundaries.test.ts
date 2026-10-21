import assert from 'node:assert/strict'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import test from 'node:test'

const markdown = join(dirname(fileURLToPath(import.meta.url)), '..', 'markdown')
const importSpecifier = /\bfrom '([^']+)'/g

function importsOf(directory: string): { file: string; target: string }[] {
  const imports: { file: string; target: string }[] = []
  for (const name of readdirSync(join(markdown, directory))) {
    const path = join(directory, name)
    if (statSync(join(markdown, path)).isDirectory()) {
      imports.push(...importsOf(path))
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      for (const match of readFileSync(join(markdown, path), 'utf8').matchAll(importSpecifier)) {
        imports.push({ file: path, target: relative(markdown, join(markdown, directory, match[1] ?? '')) })
      }
    }
  }
  return imports
}

// docs/decisions.md §The source parts by ADF and format
test('parse/ asks emit/ only through the module that names its questions', () => {
  const reached = importsOf('parse').filter(({ target }) => target.startsWith('emit/'))
  assert.ok(reached.length > 0)
  assert.deepEqual(
    reached.filter(({ target }) => target !== 'emit/spelling-questions.ts'),
    [],
  )
})

test('directive/ imports nothing from emit/ or parse/', () => {
  const imports = importsOf('directive')
  assert.ok(imports.length > 0)
  assert.deepEqual(
    imports.filter(({ target }) => target.startsWith('emit/') || target.startsWith('parse/')),
    [],
  )
})

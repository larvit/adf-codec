import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { readEntityReference } from './entity-references.ts'

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'entity-references.ts'), 'utf8')

// A value holding a space or a tilde mis-splits into a wrong name and a lost one, silently, at load.
test('every packed reference parts into one name and one value the table decodes', () => {
  const packed = /const packedReferences =\n {2}'([\s\S]*?)'\n/.exec(source)?.[1]
  assert.ok(packed !== undefined)
  const references = packed.split(/(?:\\\n)? +/)
  assert.equal(references.length, 2125)
  for (const reference of references) {
    assert.match(reference, /^[A-Za-z][A-Za-z0-9]*~[^ ~]+$/)
    assert.ok((readEntityReference(`&${reference.slice(0, reference.indexOf('~'))};`, 0)?.text ?? '') !== '')
  }
})

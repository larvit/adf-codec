import assert from 'node:assert/strict'
import test from 'node:test'

import { namedReferences, readEntityReference } from './entity-references.ts'

// A value holding a space or a tilde mis-splits into a wrong name and a lost one, silently, at load.
test('every named reference parts into one name and one value', () => {
  assert.equal(namedReferences.size, 2125)
  for (const [name, value] of namedReferences) {
    assert.match(name, /^[A-Za-z][A-Za-z0-9]*$/, name)
    assert.match(value, /^[^ ~]+$/u, name)
  }
})

test('decodes a reference to the characters HTML5 gives its name', () => {
  assert.deepEqual(readEntityReference('&ApplyFunction;', 0), { length: 15, text: '⁡' })
  assert.deepEqual(readEntityReference('&CounterClockwiseContourIntegral;', 0), { length: 33, text: '\u2233' })
  assert.deepEqual(readEntityReference('&NewLine;', 0), { length: 9, text: '\n' })
  assert.deepEqual(readEntityReference('&Tab;', 0), { length: 5, text: '\t' })
  assert.deepEqual(readEntityReference('&ThickSpace;', 0), { length: 12, text: '  ' })
  assert.deepEqual(readEntityReference('&NotSubset;', 0), { length: 11, text: '⊂⃒' })
  assert.deepEqual(readEntityReference('&nbsp;', 0), { length: 6, text: ' ' })
  assert.deepEqual(readEntityReference('&zwnj;', 0), { length: 6, text: '‌' })
  assert.equal(readEntityReference('&notareference;', 0), undefined)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { foldCase } from './case-folding.ts'

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'spec', 'unicode', 'CaseFolding.txt'), 'utf8')

function characters(hexes: string): string {
  return hexes
    .split(' ')
    .map((hex) => String.fromCodePoint(parseInt(hex, 16)))
    .join('')
}

// `CaseFolding.txt`'s common and full mappings, as `0041; C; 0061;` and `00DF; F; 0073 0073;` give them.
const mappings = new Map(
  source
    .split('\n')
    .map((line) => /^([0-9A-F]+); [CF]; ([0-9A-F ]+);/.exec(line))
    .filter((match) => match !== null)
    .map((match): [string, string] => [characters(match[1] ?? ''), characters(match[2] ?? '')]),
)

test('the vendored file holds 1606 common and full mappings, `ẞ`, `ß` and `İ` among them', () => {
  assert.equal(mappings.size, 1606)
  assert.equal(mappings.get('ẞ'), 'ss')
  assert.equal(mappings.get('ß'), 'ss')
  assert.equal(mappings.get('İ'), 'i̇')
})

test('folds every code point to the mapping the standard gives it', () => {
  assert.deepEqual(
    [...mappings].filter(([from, to]) => foldCase(from) !== to).map(([from]) => from),
    [],
  )
})

test('leaves every other code point as it is', () => {
  assert.deepEqual(foldedOutsideTheMappings(), [])
})

function foldedOutsideTheMappings(): number[] {
  const changed: number[] = []
  for (let point = 0; point <= 0x10ffff; point++) {
    const character = String.fromCodePoint(point)
    if (!mappings.has(character) && foldCase(character) !== character) changed.push(point)
  }
  return changed
}

test('folds a string code point by code point, a surrogate pair as one', () => {
  assert.equal(foldCase('Ab\u{10400}Ç ẞ'), 'ab\u{10428}ç ss')
  assert.equal(foldCase(''), '')
  assert.equal(foldCase('\ud801'), '\ud801')
})

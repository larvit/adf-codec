import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AttributeKind, AttributeVocabulary } from './adf/attribute-vocabulary.ts'
import { blockNodes } from './adf/block-nodes.ts'
import { inlineNodes } from './adf/inline-nodes.ts'
import { markAttributes } from './adf/mark-attributes.ts'
import { textDirectiveName } from './markdown/text-directive.ts'

type Declared = { attributes: AttributeVocabulary }

const specPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'flavour.md')
const introducer = 'Attributes: '
const codeFence = /^`{3,}/
const directiveName = /`([a-z][A-Za-z0-9]*)`/g
const namedType = /^`([a-z][A-Za-z0-9]*)` \(([^)]*)\)/
const owned = ' — '

function bullets(heading: string): string[] {
  const items: string[] = []
  let fence: string | undefined
  let item: string | undefined
  let inside = false
  for (const line of readFileSync(specPath, 'utf8').split('\n')) {
    if (line.startsWith('## ')) inside = line === `## ${heading}`
    if (!inside) continue
    const marker = codeFence.exec(line)?.[0]
    if (fence !== undefined) {
      if (marker !== undefined && marker.length >= fence.length) fence = undefined
      continue
    }
    if (marker !== undefined) {
      fence = marker
      continue
    }
    if (line.startsWith('- ')) {
      if (item !== undefined) items.push(item)
      item = line.slice(2)
    } else if (item !== undefined && line.startsWith('  ')) item += ` ${line.trim()}`
    else if (item !== undefined) {
      items.push(item)
      item = undefined
    }
  }
  return items
}

function declarations(heading: string): Record<string, Declared> {
  const declared: Record<string, Declared> = {}
  for (const item of bullets(heading)) {
    const cut = item.indexOf(owned)
    assert.notEqual(cut, -1, `${heading}: the bullet ${item} names no node ahead of a ${owned.trim()}`)
    const attributes = attributeList(heading, item.slice(cut))
    for (const [, name] of item.slice(0, cut).matchAll(directiveName)) {
      assert.equal(declared[name ?? ''], undefined, `${heading}: ${name ?? ''} is declared twice`)
      declared[name ?? ''] = { attributes }
    }
  }
  return declared
}

function attributeList(heading: string, prose: string): AttributeVocabulary {
  const at = prose.indexOf(introducer)
  assert.notEqual(at, -1, `${heading}: ${prose} lists no attributes`)
  let rest = prose.slice(at + introducer.length)
  if (rest.startsWith('none')) return {}
  const attributes: Record<string, AttributeKind> = {}
  for (;;) {
    const pair = namedType.exec(rest)
    assert.notEqual(pair, null, `${heading}: ${rest} reads no \`name\` (type) pair`)
    attributes[pair?.[1] ?? ''] = attributeKind(heading, pair?.[2] ?? '')
    rest = rest.slice(pair?.[0].length ?? 0)
    if (!rest.startsWith(', ')) return attributes
    rest = rest.slice(2)
  }
}

function attributeKind(heading: string, parenthesized: string): AttributeKind {
  const first = parenthesized.split(/[\s,]/)[0] ?? ''
  if (first === 'boolean' || first === 'json' || first === 'number' || first === 'string') return first
  assert.ok(first.startsWith('`'), `${heading}: ${first} is neither an attribute kind nor a value set`)
  return 'string'
}

function vocabularies(table: Readonly<Record<string, Declared>>): Record<string, Declared> {
  return Object.fromEntries(Object.entries(table).map(([type, entry]) => [type, { attributes: entry.attributes }]))
}

test('the block node table holds the attributes spec/flavour.md gives each node', () => {
  assert.deepEqual(declarations('Block nodes'), vocabularies(blockNodes))
})

test('the inline node table holds the attributes spec/flavour.md gives each node', () => {
  assert.deepEqual(declarations('Inline nodes'), vocabularies(inlineNodes))
})

// A name in two tables would make the position a directive is read in ambiguous.
test('no name is spelled in more than one position', () => {
  const names = [...Object.keys(blockNodes), ...Object.keys(inlineNodes), ...Object.keys(markAttributes), textDirectiveName]
  assert.equal(new Set(names).size, names.length)
})

test('the mark table holds the attributes spec/flavour.md gives each mark', () => {
  assert.deepEqual(declarations('Marks'), vocabularies(Object.fromEntries(Object.entries(markAttributes).map(([type, attributes]) => [type, { attributes }]))))
})

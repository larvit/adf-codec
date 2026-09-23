import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AttributeKind, AttributeVocabulary } from './adf/attribute-vocabulary.ts'
import { blockArgument } from './markdown/block-directive.ts'
import { blockNodes } from './adf/block-nodes.ts'
import { inlineNodes } from './adf/inline-nodes.ts'
import { markAttributes } from './adf/mark-attributes.ts'

type Held = Map<string, Set<AttributeKind>>
type Properties = Map<string, SchemaObject[]>
type SchemaObject = Readonly<Record<string, unknown>>
type Spelled = [string, Map<string, AttributeKind>]

const carried = ['alignment', 'annotation', 'backgroundColor', 'blockCard', 'bodiedRule', 'breakout', 'dataConsumer', 'embedCard', 'fontSize', 'fragment', 'indentation', 'inlineExtension', 'placeholder']
const definitionReference = '#/definitions/'
const gaps: string[] = []
const grammarOwn = ['doc', 'text']
const readKeywords = ['$ref', 'additionalProperties', 'allOf', 'anyOf', 'enum', 'items', 'maxItems', 'maximum', 'minItems', 'minLength', 'minimum', 'pattern', 'properties', 'required', 'type']
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'adf-schema')
const schemaFiles = ['full.json', 'stage-0.json']

test('the ADF JSON Schemas are @atlaskit/adf-schema 57.4.9, vendored byte-exact', () => {
  const digest = (name: string) => createHash('sha256').update(readFileSync(join(root, name))).digest('hex')
  assert.equal(digest('full.json'), '75f080928a970250eb8289e9cae5374e3c2a6c0ac3ca22478acaa9d3f39484a3')
  assert.equal(digest('stage-0.json'), '56747e5a71c0d5f8c58f94180d69e4482f62c08020d66aaf327333681fcc1c8f')
})

test('the tables spell the attribute names and kinds the ADF JSON Schemas give each type they spell, the pinned gaps apart', () => {
  const held = schemaTypes()
  const spelledTypes = spelled()
  const found: string[] = []
  const gapsHeld = new Set<string>()
  for (const [type, spelledKinds] of spelledTypes) {
    const kinds = held.get(type)
    if (kinds === undefined) {
      found.push(`${type}: the tables spell the type, the schema holds no definition of it`)
      continue
    }
    for (const [attribute, schemaKinds] of kinds) {
      const kind = spelledKinds.get(attribute)
      const holds = [...schemaKinds].sort().join(' or ')
      if (kind === undefined && gaps.includes(`${type}.${attribute}`)) gapsHeld.add(`${type}.${attribute}`)
      else if (kind === undefined) found.push(`${type}.${attribute}: the schema holds ${holds}, the tables spell nothing and the gaps list does not name it`)
      else if (schemaKinds.size !== 1 || !schemaKinds.has(kind)) found.push(`${type}.${attribute}: the tables spell ${kind}, the schema holds ${holds}`)
    }
    for (const [attribute, kind] of spelledKinds) if (!kinds.has(attribute)) found.push(`${type}.${attribute}: the tables spell ${kind}, the schema holds nothing`)
  }
  for (const gap of gaps) {
    if (gapsHeld.has(gap)) continue
    const [type = '', attribute = ''] = gap.split('.')
    const spelledKinds = spelledTypes.find(([name]) => name === type)?.[1]
    const kind = spelledKinds?.get(attribute)
    if (spelledKinds === undefined) found.push(`${gap}: the gaps list names it, the tables spell no ${type} type`)
    else if (kind === undefined) found.push(`${gap}: the gaps list names it, the schema holds nothing`)
    else found.push(`${gap}: the gaps list names it, the tables spell ${kind}`)
  }
  assert.deepEqual(found, [])
})

test("the ADF JSON Schemas hold no type the tables leave unspelled, the pinned carried ones and the grammar's own apart", () => {
  const held = schemaTypes()
  const spelledNames = new Set(spelled().map(([type]) => type))
  const found: string[] = []
  for (const type of held.keys()) {
    if (!spelledNames.has(type) && !carried.includes(type) && !grammarOwn.includes(type)) found.push(`${type}: the schema holds the type, the tables spell none of it and the carried list does not name it`)
  }
  for (const type of carried) {
    if (!held.has(type)) found.push(`${type}: the carried list names the type, the schema holds no definition of it`)
    if (spelledNames.has(type)) found.push(`${type}: the carried list names the type, and the tables spell it`)
  }
  assert.deepEqual(found, [])
})

function spelled(): Spelled[] {
  return [
    ...Object.entries(blockNodes).map(([type, model]) => spelledType(type, model.attributes, blockArgument(type))),
    ...Object.entries(inlineNodes).map(([type, model]) => spelledType(type, model.attributes)),
    ...Object.entries(markAttributes).map(([type, attributes]) => spelledType(type, attributes)),
  ]
}

function spelledType(type: string, attributes: AttributeVocabulary, argument?: string): Spelled {
  const kinds = new Map(Object.entries(attributes))
  if (argument !== undefined) kinds.set(argument, 'string')
  return [type, kinds]
}

function schemaTypes(): Map<string, Held> {
  const held = new Map<string, Held>()
  for (const file of schemaFiles) {
    const definitions = schemaObject(schemaObject(JSON.parse(readFileSync(join(root, file), 'utf8')), file)['definitions'], `${file} definitions`)
    for (const [name, definition] of Object.entries(definitions)) {
      const where = `${file} ${name}`
      for (const properties of alternatives(schemaObject(definition, where), definitions, where)) {
        const attributes = (properties.get('attrs') ?? []).flatMap((attrs) => alternatives(attrs, definitions, `${where} attrs`)).flatMap((alternative) => [...alternative])
        for (const type of (properties.get('type') ?? []).flatMap((schema) => enumStrings(schema, `${where} type`))) {
          const kinds = held.get(type) ?? new Map<string, Set<AttributeKind>>()
          held.set(type, kinds)
          for (const [attribute, schemas] of attributes) {
            const attributeKinds = kinds.get(attribute) ?? new Set<AttributeKind>()
            kinds.set(attribute, attributeKinds)
            for (const schema of schemas) for (const kind of propertyKinds(schema, `${where} ${type}.${attribute}`)) attributeKinds.add(kind)
          }
        }
      }
    }
  }
  return held
}

function alternatives(schema: SchemaObject, definitions: SchemaObject, where: string): Properties[] {
  const own = Object.entries(schemaObject(readSchema(schema, where)['properties'] ?? {}, `${where} properties`))
  let found: Properties[] = [new Map(own.map(([name, property]): [string, SchemaObject[]] => [name, [readSchema(schemaObject(property, `${where} ${name}`), `${where} ${name}`)]]))]
  if (schema['$ref'] !== undefined) found = intersect(found, alternatives(referenced(schema['$ref'], definitions, where), definitions, `${where} ${String(schema['$ref'])}`))
  for (const branch of branches(schema['allOf'], `${where} allOf`)) found = intersect(found, alternatives(branch, definitions, `${where} allOf`))
  if (schema['anyOf'] !== undefined) found = intersect(found, branches(schema['anyOf'], `${where} anyOf`).flatMap((branch) => alternatives(branch, definitions, `${where} anyOf`)))
  return found
}

function readSchema(schema: SchemaObject, where: string): SchemaObject {
  const unread = Object.keys(schema).find((keyword) => !readKeywords.includes(keyword))
  if (unread !== undefined) return assert.fail(`${where}: the schema holds the keyword ${unread}, which the gate does not read`)
  const extra = schema['additionalProperties']
  return extra === undefined || typeof extra === 'boolean' ? schema : assert.fail(`${where}: additionalProperties holds a schema, which the gate does not read`)
}

function intersect(left: readonly Properties[], right: readonly Properties[]): Properties[] {
  return left.flatMap((own) =>
    right.map((other) => {
      const merged = new Map(own)
      for (const [name, schemas] of other) merged.set(name, [...(merged.get(name) ?? []), ...schemas])
      return merged
    }),
  )
}

function referenced(reference: unknown, definitions: SchemaObject, where: string): SchemaObject {
  const name = typeof reference === 'string' && reference.startsWith(definitionReference) ? reference.slice(definitionReference.length) : undefined
  return schemaObject(name === undefined ? undefined : definitions[name], `${where}: the reference ${String(reference)}`)
}

function branches(value: unknown, where: string): SchemaObject[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value.map((branch, index) => schemaObject(branch, `${where} ${index}`)) : assert.fail(`${where} is no array of schemas`)
}

function enumStrings(schema: SchemaObject, where: string): string[] {
  const values = schema['enum']
  return Array.isArray(values) ? values.filter((value: unknown): value is string => typeof value === 'string') : assert.fail(`${where}: the type property holds no enum naming the type`)
}

function propertyKinds(property: SchemaObject, where: string): AttributeKind[] {
  const type = property['type']
  if (type === 'boolean') return ['boolean']
  if (type === 'integer' || type === 'number') return ['number']
  if (type === 'string') return ['string']
  if (type === 'array' || type === 'object') return ['json']
  if (type !== undefined) return assert.fail(`${where}: the schema types it ${JSON.stringify(type)}, which reads as no attribute kind`)
  const combinator = ['$ref', 'allOf', 'anyOf'].find((keyword) => property[keyword] !== undefined)
  if (combinator !== undefined) return assert.fail(`${where}: the schema holds the keyword ${combinator}, which the gate reads as no attribute kind`)
  const values = property['enum']
  return Array.isArray(values) ? values.map(valueKind) : ['json']
}

function valueKind(value: unknown): AttributeKind {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'string') return 'string'
  return 'json'
}

function schemaObject(value: unknown, where: string): SchemaObject {
  return isSchemaObject(value) ? value : assert.fail(`${where} is no JSON Schema object`)
}

function isSchemaObject(value: unknown): value is SchemaObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

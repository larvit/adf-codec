import type { AdfAttributes, AdfNode } from '../adf/document.ts'
import type { AttributeKind, AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { ConvertFault, Read } from '../result.ts'
import type { JsonValue } from '../json-value.ts'
import { holdsOnlyAttributes, nodeAttrs } from '../adf/document.ts'
import { optionalAttribute } from './escaping.ts'
import { parseJsonText } from '../json-text.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'
import { vocabularyPair, vocabularyPairs } from '../adf/attribute-vocabulary.ts'

// The attributes a node holds besides those its element writes, as `data-*` attributes sorted by key, a value that is no string as JSON; `undefined` where the node holds what no attribute writes: a mark, text, an empty key, or an attribute the vocabulary does not hold as that kind (docs/decisions.md §The HTML dialect).
export function dataAttributes(node: AdfNode, vocabulary: AttributeVocabulary, written: readonly string[]): string | undefined {
  if (!holdsOnlyAttributes(node, Object.keys(vocabulary))) return undefined
  const pairs = vocabularyPairs(nodeAttrs(node), vocabulary, written)
  if (pairs === undefined) return undefined
  let attributes = ''
  for (const { key, kind, value } of pairs.sort((left, right) => (left.key < right.key ? -1 : 1))) {
    const attribute = optionalAttribute(dataName(key), kind === 'string' ? value : serializeCanonicalJson(value, 'compact'))
    if (attribute === undefined) return undefined
    attributes += attribute
  }
  return attributes
}

// What `dataAttributes` wrote, its pairs' values unescaped. A pair it does not write in that order is no HTML of the dialect; a name or value no attribute of the node spells is the node's shape, as a directive's is (docs/decisions.md §Which code a cause takes).
export function readDataAttributes(pairs: readonly (readonly [string, string])[], type: string, vocabulary: AttributeVocabulary, written: readonly string[]): Read<AdfAttributes> {
  const attrs: AdfAttributes = {}
  let previous = ''
  for (const [name, spelled] of pairs) {
    const [key, kind] = Object.entries(vocabulary).find(([candidate]) => !written.includes(candidate) && dataName(candidate) === name) ?? []
    if (key === undefined || kind === undefined) {
      return { fault: name.startsWith('data-') ? { code: 'unsupported-node-shape', message: `${name} names no attribute ${type} holds apart from its element` } : unmappable(`${name} is no attribute the ${type} element takes`) }
    }
    if (key <= previous) return { fault: unmappable(`the data-* attributes stand once each, sorted by the attribute they name: found ${name} after ${dataName(previous)}`) }
    const value = dataValue(spelled, kind)
    if (value === undefined) return { fault: { code: 'unsupported-node-shape', message: `${name} holds a value ${type}'s ${key} does not take, or does not spell it as compact JSON` } }
    attrs[key] = value
    previous = key
  }
  return { value: attrs }
}

function dataName(key: string): string {
  return `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

function dataValue(spelled: string, kind: AttributeKind): JsonValue | undefined {
  if (kind === 'string') return spelled
  const { value } = parseJsonText(spelled)
  return value !== undefined && serializeCanonicalJson(value, 'compact') === spelled && vocabularyPair('', value, kind) !== undefined ? value : undefined
}

function unmappable(message: string): ConvertFault {
  return { code: 'unmappable-html', message }
}

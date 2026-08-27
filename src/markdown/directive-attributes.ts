import type { JsonValue } from '../json-value.ts'
import type { VocabularyPair } from '../adf/attribute-vocabulary.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

const bareToken = /^[A-Za-z0-9_-]+$/

// spec/flavour.md, Attributes.
const quotedEscapes = /[&<`|]/g

export function isBareToken(text: string): boolean {
  return bareToken.test(text)
}

export function spellAttributes(pairs: readonly (readonly [string, string])[]): string {
  if (pairs.length === 0) return ''
  const spelled = [...pairs].sort(([left], [right]) => (left < right ? -1 : 1)).map(([key, value]) => `${key}=${value}`)
  return `{${spelled.join(' ')}}`
}

export function spellVocabulary(pairs: readonly VocabularyPair[]): [string, string][] {
  return pairs.map((pair): [string, string] => [pair.key, spellAttributeValue(pair)])
}

export function spellJsonAttribute(value: JsonValue): string {
  return quote(serializeCanonicalJson(value, 'compact'))
}

export function spellStringAttribute(text: string): string {
  return isBareToken(text) ? text : quote(text)
}

function spellAttributeValue(pair: VocabularyPair): string {
  if (pair.kind === 'boolean') return `${pair.value}`
  if (pair.kind === 'json') return spellJsonAttribute(pair.value)
  if (pair.kind === 'number') return spellStringAttribute(JSON.stringify(pair.value))
  return spellStringAttribute(pair.value)
}

function quote(text: string): string {
  return JSON.stringify(text).replace(quotedEscapes, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

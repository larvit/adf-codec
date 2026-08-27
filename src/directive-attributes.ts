import type { AdfAttributes, AttributeKind, AttributeVocabulary } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

const bareToken = /^[A-Za-z0-9_-]+$/

// spec/flavour.md, Attributes.
const quotedEscapes = /[&<`|]/g

export function isBareToken(text: string): boolean {
  return bareToken.test(text)
}

export function vocabularyPairs(attrs: AdfAttributes, vocabulary: AttributeVocabulary, spelledElsewhere: readonly string[]): [string, string][] | undefined {
  const pairs: [string, string][] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (spelledElsewhere.includes(key)) continue
    const kind = Object.hasOwn(vocabulary, key) ? vocabulary[key] : undefined
    if (kind === undefined) return undefined
    const spelled = spellAttributeValue(value, kind)
    if (spelled === undefined) return undefined
    pairs.push([key, spelled])
  }
  return pairs
}

export function spellAttributes(pairs: readonly (readonly [string, string])[]): string {
  if (pairs.length === 0) return ''
  const spelled = [...pairs].sort(([left], [right]) => (left < right ? -1 : 1)).map(([key, value]) => `${key}=${value}`)
  return `{${spelled.join(' ')}}`
}

export function spellAttributeValue(value: JsonValue, kind: AttributeKind): string | undefined {
  if (kind === 'json') return spellJsonAttribute(value)
  if (kind === 'boolean') return typeof value === 'boolean' ? `${value}` : undefined
  if (kind === 'number') return typeof value === 'number' ? spellStringAttribute(JSON.stringify(value)) : undefined
  return typeof value === 'string' ? spellStringAttribute(value) : undefined
}

export function spellJsonAttribute(value: JsonValue): string {
  return quote(serializeCanonicalJson(value, 'compact'))
}

export function spellStringAttribute(text: string): string {
  return isBareToken(text) ? text : quote(text)
}

function quote(text: string): string {
  return JSON.stringify(text).replace(quotedEscapes, (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

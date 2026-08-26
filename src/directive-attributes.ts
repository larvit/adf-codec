import type { AdfAttributes, AttributeKind } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { failure, type ConvertErrorPath, type Result } from './result.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

export type AttributeFault = { key: string; kind: AttributeKind | undefined }

export type AttributeVocabulary = Readonly<Record<string, AttributeKind>>

const bareToken = /^[A-Za-z0-9_-]+$/

export function isBareToken(text: string): boolean {
  return bareToken.test(text)
}

export function attributeFailure<T>(type: string, fault: AttributeFault, path: ConvertErrorPath): Result<T> {
  if (fault.kind === undefined) return failure('unspelled-node-attribute', `the ${type} attribute ${fault.key} has no canonical markdown spelling`, path)
  return failure('unsupported-node-shape', `the ${type} attribute ${fault.key} holds no ${fault.kind}`, path)
}

export function vocabularyPairs(attrs: AdfAttributes, vocabulary: AttributeVocabulary, slot: string | undefined): AttributeFault | [string, string][] {
  const pairs: [string, string][] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (key === slot) continue
    const kind = Object.hasOwn(vocabulary, key) ? vocabulary[key] : undefined
    if (kind === undefined) return { key, kind: undefined }
    const spelled = spellAttributeValue(value, kind)
    if (spelled === undefined) return { key, kind }
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
  return JSON.stringify(text)
}

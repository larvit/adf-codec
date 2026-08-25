import type { JsonValue } from './json-value.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

export type AttributeKind = 'boolean' | 'json' | 'number' | 'string'

const bareToken = /^[A-Za-z0-9_-]+$/

export function isBareToken(text: string): boolean {
  return bareToken.test(text)
}

export function spellAttributes(pairs: readonly (readonly [string, string])[]): string {
  if (pairs.length === 0) return ''
  const spelled = [...pairs].sort(([left], [right]) => (left < right ? -1 : 1)).map(([key, value]) => `${key}=${value}`)
  return `{${spelled.join(' ')}}`
}

export function spellAttributeValue(value: JsonValue, kind: AttributeKind): string | undefined {
  if (kind === 'json') return spellJsonAttribute(value)
  if (kind === 'boolean') return typeof value === 'boolean' ? `${value}` : undefined
  if (kind === 'number') return typeof value === 'number' ? spell(JSON.stringify(value)) : undefined
  return typeof value === 'string' ? spell(value) : undefined
}

export function spellJsonAttribute(value: JsonValue): string {
  return quote(serializeCanonicalJson(value, 'compact'))
}

function spell(text: string): string {
  return isBareToken(text) ? text : quote(text)
}

function quote(text: string): string {
  return JSON.stringify(text)
}

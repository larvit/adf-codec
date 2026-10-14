import type { AdfAttributes } from './document.ts'
import type { JsonValue } from '../json-value.ts'

export type AttributeKind = 'boolean' | 'json' | 'number' | 'numbers' | 'string'

export type AttributeVocabulary = Readonly<Record<string, AttributeKind>>

export type VocabularyValue =
  | { kind: 'boolean'; value: boolean }
  | { kind: 'json'; value: JsonValue }
  | { kind: 'number'; value: number }
  | { kind: 'numbers'; value: NumberList }
  | { kind: 'string'; value: string }

export type VocabularyPair = VocabularyValue & { key: string }

export type NumberList = [number, ...number[]]

export function isNumberList(value: unknown): value is NumberList {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'number')
}

export function vocabularyPairs(attrs: AdfAttributes, vocabulary: AttributeVocabulary, spelledElsewhere: readonly string[]): VocabularyPair[] | undefined {
  const pairs: VocabularyPair[] = []
  for (const [key, value] of Object.entries(attrs)) {
    if (spelledElsewhere.includes(key)) continue
    const kind = Object.hasOwn(vocabulary, key) ? vocabulary[key] : undefined
    if (kind === undefined) return undefined
    const pair = vocabularyPair(key, value, kind)
    if (pair === undefined) return undefined
    pairs.push(pair)
  }
  return pairs
}

function vocabularyPair(key: string, value: JsonValue, kind: AttributeKind): VocabularyPair | undefined {
  if (kind === 'boolean') return typeof value === 'boolean' ? { key, kind, value } : undefined
  if (kind === 'number') return typeof value === 'number' ? { key, kind, value } : undefined
  if (kind === 'numbers') return isNumberList(value) ? { key, kind, value } : undefined
  if (kind === 'string') return typeof value === 'string' ? { key, kind, value } : undefined
  return { key, kind, value }
}

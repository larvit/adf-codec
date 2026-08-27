import type { AdfAttributes } from './document.ts'
import type { JsonValue } from '../json-value.ts'

export type AttributeKind = 'boolean' | 'json' | 'number' | 'string'

export type AttributeVocabulary = Readonly<Record<string, AttributeKind>>

export type VocabularyPair =
  | { key: string; kind: 'boolean'; value: boolean }
  | { key: string; kind: 'json'; value: JsonValue }
  | { key: string; kind: 'number'; value: number }
  | { key: string; kind: 'string'; value: string }

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
  if (kind === 'string') return typeof value === 'string' ? { key, kind, value } : undefined
  return { key, kind, value }
}

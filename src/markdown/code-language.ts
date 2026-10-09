import type { Claims } from './portable/conventions.ts'
import type { JsonValue } from '../json-value.ts'
import { carryFenceType } from './opaque-carry.ts'
import { infoStringCarries } from './commonmark/grammar.ts'

export type LanguageSlot = { info: string; kind: 'fence' } | { kind: 'attribute' } | { kind: 'none' }

// spec/flavour.md, The CommonMark blocks: the one slot a codeBlock's language rides.
export function languageSlot(language: JsonValue | undefined, claims: Claims): LanguageSlot {
  if (language === undefined) return { kind: 'none' }
  if (typeof language !== 'string' || (claims.carryFence && carryFenceType(language) !== undefined) || !infoStringCarries(language)) return { kind: 'attribute' }
  return { info: language, kind: 'fence' }
}

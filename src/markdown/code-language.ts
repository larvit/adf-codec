import type { JsonValue } from '../json-value.ts'
import { carryName } from './opaque-carry.ts'
import { holdsControlCharacter } from './commonmark-grammar.ts'
import { holdsEntityReference } from './entity-references.ts'

export type LanguageSlot = { info: string; kind: 'fence' } | { kind: 'attribute' } | { kind: 'none' }

// spec/flavour.md, The CommonMark blocks: the one slot a codeBlock's language rides, both directions.
export function languageSlot(language: JsonValue | undefined): LanguageSlot {
  if (language === undefined) return { kind: 'none' }
  if (typeof language !== 'string' || language === '' || language === carryName) return { kind: 'attribute' }
  if (/[`\\]/.test(language) || holdsControlCharacter(language) || language !== language.trim() || holdsEntityReference(language)) return { kind: 'attribute' }
  return { info: language, kind: 'fence' }
}

import type { JsonValue } from '../json-value.ts'
import { carryName } from './opaque-carry.ts'
import { holdsControlCharacter } from './commonmark-grammar.ts'
import { holdsEntityReference } from './entity-references.ts'

// spec/flavour.md, The CommonMark blocks: the info string the language rides, `undefined` where the attribute carries it.
export function fenceInfo(language: JsonValue | undefined): string | undefined {
  if (language === undefined) return ''
  if (typeof language !== 'string' || language === '' || language === carryName) return undefined
  if (/[`\\]/.test(language) || holdsControlCharacter(language) || language !== language.trim() || holdsEntityReference(language)) return undefined
  return language
}

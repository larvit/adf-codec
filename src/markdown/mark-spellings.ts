import type { AdfMark } from '../adf/document.ts'
import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { MarkType } from '../adf/mark-attributes.ts'
import { isMarkType, markAttributes } from '../adf/mark-attributes.ts'
import { spellAttributes, spellVocabulary } from './directive-attributes.ts'
import { vocabularyPairs } from '../adf/attribute-vocabulary.ts'

type Spelling = { kind: 'code' | 'directive' | 'link'; spelling?: undefined } | { kind: 'emphasis'; spelling: string }

export type MarkSpelling = Spelling & { attributes: AttributeVocabulary }

const markSpellings: Readonly<Record<MarkType, Spelling>> = {
  border: { kind: 'directive' },
  code: { kind: 'code' },
  em: { kind: 'emphasis', spelling: '_' },
  link: { kind: 'link' },
  strike: { kind: 'emphasis', spelling: '~~' },
  strong: { kind: 'emphasis', spelling: '**' },
  subsup: { kind: 'directive' },
  textColor: { kind: 'directive' },
  underline: { kind: 'directive' },
}

export function markSpelling(type: string): MarkSpelling | undefined {
  if (!isMarkType(type)) return undefined
  const spelling = markSpellings[type]
  const attributes = markAttributes[type]
  if (spelling.kind === 'emphasis') return { attributes, kind: spelling.kind, spelling: spelling.spelling }
  return { attributes, kind: spelling.kind }
}

export function spellMarkAttributes(mark: AdfMark, vocabulary: AttributeVocabulary): string | undefined {
  const pairs = vocabularyPairs(mark.attrs ?? {}, vocabulary, [])
  return pairs === undefined ? undefined : spellAttributes(spellVocabulary(pairs))
}

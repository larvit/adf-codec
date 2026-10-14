import type { AttributeVocabulary } from './attribute-vocabulary.ts'

// Marks only a block's marks key holds, so no inline spelling names them.
export const blockMarkAttributes = {
  alignment: { align: 'string' },
  breakout: { mode: 'string', width: 'number' },
  fragment: { localId: 'string', name: 'string' },
  indentation: { level: 'number' },
} satisfies Readonly<Record<string, AttributeVocabulary>>

export const markAttributes = {
  border: { color: 'string', size: 'number' },
  code: {},
  em: {},
  link: { collection: 'string', href: 'string', id: 'string', occurrenceKey: 'string', title: 'string' },
  strike: {},
  strong: {},
  subsup: { type: 'string' },
  textColor: { color: 'string' },
  underline: {},
} satisfies Readonly<Record<string, AttributeVocabulary>>

export const markVocabularies: ReadonlyMap<string, AttributeVocabulary> = new Map([...Object.entries(blockMarkAttributes), ...Object.entries(markAttributes)])

export type MarkType = keyof typeof markAttributes

export function isMarkType(type: string): type is MarkType {
  return Object.hasOwn(markAttributes, type)
}

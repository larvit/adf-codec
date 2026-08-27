import type { AttributeVocabulary } from './attribute-vocabulary.ts'

export const markAttributes = {
  border: { color: 'string', size: 'number' },
  code: {},
  em: {},
  link: { href: 'string', title: 'string' },
  strike: {},
  strong: {},
  subsup: { type: 'string' },
  textColor: { color: 'string' },
  underline: {},
} satisfies Readonly<Record<string, AttributeVocabulary>>

export type MarkType = keyof typeof markAttributes

export function isMarkType(type: string): type is MarkType {
  return Object.hasOwn(markAttributes, type)
}

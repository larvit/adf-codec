import type { AdfAttributes, AdfMark } from './document.ts'
import type { AttributeVocabulary } from './attribute-vocabulary.ts'

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

export type LinkTarget = { href: string; title?: string }

export function linkTargetMark({ href, title }: LinkTarget): AdfMark {
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
}

// `undefined` where `href` is no string, or `title` is there and no string; any other key is the caller's to check.
export function linkTarget(attrs: AdfAttributes): LinkTarget | undefined {
  const { href, title } = attrs
  if (typeof href !== 'string') return undefined
  if (title === undefined) return { href }
  return typeof title === 'string' ? { href, title } : undefined
}

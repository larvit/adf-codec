import type { AdfMark, AdfNode, AttributeVocabulary } from './adf-document.ts'
import type { AttributeFault } from './directive-attributes.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { attributeFailure, spellAttributes, vocabularyPairs } from './directive-attributes.ts'

export type InlineDirective = {
  attributes: AttributeVocabulary
  slot?: string
}

export type MarkSpelling =
  | { attributes: AttributeVocabulary; kind: 'code' | 'directive' | 'link'; spelling?: undefined }
  | { attributes: AttributeVocabulary; kind: 'emphasis'; spelling: string }

const inlineDirectives: Readonly<Record<string, InlineDirective>> = {
  date: { attributes: { localId: 'string', timestamp: 'string' } },
  emoji: { attributes: { id: 'string', localId: 'string', shortName: 'string' }, slot: 'text' },
  inlineCard: { attributes: { data: 'json', localId: 'string', url: 'string' } },
  mediaInline: {
    attributes: {
      alt: 'string',
      collection: 'string',
      data: 'json',
      height: 'number',
      id: 'string',
      localId: 'string',
      occurrenceKey: 'string',
      type: 'string',
      width: 'number',
    },
  },
  mention: { attributes: { accessLevel: 'string', id: 'string', localId: 'string', userType: 'string' }, slot: 'text' },
  status: { attributes: { color: 'string', localId: 'string', style: 'string' }, slot: 'text' },
}

const markSpellings: Readonly<Record<string, MarkSpelling>> = {
  border: { attributes: { color: 'string', size: 'number' }, kind: 'directive' },
  code: { attributes: {}, kind: 'code' },
  em: { attributes: {}, kind: 'emphasis', spelling: '_' },
  link: { attributes: { href: 'string', title: 'string' }, kind: 'link' },
  strike: { attributes: {}, kind: 'emphasis', spelling: '~~' },
  strong: { attributes: {}, kind: 'emphasis', spelling: '**' },
  subsup: { attributes: { type: 'string' }, kind: 'directive' },
  textColor: { attributes: { color: 'string' }, kind: 'directive' },
  underline: { attributes: {}, kind: 'directive' },
}

export function inlineDirective(type: string): InlineDirective | undefined {
  return Object.hasOwn(inlineDirectives, type) ? inlineDirectives[type] : undefined
}

export function markSpelling(type: string): MarkSpelling | undefined {
  return Object.hasOwn(markSpellings, type) ? markSpellings[type] : undefined
}

export function spellInlineNodeAttributes(node: AdfNode, directive: InlineDirective, path: ConvertErrorPath): Result<string> {
  const spelled = vocabularyPairs(node.attrs ?? {}, directive.attributes, directive.slot)
  if (spelled.fault !== undefined) return attributeFailure(node.type, spelled.fault, path)
  return success(spellAttributes(spelled.pairs))
}

export function spellMarkAttributes(mark: AdfMark, vocabulary: AttributeVocabulary, path: ConvertErrorPath): Result<string> {
  const spelled = vocabularyPairs(mark.attrs ?? {}, vocabulary, undefined)
  if (spelled.fault !== undefined) return markFailure(mark.type, spelled.fault, path)
  return success(spellAttributes(spelled.pairs))
}

function markFailure<T>(type: string, fault: AttributeFault, path: ConvertErrorPath): Result<T> {
  if (fault.kind === undefined) return failure('unspellable-mark', `the ${type} spelling holds no ${fault.key} attribute`, path)
  return failure('unspellable-mark', `the ${type} attribute ${fault.key} holds no ${fault.kind}`, path)
}

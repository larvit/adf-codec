import type { AdfMark, AdfNode } from './adf-document.ts'
import type { AttributeVocabulary } from './directive-attributes.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { attributeFailure, spellAttributes, vocabularyPairs } from './directive-attributes.ts'

export type InlineDirective = {
  attributes: AttributeVocabulary
  slot?: string
}

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

const markDirectives: Readonly<Record<string, AttributeVocabulary>> = {
  border: { color: 'string', size: 'number' },
  subsup: { type: 'string' },
  textColor: { color: 'string' },
  underline: {},
}

export function inlineDirective(type: string): InlineDirective | undefined {
  return Object.hasOwn(inlineDirectives, type) ? inlineDirectives[type] : undefined
}

export function markDirective(type: string): AttributeVocabulary | undefined {
  return Object.hasOwn(markDirectives, type) ? markDirectives[type] : undefined
}

export function spellInlineNodeAttributes(node: AdfNode, directive: InlineDirective, path: ConvertErrorPath): Result<string> {
  const pairs = vocabularyPairs(node.attrs ?? {}, directive.attributes, directive.slot)
  if (!Array.isArray(pairs)) return attributeFailure(node.type, pairs, path)
  return success(spellAttributes(pairs))
}

export function spellMarkAttributes(mark: AdfMark, vocabulary: AttributeVocabulary, path: ConvertErrorPath): Result<string> {
  const pairs = vocabularyPairs(mark.attrs ?? {}, vocabulary, undefined)
  if (!Array.isArray(pairs)) {
    if (pairs.kind === undefined) return failure('unspellable-mark', `the ${mark.type} spelling holds no ${pairs.key} attribute`, path)
    return failure('unspellable-mark', `the ${mark.type} attribute ${pairs.key} holds no ${pairs.kind}`, path)
  }
  return success(spellAttributes(pairs))
}

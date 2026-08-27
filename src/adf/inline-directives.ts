import type { AttributeVocabulary } from './attribute-vocabulary.ts'

export type InlineDirective = {
  attributes: AttributeVocabulary
  slot?: string
}

const inlineDirectives: Readonly<Record<string, InlineDirective>> = {
  date: { attributes: { localId: 'string', timestamp: 'string' } },
  emoji: { attributes: { id: 'string', localId: 'string', shortName: 'string' }, slot: 'text' },
  hardBreak: { attributes: { localId: 'string', text: 'string' } },
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

export function inlineDirective(type: string): InlineDirective | undefined {
  return Object.hasOwn(inlineDirectives, type) ? inlineDirectives[type] : undefined
}

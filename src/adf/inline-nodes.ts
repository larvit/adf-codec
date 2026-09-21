import type { AttributeVocabulary } from './attribute-vocabulary.ts'

export type InlineNode = {
  attributes: AttributeVocabulary
  textAttribute?: string
}

export const inlineNodes: Readonly<Record<string, InlineNode>> = {
  date: { attributes: { localId: 'string', timestamp: 'string' } },
  emoji: { attributes: { id: 'string', localId: 'string', shortName: 'string', text: 'string' }, textAttribute: 'text' },
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
  mention: { attributes: { accessLevel: 'string', id: 'string', localId: 'string', text: 'string', userType: 'string' }, textAttribute: 'text' },
  status: { attributes: { color: 'string', localId: 'string', style: 'string', text: 'string' }, textAttribute: 'text' },
}

export function inlineNodeNamed(type: string): InlineNode | undefined {
  return Object.hasOwn(inlineNodes, type) ? inlineNodes[type] : undefined
}

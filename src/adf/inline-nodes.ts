import type { AttributeVocabulary } from './attribute-vocabulary.ts'

export type InlineNodeModel = {
  attributes: AttributeVocabulary
  markTypes: readonly string[]
  textAttribute?: string
}

export const inlineNodes: Readonly<Record<string, InlineNodeModel>> = {
  date: { attributes: { localId: 'string', timestamp: 'string' }, markTypes: ['annotation'] },
  emoji: { attributes: { id: 'string', localId: 'string', shortName: 'string', text: 'string' }, markTypes: ['annotation'], textAttribute: 'text' },
  hardBreak: { attributes: { localId: 'string', text: 'string' }, markTypes: [] },
  inlineCard: { attributes: { data: 'json', localId: 'string', url: 'string' }, markTypes: ['annotation'] },
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
    markTypes: ['annotation', 'border', 'dataConsumer', 'link'],
  },
  mention: { attributes: { accessLevel: 'string', id: 'string', localId: 'string', text: 'string', userType: 'string' }, markTypes: ['annotation'], textAttribute: 'text' },
  status: { attributes: { color: 'string', localId: 'string', style: 'string', text: 'string' }, markTypes: ['annotation'], textAttribute: 'text' },
}

export function inlineNodeModel(type: string): InlineNodeModel | undefined {
  return Object.hasOwn(inlineNodes, type) ? inlineNodes[type] : undefined
}

// The table withholds nothing from a type it does not list, such as text.
export function takesMark(type: string, markType: string): boolean {
  return inlineNodeModel(type)?.markTypes.includes(markType) ?? true
}

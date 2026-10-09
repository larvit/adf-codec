import type { AttributeVocabulary } from './attribute-vocabulary.ts'

export type InlineNodeModel = {
  attributes: AttributeVocabulary
  takesMarks: boolean
  textAttribute?: string
}

export const inlineNodes: Readonly<Record<string, InlineNodeModel>> = {
  date: { attributes: { localId: 'string', timestamp: 'string' }, takesMarks: true },
  emoji: { attributes: { id: 'string', localId: 'string', shortName: 'string', text: 'string' }, takesMarks: true, textAttribute: 'text' },
  hardBreak: { attributes: { localId: 'string', text: 'string' }, takesMarks: false },
  inlineCard: { attributes: { data: 'json', localId: 'string', url: 'string' }, takesMarks: true },
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
    takesMarks: true,
  },
  mention: { attributes: { accessLevel: 'string', id: 'string', localId: 'string', text: 'string', userType: 'string' }, takesMarks: true, textAttribute: 'text' },
  status: { attributes: { color: 'string', localId: 'string', style: 'string', text: 'string' }, takesMarks: true, textAttribute: 'text' },
}

export function inlineNodeModel(type: string): InlineNodeModel | undefined {
  return Object.hasOwn(inlineNodes, type) ? inlineNodes[type] : undefined
}

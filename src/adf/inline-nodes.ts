import type { AdfNode } from './document.ts'
import type { AttributeVocabulary } from './attribute-vocabulary.ts'
import { nodeMarks } from './document.ts'

export const codeTextMarkTypes: readonly string[] = ['annotation', 'code', 'link']
export const formattedTextMarkTypes: readonly string[] = ['annotation', 'backgroundColor', 'em', 'link', 'strike', 'strong', 'subsup', 'textColor', 'underline']

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

// Undefined means every mark: the table lists only types the schema restricts. Text is code text, or formatted text, which withholds `border`.
export function takenMarkTypes(node: AdfNode): readonly string[] | undefined {
  if (node.type === 'text') return nodeMarks(node).some((mark) => mark.type === 'code') ? codeTextMarkTypes : formattedTextMarkTypes
  return inlineNodeModel(node.type)?.markTypes
}

export function takesMark(node: AdfNode, markType: string): boolean {
  return takenMarkTypes(node)?.includes(markType) ?? true
}

import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'

// An inline node HTML writes as its own element instead of the carry (docs/decisions.md §The HTML dialect). `content` is the attribute its text is, none for a date, whose text is the day its `timestamp` falls on; `leading` is the attribute standing first after the class, holding that same text.
export type NodeElement = {
  class: string
  content: string | undefined
  element: 'a' | 'span' | 'time'
  leading: 'datetime' | 'href' | undefined
  vocabulary: AttributeVocabulary
}

const nodeElements: Readonly<Record<string, NodeElement>> = {
  date: { class: 'adf-date', content: undefined, element: 'time', leading: 'datetime', vocabulary: attributesOf('date') },
  emoji: { class: 'adf-emoji', content: 'text', element: 'span', leading: undefined, vocabulary: attributesOf('emoji') },
  // A card's `data` is not written yet, so a card holding it rides the carry.
  inlineCard: { class: 'adf-inline-card', content: 'url', element: 'a', leading: 'href', vocabulary: { localId: 'string', url: 'string' } },
  status: { class: 'adf-status', content: 'text', element: 'span', leading: undefined, vocabulary: attributesOf('status') },
}

function attributesOf(type: string): AttributeVocabulary {
  return inlineNodeModel(type)?.attributes ?? {}
}

export function elementOfNodeType(type: string): NodeElement | undefined {
  return Object.hasOwn(nodeElements, type) ? nodeElements[type] : undefined
}

export function nodeTypeOfElement(element: string, className: string): [string, NodeElement] | undefined {
  return Object.entries(nodeElements).find(([, candidate]) => candidate.element === element && candidate.class === className)
}

import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'

// `content` names the attribute holding the shown text, none for a date, which shows the day its `timestamp` falls on; `leading` names the attribute right after the class, holding that same text.
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
  // Leaves out `data`, whose spelling is open (todo.md item 133), so a card holding it rides the carry.
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

// HTML's valid date string holds a four-digit year above 0, so a day outside years 1 to 9999 rides the carry.
export function htmlDay(day: string | undefined): string | undefined {
  return day !== undefined && /^\d{4}-/.test(day) && !day.startsWith('0000-') ? day : undefined
}

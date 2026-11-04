import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'

// `textAttribute` names the attribute holding the shown text, none for a date, which shows the day its `timestamp` falls on; `leading` names the attribute right after the class, holding that same text.
export type NodeElement = {
  class: string
  element: 'a' | 'span' | 'time'
  leading: 'datetime' | 'href' | undefined
  textAttribute: string | undefined
  vocabulary: AttributeVocabulary
}

const nodeElements: Readonly<Record<string, NodeElement>> = {
  date: { class: 'adf-date', element: 'time', leading: 'datetime', textAttribute: undefined, vocabulary: attributesOf('date') },
  emoji: { class: 'adf-emoji', element: 'span', leading: undefined, textAttribute: inlineNodeModel('emoji')?.textAttribute, vocabulary: attributesOf('emoji') },
  // Leaves out `data`, whose spelling is open (todo.md item 133), so a card holding it rides the carry.
  inlineCard: { class: 'adf-inline-card', element: 'a', leading: 'href', textAttribute: 'url', vocabulary: { localId: 'string', url: 'string' } },
  status: { class: 'adf-status', element: 'span', leading: undefined, textAttribute: inlineNodeModel('status')?.textAttribute, vocabulary: attributesOf('status') },
}

function attributesOf(type: string): AttributeVocabulary {
  return inlineNodeModel(type)?.attributes ?? {}
}

export function classesOfElement(element: string): string[] {
  return Object.values(nodeElements).filter((candidate) => candidate.element === element).map((candidate) => candidate.class)
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

import type { AdfAttributes, AdfNode } from '../adf/document.ts'
import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'
import { nodeAttrs } from '../adf/document.ts'
import { shownText, shownUrl } from '../adf/shown-text.ts'

// `shown` is the text the element holds and `leading.value` the attribute right after the class, each `undefined` where the node cannot be written as this element and rides the carry. The reader builds a node from the element's `data-*` attributes and text, and refuses it unless `shown` and `leading.value` give back that text and attribute, so only what the writer writes reads back. `written` names the attributes no `data-*` attribute may hold, since the text or `leading` spells them.
export type NodeElement = {
  build(data: AdfAttributes, shown: string): AdfAttributes
  class: string
  element: 'a' | 'span' | 'time'
  leading: { name: 'datetime' | 'href'; value(node: AdfNode): string | undefined } | undefined
  mismatch: string
  shown(node: AdfNode): string | undefined
  vocabulary: AttributeVocabulary
  written: readonly string[]
}

const nodeElements: Readonly<Record<string, NodeElement>> = {
  date: {
    build: (data) => data,
    class: 'adf-date',
    element: 'time',
    leading: { name: 'datetime', value: dayOf },
    mismatch: 'shows the day its data-timestamp names, in datetime and as its text; to change the date, change all three',
    shown: dayOf,
    vocabulary: attributesOf('date'),
    written: [],
  },
  emoji: textElement('emoji', 'adf-emoji'),
  inlineCard: {
    build: (data, shown) => (data['data'] === undefined ? { ...data, url: shown } : data),
    class: 'adf-inline-card',
    element: 'a',
    leading: { name: 'href', value: (node) => card(node)?.href },
    mismatch: 'holds one URL, as its href and as its text, or the URL its data-data holds as its href and its name, else that URL, as its text; to change the card, change them together',
    shown: (node) => card(node)?.text,
    vocabulary: attributesOf('inlineCard'),
    written: ['url'],
  },
  mention: textElement('mention', 'adf-mention'),
  status: textElement('status', 'adf-status'),
}

function attributesOf(type: string): AttributeVocabulary {
  return inlineNodeModel(type)?.attributes ?? {}
}

// A card holding both `data` and a `url` rides the carry: its href, read back, could not say which of the two URLs it spells.
function card(node: AdfNode): { href: string; text: string } | undefined {
  const { data, url } = nodeAttrs(node)
  if (data === undefined) return typeof url === 'string' && url !== '' ? { href: url, text: url } : undefined
  const href = url === undefined ? shownUrl(node) : undefined
  const text = shownText(node)
  return href === undefined || text === undefined ? undefined : { href, text }
}

function dayOf(node: AdfNode): string | undefined {
  return htmlDay(shownText(node))
}

function textElement(type: string, className: string): NodeElement {
  return {
    build: (data, shown) => ({ ...data, text: shown }),
    class: className,
    element: 'span',
    leading: undefined,
    mismatch: 'holds its text, which is not empty',
    shown: (node) => {
      const text = nodeAttrs(node)['text']
      return typeof text === 'string' && text !== '' ? text : undefined
    },
    vocabulary: attributesOf(type),
    written: ['text'],
  }
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
function htmlDay(day: string | undefined): string | undefined {
  return day !== undefined && /^\d{4}-/.test(day) && !day.startsWith('0000-') ? day : undefined
}

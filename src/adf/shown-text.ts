import type { AdfNode } from './document.ts'
import type { JsonValue } from '../json-value.ts'
import { nodeAttrs } from './document.ts'

// The text a node shows in place of itself, read from the attribute holding its content; `undefined` where it holds none.
export function shownText(node: AdfNode): string | undefined {
  const attrs = nodeAttrs(node)
  switch (node.type) {
    case 'blockCard':
    case 'embedCard':
    case 'inlineCard':
      return visibleText(attrs['url']) ?? visibleText(cardData(node)['name']) ?? cardUrl(node)
    case 'date':
      return isoDate(attrs['timestamp'])
    case 'emoji':
      return visibleText(attrs['text']) ?? stringValue(attrs['shortName'])
    case 'expand':
    case 'nestedExpand':
    case 'status':
      return stringValue(node.type === 'status' ? attrs['text'] : attrs['title'])
    case 'extension':
    case 'inlineExtension':
      return visibleText(attrs['text'])
    case 'media':
    case 'mediaInline':
      return visibleText(attrs['alt']) ?? (attrs['type'] === 'external' ? visibleText(attrs['url']) : undefined)
    case 'mention': {
      const id = attrs['id']
      return visibleText(attrs['text']) ?? (typeof id === 'string' && id !== '' ? `@${id}` : undefined)
    }
    default:
      return undefined
  }
}

export function cardUrl(card: AdfNode): string | undefined {
  return visibleText(nodeAttrs(card)['url']) ?? visibleText(cardData(card)['url'])
}

// `undefined` where the value is no string or holds only whitespace and null characters.
export function visibleText(value: unknown): string | undefined {
  return typeof value === 'string' && /[^\s\0]/.test(value) ? value : undefined
}

function cardData(card: AdfNode): Readonly<Record<string, JsonValue>> {
  const data = nodeAttrs(card)['data']
  return typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}
}

function isoDate(timestamp: unknown): string | undefined {
  const milliseconds = typeof timestamp === 'string' && /^-?\d+$/.test(timestamp) ? Number(timestamp) : Number.NaN
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) return undefined
  const iso = date.toISOString()
  return iso.slice(0, iso.indexOf('T'))
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

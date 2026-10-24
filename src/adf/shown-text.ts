import type { AdfNode } from './document.ts'
import type { JsonValue } from '../json-value.ts'
import type { LinkAttrs } from './mark-attributes.ts'
import { blockNodeModel } from './block-nodes.ts'
import { nodeAttrs, nodeMarks } from './document.ts'

export function isBlockNodeType(type: string): boolean {
  return blockNodeModel(type) !== undefined || type === 'blockCard' || type === 'embedCard'
}

// Whether the text a node shows stands apart from the text beside it; media shows inline, as an image in a line does.
export function partsShownText(type: string): boolean {
  return isBlockNodeType(type) && type !== 'media'
}

export function oneLine(text: string): string {
  return text.replace(/[\r\u0000]/g, '').replace(/\n/g, ' ')
}

// The name of what a node references where it shows no text of its own, for a note standing in its place.
export function referenceName(node: AdfNode): string | undefined {
  switch (node.type) {
    case 'blockCard':
    case 'embedCard':
    case 'inlineCard':
      return 'link card'
    case 'extension':
    case 'inlineExtension': {
      const key = visibleText(nodeAttrs(node)['extensionKey'])
      return key === undefined ? 'extension' : oneLine(key).trim()
    }
    case 'media':
    case 'mediaInline':
      return 'image'
    case 'syncBlock':
      return 'synced block'
    default:
      return undefined
  }
}

// What an image shows in place of itself, `href` the target of the link marking it, if any: `text`, else a note; `link`, its URL, which `text` links to where no link marks it; `after`, its URL, shown after a link going elsewhere.
export function shownImage(media: AdfNode, href: string | undefined): { after: string | undefined; link: string | undefined; text: string | undefined } {
  const alt = visibleText(nodeAttrs(media)['alt'])
  const url = shownUrl(media)
  if (url === undefined) return { after: undefined, link: undefined, text: alt }
  if (href === undefined) return { after: undefined, link: url, text: alt ?? url }
  if (href === url) return { after: undefined, link: undefined, text: alt ?? url }
  return { after: url, link: undefined, text: alt ?? visibleText(href) ?? url }
}

// The link a node's first link mark makes: its `href` where that is a string, and its `title` only where that is one.
export function shownLink(node: AdfNode): LinkAttrs | undefined {
  const { href, title } = nodeAttrs(nodeMarks(node).find((mark) => mark.type === 'link') ?? {})
  if (typeof href !== 'string') return undefined
  return typeof title === 'string' ? { href, title } : { href }
}

// The text a node shows in place of itself, read from the attribute holding its content; `undefined` where it holds none, and for an image, which `shownImage` answers.
export function shownText(node: AdfNode): string | undefined {
  const attrs = nodeAttrs(node)
  switch (node.type) {
    case 'blockCard':
    case 'embedCard':
    case 'inlineCard':
      return visibleText(attrs['url']) ?? visibleText(cardData(node)['name']) ?? shownUrl(node)
    case 'date':
      return isoDate(attrs['timestamp'])
    case 'emoji':
      return visibleText(attrs['text']) ?? stringValue(attrs['shortName'])
    case 'expand':
    case 'nestedExpand':
      return stringValue(attrs['title'])
    case 'extension':
    case 'inlineExtension':
      return visibleText(attrs['text'])
    case 'mention': {
      const id = attrs['id']
      return visibleText(attrs['text']) ?? (typeof id === 'string' && id !== '' ? `@${id}` : undefined)
    }
    case 'status':
      return stringValue(attrs['text'])
    default:
      return undefined
  }
}

// The URL a card or an external image links a reader to; `undefined` for every other node.
export function shownUrl(node: AdfNode): string | undefined {
  const attrs = nodeAttrs(node)
  switch (node.type) {
    case 'blockCard':
    case 'embedCard':
    case 'inlineCard':
      return visibleText(attrs['url']) ?? visibleText(cardData(node)['url'])
    case 'media':
    case 'mediaInline':
      return attrs['type'] === 'external' ? visibleText(attrs['url']) : undefined
    default:
      return undefined
  }
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

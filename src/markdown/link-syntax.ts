import { backslashEscape, decodeTextEscapes, holdsControlCharacter } from './commonmark-grammar.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { holdsEntityReference } from './entity-references.ts'

export type LinkDefinition = { destination: string; title?: string }

export type LinkPart = { length: number; value: string }

const bracketedDestination = /<((?:[^\n<>\\]|\\[^\n])*)>/y
const linkLabel = /\[((?:[^[\]\\]|\\[\s\S]){0,999})\]/y
const titleClosers: Readonly<Record<string, string>> = { '"': '"', "'": "'", '(': ')' }

// The label is matched by its normalized raw text, escapes and all.
export function readLabel(text: string, offset: number): LinkPart | undefined {
  linkLabel.lastIndex = offset
  const value = linkLabel.exec(text)?.[1]
  return value === undefined ? undefined : { length: value.length + 2, value }
}

export function normalizeLabel(raw: string): string {
  return raw
    .replace(/^[ \t\n]+|[ \t\n]+$/g, '')
    .replace(/[ \t\n]+/g, ' ')
    .toLowerCase()
}

export function readDestination(text: string, offset: number): LinkPart | undefined {
  bracketedDestination.lastIndex = offset
  const bracketed = bracketedDestination.exec(text)?.[0]
  if (bracketed !== undefined) return { length: bracketed.length, value: decodeTextEscapes(bracketed.slice(1, -1)) }
  if (text.charAt(offset) === '<') return undefined
  let depth = 0
  let index = offset
  while (index < text.length) {
    const character = text.charAt(index)
    if (character === ' ' || holdsControlCharacter(character)) break
    if (backslashEscape(text, index) !== undefined) {
      index += 2
      continue
    }
    if (character === '(') depth += 1
    if (character === ')') {
      depth -= 1
      if (depth < 0) break
    }
    index += 1
  }
  return index <= offset ? undefined : { length: index - offset, value: decodeTextEscapes(text.slice(offset, index)) }
}

// `offset` sits on the `(` a link text closes into.
export function readInlineTarget(text: string, offset: number): { definition: LinkDefinition; length: number } | undefined {
  let index = skipLinkWhitespace(text, offset + 1)
  let destination = ''
  if (text.charAt(index) !== ')') {
    const read = readDestination(text, index)
    if (read === undefined) return undefined
    destination = read.value
    index += read.length
  }
  const afterDestination = index
  index = skipLinkWhitespace(text, index)
  const title = index > afterDestination ? readTitle(text, index) : undefined
  if (title !== undefined) index = skipLinkWhitespace(text, index + title.length)
  if (text.charAt(index) !== ')') return undefined
  return { definition: title === undefined ? { destination } : { destination, title: title.value }, length: index + 1 - offset }
}

export function readTitle(text: string, offset: number): LinkPart | undefined {
  const opener = text.charAt(offset)
  const closer = titleClosers[opener]
  if (closer === undefined) return undefined
  let index = offset + 1
  while (index < text.length) {
    const character = text.charAt(index)
    if (backslashEscape(text, index) !== undefined) {
      index += 2
      continue
    }
    if (character === closer) return { length: index + 1 - offset, value: decodeTextEscapes(text.slice(offset + 1, index)) }
    if (character === opener) return undefined
    index += 1
  }
  return undefined
}

// The label, the destination and the title each take at most one line ending with them.
export function skipLinkWhitespace(text: string, offset: number): number {
  const rest = text.slice(offset)
  return offset + rest.length - rest.replace(/^[ \t]*\n?[ \t]*/, '').length
}

export function spellDestination(href: string, path: ConvertErrorPath): Result<string> {
  if (holdsControlCharacter(href)) return failure('unspellable-link', 'a link destination holds a control character', path)
  if (href.includes('\\')) return failure('unspellable-link', 'no canonical escape spells a backslash in a link destination', path)
  if (holdsEntityReference(href)) {
    return failure('unspellable-link', 'a link destination holds an entity reference that decodes on the way back', path)
  }
  if (href.includes(' ')) {
    if (/[<>]/.test(href)) {
      return failure('unspellable-link', 'no canonical escape spells an angle bracket beside a space in a link destination', path)
    }
    return success(`<${href}>`)
  }
  if (href.startsWith('<')) return failure('unspellable-link', 'a bare link destination cannot begin with an angle bracket', path)
  return success(escapeUnbalanced(href))
}

export function spellLinkTarget(href: string, title: string | undefined, path: ConvertErrorPath): Result<string> {
  const destination = spellDestination(href, path)
  if (!destination.ok || title === undefined) return destination
  const spelledTitle = spellTitle(title, path)
  if (!spelledTitle.ok) return spelledTitle
  return success(`${destination.value === '' ? '<>' : destination.value}${spelledTitle.value}`)
}

function spellTitle(title: string, path: ConvertErrorPath): Result<string> {
  if (/[\n\r\\]/.test(title)) {
    return failure('unspellable-link', 'no canonical escape spells a backslash or newline in a link title', path)
  }
  if (holdsEntityReference(title)) return failure('unspellable-link', 'a link title holds an entity reference that decodes on the way back', path)
  return success(` "${title.replaceAll('"', '\\"')}"`)
}

function escapeUnbalanced(href: string): string {
  const open: number[] = []
  const unbalanced = new Set<number>()
  for (let index = 0; index < href.length; index += 1) {
    const character = href.charAt(index)
    if (character === '(') open.push(index)
    if (character === ')' && open.pop() === undefined) unbalanced.add(index)
  }
  for (const index of open) unbalanced.add(index)
  let spelled = ''
  for (let index = 0; index < href.length; index += 1) spelled += (unbalanced.has(index) ? '\\' : '') + href.charAt(index)
  return spelled
}

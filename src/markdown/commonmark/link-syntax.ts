import { backslashEscape, controlCharacterRange, decodeTextEscapes, holdsControlCharacter, holdsNullCharacter } from './grammar.ts'
import { holdsEntityReference, readEntityReference } from './entity-references.ts'

export type InlineTarget = { definition: () => LinkDefinition; length: number }

export type LinkDefinition = { destination: string; title?: string }

export type LinkPart = { length: number; value: string }

// Every destination ending at one index shares what follows it: the title and the closing `)`.
type Tail = { end: number; title: string | undefined }

// One memo serves every target in `text`, those in a directive's content included.
export type TargetMemo = { destinationEnds: Int32Array | undefined; tails: Map<number, Tail | undefined>; text: string }

// The lossless flavour escapes a quote alone, writing a title holding a backslash or an entity reference as a directive (spec/flavour.md, Marks); the portable flavour writes no directive, so it escapes those too, and a table cell's `|` (README, Portable markdown).
export type TitleEscapes = 'lossless' | 'portable' | 'portable-table-cell'

const bracketedDestination = /<((?:[^\n<>\\]|\\[^\n])*)>/y
// The longest text an unbracketed destination can take.
const destinationRun = new RegExp(`[^ ${controlCharacterRange}]*`, 'y')
// CommonMark: a link label holds at most this many characters between its brackets, an escape counting as two.
export const labelLimit = 999
const linkLabel = new RegExp(String.raw`\[((?:[^[\]\\]|\\[\s\S]){0,${labelLimit}})\]`, 'y')
const linkWhitespace = /[ \t]*\n?[ \t]*/y
const titleClosers: Readonly<Record<string, string>> = { '"': '"', "'": "'", '(': ')' }

// The label is matched by its normalized raw text, escapes and all.
export function readLabel(text: string, offset: number): LinkPart | undefined {
  linkLabel.lastIndex = offset
  const value = linkLabel.exec(text)?.[1]
  return value === undefined || value.length > labelLimit ? undefined : { length: value.length + 2, value }
}

export function normalizeLabel(raw: string): string {
  const collapsed = raw.replace(/[ \t\n]+/g, ' ')
  const start = collapsed.startsWith(' ') ? 1 : 0
  const end = collapsed.endsWith(' ') ? collapsed.length - 1 : collapsed.length
  return collapsed.slice(start, end).toLowerCase()
}

export function readDestination(text: string, offset: number): LinkPart | undefined {
  bracketedDestination.lastIndex = offset
  const bracketed = bracketedDestination.exec(text)?.[0]
  if (bracketed !== undefined) return { length: bracketed.length, value: decodeTextEscapes(bracketed.slice(1, -1)) }
  if (text.charAt(offset) === '<') return undefined
  destinationRun.lastIndex = offset
  destinationRun.test(text)
  const run = text.slice(offset, destinationRun.lastIndex)
  const length = destinationEnds(run)[0] ?? 0
  return length === 0 ? undefined : { length, value: decodeTextEscapes(run.slice(0, length)) }
}

// `offset` sits on the `(` a link text closes into. The definition is built only when called, so a link the reader then refuses never decodes its destination.
export function readInlineTarget(memo: TargetMemo, offset: number): InlineTarget | undefined {
  const { text } = memo
  const start = skipLinkWhitespace(text, offset + 1)
  const end = destinationEnd(memo, start)
  if (end === undefined) return undefined
  const tail = memo.tails.has(end) ? memo.tails.get(end) : readTail(text, end)
  memo.tails.set(end, tail)
  if (tail === undefined) return undefined
  const definition = (): LinkDefinition => {
    const edge = text.charAt(start) === '<' ? 1 : 0
    const destination = decodeTextEscapes(text.slice(start + edge, end - edge))
    return tail.title === undefined ? { destination } : { destination, title: tail.title }
  }
  return { definition, length: tail.end - offset }
}

export function targetMemo(text: string): TargetMemo {
  return { destinationEnds: undefined, tails: new Map(), text }
}

// `ends[start]` is where an unbracketed destination from `start` stops, filled in one pass for every start a target can have: just after a `(`, a space or a control character, and 0, where `readDestination`'s run begins. At a stop only the innermost open start has its parentheses balanced, so the starts below it keep no end.
function destinationEnds(text: string): Int32Array {
  const ends = new Int32Array(text.length + 1)
  let open = [0]
  for (let index = 0; index <= text.length; index += backslashEscape(text, index) === undefined ? 1 : 2) {
    const character = text.charAt(index)
    if (character === '(') open.push(index + 1)
    const start = character === ')' ? open.pop() : undefined
    if (start !== undefined) ends[start] = index
    if (index < text.length && character !== ' ' && !holdsControlCharacter(character)) continue
    const innermost = open.pop()
    if (innermost !== undefined) ends[innermost] = index
    open = [index + 1]
  }
  return ends
}

function destinationEnd(memo: TargetMemo, start: number): number | undefined {
  const { text } = memo
  if (text.charAt(start) === ')') return start
  if (text.charAt(start) === '<') {
    bracketedDestination.lastIndex = start
    const bracketed = bracketedDestination.exec(text)?.[0]
    return bracketed === undefined ? undefined : start + bracketed.length
  }
  memo.destinationEnds ??= destinationEnds(text)
  const end = memo.destinationEnds[start] ?? start
  return end > start ? end : undefined
}

function readTail(text: string, end: number): Tail | undefined {
  let index = skipLinkWhitespace(text, end)
  const title = index > end ? readTitle(text, index) : undefined
  if (title !== undefined) index = skipLinkWhitespace(text, index + title.length)
  return text.charAt(index) === ')' ? { end: index + 1, title: title?.value } : undefined
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
  linkWhitespace.lastIndex = offset
  // The pattern matches empty, so the test never fails, which would reset `lastIndex` to 0.
  linkWhitespace.test(text)
  return linkWhitespace.lastIndex
}

export function spellDestination(href: string): string | undefined {
  if (holdsControlCharacter(href) || href.includes('\\') || holdsEntityReference(href)) return undefined
  if (href.includes(' ')) return /[<>]/.test(href) ? undefined : `<${href}>`
  return href.startsWith('<') ? undefined : escapeUnbalanced(href, '(', ')')
}

export function spellLinkTarget(href: string, title: string | undefined, escapes: TitleEscapes): string | undefined {
  const destination = spellDestination(href)
  if (destination === undefined || title === undefined) return destination
  const spelledTitle = spellTitle(title, escapes)
  return spelledTitle === undefined ? undefined : `${destination === '' ? '<>' : destination}${spelledTitle}`
}

export function escapeUnbalanced(spelling: string, opener: string, closer: string): string {
  const open: number[] = []
  const unbalanced = new Set<number>()
  for (let index = 0; index < spelling.length; index += backslashEscape(spelling, index) === undefined ? 1 : 2) {
    const character = spelling.charAt(index)
    if (character === opener) open.push(index)
    if (character === closer && open.pop() === undefined) unbalanced.add(index)
  }
  for (const index of open) unbalanced.add(index)
  let spelled = ''
  for (let index = 0; index < spelling.length; index += 1) spelled += (unbalanced.has(index) ? '\\' : '') + spelling.charAt(index)
  return spelled
}

function spellTitle(title: string, escapes: TitleEscapes): string | undefined {
  if (/[\n\r]/.test(title) || holdsNullCharacter(title)) return undefined
  if (escapes === 'lossless') return title.includes('\\') || holdsEntityReference(title) ? undefined : ` "${title.replaceAll('"', '\\"')}"`
  let spelled = ''
  for (let index = 0; index < title.length; index += 1) {
    const character = title.charAt(index)
    const escaped = (character === '\\' && (backslashEscape(title, index) !== undefined || index === title.length - 1)) || character === '"' || (character === '&' && readEntityReference(title, index) !== undefined) || (character === '|' && escapes === 'portable-table-cell')
    spelled += escaped ? `\\${character}` : character
  }
  return ` "${spelled}"`
}

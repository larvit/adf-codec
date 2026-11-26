import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { ConvertFault } from '../../result.ts'
import { colourNames } from './colour-names.ts'
import { identicalMarks } from '../../adf/document.ts'
import { readAdfMacro } from './adf-macro.ts'
import { linkedAddress, smileyEmoji, smileys, spellableColour, spellableTitle, spellableUrl, storedHref, wellFormedFrom } from '../spellings.ts'

// `end`: where the reading stopped, a cell's closing `|` or the line's end.
export type InlineRead = { end: number; fault?: undefined; nodes: AdfNode[] } | { fault: ConvertFault }

// A link whose text is being read: `close` is the `|` ending the text, `end` follows its `]`, and `floor` is its place in `opened`, below which no delimiter closes.
type Link = { close: number; end: number; floor: number }

// An opening delimiter no closer has met: `at` is where its content starts, and `piece` holds its characters, which stay text unless it closes.
type Opened = { at: number; key: string; mark: AdfMark; piece: TextPiece }

// `node`: a node no mark reaches and no text joins.
type Piece = TextPiece | { node: AdfNode }

type Role = 'close' | 'either' | 'open'

// `marks`: outermost first.
type TextPiece = { marks: AdfMark[]; text: string }

// `run`: the piece the next plain character joins.
// `unlinkedBefore`: no bare address starting before it links, as one starting inside a run already read ends where that run does.
type Scan = { end: number; inCell: boolean; link: Link | undefined; opened: Opened[]; pieces: Piece[]; run: TextPiece | undefined; start: number; unlinkedBefore: number; wiki: string }

const address = /https?:\/\/[^\s"`>|[\]{}\\]*/y
const anchorMacro = /\{anchor(?::[^{}\n]*)?\}/y
const characterMarks: ReadonlyMap<string, AdfMark> = new Map([
  ['*', { type: 'strong' }],
  ['+', { type: 'underline' }],
  ['^', { attrs: { type: 'sup' }, type: 'subsup' }],
  ['_', { type: 'em' }],
  ['~', { attrs: { type: 'sub' }, type: 'subsup' }],
])
const colourMacro = /\{color(?::([^{}\n]*))?\}/y
const keepsBackslash = /[\p{L}\p{N}\s:;.,]/u
const plain = /[^\n\\*_\-+^~{}?[|:;(h]+/y
const space = /\s/u
const strike: AdfMark = { type: 'strike' }
const word = /[\p{L}\p{N}]/u

// spec/wiki.md, Inline and Marks: the nodes of `wiki` from `start` to `end`, or in a cell to the `|` closing it.
export function readInline(wiki: string, start: number, end: number, inCell: boolean): InlineRead {
  const scan: Scan = { end, inCell, link: undefined, opened: [], pieces: [], run: undefined, start, unlinkedBefore: 0, wiki }
  let at = start
  while (at < end) {
    if (scan.link?.close === at) at = closeLink(scan, scan.link)
    else if (inCell && wiki.charAt(at) === '|') break
    else {
      const next = readPiece(scan, at)
      if (typeof next !== 'number') return next
      at = next
    }
  }
  return { end: at, nodes: nodesOf(scan.pieces) }
}

function readPiece(scan: Scan, at: number): number | { fault: ConvertFault } {
  const { end, wiki } = scan
  plain.lastIndex = at
  if (plain.test(wiki)) {
    const stop = Math.min(plain.lastIndex, end)
    literal(scan, wiki.slice(at, stop))
    return stop
  }
  const character = wiki.charAt(at)
  const mark = characterMarks.get(character)
  if (mark !== undefined) return delimiter(scan, at, character, character, mark, 'either')
  switch (character) {
    case '-':
      return dash(scan, at)
    case '?':
      return wiki.startsWith('??', at) ? delimiter(scan, at, '??', '??', { type: 'em' }, 'either') : plainCharacter(scan, at)
    case '[':
      return bracket(scan, at)
    case '\\':
      return escape(scan, at)
    case 'h':
      return bareAddress(scan, at)
    case '{':
      return brace(scan, at)
    case '}':
      return wiki.startsWith('}}', at) ? delimiter(scan, at, '}}', '{{', { type: 'code' }, 'close') : plainCharacter(scan, at)
    case '(':
    case ':':
    case ';':
      return smiley(scan, at)
    default:
      return plainCharacter(scan, at)
  }
}

function plainCharacter(scan: Scan, at: number): number {
  literal(scan, scan.wiki.charAt(at))
  return at + 1
}

function literal(scan: Scan, text: string): void {
  if (scan.run === undefined) scan.run = push(scan, { marks: [], text })
  else scan.run.text += text
}

function push<Pushed extends Piece>(scan: Scan, piece: Pushed): Pushed {
  scan.pieces.push(piece)
  scan.run = undefined
  return piece
}

// spec/wiki.md, Marks: a delimiter opens or closes beside whitespace, punctuation or the line's edge, around a run that neither starts nor ends with whitespace.
function delimiter(scan: Scan, at: number, spelled: string, key: string, mark: AdfMark, role: Role): number {
  const after = at + spelled.length
  const previous = pointBefore(scan, at)
  const next = pointAt(scan, after)
  const opener = openedIndex(scan, key)
  const opened = scan.opened[opener]
  if (role !== 'open' && opened !== undefined && opened.at < at && previous !== undefined && !space.test(previous) && (next === undefined || !word.test(next))) close(scan, opened, opener)
  else if (role !== 'close' && (previous === undefined || !word.test(previous)) && next !== undefined && !space.test(next)) open(scan, after, spelled, key, mark)
  else literal(scan, spelled)
  return after
}

// The nearest opener of its kind closes; an older one of that kind stays text.
function open(scan: Scan, at: number, spelled: string, key: string, mark: AdfMark): void {
  const older = openedIndex(scan, key)
  if (older !== -1) scan.opened.splice(older, 1)
  scan.opened.push({ at, key, mark, piece: push(scan, { marks: [], text: spelled }) })
}

function close(scan: Scan, { mark, piece }: Opened, opener: number): void {
  piece.text = ''
  for (let index = scan.pieces.length - 1; scan.pieces[index] !== piece && index >= 0; index -= 1) {
    const marked = scan.pieces[index]
    if (marked !== undefined && 'marks' in marked) marked.marks.unshift(mark)
  }
  scan.opened.length = opener
  scan.run = undefined
}

function openedIndex(scan: Scan, key: string): number {
  for (let index = scan.opened.length - 1; index > (scan.link?.floor ?? -1); index -= 1) if (scan.opened[index]?.key === key) return index
  return -1
}

function closeLink(scan: Scan, link: Link): number {
  const opened = scan.opened[link.floor]
  scan.link = undefined
  if (opened !== undefined) close(scan, opened, link.floor)
  return link.end
}

// spec/wiki.md, What only the reader reads: no longer run of hyphens is a dash, and none strikes.
function dash(scan: Scan, at: number): number {
  const { end, wiki } = scan
  let after = at + 1
  while (after < end && wiki.charAt(after) === '-') after += 1
  if (after === at + 1) return delimiter(scan, at, '-', '-', strike, 'either')
  const previous = pointBefore(scan, at)
  const next = pointAt(scan, after)
  const parted = (previous === undefined || space.test(previous)) && (next === undefined || space.test(next))
  literal(scan, parted && after - at <= 3 ? (after - at === 3 ? '—' : '–') : wiki.slice(at, after))
  return after
}

// `\\` is a hardBreak, and any other backslash drops before what Jira lets it protect.
function escape(scan: Scan, at: number): number {
  const next = pointAt(scan, at + 1)
  if (next === '\\') {
    push(scan, { node: { type: 'hardBreak' } })
    return at + 2
  }
  if (next === undefined || keepsBackslash.test(next) || (next === '|' && scan.inCell && scan.link === undefined)) return plainCharacter(scan, at)
  literal(scan, next)
  return at + 1 + next.length
}

function smiley(scan: Scan, at: number): number {
  for (const spelled of smileys) {
    const emoji = smileyEmoji[spelled]
    const next = pointAt(scan, at + spelled.length)
    if (emoji === undefined || !scan.wiki.startsWith(spelled, at) || (next !== undefined && word.test(next))) continue
    const { id, shortName } = emoji
    const text = /^[0-9a-f]+$/.test(id) ? String.fromCodePoint(Number.parseInt(id, 16)) : shortName
    push(scan, { node: { attrs: { id, shortName, text }, type: 'emoji' } })
    return at + spelled.length
  }
  return plainCharacter(scan, at)
}

function brace(scan: Scan, at: number): number | { fault: ConvertFault } {
  const { end, wiki } = scan
  const macro = readAdfMacro(wiki, at, end)
  if (macro?.fault !== undefined) return { fault: macro.fault }
  if (macro !== undefined) {
    push(scan, { node: macro.value.node })
    return macro.value.end
  }
  if (wiki.startsWith('{{', at)) return delimiter(scan, at, '{{', '{{', { type: 'code' }, 'open')
  anchorMacro.lastIndex = at
  if (anchorMacro.test(wiki)) return anchorMacro.lastIndex
  colourMacro.lastIndex = at
  const colour = colourMacro.exec(wiki)
  return colour === null ? plainCharacter(scan, at) : colourDelimiter(scan, at, colour[0], colour[1])
}

// `{color}` reads beside anything, a letter included.
function colourDelimiter(scan: Scan, at: number, spelled: string, named: string | undefined): number {
  const after = at + spelled.length
  const opener = openedIndex(scan, 'color')
  const opened = scan.opened[opener]
  const name = named?.toLowerCase() ?? ''
  const color = named !== undefined && spellableColour.test(named) ? named : Object.hasOwn(colourNames, name) ? colourNames[name] : undefined
  if (named === undefined && opened !== undefined && opened.at < at) close(scan, opened, opener)
  else if (color !== undefined) open(scan, after, spelled, 'color', { attrs: { color }, type: 'textColor' })
  else return plainCharacter(scan, at)
  return after
}

// A link's brackets close on its line, and hold no other `[`.
function bracket(scan: Scan, at: number): number {
  const { end, wiki } = scan
  const bars: number[] = []
  let close = at + 1
  for (; close < end && wiki.charAt(close) !== ']'; close += 1) {
    const character = wiki.charAt(close)
    if (character === '[') return plainCharacter(scan, at)
    if (character === '\\') close += 1
    else if (character === '|') bars.push(close)
  }
  if (close >= end) return plainCharacter(scan, at)
  const [first, second] = bars
  if (first === undefined) return bracketed(scan, at, wiki.slice(at + 1, close))
  const target = wiki.slice(first + 1, second ?? close)
  const title = second === undefined ? undefined : wiki.slice(second + 1, close)
  if (!linkedAddress(target) || (title !== undefined && !spellableTitle.test(title))) return plainCharacter(scan, at)
  const href = storedHref(target)
  const mark: AdfMark = { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
  if (first === at + 1) {
    push(scan, { marks: [mark], text: target })
    return close + 1
  }
  scan.opened.push({ at: at + 1, key: 'link', mark, piece: push(scan, { marks: [], text: '' }) })
  scan.link = { close: first, end: close + 1, floor: scan.opened.length - 1 }
  return at + 1
}

// `[~accountid:<id>]` and `[<href>]`.
function bracketed(scan: Scan, at: number, held: string): number {
  const id = held.startsWith('~accountid:') ? held.slice('~accountid:'.length) : undefined
  if (id !== undefined && spellableUrl.test(id)) push(scan, { node: { attrs: { accessLevel: '', id }, type: 'mention' } })
  else if (linkedAddress(held)) push(scan, { marks: [{ attrs: { href: storedHref(held) }, type: 'link' }], text: held })
  else return plainCharacter(scan, at)
  return at + held.length + 2
}

// spec/wiki.md, What only the reader reads: a bare address, less the punctuation ending it.
function bareAddress(scan: Scan, at: number): number {
  address.lastIndex = at
  const found = scan.link === undefined && at >= scan.unlinkedBefore ? address.exec(scan.wiki)?.[0] : undefined
  if (found === undefined) return plainCharacter(scan, at)
  const spelled = found.slice(0, linkedLength(found))
  const linkedFrom = spelled.endsWith('://') ? spelled.length : wellFormedFrom(spelled)
  if (linkedFrom > 0) {
    scan.unlinkedBefore = at + linkedFrom
    return plainCharacter(scan, at)
  }
  push(scan, { marks: [{ attrs: { href: storedHref(spelled) }, type: 'link' }], text: spelled })
  return at + spelled.length
}

// Jira leaves a trailing run of `!'),.;?` out of the link, but keeps that run up to its last `?` with a `'`, `)`, `,` or `;` after it.
function linkedLength(found: string): number {
  let end = found.length
  let closed = false
  while (end > 0) {
    const last = found.charAt(end - 1)
    if (!"!'),.;?".includes(last) || (last === '?' && closed)) break
    closed ||= "'),;".includes(last)
    end -= 1
  }
  return end
}

function nodesOf(pieces: readonly Piece[]): AdfNode[] {
  const nodes: AdfNode[] = []
  let previous: { marks: readonly AdfMark[]; node: AdfNode } | undefined
  for (const piece of pieces) {
    if ('node' in piece) {
      nodes.push(piece.node)
      previous = undefined
    } else if (previous !== undefined && identicalMarks(previous.marks, piece.marks)) previous.node.text = `${previous.node.text ?? ''}${piece.text}`
    else if (piece.text !== '') {
      const { marks, text } = piece
      previous = { marks, node: marks.length === 0 ? { text, type: 'text' } : { marks: marks.map(copied), text, type: 'text' } }
      nodes.push(previous.node)
    }
  }
  return nodes
}

function copied({ attrs, type }: AdfMark): AdfMark {
  return attrs === undefined ? { type } : { attrs: { ...attrs }, type }
}

// Whole code points, so a letter outside the Basic Multilingual Plane reads as a letter.
function pointAt({ end, wiki }: Scan, index: number): string | undefined {
  const point = index < end ? wiki.codePointAt(index) : undefined
  return point === undefined ? undefined : String.fromCodePoint(point)
}

function pointBefore({ start, wiki }: Scan, index: number): string | undefined {
  if (index <= start) return undefined
  const pair = index - 2 >= start ? wiki.slice(index - 2, index) : ''
  return /^[\ud800-\udbff][\udc00-\udfff]$/.test(pair) ? pair : wiki.charAt(index - 1)
}

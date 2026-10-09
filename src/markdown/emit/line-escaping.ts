import type { Claims, WrittenFlavour } from '../portable/conventions.ts'
import type { InlineToken } from '../inline-tokens.ts'
import type { LineContainer } from '../line-container.ts'
import { delimiterFlags, isWordCharacter, matchEmphasis, runLength } from '../commonmark/emphasis-matching.ts'
import { delimiterRunToken, readInlineToken } from '../inline-tokens.ts'
import { escapesLineClaim, type LinePosition } from '../commonmark/grammar.ts'
import { flavourClaims, highlightFlanking } from '../portable/conventions.ts'
import { isBareDelimiterRow } from '../pipe-table-syntax.ts'
import { opensLinkDefinition } from '../commonmark/link-reference-definitions.ts'

export type DelimiterRole = 'close' | 'open'

// A segment's kind: `backslash` text, `bracketed` text inside `[…]` (link text, alt, a directive's content), `bracketed-link-target` syntax: a link target inside `[…]`, `none` syntax written as is.
export type InlineEscaping = 'backslash' | 'bracketed' | 'bracketed-link-target' | 'none'

export type NodeRange = { first: number; last: number }

// `depth` is the index into each node's marks array that the run spells.
export type MarkRun = NodeRange & { depth: number }

export type InlineSegment =
  | { emphasis: DelimiterRole; escaping: 'none'; highlight?: undefined; nodes: MarkRun; text: string }
  | { emphasis?: undefined; escaping: 'none'; highlight: DelimiterRole; nodes: MarkRun; text: string }
  | { emphasis?: undefined; escaping: 'none'; highlight?: undefined; nodes: NodeRange; text: string }
  | { emphasis?: undefined; escaping: InlineEscaping; highlight?: undefined; nodes?: undefined; text: string }

export type AssembledLine = { line: string; openingLinkAsDirective?: true; unspellableRuns: MarkRun[] }

type ScanLine = { position: LinePosition; start: number; text: string }

type EmittedDelimiter = { closes: boolean; offset: number; pair: number; width: number }

type EmittedRun = { canClose: boolean; canOpen: boolean; character: string; delimiters: EmittedDelimiter[]; length: number; start: number }

// What stays fixed while one line's escapes are decided; `escaped` collects them.
type EscapeWalk = {
  claims: Claims
  container: LineContainer
  escaped: Set<number>
  escapings: readonly InlineEscaping[]
  headingCloser: number | undefined
  linkClose: number
  scan: string
}

const followsLinkText = /[([]/

const runCharacters = '*_`~'

export function assembleInlineLine(segments: readonly InlineSegment[], container: LineContainer, flavour: WrittenFlavour): AssembledLine {
  return escape(resolveEmphasis(segments), container, flavourClaims[flavour])
}

function resolveEmphasis(segments: readonly InlineSegment[]): InlineSegment[] {
  const resolved = segments.map((segment) => ({ ...segment }))
  // Offsets index the pre-swap text: every emphasis spelling this swaps between is one character wide.
  const scan = resolved.map((segment) => segment.text).join('')
  const offsets: number[] = []
  let offset = 0
  for (const segment of resolved) {
    offsets.push(offset)
    offset += segment.text.length
  }
  const open: number[] = []
  for (let index = 0; index < resolved.length; index += 1) {
    const segment = resolved[index]
    if (segment === undefined) continue
    if (segment.emphasis === 'open') open.push(index)
    if (segment.emphasis !== 'close') continue
    const openerIndex = open.pop()
    const opener = openerIndex === undefined ? undefined : resolved[openerIndex]
    if (openerIndex === undefined || opener === undefined) continue
    const openOffset = offsets[openerIndex] ?? 0
    const closeOffset = offsets[index] ?? 0
    if (opener.text !== '_') continue
    if (!isWordCharacter(charAt(scan, openOffset - 1)) && !isWordCharacter(charAt(scan, closeOffset + 1))) continue
    opener.text = '*'
    segment.text = '*'
  }
  return resolved
}

function escape(segments: readonly InlineSegment[], container: LineContainer, claims: Claims): AssembledLine {
  const scan = segments.map((segment) => segment.text).join('')
  const escapings: InlineEscaping[] = []
  for (const segment of segments) for (let index = 0; index < segment.text.length; index += 1) escapings.push(segment.escaping)
  const escaped = escapeClosedRuns(scan, escapings, escapeClaims(scan, escapings, container, claims))
  const placements: number[] = []
  let output = ''
  for (let index = 0; index < scan.length; index += 1) {
    if (escaped.has(index)) output += '\\'
    placements.push(output.length)
    output += scan.charAt(index)
  }
  if (container === 'paragraph' && opensLinkDefinition(output)) {
    if (segments[0]?.nodes !== undefined) return { line: output, openingLinkAsDirective: true, unspellableRuns: [] }
    return { line: `\\${output}`, unspellableRuns: unspellableRuns(segments, output, placements) }
  }
  return { line: output, unspellableRuns: unspellableRuns(segments, output, placements) }
}

function escapeClaims(scan: string, escapings: readonly InlineEscaping[], container: LineContainer, claims: Claims): ReadonlySet<number> {
  const walk: EscapeWalk = {
    claims,
    container,
    escaped: new Set(),
    escapings,
    headingCloser: container === 'heading' ? closingHashes(scan) : undefined,
    linkClose: lastLinkClose(scan, escapings),
    scan,
  }
  let line = scanLine(scan, 0)
  let index = 0
  while (index < scan.length) {
    while (index > line.start + line.text.length) line = scanLine(scan, line.start + line.text.length + 1)
    if (runCharacters.includes(scan.charAt(index))) {
      index = escapeRun(walk, index, line)
      continue
    }
    const escaping = escapings[index]
    const token = readInlineToken(scan, index, claims)
    const claimed = isEscapable(escaping)
      ? index === walk.headingCloser || claimsLineStart(line, index, container) || claimsCharacter(walk, index, token)
      : escaping === 'bracketed-link-target' && token.kind === 'directive'
    if (claimed) walk.escaped.add(index)
    // The reader takes a `==` whole, so its second `=` starts nothing unless the first is escaped.
    index += !claimed && token.kind === 'highlight' ? token.width : 1
  }
  return walk.escaped
}

// A run joining the emitter's own delimiter escapes its text; a run of text escapes from its start while the reader claims what the escapes leave of it.
function escapeRun(walk: EscapeWalk, start: number, line: ScanLine): number {
  const { escaped, escapings, scan } = walk
  const end = start + runLength(scan, start)
  const run = escapings.slice(start, end)
  if (run.some(isSyntax) && run.some(isEscapable)) {
    for (let index = start; index < end; index += 1) if (isEscapable(escapings[index])) escaped.add(index)
    return end
  }
  for (let index = start; index < end; index += 1) {
    // A backtick run escapes whole: a rest left bare would be a raw run of another length for a closer.
    if (!(index > start && scan.charAt(index) === '`') && !claimsRunRest(walk, index, end, line)) break
    escaped.add(index)
  }
  return end
}

function claimsRunRest({ claims, container, escapings, scan }: EscapeWalk, index: number, end: number, line: ScanLine): boolean {
  const escaping = escapings[index]
  if (escaping === 'bracketed-link-target') return readInlineToken(scan, index, claims).kind === 'code-span'
  if (!isEscapable(escaping)) return false
  if (claimsLineStart(line, index, container)) return true
  const token = scan.charAt(index) === '`' ? readInlineToken(scan, index, claims) : delimiterRunToken(scan, index, end - index, claims)
  return token.kind !== 'text'
}

function claimsCharacter({ container, escapings, linkClose, scan }: EscapeWalk, index: number, token: InlineToken): boolean {
  const character = scan.charAt(index)
  const inBrackets = escapings[index] === 'bracketed'
  switch (token.kind) {
    case 'bracket':
      if (token.image) return isSyntax(escapings[index + 1])
      return inBrackets || index < linkClose
    case 'bracket-close':
      return inBrackets
    case 'highlight':
      return token.opens || token.closes
    case 'text':
      if (character === '|') return container === 'table-cell'
      return character === '{' && scan.charAt(index - 1) === ']' && isSyntax(escapings[index - 1])
    default:
      return true
  }
}

// CommonMark reads no escape inside a code span, so a backtick string left beside an escape still closes a span that an earlier bare run of its length opens.
function escapeClosedRuns(scan: string, escapings: readonly InlineEscaping[], claimed: ReadonlySet<number>): ReadonlySet<number> {
  const escaped = new Set(claimed)
  // The lengths of the backtick strings escapes leave: a bare run of one of these lengths would open a span one of them closes, so it is escaped too.
  const formed = new Set<number>()
  let end = scan.length - 1
  while (end >= 0) {
    if (scan.charAt(end) !== '`') {
      end -= 1
      continue
    }
    let start = end
    while (scan.charAt(start - 1) === '`') start -= 1
    let segmentEnd = end
    for (let index = end; index > start; index -= 1) {
      if (!claimed.has(index)) continue
      formed.add(segmentEnd - index + 1)
      segmentEnd = index - 1
    }
    if (segmentEnd !== end || claimed.has(start)) formed.add(segmentEnd - start + 1)
    else if (escapings[start] !== 'none' && formed.has(end - start + 1)) {
      for (let index = start; index <= end; index += 1) escaped.add(index)
      // Each escaped backtick then stands alone, a string of length one.
      formed.add(1)
    }
    end = start - 1
  }
  return escaped
}

// One emphasis run, the innermost, or every highlight run the line cannot spell.
function unspellableRuns(segments: readonly InlineSegment[], output: string, placements: readonly number[]): MarkRun[] {
  const { nodes, runs } = emittedRuns(segments, placements, output)
  const pair = misflanked(runs) ?? unpaired(runs)
  const run = pair === undefined ? undefined : nodes[pair]
  return run === undefined ? unreadHighlights(segments, output, placements) : [run]
}

// No `==` in text can open or close, and highlights never nest, so a pair reads back where each delimiter flanks.
function unreadHighlights(segments: readonly InlineSegment[], output: string, placements: readonly number[]): MarkRun[] {
  const unread: MarkRun[] = []
  let cursor = 0
  for (const segment of segments) {
    const start = placements[cursor] ?? 0
    cursor += segment.text.length
    if (segment.highlight === undefined) continue
    const flanking = highlightFlanking(output, start)
    const flanks = segment.highlight === 'open' ? flanking.opens : flanking.closes
    if (!flanks && unread.at(-1) !== segment.nodes) unread.push(segment.nodes)
  }
  return unread
}

function misflanked(runs: readonly EmittedRun[]): number | undefined {
  for (const run of runs) {
    for (const delimiter of run.delimiters) {
      if (!(delimiter.closes ? run.canClose : run.canOpen)) return delimiter.pair
    }
  }
  return undefined
}

function unpaired(runs: readonly EmittedRun[]): number | undefined {
  const matched = new Set<number>()
  for (const pairing of matchEmphasis(runs)) {
    const opened = delimiterAt(pairing.opener, false, pairing.openerOffset, pairing.used)
    const closed = delimiterAt(pairing.closer, true, pairing.closerOffset, pairing.used)
    if (opened !== undefined && closed !== undefined && opened.pair === closed.pair) matched.add(opened.pair)
  }
  // The last opener left unpaired is the innermost: the smallest carry that changes the line.
  let innermost: number | undefined
  for (const run of runs) {
    for (const delimiter of run.delimiters) {
      if (!delimiter.closes && !matched.has(delimiter.pair)) innermost = delimiter.pair
    }
  }
  return innermost
}

function delimiterAt(run: EmittedRun, closes: boolean, offset: number, width: number): EmittedDelimiter | undefined {
  return run.delimiters.find((delimiter) => delimiter.closes === closes && delimiter.offset === offset && delimiter.width === width)
}

function emittedRuns(segments: readonly InlineSegment[], placements: readonly number[], output: string): { nodes: MarkRun[]; runs: EmittedRun[] } {
  const runs: EmittedRun[] = []
  const nodes: MarkRun[] = []
  const open: number[] = []
  let cursor = 0
  for (const segment of segments) {
    const start = placements[cursor] ?? 0
    cursor += segment.text.length
    if (segment.emphasis === undefined) continue
    const closes = segment.emphasis === 'close'
    const pair = closes ? (open.pop() ?? nodes.length) : nodes.length
    if (!closes) {
      nodes.push(segment.nodes)
      open.push(pair)
    }
    const width = segment.text.length
    const previous = runs[runs.length - 1]
    if (previous !== undefined && previous.start + previous.length === start && previous.character === segment.text.charAt(0)) {
      previous.delimiters.push({ closes, offset: start - previous.start, pair, width })
      previous.length += width
      continue
    }
    runs.push({
      canClose: false,
      canOpen: false,
      character: segment.text.charAt(0),
      delimiters: [{ closes, offset: 0, pair, width }],
      length: width,
      start,
    })
  }
  for (const run of runs) {
    const flags = delimiterFlags(run.character, charAt(output, run.start - 1), output.charAt(run.start + run.length))
    run.canClose = flags.canClose
    run.canOpen = flags.canOpen
  }
  return { nodes, runs }
}

function isEscapable(escaping: InlineEscaping | undefined): boolean {
  return escaping === 'backslash' || escaping === 'bracketed'
}

export function isSyntax(escaping: InlineEscaping | undefined): boolean {
  return escaping === 'none' || escaping === 'bracketed-link-target'
}

// A hard break is the one spelling that puts a delimiter row under a row of its own, so only a later line claims.
function claimsLineStart(line: ScanLine, index: number, container: LineContainer): boolean {
  if (container !== 'paragraph') return false
  if (index === line.start && line.position === 'later' && isBareDelimiterRow(line.text)) return true
  return escapesLineClaim(line.text, index - line.start, line.position)
}

// Where the closing sequence an ATX heading would read in the text starts, `undefined` where it reads none.
function closingHashes(scan: string): number | undefined {
  let start = scan.length
  while (scan.charAt(start - 1) === '#') start -= 1
  if (start === scan.length) return undefined
  return start === 0 || /[ \t]/.test(scan.charAt(start - 1)) ? start : undefined
}

function scanLine(scan: string, start: number): ScanLine {
  const end = scan.indexOf('\n', start)
  return { position: start === 0 ? 'first' : 'later', start, text: scan.slice(start, end === -1 ? undefined : end) }
}

// A `]` the emitter spelled sits inside a construct that binds before link text does.
function lastLinkClose(scan: string, escapings: readonly (InlineEscaping | undefined)[]): number {
  for (let cursor = scan.length - 1; cursor >= 0; cursor -= 1) {
    if (scan.charAt(cursor) !== ']' || isSyntax(escapings[cursor])) continue
    if (followsLinkText.test(scan.charAt(cursor + 1))) return cursor
  }
  return -1
}

function charAt(text: string, index: number): string {
  return index < 0 ? '' : text.charAt(index)
}

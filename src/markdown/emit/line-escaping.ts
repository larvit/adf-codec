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

// One byte a character, never an array element or Set entry: a line may run to hundreds of millions of characters.
type Escapings = (index: number) => InlineEscaping | undefined

type EscapeWalk = {
  readonly claims: Claims
  readonly container: LineContainer
  readonly escapings: Escapings
  readonly headingCloser: number | undefined
  readonly linkClose: number
  readonly scan: string
}

const escapingCodes: readonly InlineEscaping[] = ['backslash', 'bracketed', 'bracketed-link-target', 'none']

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
    if (!isWordCharacter(scan.charAt(openOffset - 1)) && !isWordCharacter(scan.charAt(closeOffset + 1))) continue
    opener.text = '*'
    segment.text = '*'
  }
  return resolved
}

function escape(segments: readonly InlineSegment[], container: LineContainer, claims: Claims): AssembledLine {
  const scan = segments.map((segment) => segment.text).join('')
  const codes = new Uint8Array(scan.length)
  let start = 0
  for (const segment of segments) {
    codes.fill(escapingCodes.indexOf(segment.escaping), start, start + segment.text.length)
    start += segment.text.length
  }
  const escapings: Escapings = (index) => {
    const code = codes[index]
    return code === undefined ? undefined : escapingCodes[code]
  }
  const escaped = escapeClaims(scan, escapings, container, claims)
  escapeClosedRuns(scan, escapings, escaped)
  const { output, placements } = backslashed(segments, scan, escaped)
  if (container === 'paragraph' && opensLinkDefinition(output)) {
    if (segments[0]?.nodes !== undefined) return { line: output, openingLinkAsDirective: true, unspellableRuns: [] }
    return { line: `\\${output}`, unspellableRuns: unspellableRuns(segments, output, placements) }
  }
  return { line: output, unspellableRuns: unspellableRuns(segments, output, placements) }
}

// The output, and where each segment's first character landed in it.
function backslashed(segments: readonly InlineSegment[], scan: string, escaped: Uint8Array): { output: string; placements: number[] } {
  // Joined a few thousand pieces at a time: an array element per escape would cost more than the character it escapes.
  const chunks: string[] = []
  let pieces: string[] = []
  let from = 0
  for (let index = escaped.indexOf(1); index !== -1; index = escaped.indexOf(1, index + 1)) {
    pieces.push(scan.slice(from, index), '\\')
    from = index
    if (pieces.length < 4096) continue
    chunks.push(pieces.join(''))
    pieces = []
  }
  pieces.push(scan.slice(from))
  chunks.push(pieces.join(''))
  const placements: number[] = []
  let escapes = 0
  let next = escaped.indexOf(1)
  let start = 0
  for (const segment of segments) {
    while (next !== -1 && next <= start) {
      escapes += 1
      next = escaped.indexOf(1, next + 1)
    }
    placements.push(start + escapes)
    start += segment.text.length
  }
  return { output: chunks.join(''), placements }
}

function escapeClaims(scan: string, escapings: Escapings, container: LineContainer, claims: Claims): Uint8Array {
  const walk: EscapeWalk = {
    claims,
    container,
    escapings,
    headingCloser: container === 'heading' ? closingHashes(scan) : undefined,
    linkClose: lastLinkClose(scan, escapings),
    scan,
  }
  const escaped = new Uint8Array(scan.length)
  let line = scanLine(scan, 0)
  let index = 0
  while (index < scan.length) {
    while (index > line.start + line.text.length) line = scanLine(scan, line.start + line.text.length + 1)
    if (runCharacters.includes(scan.charAt(index))) {
      const end = index + runLength(scan, index)
      runEscapes(walk, index, end, line, escaped)
      index = end
      continue
    }
    const token = readInlineToken(scan, index, claims)
    const claimed = claimsCharacter(walk, index, token, line)
    if (claimed) escaped[index] = 1
    // The reader takes a `==` whole, so its second `=` starts nothing unless the first is escaped.
    index += !claimed && token.kind === 'highlight' ? token.width : 1
  }
  return escaped
}

// A text character beside one of the emitter's delimiters would lengthen that delimiter's run, so every text character in such a run escapes.
function runEscapes(walk: EscapeWalk, start: number, end: number, line: ScanLine, escaped: Uint8Array): void {
  const { escapings, scan } = walk
  if (runHolds(escapings, start, end, isSyntax) && runHolds(escapings, start, end, isEscapable)) {
    for (let index = start; index < end; index += 1) if (isEscapable(escapings(index))) escaped[index] = 1
    return
  }
  for (let index = start; index < end; index += 1) {
    // A backtick run escapes whole: a bare rest would be a shorter backtick string, which can close a span an earlier run opens.
    const claimed = (index > start && scan.charAt(index) === '`') || claimsRunRest(walk, index, end, line)
    if (!claimed) break
    escaped[index] = 1
  }
}

function runHolds(escapings: Escapings, start: number, end: number, kind: (escaping: InlineEscaping | undefined) => boolean): boolean {
  for (let index = start; index < end; index += 1) if (kind(escapings(index))) return true
  return false
}

function claimsRunRest({ claims, container, escapings, scan }: EscapeWalk, index: number, end: number, line: ScanLine): boolean {
  const escaping = escapings(index)
  if (escaping === 'bracketed-link-target') return readInlineToken(scan, index, claims).kind === 'code-span'
  if (!isEscapable(escaping)) return false
  if (claimsLineStart(line, index, container)) return true
  const token = scan.charAt(index) === '`' ? readInlineToken(scan, index, claims) : delimiterRunToken(scan, index, end - index, claims)
  return token.kind !== 'text'
}

function claimsCharacter({ container, escapings, headingCloser, linkClose, scan }: EscapeWalk, index: number, token: InlineToken, line: ScanLine): boolean {
  const escaping = escapings(index)
  if (escaping === 'bracketed-link-target') return token.kind === 'directive'
  if (!isEscapable(escaping)) return false
  if (index === headingCloser || claimsLineStart(line, index, container)) return true
  switch (token.kind) {
    case 'autolink':
    case 'code-span':
    case 'delimiter-run':
    case 'directive':
    case 'entity':
    case 'escape':
    case 'hard-break':
    case 'html':
      return true
    case 'bracket':
      if (token.image) return isSyntax(escapings(index + 1))
      return escaping === 'bracketed' || index < linkClose
    case 'bracket-close':
      return escaping === 'bracketed'
    case 'highlight':
      return token.opens || token.closes
    // A backslash before a line ending reads as a hard break, so no line ending escapes.
    case 'line-ending':
    case 'text': {
      const character = scan.charAt(index)
      if (character === '|') return container === 'table-cell'
      return character === '{' && scan.charAt(index - 1) === ']' && isSyntax(escapings(index - 1))
    }
  }
}

// CommonMark reads no escape inside a code span, so a backtick string left beside an escape still closes a span that an earlier bare run of its length opens.
// The walk runs backwards and escapes only the run it just read, so every index it reads still holds the claims alone.
function escapeClosedRuns(scan: string, escapings: Escapings, escaped: Uint8Array): void {
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
      if (escaped[index] !== 1) continue
      formed.add(segmentEnd - index + 1)
      segmentEnd = index - 1
    }
    if (segmentEnd !== end || escaped[start] === 1) formed.add(segmentEnd - start + 1)
    else if (escapings(start) !== 'none' && formed.has(end - start + 1)) {
      escaped.fill(1, start, end + 1)
      // Each escaped backtick then stands alone, a string of length one.
      formed.add(1)
    }
    end = start - 1
  }
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
  for (const [index, segment] of segments.entries()) {
    const start = placements[index] ?? 0
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
  for (const [index, segment] of segments.entries()) {
    const start = placements[index] ?? 0
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
    const flags = delimiterFlags(run.character, output.charAt(run.start - 1), output.charAt(run.start + run.length))
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

// The start of the closing sequence an ATX heading would read at the text's end.
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
function lastLinkClose(scan: string, escapings: Escapings): number {
  for (let cursor = scan.length - 1; cursor >= 0; cursor -= 1) {
    if (scan.charAt(cursor) !== ']' || isSyntax(escapings(cursor))) continue
    if (followsLinkText.test(scan.charAt(cursor + 1))) return cursor
  }
  return -1
}

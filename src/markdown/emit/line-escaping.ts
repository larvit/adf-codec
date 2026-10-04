import type { Flavour } from '../plain/conventions.ts'
import type { LineContainer } from '../line-container.ts'
import { backslashEscape, escapesLineClaim, inlineHtmlConstruct, opensBracketedAutolink, opensEmailAutolink, type LinePosition } from '../commonmark/grammar.ts'
import { backtickRun, closingBacktickRun } from '../commonmark/backtick-runs.ts'
import { claimsDirectivePrefix } from '../directive-syntax.ts'
import { delimiterFlags, isWordCharacter, matchEmphasis, runLength } from '../commonmark/emphasis-matching.ts'
import { highlightDelimiter, highlightFlanking } from '../plain/conventions.ts'
import { isBareDelimiterRow } from '../pipe-table-syntax.ts'
import { opensLinkDefinition } from '../commonmark/link-reference-definitions.ts'
import { readEntityReference } from '../commonmark/entity-references.ts'

export type DelimiterRole = 'close' | 'open'

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

const delimiters = ['*', '_', '`', '~']

const followsLinkText = /[([]/

export function assembleInlineLine(segments: readonly InlineSegment[], container: LineContainer, flavour: Flavour): AssembledLine {
  return escape(resolveEmphasis(segments), container, flavour === 'plain')
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

function escape(segments: readonly InlineSegment[], container: LineContainer, highlights: boolean): AssembledLine {
  const scan = segments.map((segment) => segment.text).join('')
  const escapings: InlineEscaping[] = []
  for (const segment of segments) for (let index = 0; index < segment.text.length; index += 1) escapings.push(segment.escaping)
  const escaped = escapeClosedRuns(scan, escapings, escapeClaims(scan, escapings, container, highlights))
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

function escapeClaims(scan: string, escapings: readonly InlineEscaping[], container: LineContainer, highlights: boolean): ReadonlySet<number> {
  const escaped = new Set<number>()
  const linkClose = lastLinkClose(scan, escapings)
  let line = scanLine(scan, 0)
  let afterEscape = false
  // Whether the `=` before opens a `==` the reader takes whole, so this one starts nothing.
  let pairsEquals = false
  for (let index = 0; index < scan.length; index += 1) {
    if (index > line.start + line.text.length) line = scanLine(scan, line.start + line.text.length + 1)
    const escaping = escapings[index]
    const escapable = escaping === 'backslash' || escaping === 'bracketed'
    const opensEquals: boolean = highlights && !pairsEquals && scan.startsWith(highlightDelimiter, index)
    const claimed: boolean =
      (escapable &&
        ((opensEquals && claimsHighlight(scan, index)) ||
          claimsLineStart(line, index, container) ||
          mergesWithSyntax(scan, escapings, index) ||
          opensConstruct(scan, linkClose, index, escaping === 'bracketed', container, afterEscape))) ||
      (escaping === 'bracketed-link-target' &&
        ((scan.charAt(index) === '`' && opensCodeSpan(scan, index, afterEscape)) || claimsDirectivePrefix(scan, index)))
    if (claimed) escaped.add(index)
    afterEscape = claimed
    pairsEquals = opensEquals && !claimed
  }
  return escaped
}

// Like an emphasis run, a `==` in text escapes where the reader can open or close with it.
function claimsHighlight(scan: string, index: number): boolean {
  const flanking = highlightFlanking(scan, index)
  return flanking.opens || flanking.closes
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

function mergesWithSyntax(scan: string, escapings: readonly (InlineEscaping | undefined)[], index: number): boolean {
  const character = scan.charAt(index)
  if (character === '!') return scan.charAt(index + 1) === '[' && isSyntax(escapings[index + 1])
  if (character === '{') return scan.charAt(index - 1) === ']' && isSyntax(escapings[index - 1])
  if (!delimiters.includes(character)) return false
  return touchesSyntax(scan, escapings, index, -1) || touchesSyntax(scan, escapings, index, 1)
}

function touchesSyntax(scan: string, escapings: readonly (InlineEscaping | undefined)[], index: number, step: number): boolean {
  const character = scan.charAt(index)
  let cursor = index + step
  while (scan.charAt(cursor) === character && !isSyntax(escapings[cursor])) cursor += step
  return scan.charAt(cursor) === character && isSyntax(escapings[cursor])
}

export function isSyntax(escaping: InlineEscaping | undefined): boolean {
  return escaping === 'none' || escaping === 'bracketed-link-target'
}

function opensConstruct(
  scan: string,
  linkClose: number,
  index: number,
  inBrackets: boolean,
  container: LineContainer,
  afterEscape: boolean,
): boolean {
  if (container === 'heading' && closesHeading(scan, index)) return true
  return claimsCharacter(scan, linkClose, index, inBrackets, container, afterEscape)
}

// A hard break is the one spelling that puts a delimiter row under a row of its own, so only a later line claims.
function claimsLineStart(line: ScanLine, index: number, container: LineContainer): boolean {
  if (container !== 'paragraph') return false
  if (index === line.start && line.position === 'later' && isBareDelimiterRow(line.text)) return true
  return escapesLineClaim(line.text, index - line.start, line.position)
}

function scanLine(scan: string, start: number): ScanLine {
  const end = scan.indexOf('\n', start)
  return { position: start === 0 ? 'first' : 'later', start, text: scan.slice(start, end === -1 ? undefined : end) }
}

function closesHeading(scan: string, index: number): boolean {
  if (scan.charAt(index) !== '#' || !/^#+$/.test(scan.slice(index))) return false
  return index === 0 || /[ \t]/.test(scan.charAt(index - 1))
}

function claimsCharacter(
  scan: string,
  linkClose: number,
  index: number,
  inBrackets: boolean,
  container: LineContainer,
  afterEscape: boolean,
): boolean {
  const character = scan.charAt(index)
  if (inBrackets && (character === '[' || character === ']')) return true
  if (character === '|') return container === 'table-cell'
  if (character === '\\') return backslashEscape(scan, index) !== undefined
  if (character === '&') return readEntityReference(scan, index) !== undefined
  if (character === '<') return opensBracketedAutolink(scan, index) || opensEmailAutolink(scan, index) || inlineHtmlConstruct(scan, index) !== undefined
  if (character === '!') return claimsDirectivePrefix(scan, index)
  if (character === '[') return index < linkClose
  if (character === '`') return opensCodeSpan(scan, index, afterEscape)
  if (character === '*' || character === '_' || character === '~') return claimsEmphasis(scan, index, afterEscape)
  return false
}

// A `]` the emitter spelled sits inside a construct that binds before link text does.
function lastLinkClose(scan: string, escapings: readonly (InlineEscaping | undefined)[]): number {
  for (let cursor = scan.length - 1; cursor >= 0; cursor -= 1) {
    if (scan.charAt(cursor) !== ']' || isSyntax(escapings[cursor])) continue
    if (followsLinkText.test(scan.charAt(cursor + 1))) return cursor
  }
  return -1
}

function opensCodeSpan(scan: string, index: number, afterEscape: boolean): boolean {
  // A run escapes whole: a rest left bare would be a raw run of another length for a closer.
  if (afterEscape && scan.charAt(index - 1) === '`') return true
  if (!startsRun(scan, index, afterEscape)) return false
  const opener = backtickRun(scan, index)
  return closingBacktickRun(scan, index + opener, opener) !== undefined
}

function claimsEmphasis(scan: string, index: number, afterEscape: boolean): boolean {
  if (!startsRun(scan, index, afterEscape)) return false
  const character = scan.charAt(index)
  const length = runLength(scan, index)
  if (character === '~' && length !== 2) return false
  const flags = delimiterFlags(character, index === 0 ? '' : scan.charAt(index - 1), scan.charAt(index + length))
  return flags.canClose || flags.canOpen
}

function startsRun(scan: string, index: number, afterEscape: boolean): boolean {
  if (index === 0 || afterEscape) return true
  return scan.charAt(index - 1) !== scan.charAt(index)
}

function charAt(text: string, index: number): string {
  return index < 0 ? '' : text.charAt(index)
}

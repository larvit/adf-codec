import { backtickRun, closingBacktickRun } from '../backtick-runs.ts'
import { delimiterFlags, isWordCharacter, matchEmphasis, runLength } from '../emphasis-matching.ts'
import { backslashEscape, escapesLineClaim, inlineHtmlConstruct, opensBracketedAutolink, opensEmailAutolink, type LinePosition } from '../commonmark-grammar.ts'
import { isBareDelimiterRow } from '../pipe-table-syntax.ts'
import { opensInlineDirective } from '../directive-syntax.ts'
import { readEntityReference } from '../entity-references.ts'

export type EmphasisRole = 'close' | 'open'

export type InlineEscaping = 'backslash' | 'bracketed' | 'none'

export type NodeRange = { first: number; last: number }

export type InlineSegment =
  | { emphasis: EmphasisRole; escaping: 'none'; nodes: NodeRange; text: string }
  | { emphasis?: undefined; escaping: InlineEscaping; text: string }

export type AssembledLine = { line: string; unspellableRun: NodeRange | undefined }

type ScanLine = { position: LinePosition; start: number; text: string }

export type LineContainer = 'heading' | 'paragraph' | 'table-cell'

type EmittedDelimiter = { closes: boolean; offset: number; pair: number; width: number }

type EmittedRun = { canClose: boolean; canOpen: boolean; character: string; delimiters: EmittedDelimiter[]; length: number; start: number }

const delimiters = ['*', '_', '`', '~']

// The `:` keeps a `[label]: url` line escaped: unescaped, the parser swallows it as a link reference definition.
const followsLinkText = /[([:]/

export function assembleInlineLine(segments: readonly InlineSegment[], container: LineContainer): AssembledLine {
  return escape(resolveEmphasis(segments), container)
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

function escape(segments: readonly InlineSegment[], container: LineContainer): AssembledLine {
  const scan = segments.map((segment) => segment.text).join('')
  const escapings: InlineEscaping[] = []
  for (const segment of segments) for (let index = 0; index < segment.text.length; index += 1) escapings.push(segment.escaping)
  const escaped = new Set<number>()
  const placements: number[] = []
  let output = ''
  const linkClose = lastLinkClose(scan, escapings)
  let line = scanLine(scan, 0)
  for (let index = 0; index < scan.length; index += 1) {
    if (index > line.start + line.text.length) line = scanLine(scan, line.start + line.text.length + 1)
    const escaping = escapings[index]
    const escapable = escaping === 'backslash' || escaping === 'bracketed'
    if (
      escapable &&
      (claimsLineStart(line, index, container) ||
        mergesWithSyntax(scan, escapings, index) ||
        opensConstruct(scan, linkClose, index, escaping === 'bracketed', container, escaped))
    ) {
      output += '\\'
      escaped.add(index)
    }
    placements.push(output.length)
    output += scan.charAt(index)
  }
  return { line: output, unspellableRun: unspellableRun(segments, output, placements) }
}

function unspellableRun(segments: readonly InlineSegment[], output: string, placements: readonly number[]): NodeRange | undefined {
  const { nodes, runs } = emittedRuns(segments, placements, output)
  const pair = misflanked(runs) ?? unpaired(runs)
  return pair === undefined ? undefined : nodes[pair]
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

function emittedRuns(segments: readonly InlineSegment[], placements: readonly number[], output: string): { nodes: NodeRange[]; runs: EmittedRun[] } {
  const runs: EmittedRun[] = []
  const nodes: NodeRange[] = []
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

function isSyntax(escaping: InlineEscaping | undefined): boolean {
  return escaping === 'none'
}

function opensConstruct(
  scan: string,
  linkClose: number,
  index: number,
  inBrackets: boolean,
  container: LineContainer,
  escaped: ReadonlySet<number>,
): boolean {
  if (container === 'heading' && closesHeading(scan, index)) return true
  return claimsCharacter(scan, linkClose, index, inBrackets, container, escaped)
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
  escaped: ReadonlySet<number>,
): boolean {
  const character = scan.charAt(index)
  if (inBrackets && (character === '[' || character === ']')) return true
  if (character === '|') return container === 'table-cell'
  if (character === '\\') return backslashEscape(scan, index) !== undefined
  if (character === '&') return readEntityReference(scan, index) !== undefined
  if (character === '<') return opensBracketedAutolink(scan, index) || opensEmailAutolink(scan, index) || inlineHtmlConstruct(scan, index) !== undefined
  if (character === ':') return opensInlineDirective(scan, index)
  if (character === '[') return index < linkClose
  if (character === '`') return opensCodeSpan(scan, index, escaped)
  if (character === '*' || character === '_' || character === '~') return claimsEmphasis(scan, index, escaped)
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

function opensCodeSpan(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const opener = backtickRun(scan, index)
  return closingBacktickRun(scan, index + opener, opener) !== undefined
}

function claimsEmphasis(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const character = scan.charAt(index)
  const length = runLength(scan, index)
  if (character === '~' && length !== 2) return false
  const flags = delimiterFlags(character, index === 0 ? '' : scan.charAt(index - 1), scan.charAt(index + length))
  return flags.canClose || flags.canOpen
}

function startsRun(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (index === 0 || escaped.has(index - 1)) return true
  return scan.charAt(index - 1) !== scan.charAt(index)
}

function charAt(text: string, index: number): string {
  return index < 0 ? '' : text.charAt(index)
}

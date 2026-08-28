import { delimiterFlags, isWordCharacter, matchEmphasis } from '../emphasis-matching.ts'
import {
  escapesLineClaim,
  isAsciiPunctuation,
  opensBracketedAutolink,
  opensHtmlConstruct,
  startsEntityReference,
  type LinePosition,
} from '../commonmark-grammar.ts'
import { opensInlineDirective } from '../directive-attributes.ts'

export type EmphasisRole = 'close' | 'open'

export type InlineEscaping = 'backslash' | 'bracketed' | 'none'

export type NodeRange = { first: number; last: number }

export type InlineSegment =
  | { emphasis: EmphasisRole; escaping: 'none'; nodes: NodeRange; text: string }
  | { emphasis?: undefined; escaping: InlineEscaping; text: string }

export type AssembledLine = { line: string; unspellableRun: NodeRange | undefined }

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
  for (let index = 0; index < scan.length; index += 1) {
    const escaping = escapings[index]
    const escapable = escaping === 'backslash' || escaping === 'bracketed'
    if (escapable && (mergesWithSyntax(scan, escapings, index) || opensConstruct(scan, escapings, index, escaping === 'bracketed', container, escaped))) {
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
  escapings: readonly (InlineEscaping | undefined)[],
  index: number,
  inBrackets: boolean,
  container: LineContainer,
  escaped: ReadonlySet<number>,
): boolean {
  if (container === 'heading' && closesHeading(scan, index)) return true
  if (container === 'paragraph' && claimsLineStart(scan, index)) return true
  return claimsCharacter(scan, escapings, index, inBrackets, container, escaped)
}

function claimsLineStart(scan: string, index: number): boolean {
  const start = scan.lastIndexOf('\n', index - 1) + 1
  const end = scan.indexOf('\n', index)
  const line = scan.slice(start, end === -1 ? undefined : end)
  const position: LinePosition = start === 0 ? 'first' : 'later'
  return escapesLineClaim(line, index - start, position)
}

function closesHeading(scan: string, index: number): boolean {
  if (scan.charAt(index) !== '#' || !/^#+$/.test(scan.slice(index))) return false
  return index === 0 || /[ \t]/.test(scan.charAt(index - 1))
}

function claimsCharacter(
  scan: string,
  escapings: readonly (InlineEscaping | undefined)[],
  index: number,
  inBrackets: boolean,
  container: LineContainer,
  escaped: ReadonlySet<number>,
): boolean {
  const character = scan.charAt(index)
  const rest = scan.slice(index)
  if (inBrackets && (character === '[' || character === ']')) return true
  if (character === '|') return container === 'table-cell'
  if (character === '\\') return isAsciiPunctuation(scan.charAt(index + 1))
  if (character === '&') return startsEntityReference(rest)
  if (character === '<') return opensBracketedAutolink(rest) || opensHtmlConstruct(rest)
  if (character === ':') return opensInlineDirective(rest)
  if (character === '[') return opensLink(scan, escapings, index)
  if (character === '`') return opensCodeSpan(scan, index, escaped)
  if (character === '*' || character === '_' || character === '~') return claimsEmphasis(scan, index, escaped)
  return false
}

// A `]` the emitter spelled sits inside a construct that binds before link text does.
function opensLink(scan: string, escapings: readonly (InlineEscaping | undefined)[], index: number): boolean {
  for (let cursor = index + 1; cursor < scan.length; cursor += 1) {
    if (scan.charAt(cursor) !== ']' || isSyntax(escapings[cursor])) continue
    if (followsLinkText.test(scan.charAt(cursor + 1))) return true
  }
  return false
}

function opensCodeSpan(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const length = runLength(scan, index)
  return new RegExp('(?<!`)`{' + length + '}(?!`)').test(scan.slice(index + length))
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

function runLength(scan: string, index: number): number {
  const character = scan.charAt(index)
  let length = 0
  while (scan.charAt(index + length) === character) length += 1
  return length
}

function charAt(text: string, index: number): string {
  return index < 0 ? '' : text.charAt(index)
}

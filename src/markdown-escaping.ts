import { escapesLineClaim, isUnicodeWhitespace, opensBracketedAutolink, startsEntityReference, type LinePosition } from './commonmark-grammar.ts'

export type InlineSegment =
  | { kind: 'emphasis-close' | 'emphasis-open'; mark: string; text: string }
  | { kind: 'link-text' | 'literal' | 'syntax'; text: string }

export type AssembledLine = { line: string; unspellableMark: string | undefined }

export type LineContainer = 'heading' | 'paragraph' | 'table-cell'

type DelimiterRun = { character: string; closeMark: string | undefined; end: number; openMark: string | undefined; start: number }

const delimiters = ['*', '_', '`', '~']

const asciiPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/
const htmlConstructs = [/^<[!?]/, /^<\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)/, /^<[^\s<>@]+@[^\s<>@]+>/]
const inlineDirective = /^:[a-z][A-Za-z0-9]*[[{]/
const linkOpener = /\](?=[([:])/
const unicodePunctuation = /[\p{P}\p{S}]/u

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
    if (segment.kind === 'emphasis-open') open.push(index)
    if (segment.kind !== 'emphasis-close') continue
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
  const kinds: InlineSegment['kind'][] = []
  for (const segment of segments) for (let index = 0; index < segment.text.length; index += 1) kinds.push(segment.kind)
  const escaped = new Set<number>()
  const placements: number[] = []
  let output = ''
  for (let index = 0; index < scan.length; index += 1) {
    const kind = kinds[index]
    const escapable = kind === 'literal' || kind === 'link-text'
    if (escapable && (mergesWithSyntax(scan, kinds, index) || opensConstruct(scan, index, kind === 'link-text', container, escaped))) {
      output += '\\'
      escaped.add(index)
    }
    placements.push(output.length)
    output += scan.charAt(index)
  }
  return { line: output, unspellableMark: unspellableMark(segments, output, placements) }
}

function unspellableMark(segments: readonly InlineSegment[], output: string, placements: readonly number[]): string | undefined {
  for (const run of delimiterRuns(segments, placements)) {
    const before = charAt(output, run.start - 1)
    const after = output.charAt(run.end)
    if (run.openMark !== undefined && !isLeftFlanking(before, after)) return run.openMark
    if (run.closeMark !== undefined && !isRightFlanking(before, after)) return run.closeMark
  }
  return undefined
}

function delimiterRuns(segments: readonly InlineSegment[], placements: readonly number[]): DelimiterRun[] {
  const runs: DelimiterRun[] = []
  let cursor = 0
  for (const segment of segments) {
    const start = placements[cursor] ?? 0
    cursor += segment.text.length
    if (segment.kind !== 'emphasis-close' && segment.kind !== 'emphasis-open') continue
    const closes = segment.kind === 'emphasis-close'
    const end = start + segment.text.length
    const previous = runs[runs.length - 1]
    if (previous !== undefined && previous.end === start && previous.character === segment.text.charAt(0)) {
      previous.closeMark = previous.closeMark ?? (closes ? segment.mark : undefined)
      previous.end = end
      previous.openMark = previous.openMark ?? (closes ? undefined : segment.mark)
      continue
    }
    runs.push({
      character: segment.text.charAt(0),
      closeMark: closes ? segment.mark : undefined,
      end,
      openMark: closes ? undefined : segment.mark,
      start,
    })
  }
  return runs
}

function mergesWithSyntax(scan: string, kinds: readonly (InlineSegment['kind'] | undefined)[], index: number): boolean {
  const character = scan.charAt(index)
  if (character === '!') return scan.charAt(index + 1) === '[' && isSyntax(kinds[index + 1])
  if (!delimiters.includes(character)) return false
  return touchesSyntax(scan, kinds, index, -1) || touchesSyntax(scan, kinds, index, 1)
}

function touchesSyntax(scan: string, kinds: readonly (InlineSegment['kind'] | undefined)[], index: number, step: number): boolean {
  const character = scan.charAt(index)
  let cursor = index + step
  while (scan.charAt(cursor) === character && !isSyntax(kinds[cursor])) cursor += step
  return scan.charAt(cursor) === character && isSyntax(kinds[cursor])
}

function isSyntax(kind: InlineSegment['kind'] | undefined): boolean {
  return kind === 'emphasis-close' || kind === 'emphasis-open' || kind === 'syntax'
}

function opensConstruct(scan: string, index: number, inLinkText: boolean, container: LineContainer, escaped: ReadonlySet<number>): boolean {
  if (container === 'heading' && closesHeading(scan, index)) return true
  if (container === 'paragraph' && claimsLineStart(scan, index)) return true
  return claimsCharacter(scan, index, inLinkText, container, escaped)
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

function claimsCharacter(scan: string, index: number, inLinkText: boolean, container: LineContainer, escaped: ReadonlySet<number>): boolean {
  const character = scan.charAt(index)
  const rest = scan.slice(index)
  if (inLinkText && (character === '[' || character === ']')) return true
  if (character === '|') return container === 'table-cell'
  if (character === '\\') return asciiPunctuation.test(scan.charAt(index + 1))
  if (character === '&') return startsEntityReference(rest)
  if (character === '<') return opensBracketedAutolink(rest) || htmlConstructs.some((construct) => construct.test(rest))
  if (character === ':') return inlineDirective.test(rest)
  if (character === '[') return linkOpener.test(rest)
  if (character === '`') return opensCodeSpan(scan, index, escaped)
  if (character === '*' || character === '_' || character === '~') return opensEmphasis(scan, index, escaped)
  return false
}

function opensCodeSpan(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const length = runLength(scan, index)
  return new RegExp('(?<!`)`{' + length + '}(?!`)').test(scan.slice(index + length))
}

function opensEmphasis(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const character = scan.charAt(index)
  const length = runLength(scan, index)
  const before = index === 0 ? '' : scan.charAt(index - 1)
  const after = scan.charAt(index + length)
  if (character === '~') return length === 2 && isLeftFlanking(before, after)
  if (!isLeftFlanking(before, after)) return false
  if (character === '*') return true
  return !isRightFlanking(before, after) || isPunctuation(before)
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

function isLeftFlanking(before: string, after: string): boolean {
  if (isWhitespace(after)) return false
  if (!isPunctuation(after)) return true
  return isWhitespace(before) || isPunctuation(before)
}

function isRightFlanking(before: string, after: string): boolean {
  if (isWhitespace(before)) return false
  if (!isPunctuation(before)) return true
  return isWhitespace(after) || isPunctuation(after)
}

function isPunctuation(character: string): boolean {
  return character !== '' && unicodePunctuation.test(character)
}

function isWhitespace(character: string): boolean {
  return character === '' || isUnicodeWhitespace(character)
}

function isWordCharacter(character: string): boolean {
  return character !== '' && !isUnicodeWhitespace(character) && !unicodePunctuation.test(character)
}

function charAt(text: string, index: number): string {
  return index < 0 ? '' : text.charAt(index)
}

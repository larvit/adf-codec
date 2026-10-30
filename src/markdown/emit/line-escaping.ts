import type { Claims, WrittenFlavour } from '../flavour.ts'
import type { InlineReading } from '../inline-content.ts'
import type { InlineSource, InlineToken } from '../inline-tokens.ts'
import type { LineContainer } from '../line-container.ts'
import { delimiterRunToken, highlightFlanking, inlineSource, readInlineToken } from '../inline-tokens.ts'
import { escapesLineClaim, type LinePosition } from '../commonmark/grammar.ts'
import { flavourClaims } from '../flavour.ts'
import { isBareDelimiterRow } from '../pipe-table-syntax.ts'
import { delimiterFlags, isWordCharacter, runLength } from '../commonmark/emphasis-matching.ts'
import { opensLinkDefinition } from '../commonmark/link-reference-definitions.ts'
import { readLineBack } from '../inline-content.ts'

export type DelimiterRole = 'close' | 'open'

// A segment's kind: `backslash` text, `bracketed` text inside `[…]` (link text, alt, a directive's content), `bracketed-link-target` syntax: a link target inside `[…]`, `none` syntax written as is.
export type InlineEscaping = (typeof escapingCodes)[number]

export type NodeRange = { first: number; last: number }

// `depth` is the index into each node's marks array that the run spells.
export type MarkRun = NodeRange & { depth: number }

export type InlineSegment =
  | { emphasis: DelimiterRole; escaping: 'none'; highlight?: undefined; nodes: MarkRun; text: string }
  | { emphasis?: undefined; escaping: 'none'; highlight: DelimiterRole; nodes: MarkRun; text: string }
  | { emphasis?: undefined; escaping: 'none'; highlight?: undefined; nodes: NodeRange; text: string }
  | { emphasis?: undefined; escaping: InlineEscaping; highlight?: undefined; nodes?: undefined; text: string }

export type AssembledLine = { line: string; openingLinkAsDirective?: true; unspellableRuns: MarkRun[] }

// How the caller takes a run back: a carry swaps its nodes for one carry directive, splitting every run holding it; a drop removes its mark, moving no other delimiter where `alone` holds.
export type RunFallback = { kind: 'carry' } | { alone: (run: MarkRun) => boolean; kind: 'drop' }

type ScanLine = { position: LinePosition; start: number; text: string }

// An emphasis run's delimiters, written alike, by index into the placed segments.
type EmphasisPair = { closer: number; delimiter: string; nodes: MarkRun; opener: number }

type Escapings = (index: number) => InlineEscaping | undefined

// Which emphasis pairs fall: go back in this pass with the first misread one. `fallen` flags each pair settled to fall.
type PairSweep = {
  readonly fallback: RunFallback
  readonly fallen: Uint8Array
  readonly first: number
  // The ends of every run whose drop is not alone: dropping it can merge the runs meeting there.
  readonly merging: ReadonlySet<number>
  readonly output: string
  // The pair each placed segment delimits, -1 where it delimits none.
  readonly pairAt: Int32Array
  readonly pairs: readonly EmphasisPair[]
  readonly placed: readonly PlacedSegment[]
}

// Where a segment's first character landed in the output.
type PlacedSegment = { segment: InlineSegment; start: number }

// The escaped line once reading it back asks for no further escape.
type ReadBack = { output: string; placed: PlacedSegment[]; reading: InlineReading }

// Which of a run's characters escape: every escapable one, or every one before `end`.
type RunEscapes = { end: number; escapable: false } | { escapable: true }

// How a pair stands while another falls: `either` where it may fall before the judged one.
type Standing = 'either' | 'gone' | 'there'

// Which text characters escape wherever they stand: one of them opened a construct when the line was read back.
type TextEscapes = { backticks: boolean; brackets: boolean }

type EscapeWalk = {
  readonly claims: Claims
  readonly container: LineContainer
  readonly escapings: Escapings
  readonly headingCloser: number | undefined
  readonly inline: InlineSource
}

const escapingCodes: readonly ['backslash', 'bracketed', 'bracketed-link-target', 'none'] = ['backslash', 'bracketed', 'bracketed-link-target', 'none']

const runCharacters = '*_`~'

export function assembleInlineLine(segments: readonly InlineSegment[], container: LineContainer, flavour: WrittenFlavour, fallback: RunFallback): AssembledLine {
  return escape(resolveEmphasis(segments), container, flavourClaims[flavour], fallback)
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

function escape(segments: readonly InlineSegment[], container: LineContainer, claims: Claims, fallback: RunFallback): AssembledLine {
  const { output, placed, reading } = readBack(segments, container, claims)
  return { ...guardLinkDefinition(output, placed, container), unspellableRuns: unspellableRuns(placed, reading, output, fallback) }
}

function readBack(segments: readonly InlineSegment[], container: LineContainer, claims: Claims): ReadBack {
  const scan = segments.map((segment) => segment.text).join('')
  // One byte a character, never an array element or Set entry: a line may run to hundreds of millions of characters.
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
  const claimed = escapeClaims(scan, escapings, container, claims)
  let escapes: TextEscapes = { backticks: false, brackets: false }
  // At most three passes: each pass that doesn't return turns on at least one more of the two escape kinds.
  for (;;) {
    const { output, placed } = backslashed(segments, scan, withTextEscapes(scan, escapings, claimed, escapes))
    const { faulted, reading } = readLineBack(output, container, claims)
    const shown = textOpeners(placed, output.length, reading)
    // A text backtick in a directive's slot can open a code span past the slot's `]`: the directive faults before the reader records that span.
    const opened = faulted && !shown.backticks && !shown.brackets ? { backticks: true, brackets: true } : shown
    const next = { backticks: escapes.backticks || opened.backticks, brackets: escapes.brackets || opened.brackets }
    if (next.backticks === escapes.backticks && next.brackets === escapes.brackets) return { output, placed, reading }
    escapes = next
  }
}

// spec/flavour.md, Canonical form.
function guardLinkDefinition(output: string, placed: readonly PlacedSegment[], container: LineContainer): { line: string; openingLinkAsDirective?: true } {
  if (container !== 'paragraph' || !opensLinkDefinition(output)) return { line: output }
  return opensWithLink(placed) ? { line: output, openingLinkAsDirective: true } : { line: `\\${output}` }
}

// Only the emitter's link opener is a `[` segment spelling nodes.
function opensWithLink([first]: readonly PlacedSegment[]): boolean {
  return first?.segment.nodes !== undefined && first.segment.text === '['
}

function withTextEscapes(scan: string, escapings: Escapings, claimed: Uint8Array, { backticks, brackets }: TextEscapes): Uint8Array {
  if (!backticks && !brackets) return claimed
  const escaped = claimed.slice()
  for (let index = 0; index < scan.length; index += 1) {
    const character = scan.charAt(index)
    if (((backticks && character === '`') || (brackets && character === '[')) && isEscapable(escapings(index))) escaped[index] = 1
  }
  return escaped
}

// A construct the reader opened at a text character is one the line does not mean.
function textOpeners(placed: readonly PlacedSegment[], length: number, reading: InlineReading): TextEscapes {
  const text = new Uint8Array(length)
  for (const [index, { segment, start }] of placed.entries()) {
    if (isEscapable(segment.escaping)) text.fill(1, start, placed[index + 1]?.start ?? length)
  }
  return { backticks: reading.codeSpans.some((at) => text[at] === 1), brackets: reading.links.some((at) => text[at] === 1) }
}

function backslashed(segments: readonly InlineSegment[], scan: string, escaped: Uint8Array): { output: string; placed: PlacedSegment[] } {
  // The output joins 4096 pieces at a time: an array element per escape would cost more than the character it escapes.
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
  const placed: PlacedSegment[] = []
  let escapes = 0
  let next = escaped.indexOf(1)
  let start = 0
  for (const segment of segments) {
    while (next !== -1 && next <= start) {
      escapes += 1
      next = escaped.indexOf(1, next + 1)
    }
    placed.push({ segment, start: start + escapes })
    start += segment.text.length
  }
  return { output: chunks.join(''), placed }
}

function escapeClaims(scan: string, escapings: Escapings, container: LineContainer, claims: Claims): Uint8Array {
  const walk: EscapeWalk = {
    claims,
    container,
    escapings,
    headingCloser: container === 'heading' ? closingHashes(scan) : undefined,
    inline: inlineSource(scan),
  }
  const escaped = new Uint8Array(scan.length)
  let line = scanLine(scan, 0)
  let index = 0
  while (index < scan.length) {
    while (index > line.start + line.text.length) line = scanLine(scan, line.start + line.text.length + 1)
    if (runCharacters.includes(scan.charAt(index))) {
      const end = index + runLength(scan, index)
      const run = runEscapes(walk, index, end, line)
      if (!run.escapable) escaped.fill(1, index, run.end)
      else for (let at = index; at < end; at += 1) if (isEscapable(escapings(at))) escaped[at] = 1
      index = end
      continue
    }
    const token = readInlineToken(walk.inline, index, claims)
    const claimed = claimsCharacter(walk, index, token, line)
    if (claimed) escaped[index] = 1
    // The reader takes a `==` whole, so its second `=` starts nothing unless the first is escaped.
    index += !claimed && token.kind === 'highlight' ? token.width : 1
  }
  return escaped
}

// A text character beside one of the emitter's delimiters would lengthen that delimiter's run, so every text character in such a run escapes.
function runEscapes(walk: EscapeWalk, start: number, end: number, line: ScanLine): RunEscapes {
  const { escapings, inline: { text: scan } } = walk
  if (runHolds(escapings, start, end, isSyntax) && runHolds(escapings, start, end, isEscapable)) return { escapable: true }
  let index = start
  // A backtick run escapes whole: a bare rest would be a shorter backtick string, which can close a span an earlier run opens.
  while (index < end && ((index > start && scan.charAt(index) === '`') || claimsRunRest(walk, index, end, line))) index += 1
  return { end: index, escapable: false }
}

function runHolds(escapings: Escapings, start: number, end: number, kind: (escaping: InlineEscaping | undefined) => boolean): boolean {
  for (let index = start; index < end; index += 1) if (kind(escapings(index))) return true
  return false
}

function claimsRunRest({ claims, container, escapings, inline }: EscapeWalk, index: number, end: number, line: ScanLine): boolean {
  const scan = inline.text
  const escaping = escapings(index)
  if (escaping === 'bracketed-link-target') return readInlineToken(inline, index, claims).kind === 'code-span'
  if (!isEscapable(escaping)) return false
  if (claimsLineStart(line, index, container)) return true
  const token = scan.charAt(index) === '`' ? readInlineToken(inline, index, claims) : delimiterRunToken(scan, index, end - index, claims)
  return token.kind !== 'text'
}

function claimsCharacter({ container, escapings, headingCloser, inline: { text: scan } }: EscapeWalk, index: number, token: InlineToken, line: ScanLine): boolean {
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
      return token.image ? isSyntax(escapings(index + 1)) : escaping === 'bracketed'
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

// The runs this pass takes back: the first emphasis run the line misreads and every run that falls with it, else every misflanked highlight run. One misread emphasis pair can re-pair the delimiters after it.
function unspellableRuns(placed: readonly PlacedSegment[], reading: InlineReading, output: string, fallback: RunFallback): MarkRun[] {
  const { pairAt, pairs } = emphasisPairs(placed)
  const first = pairs.findIndex((pair) => !readAsWritten(reading, placed, pair))
  const firstPair = pairs[first]
  if (firstPair === undefined) return misflankedHighlights(placed, output)
  const merging = new Set<number>()
  if (fallback.kind === 'drop') for (const { nodes } of pairs) if (!fallback.alone(nodes)) merging.add(nodes.first).add(nodes.last + 1)
  const sweep: PairSweep = { fallback, fallen: new Uint8Array(pairs.length), first, merging, output, pairAt, pairs, placed }
  sweep.fallen[first] = 1
  // Each verdict reads the verdicts settled before it, so the sweep settles outward from the first pair.
  for (let judged = first + 1; judged < pairs.length; judged += 1) if (fallsWithFirst(sweep, judged)) sweep.fallen[judged] = 1
  for (let judged = first - 1; judged >= 0; judged -= 1) if (fallsWithFirst(sweep, judged)) sweep.fallen[judged] = 1
  const runs = [firstPair.nodes]
  for (const [index, pair] of pairs.entries()) if (index !== first && sweep.fallen[index] === 1) runs.push(pair.nodes)
  return runs
}

// The pairs in closing order.
function emphasisPairs(placed: readonly PlacedSegment[]): { pairAt: Int32Array; pairs: EmphasisPair[] } {
  const pairAt = new Int32Array(placed.length).fill(-1)
  const pairs: EmphasisPair[] = []
  const openers: { at: number; nodes: MarkRun }[] = []
  for (const [at, { segment }] of placed.entries()) {
    if (segment.emphasis === 'open') openers.push({ at, nodes: segment.nodes })
    const opener = segment.emphasis === 'close' ? openers.pop() : undefined
    if (opener === undefined) continue
    pairAt[opener.at] = pairs.length
    pairAt[at] = pairs.length
    pairs.push({ closer: at, delimiter: segment.text, nodes: opener.nodes, opener: opener.at })
  }
  return { pairAt, pairs }
}

// No `==` in text can open or close, and highlights never nest, so a highlight run reads back where both its delimiters flank.
function misflankedHighlights(placed: readonly PlacedSegment[], output: string): MarkRun[] {
  const misflanked: MarkRun[] = []
  for (const { segment, start } of placed) {
    if (segment.highlight !== undefined && !highlightFlanks(output, start, segment.highlight) && misflanked.at(-1) !== segment.nodes) misflanked.push(segment.nodes)
  }
  return misflanked
}

// A pair falls with the first where one run per pass would take it back too: one of its delimiters cannot flank however the unsettled pairs fall.
function fallsWithFirst(sweep: PairSweep, judged: number): boolean {
  if (!fallsCleanly(sweep, judged)) return false
  const spellings = pairSpellings(sweep, judged, judged)
  return spellings !== undefined && spellings.every((character) => !mayFlank(sweep, judged, character, 'opener') || (!mayFlank(sweep, judged, character, 'closer') && !holdsAlike(sweep, judged, character)))
}

// An opener that may open can pair with a delimiter of its own character inside, so one run per pass may take back a pair standing there first.
function holdsAlike({ fallen, pairs }: PairSweep, judged: number, character: string): boolean {
  const pair = pairs[judged]
  for (let held = judged - 1; pair !== undefined && held >= 0; held -= 1) {
    const inner = pairs[held]
    if (inner === undefined || inner.closer < pair.opener) return false
    if (fallen[held] === 0 && (inner.delimiter.length === 1 ? character !== '~' : inner.delimiter.startsWith(character))) return true
  }
  return false
}

// A carry splits every pair holding it, so a pair falls cleanly under a carry only where it holds no pair spanning fewer nodes, and under a drop only where no run merges at its ends.
function fallsCleanly({ fallback, merging, pairs }: PairSweep, judged: number): boolean {
  const pair = pairs[judged]
  if (pair === undefined) return false
  return fallback.kind === 'drop' ? !mergesAt(merging, pair) : !holdsEarlier(pairs, judged, pair)
}

function mergesAt(merging: ReadonlySet<number>, { nodes }: EmphasisPair): boolean {
  return merging.has(nodes.first) || merging.has(nodes.last + 1)
}

// CommonMark judges a delimiter by the characters either side of its whole run of `character`.
function mayFlank(sweep: PairSweep, judged: number, character: string, end: 'closer' | 'opener'): boolean {
  const at = sweep.pairs[judged]?.[end] ?? -1
  const before = runEdge(sweep, judged, at, -1, character)
  const after = runEdge(sweep, judged, at, 1, character)
  if (before === undefined || after === undefined) return true
  return before.some((left) =>
    after.some((right) => {
      const flags = delimiterFlags(character, left, right)
      return end === 'opener' ? flags.canOpen : flags.canClose
    }),
  )
}

// The characters that may stand past the run of `character` holding the delimiter at `from`; `undefined` where a pair beside may move.
function runEdge(sweep: PairSweep, judged: number, from: number, step: -1 | 1, character: string): string[] | undefined {
  const found: string[] = []
  // Past the run stands the character after its last delimiter: a backslash where the text beside is escaped, which the next segment's start skips.
  let edge = delimiterEdge(sweep.placed, from, step)
  for (let at = from + step; ; at += step) {
    const segment = sweep.placed[at]?.segment
    const other = sweep.pairAt[at] ?? -1
    if (segment === undefined || (other === -1 && segment.text !== '')) break
    if (other === -1) continue
    const standing = pairStanding(sweep, judged, other)
    const spellings = standing === 'gone' ? [] : pairSpellings(sweep, judged, other)
    if (standing === undefined || spellings === undefined) return undefined
    for (const spelling of spellings) if (spelling !== character) found.push(spelling)
    if (standing === 'there' && !spellings.includes(character)) return found
    edge = delimiterEdge(sweep.placed, at, step)
  }
  found.push(sweep.output.charAt(step === 1 ? edge : edge - 1))
  return found
}

function delimiterEdge(placed: readonly PlacedSegment[], at: number, step: -1 | 1): number {
  const delimiter = placed[at]
  if (delimiter === undefined) return 0
  return step === 1 ? delimiter.start + delimiter.segment.text.length : delimiter.start
}

// How the other pair stands when the judged one falls. Where the judged pair closes after the first, every pair closing after it still stands, since the judged pair is then the first that cannot read as written; `undefined` where a carry or a merge may move the other's delimiters.
function pairStanding({ fallback, fallen, first, merging, pairs }: PairSweep, judged: number, other: number): Standing | undefined {
  const pair = pairs[other]
  if (other === judged) return 'there'
  if (pair === undefined || mergesAt(merging, pair)) return undefined
  if (other > judged && judged > first) return 'there'
  // Under a carry, pairs spanning the same nodes stand and fall together.
  if (fallback.kind === 'carry') return spansAlike(pair, pairs[judged]) ? 'there' : undefined
  return fallen[other] === 1 ? 'gone' : 'either'
}

// The characters the other pair may be written with when the judged one falls: em takes `_`, turning `*` beside a word character.
function pairSpellings(sweep: PairSweep, judged: number, other: number): string[] | undefined {
  const pair = sweep.pairs[other]
  if (pair === undefined) return undefined
  if (pair.delimiter.length > 1) return [pair.delimiter.charAt(0)]
  // The carry's punctuation stands where the split pair meets it.
  if (sweep.fallback.kind === 'carry' && other !== judged && holdsEarlier(sweep.pairs, judged, pair)) return ['*', '_']
  const before = wordBeside(sweep, judged, pair.opener, -1)
  const after = wordBeside(sweep, judged, pair.closer, 1)
  if (before === undefined || after === undefined) return undefined
  const spellings: string[] = []
  if (before.includes(true) || after.includes(true)) spellings.push('*')
  if (before.includes(false) && after.includes(false)) spellings.push('_')
  return spellings
}

// Whether a word character may stand beside the delimiter at `from` as resolveEmphasis reads the line, for each way the unsettled pairs fall.
function wordBeside(sweep: PairSweep, judged: number, from: number, step: -1 | 1): boolean[] | undefined {
  const found: boolean[] = []
  for (let at = from + step; ; at += step) {
    const segment = sweep.placed[at]?.segment
    const other = sweep.pairAt[at] ?? -1
    if (segment !== undefined && segment.text === '') continue
    if (segment === undefined || other === -1) {
      found.push(segment !== undefined && isWordCharacter(segment.text.charAt(step === 1 ? 0 : segment.text.length - 1)))
      return found
    }
    const standing = pairStanding(sweep, judged, other)
    if (standing === undefined) return undefined
    if (standing === 'gone') continue
    found.push(false)
    if (standing === 'there') return found
  }
}

// Whether the pair holds one a carry may take before the judged one. Pairs close in order, so the judged pair, or one holding it, holds such a pair only where it holds the last of them to close.
function holdsEarlier(pairs: readonly EmphasisPair[], judged: number, pair: EmphasisPair): boolean {
  let earlier = judged - 1
  while (spansAlike(pairs[earlier], pairs[judged])) earlier -= 1
  const held = pairs[earlier]
  return held !== undefined && pair.nodes.first <= held.nodes.first && held.nodes.last <= pair.nodes.last
}

function spansAlike(pair: EmphasisPair | undefined, other: EmphasisPair | undefined): boolean {
  return pair !== undefined && other !== undefined && pair.nodes.first === other.nodes.first && pair.nodes.last === other.nodes.last
}

function highlightFlanks(output: string, start: number, role: DelimiterRole): boolean {
  const flanking = highlightFlanking(output, start)
  return role === 'open' ? flanking.opens : flanking.closes
}

function readAsWritten(reading: InlineReading, placed: readonly PlacedSegment[], pair: EmphasisPair): boolean {
  const read = reading.emphasis.get(placed[pair.opener]?.start ?? -1)
  return read !== undefined && read.closer === placed[pair.closer]?.start && read.width === pair.delimiter.length
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

import type { AdfNode } from '../../adf/document.ts'
import type { DelimiterRole, MarkRun, PlacedSegment } from './line-escaping.ts'
import type { InlineReading } from '../inline-content.ts'
import { delimiterFlags, isWordCharacter } from '../commonmark/emphasis-matching.ts'
import { highlightFlanking } from '../inline-tokens.ts'
import { nodeMarks } from '../../adf/document.ts'

// How the caller takes a run back: a carry swaps its nodes for one carry directive, splitting every run holding it; a drop removes its mark from the line's `nodes`.
export type RunFallback = { kind: 'carry' } | { kind: 'drop'; nodes: readonly AdfNode[] }

// An emphasis run's delimiters, written alike, by index into the placed segments.
type EmphasisPair = { closer: number; delimiter: string; nodes: MarkRun; opener: number }

// The pairs in closing order, and what the sweep has settled about them.
type PairSweep = {
  readonly fallback: RunFallback
  // 1 where the pair is settled to fall.
  readonly fallen: Uint8Array
  readonly first: number
  // The node index at each end of a run whose drop is not alone.
  readonly mergingEnds: ReadonlySet<number>
  readonly output: string
  // The pair each placed segment delimits, -1 where it delimits none.
  readonly pairAt: Int32Array
  readonly pairs: readonly EmphasisPair[]
  readonly placed: readonly PlacedSegment[]
}

// How another pair stands when the judged one falls: `moves` where a carry or a merge may move its delimiters, `unsettled` where it may stand or be gone.
type Standing = 'fallen' | 'moves' | 'stands' | 'unsettled'

// The runs this pass takes back: the first emphasis run the line misreads and every run that falls with it, else every misflanked highlight run. docs/decisions.md §Beside the first misread emphasis run, a pass takes back only runs one run per pass would take back too.
export function unspellableRuns(placed: readonly PlacedSegment[], reading: InlineReading, output: string, fallback: RunFallback): MarkRun[] {
  const { pairAt, pairs } = emphasisPairs(placed)
  const first = pairs.findIndex((pair) => !readAsWritten(reading, placed, pair))
  const firstPair = pairs[first]
  if (firstPair === undefined) return misflankedHighlights(placed, output)
  const sweep: PairSweep = { fallback, fallen: new Uint8Array(pairs.length), first, mergingEnds: mergingEnds(pairs, fallback), output, pairAt, pairs, placed }
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

function readAsWritten(reading: InlineReading, placed: readonly PlacedSegment[], pair: EmphasisPair): boolean {
  const read = reading.emphasis.get(placed[pair.opener]?.start ?? -1)
  return read !== undefined && read.closer === placed[pair.closer]?.start && read.width === pair.delimiter.length
}

// No `==` in text can open or close, and highlights never nest, so a highlight run reads back where both its delimiters flank.
function misflankedHighlights(placed: readonly PlacedSegment[], output: string): MarkRun[] {
  const misflanked: MarkRun[] = []
  for (const { segment, start } of placed) {
    if (segment.highlight !== undefined && !highlightFlanks(output, start, segment.highlight) && misflanked.at(-1) !== segment.nodes) misflanked.push(segment.nodes)
  }
  return misflanked
}

function highlightFlanks(output: string, start: number, role: DelimiterRole): boolean {
  const flanking = highlightFlanking(output, start)
  return role === 'open' ? flanking.opens : flanking.closes
}

function mergingEnds(pairs: readonly EmphasisPair[], fallback: RunFallback): Set<number> {
  const ends = new Set<number>()
  if (fallback.kind === 'drop') for (const { nodes } of pairs) if (!dropsAlone(fallback.nodes, nodes)) ends.add(nodes.first).add(nodes.last + 1)
  return ends
}

// Dropping the run merges no runs and moves no run's end, whatever else drops: at each end, the node outside holds no mark type the end node holds inside the run's mark.
function dropsAlone(nodes: readonly AdfNode[], run: MarkRun): boolean {
  return endsAlone(nodes[run.first], nodes[run.first - 1], run.depth) && endsAlone(nodes[run.last], nodes[run.last + 1], run.depth)
}

function endsAlone(edge: AdfNode | undefined, beside: AdfNode | undefined, depth: number): boolean {
  const besideTypes = new Set(nodeMarks(beside ?? {}).map((mark) => mark.type))
  return nodeMarks(edge ?? {})
    .slice(depth + 1)
    .every((mark) => !besideTypes.has(mark.type))
}

// A pair falls with the first only where one run per pass would take it back too: it falls cleanly, and cannot read however it is written.
function fallsWithFirst(sweep: PairSweep, judged: number): boolean {
  if (!fallsCleanly(sweep, judged)) return false
  const spellings = pairSpellings(sweep, judged, judged)
  return spellings !== undefined && spellings.every((character) => cannotRead(sweep, judged, character))
}

// A carry splits every pair holding it, so a pair falls cleanly under a carry only where it holds no pair spanning fewer nodes, and under a drop only where no run merges at its ends.
function fallsCleanly({ fallback, mergingEnds, pairs }: PairSweep, judged: number): boolean {
  const pair = pairs[judged]
  if (pair === undefined) return false
  return fallback.kind === 'drop' ? !mergesAt(mergingEnds, pair) : !holdsPairBefore(pairs, judged, pair)
}

function mergesAt(mergingEnds: ReadonlySet<number>, { nodes }: EmphasisPair): boolean {
  return mergingEnds.has(nodes.first) || mergingEnds.has(nodes.last + 1)
}

// An opener that may open can pair with a delimiter of its own character inside, so one run per pass may take back a pair standing there first.
function cannotRead(sweep: PairSweep, judged: number, character: string): boolean {
  if (!mayFlank(sweep, judged, character, 'opener')) return true
  return !mayFlank(sweep, judged, character, 'closer') && !holdsAlike(sweep, judged, character)
}

// Whether the judged pair holds a pair not settled to fall that may be written with `character`. Pairs close in order, so the pairs it holds close just before it.
function holdsAlike({ fallen, pairs }: PairSweep, judged: number, character: string): boolean {
  const pair = pairs[judged]
  for (let held = judged - 1; pair !== undefined && held >= 0; held -= 1) {
    const inner = pairs[held]
    if (inner === undefined || inner.closer < pair.opener) return false
    if (fallen[held] === 0 && mayBeWrittenWith(inner, character)) return true
  }
  return false
}

// Em may be written `*` or `_`, strong and strike only with their own character.
function mayBeWrittenWith(pair: EmphasisPair, character: string): boolean {
  return pair.delimiter.length === 1 ? character !== '~' : pair.delimiter.startsWith(character)
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
  const { delimiters } = touching(sweep, from, step)
  for (const at of delimiters) {
    const other = sweep.pairAt[at] ?? -1
    const standing = pairStanding(sweep, judged, other)
    if (standing === 'moves') return undefined
    const spellings = standing === 'fallen' ? [] : pairSpellings(sweep, judged, other)
    if (spellings === undefined) return undefined
    for (const spelling of spellings) if (spelling !== character) found.push(spelling)
    if (standing === 'stands' && !spellings.includes(character)) return found
  }
  // Past the run stands the character after its last delimiter: a backslash where the text beside is escaped, which the next segment's start skips.
  const edge = delimiterEdge(sweep.placed, delimiters.at(-1) ?? from, step)
  found.push(sweep.output.charAt(step === 1 ? edge : edge - 1))
  return found
}

// Whether a word character may stand beside the delimiter at `from` as resolveEmphasis reads the line, for each way the unsettled pairs fall.
function wordBeside(sweep: PairSweep, judged: number, from: number, step: -1 | 1): boolean[] | undefined {
  const found: boolean[] = []
  const { delimiters, next } = touching(sweep, from, step)
  for (const at of delimiters) {
    const standing = pairStanding(sweep, judged, sweep.pairAt[at] ?? -1)
    if (standing === 'moves') return undefined
    if (standing === 'fallen') continue
    found.push(false)
    if (standing === 'stands') return found
  }
  const text = sweep.placed[next]?.segment.text ?? ''
  found.push(isWordCharacter(text.charAt(step === 1 ? 0 : text.length - 1)))
  return found
}

// The delimiters touching the one at `from`, nearest first, and the segment holding text past them; an empty segment touches both sides.
function touching({ pairAt, placed }: PairSweep, from: number, step: -1 | 1): { delimiters: number[]; next: number } {
  const delimiters: number[] = []
  let next = from + step
  for (let segment = placed[next]?.segment; segment !== undefined; segment = placed[next]?.segment) {
    if ((pairAt[next] ?? -1) !== -1) delimiters.push(next)
    else if (segment.text !== '') break
    next += step
  }
  return { delimiters, next }
}

function delimiterEdge(placed: readonly PlacedSegment[], at: number, step: -1 | 1): number {
  const delimiter = placed[at]
  if (delimiter === undefined) return 0
  return step === 1 ? delimiter.start + delimiter.segment.text.length : delimiter.start
}

// How the other pair stands when the judged one falls; docs/decisions.md §Beside the first misread emphasis run, a pass takes back only runs one run per pass would take back too derives each case.
function pairStanding({ fallback, fallen, first, mergingEnds, pairs }: PairSweep, judged: number, other: number): Standing {
  const pair = pairs[other]
  if (other === judged) return 'stands'
  if (pair === undefined || mergesAt(mergingEnds, pair)) return 'moves'
  if (other > judged && judged > first) return 'stands'
  if (fallback.kind === 'carry') return spanSameNodes(pair, pairs[judged]) ? 'stands' : 'moves'
  return fallen[other] === 1 ? 'fallen' : 'unsettled'
}

// The characters the other pair may be written with when the judged one falls: em takes `_`, turning `*` beside a word character.
function pairSpellings(sweep: PairSweep, judged: number, other: number): string[] | undefined {
  const pair = sweep.pairs[other]
  if (pair === undefined) return undefined
  if (pair.delimiter.length > 1) return [pair.delimiter.charAt(0)]
  // The carry's punctuation stands where the split pair meets it.
  if (sweep.fallback.kind === 'carry' && other !== judged && holdsPairBefore(sweep.pairs, judged, pair)) return ['*', '_']
  const before = wordBeside(sweep, judged, pair.opener, -1)
  const after = wordBeside(sweep, judged, pair.closer, 1)
  if (before === undefined || after === undefined) return undefined
  const spellings: string[] = []
  if (before.includes(true) || after.includes(true)) spellings.push('*')
  if (before.includes(false) && after.includes(false)) spellings.push('_')
  return spellings
}

// Whether the pair holds one closing before the judged one over other nodes: one a carry may take back first. Pairs close in order, so it holds such a pair only where it holds the last of them to close.
function holdsPairBefore(pairs: readonly EmphasisPair[], judged: number, pair: EmphasisPair): boolean {
  let earlier = judged - 1
  while (spanSameNodes(pairs[earlier], pairs[judged])) earlier -= 1
  const held = pairs[earlier]
  return held !== undefined && pair.nodes.first <= held.nodes.first && held.nodes.last <= pair.nodes.last
}

function spanSameNodes(pair: EmphasisPair | undefined, other: EmphasisPair | undefined): boolean {
  return pair !== undefined && other !== undefined && pair.nodes.first === other.nodes.first && pair.nodes.last === other.nodes.last
}

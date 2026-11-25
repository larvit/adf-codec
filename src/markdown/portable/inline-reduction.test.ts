import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import type { PortableLineFallback } from '../emit/inline-line.ts'
import type { RunGrouping, RunNode } from '../emit/inline-runs.ts'
import { inlineRuns } from '../emit/inline-runs.ts'
import { lineContainer, markedLine, propertyRuns } from '../../conformance/property-harness.ts'
import { portableJudgement, portableLeaves, portableLink, reduceInline, trimmedEdges, trimmedEdgesPass, trimmingRuns, trimPass, withoutFallback } from './inline-reduction.ts'
import { success, type Result } from '../../result.ts'

test('reduces a line alike dropping every run a pass may or the first alone', () => {
  fc.assert(
    fc.property(markedLine, lineContainer, (nodes, container) => {
      assert.deepEqual(reduceInline(nodes, container, { depth: 0, path: [], sources: new Map() }), firstRunLine(nodes, container))
    }),
    // Lines the fixed seed rarely generates: a later run must not drop with the first, or one pass drops every copy of a repeated mark run.
    {
      ...propertyRuns(3000),
      examples: [
        [[{ attrs: { id: 'a' }, type: 'mention' }, { marks: [{ type: 'strike' }, { type: 'strong' }], text: 'un*', type: 'text' }, { marks: [{ type: 'strong' }], text: '[', type: 'text' }, { text: 'a ', type: 'text' }, { text: ' ', type: 'text' }], 'heading'],
        [[{ marks: [{ type: 'strong' }], text: '-', type: 'text' }, { text: '0', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: 'un ', type: 'text' }, { text: ' ', type: 'text' }], 'heading'],
        [[{ marks: [{ type: 'em' }, { type: 'strike' }], text: '`', type: 'text' }, { text: 'a ', type: 'text' }, { marks: [{ type: 'strike' }], text: 'un', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }, { marks: [{ type: 'underline' }], text: 'z', type: 'text' }], 'heading'],
        [[1, 2, 3].flatMap(() => [{ text: 'un', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }]), 'paragraph'],
        [[1, 2, 3].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strike' }, { type: 'strong' }], text: '(', type: 'text' }, { attrs: { id: 'a' }, type: 'mention' }]), 'paragraph'],
        [[{ text: 'z', type: 'text' }, ...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'strike' }], text: '(b', type: 'text' }, { marks: [{ type: 'em' }], text: '(b', type: 'text' }])], 'paragraph'],
        [[...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'strike' }], text: 'b(', type: 'text' }, { marks: [{ type: 'em' }], text: 'b(', type: 'text' }]), { text: 'z', type: 'text' }], 'paragraph'],
        [[...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strong' }], text: '(', type: 'text' }, { marks: [{ type: 'em' }], text: '(', type: 'text' }]), { text: 'a', type: 'text' }], 'paragraph'],
        [[...[1, 2, 3, 4, 5].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strong' }], text: '~** ', type: 'text' }, { marks: [{ type: 'em' }], text: '- _', type: 'text' }]), { text: 'r', type: 'text' }], 'table-cell'],
        [[{ marks: [{ type: 'em' }, { type: 'strike' }], text: '-', type: 'text' }, { text: 'a(.', type: 'text' }, ...[1, 2, 3, 4, 5].flatMap(() => [{ marks: [{ type: 'strong' }, { type: 'strike' }, { type: 'em' }], text: '0.-', type: 'text' }, { marks: [{ type: 'link' }], text: 'un', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'em' }, { type: 'strong' }], text: '=', type: 'text' }]), { marks: [{ type: 'strong' }, { type: 'em' }], text: '[', type: 'text' }, { text: '`=', type: 'text' }], 'table-cell'],
        [[...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strong' }], text: ' ~~ ', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strike' }, { type: 'strong' }], text: ')', type: 'text' }]), { text: 'a', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'strong' }], text: '.unun', type: 'text' }], 'heading'],
      ],
    },
  )
})

test('refuses an opening-link fallback whose link run holds no code span', () => {
  const link = { attrs: { href: 'u' }, type: 'link' }
  const lines: AdfNode[][] = [
    [{ marks: [link], text: 'a', type: 'text' }],
    [{ marks: [link, { type: 'em' }], text: 'a', type: 'text' }],
    [{ marks: [link], text: 'a', type: 'text' }, { marks: [{ type: 'code' }], text: 'c', type: 'text' }],
  ]
  for (const line of lines) {
    const refused = withoutFallback(line, { kind: 'opening-link' }, [])
    assert.equal(refused.ok ? 'kept' : refused.error.code, 'unsupported-node-shape')
  }
})

test('takes code off every node of an opening link\'s run that an opening-link fallback names', () => {
  const link = { attrs: { href: 'u' }, type: 'link' }
  const line: AdfNode[] = [{ marks: [link, { type: 'code' }], text: 'a', type: 'text' }, { marks: [link], text: 'b', type: 'text' }]
  assert.deepEqual(withoutFallback(line, { kind: 'opening-link' }, []), success([{ marks: [link], text: 'a', type: 'text' }, { marks: [link], text: 'b', type: 'text' }]))
})

test('refuses an unspellable-run fallback that takes no mark', () => {
  const refused = withoutFallback([{ marks: [{ type: 'em' }], text: 'a', type: 'text' }], { kind: 'unspellable-run', runs: [{ first: 0, last: 0, mark: { type: 'strike' } }] }, [])
  assert.equal(refused.ok ? 'kept' : refused.error.code, 'unsupported-node-shape')
})

const groupings: readonly RunGrouping[] = ['parted', 'spanned']
const link: AdfMark = { attrs: { href: 'u' }, type: 'link' }
const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })
const trimMarks = fc.oneof(
  fc.uniqueArray(fc.constantFrom<AdfMark>({ type: 'backgroundColor' }, { type: 'em' }, link, { attrs: { href: 'v' }, type: 'link' }, { type: 'strike' }, { type: 'strong' }), { maxLength: 3, selector: (held) => held.type }),
  fc.constantFrom<AdfMark[]>([{ type: 'code' }], [link, { type: 'code' }]),
)
const trimLeaf = fc.oneof(
  { arbitrary: fc.record({ marks: trimMarks, text: fc.string({ maxLength: 3, minLength: 1, unit: fc.constantFrom(' ', ' ', '\t', 'x') }) }).map(({ marks, text }): AdfNode => (marks.length === 0 ? { text, type: 'text' } : { marks, text, type: 'text' })), weight: 6 },
  { arbitrary: fc.constant<AdfNode>({ type: 'hardBreak' }), weight: 1 },
)
const trimLine = fc.oneof(
  fc.array(trimLeaf, { maxLength: 12, minLength: 1 }),
  fc.tuple(fc.array(trimLeaf, { maxLength: 2 }), fc.array(trimLeaf, { maxLength: 3, minLength: 1 }), fc.integer({ max: 8, min: 2 }), fc.array(trimLeaf, { maxLength: 2 })).map(([head, unit, repeats, tail]) => [...head, ...Array.from({ length: repeats }, () => unit).flat(), ...tail]),
)

for (const grouping of groupings) {
  test(`trims a ${grouping} line as the reference counts trim it, in no more passes`, () => {
    fc.assert(
      fc.property(trimLine, (line) => {
        const peeled = trimmedWith(line, (leaves) => trimPass(leaves, (held) => runsSharedWithNext(held, grouping)))
        const trimmed = trimmedWith(line, (leaves) => trimmedEdgesPass(leaves, grouping))
        assert.deepEqual(trimmedEdges(line, grouping), peeled.line)
        assert.ok(trimmed.passes <= peeled.passes, `${trimmed.passes} passes against ${peeled.passes}`)
      }),
      propertyRuns(3000),
    )
  })
}

test('counts a run crossing a code span to its next holder where the line is spanned, and none where it is parted', () => {
  const line = [marked('Run ', { type: 'strong' }), marked('npm ci', { type: 'code' }), marked(' first', { type: 'strong' })]
  assert.deepEqual(trimmingRuns(line, 'spanned'), [1, 1, 0])
  assert.deepEqual(trimmingRuns(line, 'parted'), [0, 0, 0])
})

test('counts every nested run crossing a hard break, and none crossing a hard break whose marks are empty', () => {
  assert.deepEqual(trimmingRuns([marked('a', { type: 'em' }, { type: 'strong' }), { type: 'hardBreak' }, marked('b', { type: 'em' }, { type: 'strong' })], 'spanned'), [2, 2, 0])
  assert.deepEqual(trimmingRuns([marked('a', { type: 'em' }), { marks: [], type: 'hardBreak' }, marked('b', { type: 'em' })], 'spanned'), [0, 0, 0])
})

test('counts an emphasis run from its first to its last leaf holding more than spaces and tabs, and a link run to its last leaf', () => {
  const line = [marked(' \t', link, { type: 'em' }), marked('x', link, { type: 'code' }), marked('a', link, { type: 'em' }), marked('x', link, { type: 'code' }), marked('b', link, { type: 'em' }), marked('x', link, { type: 'code' }), marked(' ', link, { type: 'em' })]
  assert.deepEqual(trimmingRuns(line, 'spanned'), [1, 1, 2, 2, 1, 1, 0])
})

test('counts a run nested in an emphasis run from the emphasis run\'s first leaf holding more than spaces and tabs', () => {
  const line = [marked(' ', { type: 'em' }), marked('x', { type: 'code' }), marked('a', { type: 'em' }, { type: 'strong' }), marked('x', { type: 'code' }), marked('b', { type: 'em' }, { type: 'strong' })]
  assert.deepEqual(trimmingRuns(line, 'spanned'), [0, 0, 2, 2, 0])
})

test('counts an emphasis run to a leaf holding it and no text, which the trim never changes', () => {
  assert.deepEqual(trimmingRuns([marked('a', { type: 'em' }), marked('x', { type: 'code' }), { attrs: { id: 'a' }, marks: [{ type: 'em' }], type: 'mention' }], 'spanned'), [1, 1, 0])
})

const alternatingLines: readonly [string, AdfNode, AdfNode][] = [
  ['a code space beside an emphasized space', marked(' ', { type: 'code' }), marked(' ', { type: 'em' })],
  ['code x beside an emphasized space', marked('x', { type: 'code' }), marked(' ', { type: 'em' })],
  ['linked code x beside a linked emphasized space', marked('x', link, { type: 'code' }), marked(' ', link, { type: 'em' })],
]
for (const [name, code, emphasized] of alternatingLines) {
  test(`trims a line of ${name}, 1 000 leaves long, in as many passes as its 6-leaf form`, () => {
    const alternating = (pairs: number) => Array.from({ length: pairs }, () => [code, emphasized]).flat()
    assert.equal(trimmedWith(alternating(500), spannedPass).passes, trimmedWith(alternating(3), spannedPass).passes)
  })
}

const blankLines: readonly [string, (blanks: number) => AdfNode[]][] = [
  ['blanks alternating linked and unmarked, then a hard break and a linked leaf', (blanks) => [...alternatingBlanks(blanks, marked(' ', link), marked(' ')), { type: 'hardBreak' }, marked('x', link)]],
  ['an emphasized leaf and a hard break, then blanks alternating emphasized and emphasized linked, then an emphasized leaf', (blanks) => [marked('a', { type: 'em' }), { type: 'hardBreak' }, ...alternatingBlanks(blanks, marked(' ', { type: 'em' }), marked(' ', { type: 'em' }, link)), marked('b', { type: 'em' })]],
]
for (const [name, line] of blankLines) {
  test(`trims ${name}, 1 000 blanks long, in as many passes as its 6-blank form`, () => {
    assert.equal(trimmedWith(line(1000), spannedPass).passes, trimmedWith(line(6), spannedPass).passes)
  })
}

const em: AdfMark = { type: 'em' }
const replayedLines: readonly [string, AdfNode[], AdfNode[]][] = [
  ['the lead whitespace a dropped blank leaves at the line start', [marked(' ', em), marked(' x')], [{ text: 'x', type: 'text' }]],
  ['the trail whitespace dropped blanks leave before a hard break', [marked('x ', link), marked(' ', em, link), marked(' ', link), marked(' ', em, link), { type: 'hardBreak' }, marked('y', link)], [marked('x', link), { type: 'hardBreak' }, marked('y', link)]],
  ['the lead whitespace dropped blanks leave after a hard break', [marked('y', link), { type: 'hardBreak' }, marked(' ', em, link), marked(' ', link), marked(' ', em, link), marked(' x', link)], [marked('y', link), { type: 'hardBreak' }, marked('x', link)]],
  ['both edges of a leaf whose lead whitespace reaches a line edge two rounds before its trail whitespace', [marked('y', link), { type: 'hardBreak' }, marked(' ', link), { text: '  x  ', type: 'text' }, marked(' ', link), { text: ' ', type: 'text' }, marked(' ', link), { type: 'hardBreak' }, marked('y', link)], [marked('y', link), { type: 'hardBreak' }, { text: 'x', type: 'text' }, { type: 'hardBreak' }, marked('y', link)]],
  ['both edges of a leaf whose trail whitespace reaches a line edge two rounds before its lead whitespace', [marked('y', link), { type: 'hardBreak' }, marked(' ', link), { text: ' ', type: 'text' }, marked(' ', link), { text: '  x  ', type: 'text' }, marked(' ', link), { type: 'hardBreak' }, marked('y', link)], [marked('y', link), { type: 'hardBreak' }, { text: 'x', type: 'text' }, { type: 'hardBreak' }, marked('y', link)]],
]
for (const [name, line, trimmed] of replayedLines) {
  test(`trims ${name} in 2 passes`, () => {
    assert.deepEqual(trimmedWith(line, spannedPass), { line: trimmed, passes: 2 })
  })
}

for (const [name, line] of blankLines) {
  test(`reads the text of each leaf it keeps in ${name}, 1 000 blanks long, as often as in its 6-blank form`, () => {
    assert.equal(keptTextReads(line(1000)), keptTextReads(line(6)))
  })
}

test('trims a line whose link run crosses a leaf holding no text as a leaf a pass would', () => {
  const mention: AdfNode = { attrs: { id: 'a' }, type: 'mention' }
  const line = [marked(' ', link), marked(' '), { type: 'hardBreak' }, marked(' ', link), mention, marked(' '), { type: 'hardBreak' }, marked(' x', link)]
  assert.deepEqual(trimmedEdges(line, 'spanned'), [mention, { type: 'hardBreak' }, marked('x', link)])
})

test('trims the blanks a leaf holds at both ends, spaces and tabs alike, wherever the run is as long', () => {
  for (const blanks of [' \t ', ' '.repeat(5000)]) {
    assert.deepEqual(trimmedEdges([marked(`${blanks}a${blanks}`, { type: 'strong' })], 'spanned'), [marked('a', { type: 'strong' })])
    assert.deepEqual(trimmedEdges([marked('a'), marked(`${blanks}b`, { type: 'strong' }), marked('c')], 'spanned'), [marked(`a${blanks}`), marked('b', { type: 'strong' }), marked('c')])
  }
})

test('spells a link title on one line, dropping a carriage return and a null and turning a newline into a space', () => {
  const titled = portableLink({ attrs: { href: 'u', title: 'a\r\0b\nc' }, type: 'link' }, 'paragraph')
  assert.deepEqual(titled, { attrs: { href: 'u', title: 'ab c' }, type: 'link' })
})

function alternatingBlanks(blanks: number, first: AdfNode, second: AdfNode): AdfNode[] {
  return Array.from({ length: blanks }, (_, index) => (index % 2 === 0 ? first : second))
}

// How often a spanned trim reads the text of the line's leaves holding more than spaces and tabs.
function keptTextReads(line: readonly AdfNode[]): number {
  let reads = 0
  const counted = line.map((leaf): AdfNode => {
    const text = leaf.text
    if (text === undefined || text.trim() === '') return leaf
    return {
      ...leaf,
      get text() {
        reads += 1
        return text
      },
    }
  })
  trimmedEdges(counted, 'spanned')
  return reads
}

function spannedPass(leaves: readonly AdfNode[]): { line: AdfNode[]; settled: boolean } {
  return trimmedEdgesPass(leaves, 'spanned')
}

// Runs `pass` until it settles.
function trimmedWith(leaves: readonly AdfNode[], pass: (leaves: readonly AdfNode[]) => { line: AdfNode[]; settled: boolean }): { line: AdfNode[]; passes: number } {
  for (let current = leaves, passes = 1; ; passes += 1) {
    const step = pass(current)
    if (step.settled) return { line: step.line, passes }
    current = step.line
  }
}

// The reference counts: every run reaches its last leaf holding its mark, so the trim peels a run's blank end leaves one pass each.
function runsSharedWithNext(leaves: readonly AdfNode[], grouping: RunGrouping): number[] {
  const shared = leaves.map(() => 0)
  countSharedRuns(leaves.map((node) => ({ carried: false, node, outer: 0 })), 0, grouping, shared)
  return shared
}

function countSharedRuns(nodes: readonly RunNode[], firstIndex: number, grouping: RunGrouping, shared: number[]): void {
  for (const run of inlineRuns(nodes, firstIndex, grouping)) {
    if (run.kind === 'plain') continue
    for (let index = run.index; index < run.index + run.nodes.length - 1; index += 1) shared[index] = (shared[index] ?? 0) + 1
    countSharedRuns(run.nodes, run.index, grouping, shared)
  }
}

// Judges each pass spanned, else parted, dropping only the first run it finds, with every misflanked highlight, and takes no cap.
function firstRunLine(nodes: readonly AdfNode[], container: LineContainer): Result<AdfNode[]> {
  const leaves = portableLeaves(nodes, container, { depth: 0, path: [], sources: new Map() })
  if (!leaves.ok) return leaves
  for (let current: readonly AdfNode[] = leaves.value; ; ) {
    const spanned = portableJudgement(current, 'spanned', container, [])
    if (!spanned.ok) return spanned
    if (spanned.value.kind === 'written') return success(spanned.value.written)
    const parted = portableJudgement(spanned.value.line, 'parted', container, [])
    if (!parted.ok) return parted
    if (parted.value.kind === 'written') return success(parted.value.written)
    const fixed = withoutFallback(parted.value.line, firstRun(parted.value.fallback), [])
    if (!fixed.ok) return fixed
    current = fixed.value
  }
}

function firstRun(fallback: PortableLineFallback): PortableLineFallback {
  if (fallback.kind === 'opening-link') return fallback
  const [first, ...others] = fallback.runs
  return { kind: 'unspellable-run', runs: [first, ...others.filter((run) => run.mark.type === 'backgroundColor')] }
}

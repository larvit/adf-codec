import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import type { PortableLineFallback } from '../emit/inline-line.ts'
import type { RunGrouping, RunNode } from '../emit/inline-runs.ts'
import { inlineRuns } from '../emit/inline-runs.ts'
import { lineContainer, markedLine, propertyRuns } from '../../conformance/property-harness.ts'
import { portableJudgement, portableLeaves, reduceInline, trimmedEdges, trimmingRuns, trimPass, withoutFallback } from './inline-reduction.ts'
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
  { arbitrary: fc.record({ marks: trimMarks, text: fc.string({ maxLength: 3, minLength: 1, unit: fc.constantFrom(' ', ' ', '\t', 'x') }) }).map((held): AdfNode => ({ ...held, type: 'text' })), weight: 6 },
  { arbitrary: fc.constant<AdfNode>({ type: 'hardBreak' }), weight: 1 },
)
const trimLine = fc.oneof(
  fc.array(trimLeaf, { maxLength: 12, minLength: 1 }),
  fc.tuple(fc.array(trimLeaf, { maxLength: 2 }), fc.array(trimLeaf, { maxLength: 3, minLength: 1 }), fc.integer({ max: 8, min: 2 }), fc.array(trimLeaf, { maxLength: 2 })).map(([head, unit, repeats, tail]) => [...head, ...Array.from({ length: repeats }, () => unit).flat(), ...tail]),
)

for (const grouping of groupings) {
  test(`trims a line ${grouping} as peeling each run's end leaf by leaf does, in no more passes`, () => {
    fc.assert(
      fc.property(trimLine, (line) => {
        const peeled = trimmedWith(line, (leaves) => runsSharedWithNext(leaves, grouping))
        const trimmed = trimmedWith(line, (leaves) => trimmingRuns(leaves, grouping))
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

test('counts every nested run crossing a hard break, and none crossing a hard break holding an empty marks', () => {
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
  test(`trims a line of ${name}, 1 000 leaves long, in the passes its 6-leaf form takes`, () => {
    const alternating = (pairs: number) => Array.from({ length: pairs }, () => [code, emphasized]).flat()
    assert.equal(trimmedWith(alternating(500), (leaves) => trimmingRuns(leaves, 'spanned')).passes, trimmedWith(alternating(3), (leaves) => trimmingRuns(leaves, 'spanned')).passes)
  })
}

// The trim's passes and line where each pass judges every leaf against `shared`'s counts.
function trimmedWith(leaves: readonly AdfNode[], shared: (leaves: readonly AdfNode[]) => readonly number[]): { line: AdfNode[]; passes: number } {
  for (let current = leaves, passes = 1; ; passes += 1) {
    const pass = trimPass(current, shared)
    if (pass.settled) return { line: pass.line, passes }
    current = pass.line
  }
}

// The reference counts: every run reaches its last leaf holding its mark, so the trim peels a run's end leaves one pass each.
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

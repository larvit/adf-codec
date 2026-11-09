import assert from 'node:assert/strict'
import test from 'node:test'

import type { NodeRange } from './line-escaping.ts'
import type { RunGrouping } from './inline-runs.ts'
import { isAdfMark, type AdfMark, type AdfNode } from '../../adf/document.ts'
import { linePass, withheldMarkFallbacks } from './inline-line.ts'
import { portableJudgement, portableLeaves } from '../portable/inline-reduction.ts'

// Each line is worked by hand from docs/decisions.md §With the first misread emphasis run, `unspellableRuns` returns only runs that, taken back early, leave the line as the one-run-per-pass reference writes it.
// A run reads `mark@first-last`, nodes named by index. `carry` is the lossless writer's first read-back pass, `drop` the portable writer's.
const lines: { carry?: string[]; drop?: string[]; name: string; nodes: AdfNode[] }[] = [
  {
    carry: ['em@0-0', 'strong@0-0'],
    name: 'a strong whose em cannot close, with the em',
    nodes: [marked(['em', 'strong', 'strike'], ')'), plain('a')],
  },
  {
    carry: ['strike@1-1'],
    drop: ['em@1-1', 'strike@1-1'],
    name: 'the strike that cannot open',
    nodes: [marked(['strong'], 'r'), marked(['strong', 'strike', 'em'], '_'), plain('a')],
  },
  {
    carry: ['strike@0-0'],
    drop: ['strike@0-0', 'strong@0-0'],
    name: 'the strike that cannot close',
    nodes: [marked(['strike', 'em', 'strong'], '_'), plain('0')],
  },
  {
    carry: ['strike@1-1', 'strike@3-3'],
    drop: ['strike@1-1', 'strike@3-3'],
    name: 'two strikes that cannot open, not the strong over them',
    nodes: [plain('b'), marked(['strike', 'strong'], '_'), marked(['strong'], 'r'), marked(['strong', 'strike', 'em'], '(')],
  },
  {
    carry: ['strong@0-0'],
    drop: ['strike@0-1', 'strong@0-0'],
    name: 'the strong that cannot close, and under a drop the strike',
    nodes: [marked(['strike', 'em', 'strong'], '_'), marked(['strike', 'em'], 'b)'), plain('0')],
  },
  {
    carry: ['strong@0-0'],
    drop: ['em@2-3', 'strong@0-0', 'strong@2-3'],
    name: 'the strong that cannot close, the em holding a strike staying under a carry',
    nodes: [marked(['strong'], '*'), plain('0'), marked(['em', 'strong', 'strike'], '['), marked(['em', 'strong'], '(')],
  },
  {
    carry: ['strike@1-1'],
    drop: ['em@2-2', 'strike@1-1', 'strong@2-2'],
    name: 'the strike that cannot open, and under a drop the strong and em after it',
    nodes: [plain('b'), marked(['strike'], ')'), marked(['em', 'strong'], '_'), plain('n')],
  },
  {
    drop: ['strong@2-2'],
    name: 'a strong that cannot open, the em beside a strike that merges staying',
    nodes: [marked(['strong', 'strike'], 'a'), marked(['strike'], 'a'), marked(['strike', 'strong', 'em'], '_')],
  },
  {
    drop: ['strong@1-2'],
    name: 'a strong that cannot open, the em beside it staying as its end can merge',
    nodes: [plain('a'), marked(['strong', 'em'], '[ '), marked(['strong'], 'a'), marked(['em', 'strong'], 'a')],
  },
  {
    carry: ['strong@0-0', 'strong@2-2'],
    name: 'a strong whose opener follows a word beside an em written `_`',
    nodes: [marked(['strong'], '_'), plain('0'), marked(['strong', 'em'], 'a)')],
  },
  {
    carry: ['em@1-1', 'strong@1-1'],
    name: 'a strong and em that cannot close inside a strike that reads',
    nodes: [marked(['strong'], '!'), marked(['strike', 'em', 'strong'], '['), marked(['strike'], '0')],
  },
  {
    carry: ['em@2-2'],
    name: 'the em that cannot open, not the strong over more nodes holding it',
    nodes: [plain('b'), marked(['strong'], '(a'), marked(['strong', 'em'], ')'), plain('c')],
  },
]

for (const { carry, drop, name, nodes } of lines) {
  for (const grouping of ['spanned', 'parted'] as const) {
    if (carry !== undefined) test(`${grouping} line of ${name}: a carry takes ${carry.join(', ')}`, () => assert.deepEqual(carryRuns(nodes, grouping), carry))
    if (drop !== undefined) test(`${grouping} line of ${name}: a drop takes ${drop.join(', ')}`, () => assert.deepEqual(dropRuns(nodes, grouping), drop))
  }
}

function carryRuns(nodes: readonly AdfNode[], grouping: RunGrouping): string[] {
  const pass = linePass(nodes, 'paragraph', [], withheldMarkFallbacks(nodes, 'lossless'), grouping)
  assert.ok(pass.ok)
  assert.ok(pass.value.fallback !== undefined && pass.value.fallback !== 'opening-link')
  return named(pass.value.fallback)
}

function dropRuns(nodes: readonly AdfNode[], grouping: RunGrouping): string[] {
  const leaves = portableLeaves(nodes, 'paragraph', { depth: 0, path: [], sources: new Map() })
  assert.ok(leaves.ok)
  const judged = portableJudgement(leaves.value, grouping, 'paragraph', [])
  assert.ok(judged.ok)
  assert.ok(judged.value.kind === 'fallback' && judged.value.fallback.kind === 'unspellable-run')
  return named(judged.value.fallback.runs)
}

function marked(types: readonly string[], text: string): AdfNode {
  const marks: AdfMark[] = types.map((type) => ({ type }))
  return { marks, text, type: 'text' }
}

function named(runs: readonly NodeRange[]): string[] {
  return runs.map((run) => `${'mark' in run && isAdfMark(run.mark) ? run.mark.type : 'unmarked'}@${run.first}-${run.last}`).sort()
}

function plain(text: string): AdfNode {
  return { text, type: 'text' }
}

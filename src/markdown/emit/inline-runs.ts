import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { identicalMark, nodeMarks } from '../../adf/document.ts'
import { markSpelling } from '../mark-spellings.ts'
import { takesMark } from '../../adf/inline-nodes.ts'

export type InlineRun = MarkedRun | PlainRun

type MarkedRun = { index: number; kind: 'marked'; mark: AdfMark; nodes: [RunNode, ...RunNode[]] }

export type PlainRun = { carried: boolean; index: number; kind: 'plain'; node: AdfNode }

// spec/flavour.md, Marks: spanned, an em, strike, strong or link run crosses a node that cannot hold its mark; parted, as a line needing a fallback is, every run breaks there.
export type RunGrouping = 'parted' | 'spanned'

// An inline node inside the runs of its first `outer` marks, `carried` where the carry spells it. A node a run crosses holds no mark of that run, so its `outer` stays.
export type RunNode = { carried: boolean; node: AdfNode; outer: number }

export function inlineRuns(nodes: readonly RunNode[], firstIndex: number, grouping: RunGrouping): InlineRun[] {
  const runs: InlineRun[] = []
  let end = 0
  for (const [offset, { carried, node, outer }] of nodes.entries()) {
    if (offset < end) continue
    const index = firstIndex + offset
    // A carried node spells its marks inside the carry.
    const mark = carried ? undefined : nodeMarks(node)[outer]
    if (mark === undefined) {
      runs.push({ carried, index, kind: 'plain', node })
      continue
    }
    end = runEnd(nodes, offset, mark, grouping)
    runs.push({ index, kind: 'marked', mark, nodes: [{ carried, node, outer: outer + 1 }, ...nodes.slice(offset + 1, end).map((runNode) => insideRun(runNode, mark) ?? runNode)] })
  }
  return runs
}

// A run opens and closes at a node holding its mark, so a node it would cross past the last such node stays outside.
function runEnd(nodes: readonly RunNode[], first: number, mark: AdfMark, grouping: RunGrouping): number {
  let end = first + 1
  for (let offset = end; offset < nodes.length; offset += 1) {
    const runNode = nodes[offset]
    if (runNode === undefined || runNode.carried) break
    if (insideRun(runNode, mark) !== undefined) end = offset + 1
    else if (grouping === 'parted' || !runCrosses(runNode.node, mark)) break
  }
  return end
}

export function insideRun(runNode: RunNode, mark: AdfMark): RunNode | undefined {
  const held = nodeMarks(runNode.node)[runNode.outer]
  return held !== undefined && identicalMark(held, mark) ? { ...runNode, outer: runNode.outer + 1 } : undefined
}

// The readers refuse `marks=empty` inside a mark's spelling.
function runCrosses(node: AdfNode, mark: AdfMark): boolean {
  const kind = markSpelling(mark.type)?.kind
  return (kind === 'emphasis' || kind === 'link') && !takesMark(node, mark.type) && node.marks?.length !== 0
}

// For each leaf but the last, how many runs hold both it and the next leaf, grouped as the writers group them, so the reducer trims edge whitespace by runs they spell.
export function runsSharedWithNext(leaves: readonly AdfNode[], grouping: RunGrouping): number[] {
  const shared = leaves.map(() => 0)
  countSharedRuns(leaves.map((node) => ({ carried: false, node, outer: 0 })), 0, grouping, shared)
  return shared
}

// Recurses once per mark of a leaf, and the reducer's leaves hold one mark of each kept type.
function countSharedRuns(nodes: readonly RunNode[], firstIndex: number, grouping: RunGrouping, shared: number[]): void {
  for (const run of inlineRuns(nodes, firstIndex, grouping)) {
    if (run.kind === 'plain') continue
    for (let index = run.index; index < run.index + run.nodes.length - 1; index += 1) shared[index] = (shared[index] ?? 0) + 1
    countSharedRuns(run.nodes, run.index, grouping, shared)
  }
}

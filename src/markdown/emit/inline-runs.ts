import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { identicalMark, isSpellableText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { inlineNodeModel, takesMark } from '../../adf/inline-nodes.ts'
import { markSpelling } from '../mark-spellings.ts'
import { slotFault } from '../directive/syntax.ts'

export type InlineRun = { index: number; kind: 'marked'; mark: AdfMark; nodes: RunNode[] } | { index: number; kind: 'plain'; node: AdfNode }

// `parted` keeps a run from crossing any node.
export type RunGrouping = { carried: ReadonlySet<number>; parted: boolean }

// An inline node inside the runs of its first `outer` marks. A node a run crosses holds no mark of that run, so its `outer` stays.
export type RunNode = { node: AdfNode; outer: number }

export const partedLine: RunGrouping = { carried: new Set(), parted: true }
export const spannedLine: RunGrouping = { carried: new Set(), parted: false }

// spec/flavour.md, Marks. The portable reducer must ask this too, or it trims edge whitespace by runs the writers do not spell.
export function inlineRuns(nodes: readonly RunNode[], firstIndex: number, grouping: RunGrouping): InlineRun[] {
  const runs: InlineRun[] = []
  let end = 0
  for (const [offset, { node, outer }] of nodes.entries()) {
    if (offset < end) continue
    const index = firstIndex + offset
    // A carried node spells its marks inside the carry.
    const mark = carries(node, grouping.carried, index) ? undefined : nodeMarks(node)[outer]
    if (mark === undefined) {
      runs.push({ index, kind: 'plain', node })
      continue
    }
    end = runEnd(nodes, offset, mark, firstIndex, grouping)
    runs.push({ index, kind: 'marked', mark, nodes: nodes.slice(offset, end).map((runNode) => insideRun(runNode, mark) ?? runNode) })
  }
  return runs
}

// A run opens and closes at a node holding its mark, so a node it would cross past the last such node stays outside.
function runEnd(nodes: readonly RunNode[], first: number, mark: AdfMark, firstIndex: number, { carried, parted }: RunGrouping): number {
  let end = first + 1
  for (let offset = end; offset < nodes.length; offset += 1) {
    const runNode = nodes[offset]
    if (runNode === undefined || carries(runNode.node, carried, firstIndex + offset)) break
    if (insideRun(runNode, mark) !== undefined) end = offset + 1
    else if (parted || !runCrosses(runNode.node, mark)) break
  }
  return end
}

export function insideRun({ node, outer }: RunNode, mark: AdfMark): RunNode | undefined {
  const held = nodeMarks(node)[outer]
  return held !== undefined && identicalMark(held, mark) ? { node, outer: outer + 1 } : undefined
}

// The readers refuse `marks=empty` inside a mark's spelling.
function runCrosses(node: AdfNode, mark: AdfMark): boolean {
  const kind = markSpelling(mark.type)?.kind
  return (kind === 'emphasis' || kind === 'link') && !takesMark(node, mark.type) && node.marks?.length !== 0
}

// Decides the text-node and slot-fault carries up front, `withheldMarkFallbacks` the withheld-mark ones, so a line holding many of them is emitted once.
export function carries(node: AdfNode, carried: ReadonlySet<number>, index: number): boolean {
  if (carried.has(index)) return true
  if (node.type === 'text') return !isSpellableText(node) || typeof node.text !== 'string' || node.text === ''
  const model = inlineNodeModel(node.type)
  if (model === undefined) return true
  const slot = model.textAttribute === undefined ? undefined : nodeAttrs(node)[model.textAttribute]
  return typeof slot === 'string' && slotFault(node.type, slot) !== undefined && nodeContent(node).length === 0 && node.text === undefined
}

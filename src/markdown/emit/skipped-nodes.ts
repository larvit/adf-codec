import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { identicalMark, nodeMarks } from '../../adf/document.ts'
import { largestNesting } from '../../nesting.ts'
import { markSpelling } from '../mark-spellings.ts'
import { takesMark } from '../../adf/inline-nodes.ts'

type Carries = (node: AdfNode, index: number) => boolean

// The nodes, each that an emphasis or link run skips between two nodes it marks holding the run's mark at the run's depth, or `nodes` itself where no run skips one.
export function spanSkippedNodes(nodes: readonly AdfNode[], carries: Carries): readonly AdfNode[] {
  const spanned = [...nodes]
  return spanRuns(spanned, 0, spanned.length, 0, carries) ? spanned : nodes
}

// Groups the runs as `inlineRuns` does, then lends each run's mark to the nodes it skips; returns whether it lent any.
function spanRuns(spanned: AdfNode[], first: number, end: number, depth: number, carries: Carries): boolean {
  if (depth > largestNesting) return false
  let lent = false
  for (let start = first; start < end; ) {
    const mark = heldMark(spanned, start, depth, carries)
    if (mark === undefined) {
      start += 1
      continue
    }
    let last = start
    for (;;) {
      let next = last + 1
      while (next < end && skipsMark(spanned, next, mark, carries)) next += 1
      const held = next < end ? heldMark(spanned, next, depth, carries) : undefined
      if (held === undefined || !identicalMark(held, mark)) break
      for (const [offset, node] of spanned.slice(last + 1, next).entries()) spanned[last + 1 + offset] = withMark(node, mark, depth)
      lent ||= next > last + 1
      last = next
    }
    lent = spanRuns(spanned, start, last + 1, depth + 1, carries) || lent
    start = last + 1
  }
  return lent
}

function heldMark(spanned: readonly AdfNode[], index: number, depth: number, carries: Carries): AdfMark | undefined {
  const node = spanned[index]
  return node === undefined || carries(node, index) ? undefined : nodeMarks(node)[depth]
}

// spec/flavour.md, Marks: the readers give no node a mark Atlassian's schema withholds from it.
function skipsMark(spanned: readonly AdfNode[], index: number, mark: AdfMark, carries: Carries): boolean {
  const node = spanned[index]
  const kind = markSpelling(mark.type)?.kind
  return node !== undefined && (kind === 'emphasis' || kind === 'link') && !carries(node, index) && !takesMark(node, mark.type)
}

function withMark(node: AdfNode, mark: AdfMark, depth: number): AdfNode {
  const marks = nodeMarks(node)
  return { ...node, marks: [...marks.slice(0, depth), mark, ...marks.slice(depth)] }
}

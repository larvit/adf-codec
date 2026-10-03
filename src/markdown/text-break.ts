import type { AdfNode } from '../adf/document.ts'
import { identicalMarks, nodeMarks } from '../adf/document.ts'
import { spellInlineLeafDirective } from './directive-syntax.ts'

export const textBreakName = 'textBreak'

export const textBreakSpelling = spellInlineLeafDirective(textBreakName, '')

// Whether CommonMark reads the pair back as one text node, where neither rides the carry (spec/flavour.md, Inline nodes).
export function readsAsOne(previous: AdfNode, node: AdfNode): boolean {
  return spelledAsText(previous) && spelledAsText(node) && identicalMarks(nodeMarks(previous), nodeMarks(node))
}

function spelledAsText(node: AdfNode): boolean {
  return node.type === 'text' && node.attrs === undefined && node.content === undefined && node.marks?.length !== 0
}

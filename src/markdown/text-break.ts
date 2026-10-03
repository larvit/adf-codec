import type { AdfNode } from '../adf/document.ts'
import { identicalMarks, isPlainText, nodeMarks } from '../adf/document.ts'
import { spellInlineLeafDirective } from './directive-syntax.ts'

export const textBreakName = 'textBreak'

export const textBreakSpelling = spellInlineLeafDirective(textBreakName, '')

// Whether CommonMark reads the pair back as one text node, where neither rides the carry (spec/flavour.md, Inline nodes).
export function readsAsOne(previous: AdfNode, node: AdfNode): boolean {
  return isPlainText(previous) && isPlainText(node) && identicalMarks(nodeMarks(previous), nodeMarks(node))
}

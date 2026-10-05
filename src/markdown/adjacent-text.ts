import type { AdfNode } from '../adf/document.ts'
import { identicalMarks, isSpellableText, nodeMarks } from '../adf/document.ts'
import { spellInlineLeafDirective } from './directive-syntax.ts'

export const textBreakName = 'textBreak'

export const textBreakSpelling = spellInlineLeafDirective(textBreakName, '')

// The lossless reader's rule: CommonMark reads the pair back as one text run (spec/flavour.md, Inline nodes).
export function joinsWhenRead(previous: AdfNode, node: AdfNode): boolean {
  return isSpellableText(previous) && isSpellableText(node) && identicalMarks(nodeMarks(previous), nodeMarks(node))
}

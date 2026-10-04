import type { DirectiveSpan, Read } from './directive-syntax.ts'
import { readSoleStringAttribute, spellAttributes, spellInlineLeafDirective, spellStringAttribute, unsupportedNodeShape } from './directive-syntax.ts'

const name = 'text'
const spelledRun = /^(?:[ \t]+|\n+|\0+)$/

export const textDirectiveName = name

export function spellTextDirective(text: string): string {
  return spellInlineLeafDirective(name, spellAttributes([[name, spellStringAttribute(text)]]))
}

export function readTextDirective(span: DirectiveSpan): Read<string> | undefined {
  if (span.name !== name) return undefined
  const spelled = readSoleStringAttribute(span, name)
  if (spelled.fault !== undefined) return spelled
  if (!spelledRun.test(spelled.value)) return { fault: unsupportedNodeShape(`${name} spells one run of spaces and tabs, one run of newlines, or one run of null characters: this one spells none of them`) }
  return spelled
}

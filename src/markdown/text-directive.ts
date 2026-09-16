import type { DirectiveSpan, Read } from './directive-syntax.ts'
import { readSoleStringAttribute, spellAttributes, spellInlineLeafDirective, spellStringAttribute, unsupportedNodeShape } from './directive-syntax.ts'

const name = 'text'
const whitespaceRun = /^(?:[ \t]+|\n+)$/

export const textDirectiveName = name

export function spellTextDirective(text: string): string {
  return spellInlineLeafDirective(name, spellAttributes([[name, spellStringAttribute(text)]]))
}

export function readTextDirective(span: DirectiveSpan): Read<string> | undefined {
  if (span.name !== name) return undefined
  const spelled = readSoleStringAttribute(span, name)
  if (spelled.fault !== undefined) return spelled
  if (!whitespaceRun.test(spelled.value)) return { fault: unsupportedNodeShape(`${name} spells one run of spaces and tabs, or one run of newlines: this one spells neither`) }
  return spelled
}

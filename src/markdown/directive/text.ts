import type { DirectiveSpan } from './syntax.ts'
import type { Read } from '../../result.ts'
import { readSoleStringAttribute, spellAttributes, spellInlineLeafDirective, spellStringAttribute, unsupportedNodeShape } from './syntax.ts'

const name = 'text'
const loneSurrogate = '[\\ud800-\\udbff](?![\\udc00-\\udfff])|(?<![\\ud800-\\udbff])[\\udc00-\\udfff]'

// A surrogate pair is no lone surrogate: UTF-8 encodes it, and only a lone one reads back as U+FFFD.
export const loneSurrogates = `(?:${loneSurrogate})+`

const spelledRun = new RegExp(`^(?:[ \\t]+|\\n+|\\0+|${loneSurrogates})$`)

export const textDirectiveName = name

export function spellTextDirective(text: string): string {
  return spellInlineLeafDirective(name, spellAttributes([[name, spellStringAttribute(text)]]))
}

export function readTextDirective(span: DirectiveSpan): Read<string> | undefined {
  if (span.name !== name) return undefined
  const spelled = readSoleStringAttribute(span, name)
  if (spelled.fault !== undefined) return spelled
  if (!spelledRun.test(spelled.value)) return { fault: unsupportedNodeShape(`${name} spells one run of spaces and tabs, one run of newlines, one run of null characters, or one run of lone surrogates: this one spells none of them`) }
  return spelled
}

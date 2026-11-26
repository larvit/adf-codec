import type { DirectiveSpan } from './syntax.ts'
import type { Read } from '../../result.ts'
import { loneSurrogates } from '../commonmark/grammar.ts'
import { readSoleStringAttribute, spellAttributes, spellInlineLeafDirective, spellStringAttribute, unsupportedNodeShape } from './syntax.ts'

const name = 'text'
const spelledRun = new RegExp(`^(?:[ \\t]+|\\n+|\\0+|${loneSurrogates})$`)

export const textDirectiveName = name

export function spellTextDirective(text: string): string {
	return spellInlineLeafDirective(name, spellAttributes([[name, spellStringAttribute(text)]]))
}

export function readTextDirective(span: DirectiveSpan): Read<string> | undefined {
	if (span.name !== name) return undefined
	const spelled = readSoleStringAttribute(span, name)
	if (spelled.fault !== undefined) return spelled
	if (!spelledRun.test(spelled.value)) return { fault: unsupportedNodeShape(`${name} spells one run of spaces and tabs, one run of newlines, one run of null characters, or one run of lone surrogates: this one doesn't spell any of them`) }
	return spelled
}

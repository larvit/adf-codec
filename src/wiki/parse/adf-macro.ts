import type { AdfNode } from '../../adf/document.ts'
import type { ConvertFault, Read } from '../../result.ts'
import { carriedNesting, carriedNode, carriedValue } from '../../adf/carried-json.ts'
import { largestNesting } from '../../nesting.ts'

// `inline`: the macro says `display=inline`.
export type AdfMacro = { end: number; inline: boolean; node: AdfNode }

const closer = '{adf}'
const holder = 'an {adf} macro'
const opener = /\{adf(?::([^{}\n]*))?\}/y

// spec/wiki.md, The carry: `undefined` where no `{adf}` macro opens at `at`. A macro closing past `end` is refused.
export function readAdfMacro(wiki: string, at: number, end: number): Read<AdfMacro> | undefined {
	opener.lastIndex = at
	const opened = opener.exec(wiki)
	if (opened === null) return undefined
	const start = opener.lastIndex
	const close = wiki.indexOf(closer, start)
	if (close === -1) return { fault: refusal('closes with {adf}: this one is left open') }
	if (close + closer.length > end) return { fault: refusal('inside a line closes on that line: this one closes on a later line') }
	const value = carriedValue(wiki.slice(start, close), holder, refusal("holds one ADF node's JSON: this is no JSON"))
	if (value.fault !== undefined) return value
	const bounded = carriedNesting(value.value, largestNesting)
	if (bounded.fault !== undefined) return bounded
	const node = carriedNode(bounded.value, holder)
	if (node.fault !== undefined) return node
	return { value: { end: close + closer.length, inline: opened[1] === 'display=inline', node: node.value } }
}

function refusal(message: string): ConvertFault {
	return { code: 'unsupported-node-shape', message: `${holder} ${message}` }
}

import type { AdfNode } from '../adf/document.ts'
import { carriedJson } from '../adf/carried-json.ts'
import { largestNesting } from '../nesting.ts'
import { success, type ConvertErrorPath, type Result } from '../result.ts'

const backslash = 0x5c
const brace = 0x7b
const quote = 0x22

// spec/wiki.md, The carry.
export function blockCarry(node: AdfNode, path: ConvertErrorPath): Result<string> {
	const json = carriedJson(node, node, 'compact', path, largestNesting)
	return json.ok ? success(`{adf:display=block}\n${closingMacroEscaped(json.value.json)}\n{adf}`) : json
}

// One macro per node, since Jira reads a node and never an array inside `{adf:display=inline}`.
export function inlineCarry(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
	let macros = ''
	for (const node of nodes) {
		const json = carriedJson(node, node, 'compact', path, largestNesting)
		if (!json.ok) return json
		macros += `{adf:display=inline}${closingMacroEscaped(json.value.json)}{adf}`
	}
	return success(macros)
}

// A `{` inside a JSON string is `\u007b`, so the closing `{adf}` is the only one the macro holds.
// A scan by index, since a regex over a string of 2^28 characters overflows V8's stack.
function closingMacroEscaped(json: string): string {
	let escaped = ''
	let kept = 0
	let inString = false
	for (let at = 0; at < json.length; at += 1) {
		const code = json.charCodeAt(at)
		if (code === backslash) at += 1
		else if (code === quote) inString = !inString
		else if (code === brace && inString) {
			escaped += `${json.slice(kept, at)}\\u007b`
			kept = at + 1
		}
	}
	return escaped + json.slice(kept)
}

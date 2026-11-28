import type { AdfNode } from '../adf/document.ts'
import { carriedJson, carriedNesting, carriedNode, carriedValue } from '../adf/carried-json.ts'
import { largestNesting } from '../nesting.ts'
import { success, type ConvertErrorPath, type ConvertFault, type Read, type Result } from '../result.ts'

// `inline`: the macro says `display=inline`.
export type AdfMacro = { end: number; inline: boolean; node: AdfNode }

const backslash = 0x5c
const blockDisplay = 'display=block'
const brace = 0x7b
const closer = '{adf}'
const documentJson = '{"type":"doc","version":1}'
const holder = 'an {adf} macro'
const inlineDisplay = 'display=inline'
const opener = /\{adf(?::([^{}\n]*))?\}/y
const quote = 0x22

// spec/wiki.md, The carry.
export function blockCarry(node: AdfNode, path: ConvertErrorPath): Result<string> {
	const json = carriedJson(node, node, 'compact', path, largestNesting)
	return json.ok ? success(`${opening(blockDisplay)}\n${closingMacroEscaped(json.value.json)}\n${closer}`) : json
}

// One macro per node, since Jira reads a node and never an array inside `{adf:display=inline}`.
export function inlineCarry(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
	let macros = ''
	for (const node of nodes) {
		const json = carriedJson(node, node, 'compact', path, largestNesting)
		if (!json.ok) return json
		macros += inlineMacro(closingMacroEscaped(json.value.json))
	}
	return success(macros)
}

// What `inlineCarry` writes for a node of this JSON, which holds no `{` in a string.
export function inlineMacro(json: string): string {
	return `${opening(inlineDisplay)}${json}${closer}`
}

function opening(display: string): string {
	return `{adf:${display}}`
}

// What `blockCarry` writes for a document holding no `content` key, with any whitespace around its parts.
export function carriesBareDocument(wiki: string): boolean {
	const macro = wiki.trim()
	const opened = opening(blockDisplay)
	return macro.startsWith(opened) && macro.endsWith(closer) && macro.slice(opened.length, -closer.length).trim() === documentJson
}

// `undefined` where no `{adf}` macro opens at `at`. A macro closing past `end` is refused.
export function readAdfMacro(wiki: string, at: number, end: number): Read<AdfMacro> | undefined {
	opener.lastIndex = at
	const opened = opener.exec(wiki)
	if (opened === null) return undefined
	const start = opener.lastIndex
	const close = wiki.indexOf(closer, start)
	if (close === -1) return { fault: refusal(`closes with ${closer}: this one is left open`) }
	if (close + closer.length > end) return { fault: refusal('inside a line closes on that line: this one closes on a later line') }
	const value = carriedValue(wiki.slice(start, close), holder, refusal("holds one ADF node's JSON: this is no JSON"))
	if (value.fault !== undefined) return value
	const bounded = carriedNesting(value.value, largestNesting)
	if (bounded.fault !== undefined) return bounded
	const node = carriedNode(bounded.value, holder)
	if (node.fault !== undefined) return node
	return { value: { end: close + closer.length, inline: opened[1] === inlineDisplay, node: node.value } }
}

function refusal(message: string): ConvertFault {
	return { code: 'unsupported-node-shape', message: `${holder} ${message}` }
}

// A `{` inside a JSON string is `\u007b`, so the closing `{adf}` is the only one the macro holds.
// A loop, since a regex matching a JSON string of 2^28 characters overflows V8's stack.
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

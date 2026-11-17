import type { AdfNode } from '../adf/document.ts'
import { carriedJson } from '../adf/carried-json.ts'
import { largestNesting } from '../nesting.ts'
import { success, type ConvertErrorPath, type Result } from '../result.ts'

// spec/wiki.md, The carry. Only the document's own blocks ride, so a block carry has every level.
export function blockCarry(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  return json.ok ? success(`{adf:display=block}\n${closingMacroEscaped(json.value.json)}\n{adf}`) : json
}

// One node is carried as its JSON, a run of several as an array.
export function inlineCarry(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
  const carried = nodes.length === 1 && nodes[0] !== undefined ? nodes[0] : nodes
  const json = carriedJson(carried, carried, 'compact', path, largestNesting)
  return json.ok ? success(`{adf:display=inline}${closingMacroEscaped(json.value.json)}{adf}`) : json
}

// A `{` inside a JSON string is `\u007b`, so the closing `{adf}` is the only one the macro holds.
function closingMacroEscaped(json: string): string {
  return json.replace(/"(?:[^"\\]|\\.)*"/g, (string) => string.replaceAll('{', '\\u007b'))
}

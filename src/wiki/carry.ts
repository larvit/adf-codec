import type { AdfNode } from '../adf/document.ts'
import { carriedJson } from '../adf/carried-json.ts'
import { largestNesting } from '../nesting.ts'
import { success, type ConvertErrorPath, type Result } from '../result.ts'

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
function closingMacroEscaped(json: string): string {
  return json.replace(/"(?:[^"\\]|\\.)*"/g, (string) => string.replaceAll('{', '\\u007b'))
}

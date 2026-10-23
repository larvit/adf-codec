import type { AdfNode } from '../../adf/document.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { carriedJson } from '../../adf/carried-json.ts'
import { carriedValue } from './escaping.ts'
import { largestNesting } from '../../nesting.ts'
import { nodeContent } from '../../adf/document.ts'
import { shownText } from '../../adf/shown-text.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

export function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting - depth)
  return json.ok ? success(carryElement('div', json.value.json, carriedText(node))) : json
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  return json.ok ? success(carryElement('span', json.value.json, carriedText(node))) : json
}

export function carryElement(tag: string, json: string, text: string): string {
  return `<${tag} class="adf-carry" data-adf="${carriedValue(json)}">${carriedValue(text)}</${tag}>`
}

// The text a carried node shows, a line break between its blocks and for each hard break; a reader of the element reads the JSON alone.
function carriedText(node: AdfNode): string {
  let text = ''
  const pending: AdfNode[] = [node]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (text !== '' && (next.type === 'hardBreak' || blockNodeModel(next.type) !== undefined)) text += '\n'
    text += next.text ?? shownText(next) ?? ''
    for (const child of [...nodeContent(next)].reverse()) pending.push(child)
  }
  return text
}

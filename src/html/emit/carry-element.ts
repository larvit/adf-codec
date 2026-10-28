import type { AdfNode } from '../../adf/document.ts'
import { carriedJson } from '../../adf/carried-json.ts'
import { carryAttributes } from '../carry-attributes.ts'
import { carryContent } from '../carry-content.ts'
import { largestNesting } from '../../nesting.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

export function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting - depth)
  if (!json.ok) return json
  return success(carryElement('div', json.value.json, carryContent(node, 'div')))
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  return json.ok ? success(carryElement('span', json.value.json, carryContent(node, 'span'))) : json
}

export function carryElement(tag: string, json: string, content: string): string {
  return `<${tag}${carryAttributes(json)}>${content}</${tag}>`
}

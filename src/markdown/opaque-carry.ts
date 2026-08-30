import type { AdfNode } from '../adf/document.ts'
import type { JsonSpelling } from '../canonical-json.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { isJsonValue } from '../json-value.ts'
import { fencedCodeBlock } from './backtick-runs.ts'
import { largestNesting } from '../nesting.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'
import { spellAttributes, spellStringAttribute } from './directive-attributes.ts'

export const carryName = 'adf'

export function carriedBlock(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, 'two-space', path)
  if (!json.ok) return json
  return success(fencedCodeBlock(carryName, json.value))
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, 'compact', path)
  if (!json.ok) return json
  return success(`:${carryName}${spellAttributes([['json', spellStringAttribute(json.value)]])}`)
}

function carriedJson(node: AdfNode, spelling: JsonSpelling, path: ConvertErrorPath): Result<string> {
  if (!isJsonValue(node)) {
    return failure('unsupported-nesting-depth', `a carried node's JSON nests deeper than the ${largestNesting} levels the emitter carries`, path)
  }
  return success(serializeCanonicalJson(node, spelling))
}

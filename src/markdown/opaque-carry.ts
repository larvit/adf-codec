import type { AdfNode } from '../adf/document.ts'
import type { DirectiveSpan, Read } from './directive-syntax.ts'
import type { JsonSpelling } from '../canonical-json.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { isAdfNode } from '../adf/document.ts'
import { isJsonValue, nestingDepth, overNested } from '../json-value.ts'
import { fencedCodeBlock } from './backtick-runs.ts'
import { largestNesting } from '../nesting.ts'
import { malformedDirective, readSoleStringAttribute, spellAttributes, spellInlineLeafDirective, spellStringAttribute, unsupportedNodeShape } from './directive-syntax.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export const carryName = 'carry'

const jsonAttribute = 'json'

export function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<{ headroom: number; text: string }> {
  const json = carriedJson(node, 'two-space', path, largestNesting - depth)
  if (!json.ok) return json
  return success({ headroom: json.value.headroom, text: fencedCodeBlock(carryName, json.value.json) })
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, 'compact', path, largestNesting)
  if (!json.ok) return json
  return success(spellInlineLeafDirective(carryName, spellAttributes([[jsonAttribute, spellStringAttribute(json.value.json)]])))
}

export function readCarriedBlock(body: string, depth: number): Read<AdfNode> {
  return readCarriedJson(body, 'two-space', largestNesting - depth)
}

export function readCarriedInline(span: DirectiveSpan): Read<AdfNode> | undefined {
  if (span.name !== carryName) return undefined
  const spelled = readSoleStringAttribute(span, jsonAttribute)
  if (spelled.fault !== undefined) return spelled
  return readCarriedJson(spelled.value, 'compact', largestNesting)
}

function carriedJson(node: AdfNode, spelling: JsonSpelling, path: ConvertErrorPath, levels: number): Result<{ headroom: number; json: string }> {
  const headroom = levels - nestingDepth(node)
  if (!isJsonValue(node) || headroom < 0) {
    return failure('unsupported-nesting-depth', `a carried node's JSON nests deeper than the ${levels} levels its position leaves`, path)
  }
  return success({ headroom, json: serializeCanonicalJson(node, spelling) })
}

function readCarriedJson(raw: string, spelling: JsonSpelling, levels: number): Read<AdfNode> {
  const parsed = parseJsonText(raw)
  if (parsed === undefined) return { fault: malformedDirective('the opaque carry holds invalid JSON') }
  const { value } = parsed
  if (!isJsonValue(value)) return { fault: unsupportedNodeShape('the opaque carry holds a number JSON cannot spell') }
  if (overNested(value, levels)) {
    return { fault: { code: 'unsupported-nesting-depth', message: `a carried node's JSON nests deeper than the ${levels} levels its position leaves` } }
  }
  if (serializeCanonicalJson(value, spelling) !== raw) {
    const shape = spelling === 'compact' ? 'compact, keys sorted' : 'two-space indent, keys sorted'
    return { fault: unsupportedNodeShape(`the opaque carry spells its node's JSON canonically: ${shape}`) }
  }
  if (!isAdfNode(value)) return { fault: unsupportedNodeShape("the opaque carry holds one ADF node's JSON: this JSON is no ADF node") }
  return { value }
}

function parseJsonText(raw: string): { value: unknown } | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    return { value }
  } catch {
    return undefined
  }
}

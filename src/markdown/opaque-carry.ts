import type { AdfNode } from '../adf/document.ts'
import type { DirectiveSpan, Read } from './directive-syntax.ts'
import type { JsonSpelling } from '../canonical-json.ts'
import type { JsonValue } from '../json-value.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { fencedCodeBlock } from './commonmark/backtick-runs.ts'
import { infoStringCarries } from './commonmark/grammar.ts'
import { isAdfNode } from '../adf/document.ts'
import { isJsonValue, nestingDepth, overNested } from '../json-value.ts'
import { largestNesting } from '../nesting.ts'
import { malformedDirective, readSoleStringAttribute, spellAttributes, spellInlineLeafDirective, spellStringAttribute, unsupportedNodeShape } from './directive-syntax.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export const carryFencePrefix = 'adf:'

export const carryName = 'carry'

const jsonAttribute = 'json'

// spec/flavour.md, The opaque carry: the info string names the type wherever it carries the type back.
export function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<{ headroom: number; text: string }> {
  const { type, ...untyped } = node
  const named = infoStringCarries(type)
  const json = carriedJson(node, named ? untyped : node, 'two-space', path, largestNesting - depth)
  if (!json.ok) return json
  return success({ headroom: json.value.headroom, text: fencedCodeBlock(`${carryFencePrefix}${named ? type : ''}`, json.value.json) })
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  if (!json.ok) return json
  return success(spellInlineLeafDirective(carryName, spellAttributes([[jsonAttribute, spellStringAttribute(json.value.json)]])))
}

export function readCarriedBlock(type: string, body: string, depth: number): Read<AdfNode> {
  if (type !== '' && !infoStringCarries(type)) {
    return { fault: unsupportedNodeShape(`the carry fence names a type no info string carries back: spell it ${carryFencePrefix} with the type in the JSON`) }
  }
  const read = readCarriedJson(body, 'two-space', largestNesting - depth, type)
  if (read.fault !== undefined || type !== '' || !infoStringCarries(read.value.type)) return read
  return { fault: unsupportedNodeShape(`the carry fence names a type its info string carries: spell it ${carryFencePrefix}${read.value.type}`) }
}

export function readCarriedInline(span: DirectiveSpan): Read<AdfNode> | undefined {
  if (span.name !== carryName) return undefined
  const spelled = readSoleStringAttribute(span, jsonAttribute)
  if (spelled.fault !== undefined) return spelled
  return readCarriedJson(spelled.value, 'compact', largestNesting)
}

function carriedJson(node: AdfNode, spelled: object, spelling: JsonSpelling, path: ConvertErrorPath, levels: number): Result<{ headroom: number; json: string }> {
  const headroom = levels - nestingDepth(node)
  if (!isJsonValue(spelled) || headroom < 0) {
    return failure('unsupported-nesting-depth', `a carried node's JSON nests deeper than the ${levels} levels its position leaves`, path)
  }
  return success({ headroom, json: serializeCanonicalJson(spelled, spelling) })
}

// `type` is the one the fence's info string names, `undefined` for the inline carry.
function readCarriedJson(raw: string, spelling: JsonSpelling, levels: number, type?: string): Read<AdfNode> {
  const parsed = parseJsonText(raw)
  if (parsed === undefined) return { fault: malformedDirective('the opaque carry holds invalid JSON') }
  const { value } = parsed
  if (!isJsonValue(value)) return { fault: unsupportedNodeShape('the opaque carry holds a number JSON cannot spell') }
  const typed = type === undefined || type === '' ? { value } : typedValue(value, type)
  if (typed.fault !== undefined) return typed
  const held = typed.value
  if (overNested(held, levels)) {
    return { fault: { code: 'unsupported-nesting-depth', message: `a carried node's JSON nests deeper than the ${levels} levels its position leaves` } }
  }
  if (serializeCanonicalJson(value, spelling) !== raw) {
    const shape = spelling === 'compact' ? 'compact, keys sorted' : 'two-space indent, keys sorted'
    return { fault: unsupportedNodeShape(`the opaque carry spells its node's JSON canonically: ${shape}`) }
  }
  if (!isAdfNode(held)) return { fault: unsupportedNodeShape("the opaque carry holds one ADF node's JSON: this JSON is no ADF node") }
  return { value: held }
}

function typedValue(value: JsonValue, type: string): Read<JsonValue> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return { value }
  if ('type' in value) return { fault: unsupportedNodeShape(`the ${carryFencePrefix}${type} fence names its node's type: this JSON holds a type as well`) }
  return { value: { ...value, type } }
}

function parseJsonText(raw: string): { value: unknown } | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    return { value }
  } catch {
    return undefined
  }
}

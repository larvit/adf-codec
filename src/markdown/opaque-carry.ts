import type { AdfNode } from '../adf/document.ts'
import type { ConvertFault } from '../result.ts'
import type { DirectiveSpan, Read } from './directive-syntax.ts'
import type { JsonSpelling } from '../canonical-json.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { isAdfNode } from '../adf/document.ts'
import { isJsonValue } from '../json-value.ts'
import { fencedCodeBlock } from './backtick-runs.ts'
import { largestNesting } from '../nesting.ts'
import { malformedDirective, spellAttributes, spellStringAttribute } from './directive-syntax.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export const carryName = 'adf'

const jsonAttribute = 'json'

export function carriedBlock(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, 'two-space', path)
  if (!json.ok) return json
  return success(fencedCodeBlock(carryName, json.value))
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, 'compact', path)
  if (!json.ok) return json
  return success(`:${carryName}${spellAttributes([[jsonAttribute, spellStringAttribute(json.value)]])}`)
}

export function readCarriedBlock(body: string): Read<AdfNode> {
  return readCarriedJson(body, 'two-space')
}

export function readCarriedInline(span: DirectiveSpan): Read<AdfNode> | undefined {
  if (span.name !== carryName) return undefined
  if (span.content !== undefined) return { fault: unsupported(`${carryName} takes no content`) }
  const spelled = span.attributes.get(jsonAttribute)
  if (spelled === undefined || span.attributes.size !== 1) return { fault: unsupported(`${carryName} holds one ${jsonAttribute} attribute alone`) }
  const spelling = spellStringAttribute(spelled.decoded)
  if (spelling !== spelled.spelling) return { fault: unsupported(`${carryName} spells its ${jsonAttribute} attribute as ${jsonAttribute}=${spelling}`) }
  return readCarriedJson(spelled.decoded, 'compact')
}

function carriedJson(node: AdfNode, spelling: JsonSpelling, path: ConvertErrorPath): Result<string> {
  if (!isJsonValue(node)) {
    return failure('unsupported-nesting-depth', `a carried node's JSON nests deeper than the ${largestNesting} levels the emitter carries`, path)
  }
  return success(serializeCanonicalJson(node, spelling))
}

function readCarriedJson(raw: string, spelling: JsonSpelling): Read<AdfNode> {
  const parsed = parseJsonText(raw)
  if (parsed === undefined) return { fault: malformedDirective('the opaque carry holds invalid JSON') }
  const { value } = parsed
  if (!isJsonValue(value)) {
    return { fault: { code: 'unsupported-nesting-depth', message: `a carried node's JSON nests deeper than the ${largestNesting} levels the parser carries` } }
  }
  if (serializeCanonicalJson(value, spelling) !== raw) {
    const shape = spelling === 'compact' ? 'compact, keys sorted' : 'two-space indent, keys sorted'
    return { fault: unsupported(`the opaque carry spells its node's JSON canonically: ${shape}`) }
  }
  if (!isAdfNode(value)) return { fault: unsupported("the opaque carry holds one ADF node's JSON") }
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

function unsupported(message: string): ConvertFault {
  return { code: 'unsupported-node-shape', message }
}

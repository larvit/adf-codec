import type { AdfNode } from './document.ts'
import type { JsonSpelling } from '../canonical-json.ts'
import type { JsonValue } from '../json-value.ts'
import { canonicalJsonPieces } from '../canonical-json.ts'
import { faulted, success, type ConvertErrorPath, type ConvertFault, type Read, type Result } from '../result.ts'
import { isAdfNode } from './document.ts'
import { isJsonValue, nestingDepth, overNested } from '../json-value.ts'
import { joinedWithin } from '../length-bound.ts'
import { parseJsonText } from '../json-text.ts'

// JSON `carriedNesting` found within the levels its position leaves, the one value `carriedNode` reads.
export type BoundedJson = { readonly bounded: JsonValue }

// `spelled` is the node as the carry holds it, `type` dropped where the format names it apart; `levels` the nesting its position leaves.
export function carriedJson(node: AdfNode, spelled: object, spelling: JsonSpelling, path: ConvertErrorPath, levels: number): Result<{ headroom: number; json: string }> {
  const headroom = levels - nestingDepth(node)
  if (!isJsonValue(spelled) || headroom < 0) return faulted(nestedPast(levels), path)
  // Two-space JSON indents each value by its depth, so a short compact value can spell past the bound: join only up to it.
  const json = joinedWithin(canonicalJsonPieces(spelled, spelling))
  return json.ok ? success({ headroom, json: json.value }) : json
}

// The read inverse of `carriedJson` takes three steps, value, nesting and node, so each format's own refusals keep their place between them; `invalid` is the format's refusal of text that is no JSON, and `holder` names the carry in a message.
export function carriedValue(json: string, holder: string, invalid: ConvertFault): Read<JsonValue> {
  const parsed = parseJsonText(json)
  if (parsed.refusal === undefined) return { value: parsed.value }
  return { fault: parsed.refusal === 'syntax' ? invalid : { code: 'unsupported-node-shape', message: `${holder} holds a number JSON cannot spell` } }
}

export function carriedNesting(held: JsonValue, levels: number): Read<BoundedJson> {
  return overNested(held, levels) ? { fault: nestedPast(levels) } : { value: { bounded: held } }
}

export function carriedNode({ bounded }: BoundedJson, holder: string): Read<AdfNode> {
  return isAdfNode(bounded) ? { value: bounded } : { fault: { code: 'unsupported-node-shape', message: `${holder} holds one ADF node's JSON: this JSON is no ADF node` } }
}

function nestedPast(levels: number): ConvertFault {
  return { code: 'unsupported-nesting-depth', message: `a carried node's JSON nests deeper than the ${levels} levels its position leaves` }
}

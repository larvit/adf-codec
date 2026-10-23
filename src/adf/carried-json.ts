import type { AdfNode } from './document.ts'
import type { JsonSpelling } from '../canonical-json.ts'
import { canonicalJsonPieces } from '../canonical-json.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { isJsonValue, nestingDepth } from '../json-value.ts'
import { joinedWithin } from '../length-bound.ts'

// `spelled` is the node as the carry holds it, `type` dropped where the format names it apart; `levels` the nesting its position leaves.
export function carriedJson(node: AdfNode, spelled: object, spelling: JsonSpelling, path: ConvertErrorPath, levels: number): Result<{ headroom: number; json: string }> {
  const headroom = levels - nestingDepth(node)
  if (!isJsonValue(spelled) || headroom < 0) {
    return failure('unsupported-nesting-depth', `a carried node's JSON nests deeper than the ${levels} levels its position leaves`, path)
  }
  // Two-space JSON indents each value by its depth, so a short compact value can spell past the bound: join only up to it.
  const json = joinedWithin(canonicalJsonPieces(spelled, spelling))
  return json.ok ? success({ headroom, json: json.value }) : json
}

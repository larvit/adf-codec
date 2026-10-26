import type { AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import type { ParseError, Result } from '../../result.ts'
import { holdableJson } from '../escaping.ts'
import { isAdfNode } from '../../adf/document.ts'
import { overNested } from '../../json-value.ts'
import { parseJsonText } from '../../json-text.ts'
import { refused, type Place, type StartTag } from './source.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { success } from '../../result.ts'

// The JSON a carry element holds, and the end of the element; what it shows is skipped unread (docs/decisions.md §The HTML dialect).
export function readCarry(html: string, tag: StartTag, levels: number, place: Place): Result<{ end: number; held: JsonValue }, ParseError> {
  const [kind, held, ...others] = tag.attributes
  if (kind?.[0] !== 'class' || kind[1] !== 'adf-carry' || held?.[0] !== 'data-adf' || others.length > 0) {
    return refused('unmappable-html', `a <${tag.name}> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone`, html, tag.end, place)
  }
  const json = held[1]
  const parsed = parseJsonText(json)
  if (parsed.refusal === 'syntax') return refused('unmappable-html', "a carry element's data-adf holds invalid JSON", html, tag.end, place)
  if (parsed.refusal !== undefined) return refused('unsupported-node-shape', "a carry element's data-adf holds a number JSON cannot spell", html, tag.end, place)
  if (overNested(parsed.value, levels)) return refused('unsupported-nesting-depth', `a carried node's JSON nests deeper than the ${levels} levels its position leaves`, html, tag.end, place)
  if (holdableJson(serializeCanonicalJson(parsed.value, 'compact')) !== json) {
    return refused('unsupported-node-shape', "a carry element spells its node's JSON canonically: compact, keys sorted, a character HTML cannot hold as a JSON escape", html, tag.end, place)
  }
  const closer = `</${tag.name}>`
  const end = html.indexOf(closer, tag.end)
  return end < 0 ? refused('unmappable-html', `a carry element ends at ${closer}: found none`, html, tag.end, place) : success({ end: end + closer.length, held: parsed.value })
}

export function heldNode(held: JsonValue, html: string, index: number, place: Place): Result<AdfNode, ParseError> {
  return isAdfNode(held) ? success(held) : refused('unsupported-node-shape', "a carry element's data-adf holds one ADF node's JSON: this JSON is no ADF node", html, index, place)
}

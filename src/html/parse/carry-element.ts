import type { AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import type { ParseError, Read, Result } from '../../result.ts'
import { carriedNesting, carriedNode, carriedValue } from '../../adf/carried-json.ts'
import { holdableJson } from '../escaping.ts'
import { readCarryAttributes } from '../carry-attributes.ts'
import { refused, type Place, type StartTag } from './source.ts'
import { spellsCanonicalJson } from '../../canonical-json.ts'
import { success } from '../../result.ts'

const holder = "a carry element's data-adf"

// The JSON a carry element holds, and the element's end; what it shows is skipped unread (docs/decisions.md §The HTML dialect).
export function readCarry(html: string, tag: StartTag, levels: number, place: Place): Result<{ end: number; held: JsonValue; json: string }, ParseError> {
  const json = readCarryAttributes(tag.attributes)
  if (json === undefined) return refused('unmappable-html', `a <${tag.name}> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone`, html, tag.end, place)
  const held = heldJson(json, levels)
  if (held.fault !== undefined) return refused(held.fault.code, held.fault.message, html, tag.end, place)
  const closer = `</${tag.name}>`
  const end = html.indexOf(closer, tag.end)
  return end < 0 ? refused('unmappable-html', `a carry element ends at ${closer}: found none`, html, tag.end, place) : success({ end: end + closer.length, held: held.value, json })
}

// Short of the node, which `heldNode` reads once the element's end is found, so a carry missing its closing tag is refused for that first.
function heldJson(json: string, levels: number): Read<JsonValue> {
  const held = carriedValue(json, holder, { code: 'unmappable-html', message: `${holder} holds invalid JSON` })
  if (held.fault !== undefined) return held
  const nested = carriedNesting(held.value, levels)
  if (nested !== undefined) return { fault: nested }
  if (spellsCanonicalJson(held.value, 'compact', json, holdableJson)) return held
  return { fault: { code: 'unsupported-node-shape', message: "a carry element spells its node's JSON canonically: compact, keys sorted, a character HTML cannot hold as a JSON escape" } }
}

export function heldNode(held: JsonValue, html: string, index: number, place: Place): Result<AdfNode, ParseError> {
  const node = carriedNode(held, holder)
  return node.fault === undefined ? success(node.value) : refused(node.fault.code, node.fault.message, html, index, place)
}

import type { AdfNode } from '../../adf/document.ts'
import type { Read } from '../../result.ts'
import { carriedNesting, carriedNode, carriedValue } from '../../adf/carried-json.ts'
import { carryContent } from '../carry-content.ts'
import { foundAt, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { holdableJson } from '../escaping.ts'
import { readCarryAttributes } from '../carry-attributes.ts'
import { spellsCanonicalJson } from '../../canonical-json.ts'
import { success } from '../../result.ts'

const holder = "a carry element's data-adf"

// What the element shows must read back as `adfToHtml` shows its node, so an edit to it is refused rather than dropped (README goal 7).
export function readCarry(html: string, tag: StartTag, element: 'div' | 'span', levels: number, place: Place): ReadNode {
  const json = readCarryAttributes(tag.attributes)
  if (json === undefined) return refused('unmappable-html', `a <${tag.name}> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone`, html, tag.end, place)
  const node = heldNode(json, levels)
  if (node.fault !== undefined) return refused(node.fault.code, node.fault.message, html, tag.end, place)
  const shown = `${carryContent(node.value, element)}</${element}>`
  if (html.startsWith(shown, tag.end)) return success({ end: tag.end + shown.length, node: node.value })
  let at = tag.end
  while (html[at] === shown[at - tag.end]) at += 1
  return refused('unmappable-html', `a carry element shows its node's text as adfToHtml writes it, then ends at </${element}>; an edit to it is no edit to the node: ${foundAt(html, at)}`, html, at, place)
}

function heldNode(json: string, levels: number): Read<AdfNode> {
  const held = carriedValue(json, holder, { code: 'unmappable-html', message: `${holder} holds invalid JSON` })
  if (held.fault !== undefined) return held
  const nested = carriedNesting(held.value, levels)
  if (nested.fault !== undefined) return nested
  if (!spellsCanonicalJson(held.value, 'compact', json, holdableJson)) {
    return { fault: { code: 'unsupported-node-shape', message: "a carry element spells its node's JSON canonically: compact, keys sorted, a character HTML cannot hold as a JSON escape" } }
  }
  return carriedNode(nested.value, holder)
}

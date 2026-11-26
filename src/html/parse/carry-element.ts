import type { AdfNode } from '../../adf/document.ts'
import type { Read } from '../../result.ts'
import { carriedNesting, carriedNode, carriedValue } from '../../adf/carried-json.ts'
import { carryContent } from '../carry-content.ts'
import { carryJsonOffset, readCarryAttributes } from '../carry-attributes.ts'
import { classesOfElement } from '../node-element.ts'
import { colourAttributeOn } from '../mark-elements.ts'
import { foundAt, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { holdableJson, readsAsShown } from '../escaping.ts'
import { mediaGroupClass, panelClass } from '../block-classes.ts'
import { spellsCanonicalJson } from '../../canonical-json.ts'
import { success } from '../../result.ts'

const holder = "a carry element's data-adf"

// What the element shows must read back as `adfToHtml` shows its node, so an edit to it is refused rather than dropped (README goal 7).
export function readCarry(html: string, tag: StartTag, element: 'div' | 'span', levels: number, place: Place): ReadNode {
	const json = readCarryAttributes(tag.attributes)
	if (json === undefined) {
		return refused('unmappable-html', `a <${element}> of the dialect ${spellings(element)}: ${foundAt(html, tag.start)}`, html, tag.start, place)
	}
	const jsonAt = tag.start + carryJsonOffset(tag.name)
	const node = heldNode(json, levels, html, jsonAt)
	if (node.fault !== undefined) return refused(node.fault.code, node.fault.message, html, jsonAt, place)
	const shown = `${carryContent(node.value, element)}</${element}>`
	const read = readsAsShown(html, tag.end, shown)
	if (read.whole) return success({ end: read.at, node: node.value })
	return refused('unmappable-html', `a carry element shows what adfToHtml writes for its node, as it or a browser spells it, then </${element}>; to change the node, edit its ADF and write the HTML again: ${foundAt(html, read.at)}`, html, read.at, place)
}

// Every way the dialect spells the element, so a refusal names the one meant.
function spellings(element: 'div' | 'span'): string {
	const carry = 'is a carry element, holding class="adf-carry" and then data-adf alone'
	if (element === 'div') return `${carry}, or opens with class="${mediaGroupClass}" or "${panelClass}"`
	const classes = classesOfElement(element).map((name) => `"${name}"`).join(', ').replace(/, (?=[^,]*$)/, ' or ')
	return `${carry}, opens with class=${classes}, or holds ${colourAttributeOn(element)} alone`
}

function heldNode(json: string, levels: number, html: string, jsonAt: number): Read<AdfNode> {
	const held = carriedValue(json, holder, { code: 'unmappable-html', message: `${holder} holds invalid JSON` })
	if (held.fault !== undefined) return held
	const nested = carriedNesting(held.value, levels)
	if (nested.fault !== undefined) return nested
	if (!spellsCanonicalJson(held.value, 'compact', json, holdableJson)) {
		return { fault: { code: 'unsupported-node-shape', message: `a carry element spells its node's JSON canonically: compact, keys sorted, each character HTML cannot hold spelled as a JSON escape: ${foundAt(html, jsonAt)}` } }
	}
	return carriedNode(nested.value, holder)
}

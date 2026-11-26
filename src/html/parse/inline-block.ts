import type { AdfAttributes, AdfMark, AdfNode } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { Read } from '../../result.ts'
import { misread, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { readInline } from './inline.ts'
import { readTextBlockAttributes } from '../text-block-attributes.ts'
import { success } from '../../result.ts'

// `own`: the attributes the element itself writes, such as a heading's level.
export function readInlineBlock(html: string, tag: StartTag, type: string, vocabulary: AttributeVocabulary, own: AdfAttributes, place: Place): ReadNode {
	const written = Object.keys(own)
	const marked = type === 'paragraph' || type === 'heading'
	const held = marked ? readTextBlockAttributes(tag.attributes, tag.name, vocabulary, written) : readUnmarked(tag, vocabulary, written)
	if (held.fault !== undefined) return refused(held.fault.code, held.fault.message, html, tag.start, place)
	const inline = readInline(html, tag.end, place)
	if (!inline.ok) return inline
	const { end, nodes } = inline.value
	const closer = `</${tag.name}>`
	if (!html.startsWith(closer, end)) {
		const stop = misread(html, end, `${closer} ends the ${type}, and its text spells < as &lt;`, 'no inline element of the dialect')
		return refused('unmappable-html', stop.message, html, stop.at, place)
	}
	const node = built(type, { ...own, ...held.value.attrs }, nodes)
	return success({ end: end + closer.length, node: held.value.marks.length === 0 ? node : { ...node, marks: held.value.marks } })
}

function readUnmarked(tag: StartTag, vocabulary: AttributeVocabulary, written: readonly string[]): Read<{ attrs: AdfAttributes; marks: AdfMark[] }> {
	const data = readDataAttributes(tag.attributes, tag.name, vocabulary, written)
	return data.fault === undefined ? { value: { attrs: data.value, marks: [] } } : data
}

// The node an element holding no attribute or content reads as: `adfToHtml` writes a node holding an empty `attrs` or `content` as a carry.
export function built(type: string, attrs: AdfAttributes, content: AdfNode[]): AdfNode {
	return { ...(Object.keys(attrs).length === 0 ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

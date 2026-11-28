import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { blockNodeModel, isHeadingLevel } from '../../adf/block-nodes.ts'
import { codeLanguages, linkedAddress, panelColours, spellableAlt, spellableImageUrl, spellableUrl, storedHref } from '../spellings.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { identicalMark, identicalMarks, mergeAdjacentText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { imageText, shownCard, taskMarker } from '../../plain-text/shown-node.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { largestNesting } from '../../nesting.ts'
import { layoutOf } from '../../plain-text/layout.ts'
import { listTypes, macroOf, plainTable } from './spelled-blocks.ts'
import { oneLine, shownText, visibleText } from '../../adf/shown-text.ts'

// `depth`: the nesting level, as `largestNesting` counts it; `parent`: the node holding this one, from which a refusal's path is built.
type Place = { depth: number; index: number; node: AdfNode; parent: Place | undefined }

// The reduced form of each block reduced so far.
type Reduction = Map<AdfNode, AdfNode[]>

const cellTypes = ['tableCell', 'tableHeader']
const checkedMarkTypes = ['code', 'em', 'strike', 'strong', 'subsup', 'underline']
const hardBreak: AdfNode = { type: 'hardBreak' }
const taskTypes = ['blockTaskItem', 'taskItem']

// spec/wiki.md, The lossy writer: the document's blocks as the nodes the lossless writer spells, each keeping the content of what it replaces. A document past 500 levels, counted as `adfToPlainText` counts them, is refused first.
export function lossyForm(content: readonly AdfNode[]): Result<AdfNode[]> {
	const deep = nodeTooDeep(content)
	if (deep !== undefined) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the lossy wiki writer writes`, pathTo(deep))
	return success(unnested(withoutBlank(reducedBlocks(content)), 0))
}

// The first node in document order nested past `largestNesting` levels.
function nodeTooDeep(content: readonly AdfNode[]): Place | undefined {
	const pending: Place[] = places(content, 0, undefined)
	for (let place = pending.pop(); place !== undefined; place = pending.pop()) {
		if (place.depth > largestNesting) return place
		append(pending, places(nodeContent(place.node), place.depth + layoutOf(place.node).level, place))
	}
	return undefined
}

// The places of `nodes`, last first, so a stack pops them in document order.
function places(nodes: readonly AdfNode[], depth: number, parent: Place | undefined): Place[] {
	return nodes.map((node, index) => ({ depth, index, node, parent })).reverse()
}

function pathTo(place: Place): ConvertErrorPath {
	const path: (number | string)[] = []
	for (let held: Place | undefined = place; held !== undefined; held = held.parent) path.push(held.index, 'content')
	return path.reverse()
}

// A stack rather than recursion (docs/decisions.md §Nothing recurses unbounded): every block is gathered before the blocks it holds, then reduced after them, so each reduction reads reduced blocks alone.
function reducedBlocks(content: readonly AdfNode[]): AdfNode[] {
	const gathered: AdfNode[] = []
	const pending: AdfNode[] = notLoose(content)
	for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
		gathered.push(node)
		append(pending, heldBlocks(node))
	}
	const reduction: Reduction = new Map()
	for (const node of gathered.reverse()) reduction.set(node, block(node, reduction))
	return blocks(content, reduction)
}

// The blocks whose reduced form the reduction of `node` reads: none where it reads its content as a line.
function heldBlocks(node: AdfNode): AdfNode[] {
	const content = nodeContent(node)
	if (blockNodeModel(node.type)?.contentModel === 'inline') return []
	if (node.type === 'table') return content.flatMap((row) => (row.type === 'tableRow' ? nodeContent(row).flatMap((cell) => (cellTypes.includes(cell.type) ? notLoose(nodeContent(cell)) : [cell])) : [row]))
	if (node.type !== 'taskList' && !listTypes.includes(node.type)) return notLoose(content)
	return content.flatMap((child) => (child.type === 'taskItem' ? [] : notLoose(child.type === 'blockTaskItem' ? nodeContent(child) : [child])))
}

// `heldBlocks` names every block a reduction reads, so each is in `reduction` by then.
function reducedBlock(node: AdfNode, reduction: Reduction): AdfNode[] {
	return reduction.get(node) ?? []
}

// A loose node is text or an inline node, which stands in a line.
function isLoose(node: AdfNode): boolean {
	return node.type === 'text' || inlineNodeModel(node.type) !== undefined
}

function notLoose(nodes: readonly AdfNode[]): AdfNode[] {
	return nodes.filter((node) => !isLoose(node))
}

// A `{quote}` or a `{panel}` can't hold its own kind, so one inside another of its kind stands as its blocks.
function unnested(nodes: readonly AdfNode[], held: number): AdfNode[] {
	const kept: AdfNode[] = []
	for (const node of nodes) {
		const macro = macroOf(node)
		if (macro === 0) kept.push(node)
		else {
			const inner = unnested(nodeContent(node), held | macro)
			if ((held & macro) === 0) kept.push({ ...node, content: inner })
			else append(kept, inner)
		}
	}
	return kept
}

function blocks(nodes: readonly AdfNode[], reduction: Reduction): AdfNode[] {
	const reduced: AdfNode[] = []
	let loose: AdfNode[] = []
	const closeLoose = (): void => {
		if (loose.length > 0) reduced.push(paragraph(inlines(loose)))
		loose = []
	}
	for (const node of nodes) {
		if (isLoose(node)) loose.push(node)
		else {
			closeLoose()
			append(reduced, reducedBlock(node, reduction))
		}
	}
	closeLoose()
	return reduced
}

function block(node: AdfNode, reduction: Reduction): AdfNode[] {
	const content = nodeContent(node)
	switch (node.type) {
		case 'blockquote':
			return container('blockquote', withoutBlank(blocks(content, reduction)))
		case 'bulletList':
		case 'orderedList':
		case 'taskList':
			return list(node.type === 'orderedList' ? 'orderedList' : 'bulletList', content, reduction)
		case 'codeBlock':
			return codeBlock(node)
		case 'expand':
		case 'nestedExpand':
			return [...titleParagraph(shownText(node)), ...blocks(content, reduction)]
		case 'heading':
			return heading(node)
		case 'media':
			return imageBlock(node)
		case 'panel':
			return panel(node, reduction)
		case 'rule':
			return [{ type: 'rule' }]
		case 'table':
			return table(content, reduction)
		default:
			return otherBlock(node, reduction)
	}
}

// A block of a type with no spelling is its text, then its blocks.
function otherBlock(node: AdfNode, reduction: Reduction): AdfNode[] {
	const content = nodeContent(node)
	if (blockNodeModel(node.type)?.contentModel === 'inline') return [paragraph(inlines(content))]
	const shown = shownCard(node) ?? node.text
	const own = shown === undefined ? [] : [paragraph(inlines(textNodes(shown, [])))]
	return [...own, ...blocks(content, reduction)]
}

// A loop, since `push(...items)` throws past the engine's argument limit (docs/decisions.md §Nothing spreads an unbounded array).
function append<T>(target: T[], items: readonly T[]): void {
	for (const item of items) target.push(item)
}

function container(type: string, content: AdfNode[]): AdfNode[] {
	return content.length === 0 ? [] : [{ content, type }]
}

function paragraph(content: readonly AdfNode[]): AdfNode {
	return content.length === 0 ? { type: 'paragraph' } : { content: [...content], type: 'paragraph' }
}

function withoutBlank(nodes: readonly AdfNode[]): AdfNode[] {
	return nodes.filter((node) => node.type !== 'paragraph' || node.content !== undefined)
}

function titleParagraph(title: string | undefined): AdfNode[] {
	const shown = visibleText(title)
	return shown === undefined ? [] : [paragraph(inlines([textNode(shown, [{ type: 'strong' }])]))]
}

function heading(node: AdfNode): AdfNode[] {
	const { level } = nodeAttrs(node)
	const content = inlines(nodeContent(node))
	if (!isHeadingLevel(level)) return [paragraph(content)]
	return content.length === 0 ? [] : [{ attrs: { level }, content, type: 'heading' }]
}

function panel(node: AdfNode, reduction: Reduction): AdfNode[] {
	const { panelType } = nodeAttrs(node)
	const known = typeof panelType === 'string' && Object.hasOwn(panelColours, panelType)
	const content = withoutBlank(blocks(nodeContent(node), reduction))
	return content.length === 0 ? [] : [{ attrs: { panelType: known ? panelType : 'info' }, content, type: 'panel' }]
}

function codeBlock(node: AdfNode): AdfNode[] {
	const code = nodeContent(node).map((child) => child.text ?? '').join('').replaceAll(/\r\n?/gu, '\n')
	if (code === '') return []
	if (code.includes('{code}') || code.includes('{noformat}')) return [paragraph(inlines(textNodes(code, [])))]
	const { language } = nodeAttrs(node)
	const lower = typeof language === 'string' ? language.toLowerCase() : ''
	return [{ attrs: { language: codeLanguages.includes(lower) ? lower : '' }, content: [{ text: code, type: 'text' }], type: 'codeBlock' }]
}

// An external image whose encoded address wiki markup spells stays an image block; an external image with any other address is its alt and address as text, and any other image its alt, else `[image]`. What the image can't hold follows as paragraphs: an alt it can't spell, and the link around it.
function imageBlock(media: AdfNode): AdfNode[] {
	const { alt, type, url } = nodeAttrs(media)
	const shownAlt = visibleText(alt)
	const address = visibleText(url)
	const spelledAlt = shownAlt === undefined ? undefined : oneLine(shownAlt).trim()
	const spellable = spelledAlt !== undefined && spellableAlt.test(spelledAlt)
	const external = type === 'external'
	const encoded = address === undefined ? '' : urlEncoded(address).replaceAll('!', '%21')
	const written = external && spellableImageUrl.test(encoded)
	const image: AdfNode[] = written ? [{ attrs: { layout: 'center' }, content: [{ attrs: spellable ? { alt: spelledAlt, type, url: encoded } : { type, url: encoded }, type: 'media' }], type: 'mediaSingle' }] : []
	const altText = written ? (spellable ? undefined : shownAlt) : imageText(shownAlt, external ? address : undefined, undefined)
	const altParagraph = altText === undefined ? [] : [paragraph(inlines(textNodes(altText, [])))]
	const link = nodeMarks(media).find(({ type: markType }) => markType === 'link')
	const linked = link === undefined ? undefined : cleanMark(link)
	return [...image, ...altParagraph, ...(linked === undefined ? [] : [paragraph(inlines([textNode(String(nodeAttrs(linked)['href']), [linked])]))])]
}

function urlEncoded(url: string): string {
	return storedHref(url.trim().replace(/[\s[\]{}|\\]/gu, (character) => encodeURIComponent(character)))
}

// A list a child holds after an item joins that item's parts, so each item is reduced once.
function list(type: string, children: readonly AdfNode[], reduction: Reduction): AdfNode[] {
	const itemParts: AdfNode[][] = []
	for (const child of children) {
		const last = itemParts.at(-1)
		if (last !== undefined && (listTypes.includes(child.type) || child.type === 'taskList')) append(last, reducedBlock(child, reduction))
		else itemParts.push(itemBlocks(child, reduction))
	}
	const items = itemParts.flatMap(listItems)
	return items.length === 0 ? [] : [type === 'orderedList' ? { attrs: { order: 1 }, content: items, type } : { content: items, type }]
}

// A task item keeps its state as a marker leading its text.
function itemBlocks(item: AdfNode, reduction: Reduction): AdfNode[] {
	if (!taskTypes.includes(item.type)) return blocks([item], reduction)
	const content = nodeContent(item)
	const inner = item.type === 'taskItem' ? [paragraph(inlines(content))] : blocks(content, reduction)
	const marker = textNode(taskMarker(item), [])
	const [first, ...rest] = inner
	return first?.type === 'paragraph' ? [paragraph(inlines([marker, ...nodeContent(first)])), ...rest] : [paragraph([marker]), ...inner]
}

// A block after a list starts an item of its own, so the document's order stands.
function listItems(parts: readonly AdfNode[]): AdfNode[] {
	const items: AdfNode[] = []
	let texts: (readonly AdfNode[])[] = []
	let lists: { content: AdfNode[]; node: AdfNode }[] = []
	const closeItem = (): void => {
		if (texts.length > 0 || lists.length > 0) items.push({ content: [paragraph(joinedLines(texts)), ...lists.map(({ content, node }) => ({ ...node, content }))], type: 'listItem' })
		texts = []
		lists = []
	}
	const [first, ...rest] = parts
	const others = first?.type === 'paragraph' ? rest : parts
	if (first?.type === 'paragraph') texts.push(nodeContent(first))
	for (const part of others) {
		const previous = lists.at(-1)
		if (!listTypes.includes(part.type)) {
			if (lists.length > 0) closeItem()
			append(texts, lines(part))
		} else if (previous?.node.type === part.type) append(previous.content, nodeContent(part))
		else lists.push({ content: [...nodeContent(part)], node: part })
	}
	closeItem()
	return items.length === 0 ? [{ content: [paragraph([])], type: 'listItem' }] : items
}

// A table holds rows of cells; what else it holds stands after it, as its blocks.
function table(rows: readonly AdfNode[], reduction: Reduction): AdfNode[] {
	const spelled: AdfNode[] = []
	const after: AdfNode[] = []
	for (const row of rows) {
		if (row.type === 'tableRow') append(spelled, tableRow(row, after, reduction))
		else append(after, reducedBlock(row, reduction))
	}
	return [...(spelled.length === 0 ? [] : [{ attrs: plainTable, content: spelled, type: 'table' }]), ...after]
}

function tableRow(row: AdfNode, after: AdfNode[], reduction: Reduction): AdfNode[] {
	const cells: AdfNode[] = []
	for (const cell of nodeContent(row)) {
		if (cellTypes.includes(cell.type)) cells.push({ content: [paragraph(joinedLines(blocks(nodeContent(cell), reduction).flatMap(lines)))], type: cell.type })
		else append(after, reducedBlock(cell, reduction))
	}
	return cells.length === 0 ? [] : [{ content: cells, type: 'tableRow' }]
}

// The inline content of each line a reduced block shows, as it would stand in a table cell or a list item.
function lines(block: AdfNode): AdfNode[][] {
	const shown: AdfNode[][] = []
	const pending: AdfNode[] = [block]
	for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
		const content = nodeContent(node)
		if (node.type === 'codeBlock') append(shown, content.flatMap((child) => (child.text ?? '').split('\n').map((line) => (line === '' ? [] : [textNode(line, [])]))))
		else if (node.type === 'media') shown.push([imageLine(node)])
		else if (node.type !== 'heading' && node.type !== 'paragraph') append(pending, [...content].reverse())
		else if (content.length > 0) shown.push([...content])
	}
	return shown
}

// The alt and the address of a reduced image, which a cell or a list item holds as text.
function imageLine(media: AdfNode): AdfNode {
	const { alt, url } = nodeAttrs(media)
	return textNode(imageText(visibleText(alt), visibleText(url), undefined), [])
}

function joinedLines(parts: readonly (readonly AdfNode[])[]): AdfNode[] {
	return parts.flatMap((part, index) => (index === 0 ? part : [hardBreak, ...part]))
}

// The inline nodes of a line: text, hard breaks and mentions, each with the marks wiki markup spells.
function inlines(nodes: readonly AdfNode[]): AdfNode[] {
	const spelled = mergedText(inlineNodes(nodes)).flatMap(partedEdges)
	return trimmed(mergedText(withLinkTitles(mergedText(spelled))))
}

// Every node the line holds at any depth, in document order: its own text, then what it holds.
function inlineNodes(nodes: readonly AdfNode[]): AdfNode[] {
	const shown: AdfNode[] = []
	const pending: AdfNode[] = [...nodes].reverse()
	for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
		const whole = wholeInline(node)
		append(shown, whole ?? textNodes(shownCard(node) ?? node.text ?? '', cleanMarks(nodeMarks(node))))
		append(pending, [...nodeContent(node)].reverse())
	}
	return shown
}

// What a hard break, a mention and an inline image show, none of which holds content; `undefined` for any other node.
function wholeInline(node: AdfNode): AdfNode[] | undefined {
	if (node.type === 'hardBreak') return [hardBreak]
	const { alt, id } = nodeAttrs(node)
	if (node.type === 'mention' && typeof id === 'string' && spellableUrl.test(id)) return [{ attrs: { accessLevel: '', id }, type: 'mention' }]
	return node.type === 'mediaInline' ? textNodes(imageText(visibleText(alt), undefined, undefined), cleanMarks(nodeMarks(node))) : undefined
}

function textNode(text: string, marks: readonly AdfMark[]): AdfNode {
	return marks.length === 0 ? { text, type: 'text' } : { marks: [...marks], text, type: 'text' }
}

// A line feed in a text is a hard break, as the reader reads it.
function textNodes(text: string, marks: readonly AdfMark[]): AdfNode[] {
	return text
		.replaceAll('\r', '')
		.split('\n')
		.flatMap((line, index) => [...(index > 0 ? [hardBreak] : []), ...(line === '' ? [] : [textNode(line, marks)])])
}

function cleanMarks(marks: readonly AdfMark[]): AdfMark[] {
	const clean: AdfMark[] = []
	for (const mark of marks) {
		const spelled = cleanMark(mark)
		if (spelled !== undefined && !clean.some(({ type }) => type === spelled.type)) clean.push(spelled)
	}
	return clean
}

function cleanMark(mark: AdfMark): AdfMark | undefined {
	const attrs = nodeAttrs(mark)
	if (['code', 'em', 'strike', 'strong', 'underline'].includes(mark.type)) return { type: mark.type }
	if (mark.type === 'subsup') return attrs['type'] === 'sub' || attrs['type'] === 'sup' ? { attrs: { type: attrs['type'] }, type: 'subsup' } : undefined
	if (mark.type === 'textColor') return typeof attrs['color'] === 'string' ? colourMark(attrs['color']) : undefined
	if (mark.type !== 'link') return undefined
	const { href, title } = attrs
	const address = visibleText(href)
	const caption = typeof title === 'string' ? oneLine(title).trim() : ''
	if (address === undefined) return undefined
	return caption === '' ? { attrs: { href: urlEncoded(address) }, type: 'link' } : { attrs: { href: urlEncoded(address), title: caption }, type: 'link' }
}

function colourMark(colour: string): AdfMark | undefined {
	const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(colour)
	if (short !== null) return { attrs: { color: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` }, type: 'textColor' }
	return /^#[0-9a-f]{6}$/i.test(colour) ? { attrs: { color: colour }, type: 'textColor' } : undefined
}

function mergedText(nodes: readonly AdfNode[]): AdfNode[] {
	return mergeAdjacentText(nodes, (previous, node) => previous.type === 'text' && node.type === 'text' && identicalMarks(nodeMarks(previous), nodeMarks(node)))
}

// A delimiter reads beside no whitespace inside it, so whitespace at the edge of a text it marks stands outside.
function partedEdges(node: AdfNode): AdfNode[] {
	const { text } = node
	if (text === undefined || !nodeMarks(node).some(({ type }) => checkedMarkTypes.includes(type))) return [node]
	const body = text.trim()
	if (body === '') return [textNode(text, [])]
	const before = text.slice(0, text.length - text.trimStart().length)
	const after = text.slice(text.trimEnd().length)
	return [...(before === '' ? [] : [textNode(before, [])]), { ...node, text: body }, ...(after === '' ? [] : [textNode(after, [])])]
}

// Jira drops the title of a link written `[text|href|title]` and shows an address it doesn't link as text, so such a link's address and title follow its text in parentheses.
function withLinkTitles(nodes: readonly AdfNode[]): AdfNode[] {
	const titled: AdfNode[] = []
	let open: AdfMark | undefined
	let shown = ''
	for (const node of nodes) {
		const marks = nodeMarks(node)
		const held = open
		if (held !== undefined && !marks.some((mark) => identicalMark(mark, held))) {
			titled.push(...linkSuffix(held, shown))
			open = undefined
			shown = ''
		}
		open = open ?? marks.find(needsSuffix)
		const link = open
		if (link === undefined) titled.push(node)
		else {
			shown += node.text ?? ''
			titled.push(textNode(node.text ?? '', marks.flatMap((mark) => (identicalMark(mark, link) ? linkOnly(link) : [mark]))))
		}
	}
	return open === undefined ? titled : [...titled, ...linkSuffix(open, shown)]
}

function linkOnly(link: AdfMark): AdfMark[] {
	const { href } = nodeAttrs(link)
	return typeof href === 'string' && linkedAddress(href) ? [{ attrs: { href }, type: 'link' }] : []
}

function needsSuffix(mark: AdfMark): boolean {
	return mark.type === 'link' && (typeof nodeAttrs(mark)['title'] === 'string' || linkOnly(mark).length === 0)
}

function linkSuffix(link: AdfMark, shown: string): AdfNode[] {
	const { href, title } = nodeAttrs(link)
	const parts = [linkOnly(link).length === 0 && href !== shown ? String(href) : undefined, typeof title === 'string' ? title : undefined]
	return parts.flatMap((part) => (part === undefined ? [] : [textNode(` (${part})`, [])]))
}

// A line starts and ends at text that isn't whitespace.
function trimmed(nodes: readonly AdfNode[]): AdfNode[] {
	const blank = nodes.map((node) => node.text !== undefined && node.text.trim() === '')
	const start = blank.indexOf(false)
	if (start === -1) return []
	const kept = nodes.slice(start, blank.lastIndexOf(false) + 1)
	return kept.map((node, index) => {
		if (node.text === undefined) return node
		const text = index === 0 ? node.text.trimStart() : node.text
		return { ...node, text: index === kept.length - 1 ? text.trimEnd() : text }
	})
}

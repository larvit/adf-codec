import type { AdfDocument, AdfNode } from '../adf/document.ts'
import type { Layout } from './layout.ts'
import { bulletLists, cellTypes, layoutOf } from './layout.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { imageText, linkSuffix, shownCard, taskMarker } from './shown-node.ts'
import { largestNesting } from '../nesting.ts'
import { linkAttrs, type LinkAttrs } from '../adf/mark-attributes.ts'
import { longestOutput, tooLong } from '../length-bound.ts'
import { nodeAttrs, nodeContent, nodeMarks, writeAdf } from '../adf/document.ts'
import { shownLink, shownText, shownUrl, visibleText } from '../adf/shown-text.ts'

// `parent`: the node holding this one.
type Place = { index: number; parent: Place | undefined }
// `gap`: the line feeds the next text needs before it at least; `leave`: the state to restore after a list item, and its `length` at the start, which shows whether it wrote anything; `leaveCell`: the cell to restore after a table cell, with the `gap` and `literal` to restore too where the cell wrote no text; `separator`: the bar between two cells of a row; `marker`: the marker this node has in its list; `suffix`: text written right after this node; `depth`: the nesting level as `largestNesting` counts it; `place`: where the node stands, from which a refusal's path is built.
type Step =
	| { kind: 'gap'; lines: number }
	| { kind: 'leave'; indent: string; lead: string | undefined; length: number }
	| { kind: 'leaveCell'; cell: Cell | undefined; gap: number; literal: number }
	| { depth: number; kind: 'node'; marker: string | undefined; node: AdfNode; place: Place | undefined; suffix: string | undefined }
	| { kind: 'separator' }

// The text written so far. `pieces`: the text in order, `length` its total; `gap`: the line feeds the layout owes before the next text at least, and `literal` the line feeds the text before it ended in, of which the larger count is written; `lead`: the marker of the item the next text opens; `indent`: the margin of every line after that; `cell`: the table cell being written.
type Writing = { cell: Cell | undefined; gap: number; indent: string; lead: string | undefined; length: number; literal: number; pieces: string[] }

// A table cell being written: its text goes on the row's line, without the row's margin; `start` is the `length` where the cell began, and `owed` the line feeds owed there, the only ones its first text may write.
type Cell = { owed: number; start: number }

const cardTypes = ['blockCard', 'embedCard', 'inlineCard']
const expandTypes = ['expand', 'nestedExpand']
const imageTypes = ['media', 'mediaInline']
const markedItems = ['blockTaskItem', 'decisionItem', 'listItem', 'taskItem']
const shownTextTypes = ['date', 'emoji', 'extension', 'inlineExtension', 'mention', 'status']

export function adfToPlainText(document: AdfDocument): Result<string> {
	return writeAdf(document, (_read, content) => writeText(content ?? []))
}

// A stack rather than recursion (docs/decisions.md §Nothing recurses unbounded). Text is written the moment it is met.
function writeText(content: readonly AdfNode[]): Result<string> {
	const writing: Writing = { cell: undefined, gap: 0, indent: '', lead: undefined, length: 0, literal: 0, pieces: [] }
	const pending: Step[] = childSteps(content, { level: 1, lines: 2 }, 0, undefined, () => undefined).reverse()
	for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
		if (step.kind === 'node') {
			const refusal = openNode(writing, step, pending)
			if (refusal !== undefined) return refusal
		} else applyStep(writing, step)
		if (writing.length > longestOutput) return tooLong()
	}
	return success(writing.pieces.join(''))
}

function applyStep(writing: Writing, step: Exclude<Step, { kind: 'node' }>): void {
	if (step.kind === 'gap') writing.gap = Math.max(writing.gap, step.lines)
	else if (step.kind === 'separator') emit(writing, ' | ')
	else if (step.kind === 'leave') {
		writing.indent = step.indent
		writing.lead = step.length === writing.length ? step.lead : undefined
	} else {
		const written = writing.cell !== undefined && writing.length > writing.cell.start
		writing.gap = written ? 0 : step.gap
		writing.literal = written ? 0 : step.literal
		writing.cell = step.cell
	}
}

// Writes the text of a node, and pushes the steps for the nodes within it; refuses a node nested too deep.
function openNode(writing: Writing, step: Extract<Step, { kind: 'node' }>, pending: Step[]): Result<string> | undefined {
	const { depth, marker, node, place, suffix } = step
	if (depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, pathTo(place))
	if (cellTypes.includes(node.type)) {
		pending.push({ cell: writing.cell, gap: writing.gap, kind: 'leaveCell', literal: writing.literal })
		writing.cell = { owed: Math.max(writing.gap, writing.literal), start: writing.length }
	}
	if (marker !== undefined) {
		pending.push({ indent: writing.indent, kind: 'leave', lead: writing.lead, length: writing.length })
		writing.lead = writing.lead === undefined ? `${writing.indent}${marker}` : `${writing.lead}${marker}`
		writing.indent = `${writing.indent}${' '.repeat(marker.length)}`
	}
	if (node.type === 'hardBreak') writing.gap += 1
	else if (shownTextTypes.includes(node.type)) emit(writing, shownText(node) ?? '')
	else if (cardTypes.includes(node.type)) emit(writing, shownCard(node) ?? '')
	else if (imageTypes.includes(node.type)) emit(writing, imageText(visibleText(nodeAttrs(node)['alt']), shownUrl(node), shownLink(node)))
	else {
		const title = expandTypes.includes(node.type) ? shownText(node) : undefined
		emit(writing, `${node.text ?? title ?? ''}${suffix ?? ''}`)
		const inner = stepsWithin(node, depth, place)
		if (title !== undefined) inner.unshift({ kind: 'gap', lines: 2 })
		for (const child of inner.reverse()) pending.push(child)
	}
	return undefined
}

// In a cell, the text goes on the row's line: before its first text only the line feeds owed at the cell's start are written, after it a line feed owed or in the text becomes a space, and a list marker keeps its place without any margin.
function emit(writing: Writing, text: string): void {
	const end = endBeforeLineFeeds(text)
	if (end > 0) {
		const { cell, indent, lead, length } = writing
		const started = cell !== undefined && length > cell.start
		const owed = cell !== undefined && !started ? cell.owed : Math.max(writing.gap, writing.literal)
		const marker = lead?.trimStart() ?? ''
		let head = ''
		if (cell !== undefined && (started || owed === 0)) head = started ? (owed > 0 ? ` ${marker}` : '') : marker
		else if (length === 0 || owed > 0) head = `${length === 0 ? '' : '\n'.repeat(owed)}${lead ?? indent}`
		const kept = text.slice(0, end)
		const body = cell === undefined ? kept.replaceAll(/\n(?=[^\n])/g, `\n${indent}`) : kept.replaceAll(/\n+/g, ' ')
		writing.pieces.push(head, body)
		writing.length += head.length + body.length
		writing.gap = 0
		writing.lead = undefined
	}
	writing.literal = (end > 0 ? 0 : writing.literal) + (text.length - end)
}

function endBeforeLineFeeds(text: string): number {
	let end = text.length
	while (end > 0 && text[end - 1] === '\n') end -= 1
	return end
}

function stepsWithin(node: AdfNode, depth: number, place: Place | undefined): Step[] {
	const layout = layoutOf(node)
	return childSteps(nodeContent(node), layout, depth + layout.level, place, markerFor(node))
}

// The steps for `nodes` in document order, `layout.lines` line feeds apart, or bar-separated where the layout holds cells.
function childSteps(nodes: readonly AdfNode[], layout: Layout, depth: number, parent: Place | undefined, markerFor: (index: number, node: AdfNode) => string | undefined): Step[] {
	const steps: Step[] = []
	const links = nodes.map(linkOf)
	let run = ''
	for (const [index, node] of nodes.entries()) {
		if (index > 0) steps.push(layout.cells === true ? { kind: 'separator' } : { kind: 'gap', lines: layout.lines })
		const link = links[index]
		const before = links[index - 1]
		run = link !== undefined && before !== undefined && sameLink(link, before) ? `${run}${node.text ?? ''}` : node.text ?? ''
		const after = links[index + 1]
		const ends = link !== undefined && !(after !== undefined && sameLink(link, after))
		steps.push({ depth, kind: 'node', marker: markerFor(index, node), node, place: { index, parent }, suffix: ends && run !== '' ? linkSuffix(link, run) : undefined })
	}
	return steps
}

function linkOf(node: AdfNode): LinkAttrs | undefined {
	const mark = nodeMarks(node).find((held) => held.type === 'link')
	return node.type === 'text' && mark !== undefined ? linkAttrs(nodeAttrs(mark)) : undefined
}

function sameLink(left: LinkAttrs, right: LinkAttrs): boolean {
	return left.href === right.href && left.title === right.title
}

// A child of a list that is no item, such as a task list nested in one, gets blank margin so it stands under the item before it.
function markerFor(node: AdfNode): (index: number, child: AdfNode) => string | undefined {
	if (bulletLists.includes(node.type)) return (_index, child) => (markedItems.includes(child.type) ? bulletOf(child) : '  ')
	if (node.type !== 'orderedList') return () => undefined
	const order = nodeAttrs(node)['order']
	const first = typeof order === 'number' && Number.isSafeInteger(order) ? order : 1
	return (index, child) => {
		const number = `${first + index}. `
		return markedItems.includes(child.type) ? number : ' '.repeat(number.length)
	}
}

function bulletOf(item: AdfNode): string {
	return item.type === 'blockTaskItem' || item.type === 'taskItem' ? taskMarker(item) : '• '
}

function pathTo(place: Place | undefined): ConvertErrorPath {
	const indexes: number[] = []
	for (let held = place; held !== undefined; held = held.parent) indexes.push(held.index)
	return indexes.reverse().flatMap((index) => ['content', index])
}

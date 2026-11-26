import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { blockCarry } from '../carry.ts'
import { joinedWithin, withinEngineLimits } from '../../length-bound.ts'
import { lossyForm } from './lossy-form.ts'
import { nodeAttrs, nodeContent, readAdfDocument, writableContent } from '../../adf/document.ts'
import { panelColours } from '../spellings.ts'
import { spelledBlocks, type Spelling } from './spelled-blocks.ts'

// `prefix`: the markers of the lists holding the block, one character per level.
type Pending = string | { node: AdfNode; prefix: string }

const listMarkers: ReadonlyMap<string, string> = new Map([['bulletList', '*'], ['orderedList', '#']])

export function adfToLosslessJiraWiki(document: AdfDocument): Result<string> {
	return withinEngineLimits(() => {
		const read = readAdfDocument(document)
		if (!read.ok) return read
		const content = writableContent(read.value)
		if (!content.ok) return content
		return content.value === undefined ? blockCarry(read.value, []) : writeWiki(content.value, false)
	})
}

// spec/wiki.md, The lossy writer.
export function adfToLossyJiraWiki(document: AdfDocument): Result<string> {
	return withinEngineLimits(() => {
		const read = readAdfDocument(document)
		if (!read.ok) return read
		const content = writableContent(read.value)
		if (!content.ok) return content
		const reduced = lossyForm(content.value ?? [])
		return reduced.ok ? writeWiki(reduced.value, true) : reduced
	})
}

// Every block a spelled block holds is spelled too, so only the document's own blocks ride.
function writeWiki(content: readonly AdfNode[], lossy: boolean): Result<string> {
	const found = spelledBlocks(content, lossy)
	if (!found.ok) return found
	const spelled = found.value
	const pieces: string[] = []
	for (const [index, node] of content.entries()) {
		if (index > 0) pieces.push('\n\n')
		const spelling = spelled.get(node)
		if (spelling === undefined || spelling.blank) {
			const carry = blockCarry(node, ['content', index])
			if (!carry.ok) return carry
			pieces.push(carry.value)
		} else writeSpelled(node, spelled, pieces)
	}
	return joinedWithin(pieces)
}

// A stack rather than recursion (docs/decisions.md §Nothing recurses unbounded).
function writeSpelled(root: AdfNode, spelled: ReadonlyMap<AdfNode, Spelling>, pieces: string[]): void {
	const pending: Pending[] = [{ node: root, prefix: '' }]
	for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
		if (typeof next === 'string') pieces.push(next)
		else for (const piece of blockPieces(next.node, next.prefix, spelled).reverse()) pending.push(piece)
	}
}

function blockPieces(node: AdfNode, prefix: string, spelled: ReadonlyMap<AdfNode, Spelling>): Pending[] {
	const text = spelled.get(node)?.text
	if (text !== undefined) return [text]
	const content = nodeContent(node)
	const marker = listMarkers.get(node.type)
	if (marker !== undefined) return listPieces(content, `${prefix}${marker}`)
	if (node.type === 'table') return tablePieces(content)
	const [only] = content
	if (node.type === 'blockquote' && content.length === 1 && only?.type === 'paragraph') return ['bq. ', { node: only, prefix: '' }]
	const colour = node.type === 'panel' ? panelColours[String(nodeAttrs(node)['panelType'])] : undefined
	const [open, close] = colour === undefined ? ['{quote}', '{quote}'] : [`{panel:bgColor=${colour}}`, '{panel}']
	const blocks = content.flatMap((child, index): Pending[] => [...(index > 0 ? ['\n\n'] : []), { node: child, prefix: '' }])
	return [`${open}\n`, ...blocks, `\n${close}`]
}

// An item's paragraph stands on its marker's line, and each list it holds follows on the lines below, one marker deeper.
function listPieces(items: readonly AdfNode[], prefix: string): Pending[] {
	return items.flatMap((item, index): Pending[] =>
		nodeContent(item).flatMap((child, position): Pending[] => (position === 0 ? [`${index > 0 ? '\n' : ''}${prefix} `, { node: child, prefix }] : ['\n', { node: child, prefix }])),
	)
}

// A row closes with its last cell's delimiter.
function tablePieces(rows: readonly AdfNode[]): Pending[] {
	return rows.flatMap((row, index): Pending[] => {
		let delimiter = ''
		const cells = nodeContent(row).flatMap((cell): Pending[] => {
			delimiter = cell.type === 'tableHeader' ? '||' : '|'
			return [delimiter, ...nodeContent(cell).map((paragraph) => ({ node: paragraph, prefix: '' }))]
		})
		return [...(index > 0 ? ['\n'] : []), ...cells, delimiter]
	})
}

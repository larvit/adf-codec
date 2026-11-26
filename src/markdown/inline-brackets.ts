import type { AdfNode } from '../adf/document.ts'
import type { Image, ImageAside, Piece, Resolved, Scan } from './inline-pieces.ts'
import type { InlineTarget, LinkDefinition } from './commonmark/link-syntax.ts'
import { adfNodes, applyMark, holdsOwnMarks, isImageAside, isNode, isTextBreak, marksItem, marksLink, ownMarksInMark, record, resolveNodes } from './inline-pieces.ts'
import { centeredImage, externalMedia } from '../adf/plain-image.ts'
import { failure, success, type Result } from '../result.ts'
import { imageAside } from '../adf/image-aside.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'
import { labelLimit, normalizeLabel, readInlineTarget, readLabel } from './commonmark/link-syntax.ts'
import { linkMark, toLinkAttrs } from './mark-spellings.ts'
import { nodeAttrs } from '../adf/document.ts'
import { textBreakSpelling } from './adjacent-text.ts'

export type BracketStack = {
	// What the `]` at `index` makes of the innermost open bracket, which it closes: `undefined` where the `]` stays text.
	close: (scan: Scan, pieces: readonly Piece[], index: number) => Result<Closed> | undefined
	open: (bracket: OpenBracket) => void
}

// The pieces from `from` on give way to `pieces`, and the scan goes on at `end`.
type Closed = { end: number; from: number; pieces: Piece[] }

// `index` is the bracket's position in the scan's pieces; `start` is where its text starts in `source`.
type OpenBracket = { image: boolean; index: number; start: number }

const unlinkable = 'the text of this link holds only nodes that take no link: write the link around text beside them'

export function bracketStack(): BracketStack {
	const open: OpenBracket[] = []
	// Link openers below this index of `open` were open when a link closed, so they stay literal: no link holds another.
	let linkOpenersFrom = 0
	return {
		// A `]` that stays text still pops its bracket, so no later close walks past it.
		close: (scan, pieces, index) => {
			const bracket = open.pop()
			if (bracket === undefined) return undefined
			const closing = closeBracket(scan, { ...bracket, opensLink: open.length >= linkOpenersFrom }, pieces, index)
			linkOpenersFrom = closing.closesLink ? open.length : Math.min(linkOpenersFrom, open.length)
			return closing.built
		},
		open: (bracket) => void open.push(bracket),
	}
}

// `closesLink`: a link closes here, or these brackets hold one.
function closeBracket(scan: Scan, open: OpenBracket & { opensLink: boolean }, pieces: readonly Piece[], index: number): { built: Result<Closed> | undefined; closesLink: boolean } {
	const target = open.image || open.opensLink ? resolveTarget(scan, open.start, index) : undefined
	if (target === undefined) return { built: undefined, closesLink: false }
	const inner = pieces.slice(open.index + 1)
	// Before `linkPieces`' own-marks guard: brackets that go literal mark nothing, so a carry inside them is not an error.
	if (!open.image && holdsLink(inner)) return { built: undefined, closesLink: true }
	const built = open.image ? imagePieces(scan, inner, target.definition()) : linkPieces(scan, inner, target.definition())
	record(scan.shared, { at: scan.offset + open.start - 1, kind: 'links' })
	return { built: built.ok ? success({ end: index + 1 + target.length, from: open.index, pieces: built.value }) : built, closesLink: !open.image }
}

function resolveTarget(scan: Scan, start: number, index: number): InlineTarget | undefined {
	const after = index + 1
	if (scan.source.charAt(after) === '(') {
		const inline = readInlineTarget(scan.shared.targets, scan.offset + after)
		// The memo reads the outermost content; a target it reads holds here exactly when the target ends inside `source`.
		if (inline !== undefined && after + inline.length <= scan.source.length) return inline
	}
	const label = scan.source.charAt(after) === '[' ? readLabel(scan.source, after) : undefined
	const labelIsText = label === undefined || label.value === ''
	if (labelIsText && index - start > labelLimit) return undefined
	const name = labelIsText ? scan.source.slice(start, index) : label.value
	const definition = scan.shared.definitions.get(normalizeLabel(name))
	if (definition === undefined) return undefined
	return { definition: () => definition, length: label?.length ?? 0 }
}

// Only a link a `nodes` piece spells, or an (image)'s, makes the outer brackets literal; an `ownMarks` node's link is its own, so the own-marks guard in `linkPieces` refuses it.
function holdsLink(pieces: readonly Piece[]): boolean {
	return pieces.some((piece) => piece.kind === 'nodes' && (piece.nodes.some(isImageAside) || marksLink(piece.nodes)))
}

// An image alone in the link text keeps its piece, so a paragraph holding nothing else builds the linked image.
function linkPieces(scan: Scan, inner: readonly Piece[], definition: LinkDefinition): Result<Piece[]> {
	if (inner.some(holdsOwnMarks)) return failure('unsupported-node-shape', ownMarksInMark, scan.shared.path)
	const [only] = inner
	if (inner.length === 1 && only?.kind === 'image') return success([{ ...only, link: definition }])
	const text = resolveNodes(inner, scan, true)
	if (!text.ok) return text
	if (!text.value.some((item) => marksItem(item, 'link')) && text.value.some((item) => isNode(item) && item.type !== 'hardBreak')) {
		return failure('unsupported-node-shape', unlinkable, scan.shared.path)
	}
	const images = inner.flatMap((piece) => (piece.kind === 'image' ? [piece.definition] : []))
	return success([{ kind: 'nodes', nodes: [...linkTo(text.value, definition), ...besideLink(images, definition)] }])
}

function imagePieces(scan: Scan, inner: readonly Piece[], definition: LinkDefinition): Result<Piece[]> {
	const description = resolveNodes(inner, scan, false)
	if (!description.ok) return description
	if (description.value.some(isTextBreak)) return failure('unsupported-node-shape', `delete ${textBreakSpelling} from this image description: the description reads as plain alt text`, scan.shared.path)
	const alt = adfNodes(description.value.filter((item) => !isImageAside(item))).map(altText).join('')
	return success([{ alt, definition, kind: 'image' }])
}

// spec/flavour.md, The CommonMark image: the description's plain text, the content slot included.
function altText(node: AdfNode): string {
	if (node.type === 'hardBreak') return ' '
	const slot = inlineNodeModel(node.type)?.textAttribute
	const spelled = slot === undefined ? undefined : nodeAttrs(node)[slot]
	return typeof spelled === 'string' ? spelled : (node.text ?? '')
}

// spec/flavour.md, The CommonMark image: an image no paragraph holds alone reads as its alt text, linked, and inside a link as the link's text, then (image) linked to the image.
export function linkedAlt(piece: Piece, inLink: boolean): Piece[] {
	if (piece.kind !== 'image') return [piece]
	if (inLink && piece.link === undefined) return [piece, { kind: 'nodes', nodes: [{ image: piece.definition, kind: 'imageAside', nodes: [] }] }]
	const alt = linkTo(piece.alt === '' ? [] : [{ text: piece.alt, type: 'text' }], piece.link ?? piece.definition)
	return [{ kind: 'nodes', nodes: piece.link === undefined ? alt : [...alt, ...besideLink([piece.definition], piece.link)] }]
}

// An `!adf:link` builds the (image) of each image its text holds after itself.
export function asidesAfterLink(text: readonly Resolved[], link: LinkDefinition): Resolved[] {
	const images = text.flatMap((item) => (isImageAside(item) ? [item.image] : []))
	return [...text.filter((item) => !isImageAside(item)), ...besideLink(images, link)]
}

// A link to the image itself needs no (image), as `adfToPortableMarkdown` writes none; one stays to keep an image title the link lacks.
function besideLink(images: readonly LinkDefinition[], link: LinkDefinition): ImageAside[] {
	return images
		.filter((image) => image.destination !== link.destination || (image.title !== undefined && image.title !== '' && image.title !== link.title))
		.map((image) => ({ image, kind: 'imageAside', nodes: imageAside((text) => [{ marks: [linkMark(image)], text, type: 'text' }]) }))
}

export function mediaSingle({ alt, definition, link }: Image): AdfNode {
	const { title } = definition
	const caption: AdfNode[] = title === undefined || title === '' ? [] : [{ content: [{ text: title, type: 'text' }], type: 'caption' }]
	return centeredImage([externalMedia(alt, definition.destination, link === undefined ? undefined : toLinkAttrs(link)), ...caption])
}

// ADF holds no empty text node and a hard break takes no link, so the destination text carries the link ahead of the text's hard breaks; an empty destination leaves the breaks alone.
function linkTo(text: readonly Resolved[], definition: LinkDefinition): Resolved[] {
	if (text.some((item) => marksItem(item, 'link'))) return applyMark(text, linkMark(definition))
	return definition.destination === '' ? [...text] : [{ marks: [linkMark(definition)], text: definition.destination, type: 'text' }, ...text]
}

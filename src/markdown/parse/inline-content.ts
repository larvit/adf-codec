import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { ClaimedPrefix, DirectiveSpan, NestedSpans } from '../directive/syntax.ts'
import type { Claims, Flavour } from '../flavour.ts'
import type { EmphasisPairing } from '../commonmark/emphasis-matching.ts'
import type { InlineSource, InlineToken } from '../inline-tokens.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinition } from '../commonmark/link-syntax.ts'
import { centeredImage, externalMedia, imageAside } from '../external-image.ts'
import { commonMarkLink, linkDefinition, linkHref, linkMark } from '../mark-spellings.ts'
import { decodeTextEscapes, trimTrailingSpace } from '../commonmark/grammar.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { flavourClaims } from '../flavour.ts'
import { highlightDelimiter, inlineSource, readInlineToken } from '../inline-tokens.ts'
import { identicalMarks, mergeAdjacentText, nodeAttrs, nodeMarks } from '../../adf/document.ts'
import { inlineNodeModel, takesMark } from '../../adf/inline-nodes.ts'
import { joinsWhenRead, textBreakName, textBreakSpelling } from '../adjacent-text.ts'
import { matchEmphasis } from '../commonmark/emphasis-matching.ts'
import { normalizeLabel, readInlineTarget, readLabel } from '../commonmark/link-syntax.ts'
import { noSpans, readInlineDirective } from '../directive/syntax.ts'
import { openingLinkTakesDirective } from '../emit/spelling-questions.ts'
import { readCarriedInline } from '../opaque-carry.ts'
import { readDirectiveMark } from '../directive/mark-reading.ts'
import { readInlineDirectiveNode } from '../directive/node-reading.ts'
import { readTextDirective } from '../directive/text.ts'

// Only a `paragraph` block takes `image`, the `mediaSingle` a lone image builds; every other container takes `nodes`, where the image is its linked alt text.
export type InlineContent = { image?: AdfNode; nodes: AdfNode[] }

// The text break leaf: it holds no marks, and stands between the nodes it parts until the outermost content checks and drops it.
type TextBreak = { kind: 'textBreak' }

// A node whose marks are its own — an opaque carry, or an inline node spelling marks=empty: no mark spelling wraps it, and it joins no neighbour.
type OwnMarks = { kind: 'ownMarks'; node: AdfNode }

type Inline = AdfNode | OwnMarks | TextBreak

type Scanned = { image?: AdfNode; pieces: Resolved[] }

export type LinkDefinitions = ReadonlyMap<string, LinkDefinition>

type Bracket = { image: boolean; kind: 'open' }

// `link` is the link whose text is this image alone.
type Image = { alt: string; definition: LinkDefinition; kind: 'image'; link?: LinkDefinition }

// The (image) after a link for one image its text holds: running text keeps it, alt text drops it. In an `!adf:link`'s text it holds no nodes until the link builds it after itself.
type ImageLink = { image: LinkDefinition; kind: 'imageLink'; nodes: Inline[] }

type Nodes = { kind: 'nodes'; nodes: Inline[] }

type Resolved = ImageLink | Nodes

type HighlightDelimiter = { closes: boolean; holder: AdfNode; index: number; opens: boolean; position: number; stretch: number }

// `index` is the bracket's piece, `start` the index of the source its text starts at.
type OpenBracket = { image: boolean; index: number; start: number }

type Pairing = EmphasisPairing<Run>

type Piece =
  | Bracket
  | OwnMarks
  | Image
  | ImageLink
  | Nodes
  | TextBreak
  | { canClose: boolean; canOpen: boolean; character: string; kind: 'run'; length: number }
  | { closes: boolean; kind: 'highlight'; opens: boolean }

type Run = { canClose: boolean; canOpen: boolean; character: string; index: number; length: number }

// `container` is `undefined` inside a directive's content slot, the emitter's `bracketed`.
type Scan = {
  // CommonMark's bracket stack, innermost last.
  brackets: OpenBracket[]
  claims: Claims
  container: LineContainer | undefined
  definitions: LinkDefinitions
  // Whether this content is an `!adf:link`'s text, where an image reads as its plain alt text.
  inLink: boolean
  // A link opener at this index of `brackets` or above is active; one below it stood open while a link closed, and no link holds another.
  linkOpenersFrom: number
  openingSpellableLink: boolean
  path: ConvertErrorPath
  pending: string
  pieces: Piece[]
  source: string
  spans: NestedSpans
}

// What a directive's content slot inherits from the content holding it.
type SharedScan = Pick<Scan, 'definitions' | 'path'>

const ownMarksInMark = 'move the opaque carry, or the node spelling marks=empty, out of the mark spelling: it holds its own marks'
const editorHighlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }
const hreflessLink = 'the link mark spells its href: this one spells none'
const linkInLink = 'no link wraps a link: the [content] this one marks already holds one'
const unlinkable = 'the text of this link holds only nodes that take no link: write the link around text beside them'
const spellableLink = 'link takes the directive form only where CommonMark cannot spell it: this one it can, as [text](url "title") or <url>'
const textBreak: TextBreak = { kind: 'textBreak' }

// The outermost content: only here does a text break see both its neighbours.
export function parseInlineContent(source: string, definitions: LinkDefinitions, path: ConvertErrorPath, container: LineContainer, flavour: Flavour): Result<InlineContent> {
  const scan = freshScan(source, { definitions, path }, { claims: flavourClaims[flavour], container, inLink: false, spans: noSpans })
  const scanned = scanInline(scan)
  if (!scanned.ok) return scanned
  const nodes = partText(contentNodes(scanned.value.pieces), scan)
  if (!nodes.ok) return nodes
  if (scan.openingSpellableLink) {
    const takesDirective = openingLinkTakesDirective(nodes.value, path)
    if (!takesDirective.ok) return takesDirective
    if (!takesDirective.value) return failure('unsupported-node-shape', spellableLink, path)
  }
  const { image } = scanned.value
  return success(image === undefined ? { nodes: nodes.value } : { image, nodes: nodes.value })
}

function freshScan(source: string, shared: SharedScan, own: Pick<Scan, 'claims' | 'container' | 'inLink' | 'spans'>): Scan {
  return { ...shared, ...own, brackets: [], linkOpenersFrom: 0, openingSpellableLink: false, pending: '', pieces: [], source }
}

function scanInline(scan: Scan): Result<Scanned> {
  const inline = inlineSource(scan.source)
  let index = 0
  while (index < scan.source.length) {
    const read = readToken(scan, inline, index, readInlineToken(inline, index, scan.claims))
    if (!read.ok) return read
    index = read.value
  }
  flush(scan, scan.container !== undefined)
  return assemble(scan)
}

function readToken(scan: Scan, inline: InlineSource, index: number, token: InlineToken): Result<number> {
  if (token.kind === 'directive') return readDirective(scan, inline, token.prefix)
  if (token.kind === 'html') return failure('unmappable-html', `no raw HTML converts at this version: ${token.construct}`, scan.path)
  const end = index + token.width
  switch (token.kind) {
    case 'autolink':
      flush(scan, false)
      pushNode(scan, linkedText(scan.source.slice(index + 1, end - 1), token.email ? 'mailto:' : ''))
      return success(end)
    case 'bracket':
      flush(scan, false)
      scan.brackets.push({ image: token.image, index: scan.pieces.length, start: end })
      scan.pieces.push({ image: token.image, kind: 'open' })
      return success(end)
    case 'bracket-close':
      return closeBracket(scan, index)
    case 'code-span':
      flush(scan, false)
      pushNode(scan, { marks: [{ type: 'code' }], text: codeSpanText(scan.source.slice(index + token.opener, end - token.opener)), type: 'text' })
      return success(end)
    case 'delimiter-run':
      flush(scan, false)
      scan.pieces.push({ canClose: token.canClose, canOpen: token.canOpen, character: scan.source.charAt(index), kind: 'run', length: token.width })
      return success(end)
    case 'entity':
    case 'escape':
    case 'text':
      scan.pending += scan.source.slice(index, end)
      return success(end)
    case 'hard-break':
      // CommonMark keeps the spaces before a backslash hard break.
      flush(scan, false)
      pushNode(scan, { type: 'hardBreak' })
      return success(end)
    case 'highlight':
      flush(scan, false)
      scan.pieces.push({ closes: token.closes, kind: 'highlight', opens: token.opens })
      return success(end)
    case 'line-ending':
      return success(readLineEnding(scan, index))
  }
}

function readLineEnding(scan: Scan, index: number): number {
  const hard = scan.pending.endsWith('  ')
  flush(scan, true)
  if (hard) pushNode(scan, { type: 'hardBreak' })
  else scan.pending = ' '
  return index + 1
}

function readDirective(scan: Scan, inline: InlineSource, prefix: ClaimedPrefix): Result<number> {
  const held = scan.spans.get(prefix.index)
  if (held !== undefined) return pushDirective(scan, held, prefix.index)
  const directive = readInlineDirective(inline, prefix)
  if (directive.fault !== undefined) return faulted(directive.fault, scan.path)
  return pushDirective(scan, directive.value, prefix.index)
}

function pushDirective(scan: Scan, span: DirectiveSpan, index: number): Result<number> {
  const pieces = directivePieces(scan, span, index)
  if (!pieces.ok) return pieces
  flush(scan, false)
  for (const piece of pieces.value) scan.pieces.push(piece)
  return success(index + span.length)
}

function directivePieces(scan: Scan, span: DirectiveSpan, index: number): Result<Piece[]> {
  const carried = readCarriedInline(span)
  if (carried !== undefined) {
    if (carried.fault !== undefined) return faulted(carried.fault, scan.path)
    return success([{ kind: 'ownMarks', node: carried.value }])
  }
  if (span.name === textBreakName) return span.content === undefined && span.attributes.size === 0 ? success([textBreak]) : failure('unsupported-node-shape', `${textBreakName} spells the bare leaf form, ${textBreakSpelling}: this one spells more`, scan.path)
  const text = readTextDirective(span)
  if (text?.fault !== undefined) return faulted(text.fault, scan.path)
  if (text !== undefined) return success([{ kind: 'nodes', nodes: [{ text: text.value, type: 'text' }] }])
  const mark = readDirectiveMark(span.name, span.attributes, scan.path)
  // A node's slot is the node's own content, never the text of a link around the node.
  const slot = slotContent(scan, span, mark !== undefined && (scan.inLink || span.name === 'link'))
  if (!slot.ok) return slot
  if (mark !== undefined) return mark.ok ? directiveMarkPieces(scan, span.name, mark.value, slot.value, index) : mark
  const content = slot.value === undefined ? undefined : contentNodes(slot.value)
  if (content?.some(isTextBreak) === true) return failure('unsupported-node-shape', `delete ${textBreakSpelling} from this content slot: a slot holds one text node`, scan.path)
  const node = readInlineDirectiveNode(span.name, span.attributes, content === undefined ? undefined : adfNodes(content), scan.path)
  if (!node.ok) return node
  return success([node.value.marks === undefined ? { kind: 'nodes', nodes: [node.value] } : { kind: 'ownMarks', node: node.value }])
}

function directiveMarkPieces(scan: Scan, name: string, mark: AdfMark, slot: readonly Resolved[] | undefined, index: number): Result<Piece[]> {
  const nodes = slot === undefined ? [] : contentNodes(slot)
  if (slot === undefined || nodes.length === 0) {
    return failure('unsupported-node-shape', `the ${name} mark wraps the [content] it marks: this one wraps none`, scan.path)
  }
  if (nodes.some(holdsOwnMarks)) return failure('unsupported-node-shape', ownMarksInMark, scan.path)
  if (!nodes.some((node) => marksItem(node, mark.type))) {
    return failure('unsupported-node-shape', `the ${name} mark wraps the [content] it marks: this one wraps only nodes that take no ${name} mark: write the ${name} mark around text beside them`, scan.path)
  }
  const refused = mark.type === 'link' ? refuseLinkDirective(scan, mark, nodes, index) : undefined
  if (refused !== undefined) return refused
  const marked = slot.map((piece) => ({ ...piece, nodes: applyMark(piece.nodes, mark) }))
  const link = mark.type === 'link' ? linkDefinition(nodeAttrs(mark)) : undefined
  if (link === undefined) return success(marked)
  const images = slot.flatMap((piece) => (piece.kind === 'imageLink' ? [piece.image] : []))
  return success([...marked.filter((piece) => piece.kind === 'nodes'), ...besideLink(images, link)])
}

// spec/flavour.md, Marks. A link opening a paragraph may still need the directive form for the line it opens, which `parseInlineContent` asks the emitter.
function refuseLinkDirective(scan: Scan, mark: AdfMark, nodes: readonly Inline[], index: number): Result<Piece[]> | undefined {
  const href = linkHref(nodeAttrs(mark))
  if (href === undefined) return failure('unsupported-node-shape', hreflessLink, scan.path)
  if (marksLink(nodes)) return failure('unsupported-node-shape', linkInLink, scan.path)
  if (commonMarkLink(nodeAttrs(mark), href, adfNodes(nodes), 0, scan.container === undefined, 'lossless') === undefined) return undefined
  if (index !== 0 || scan.container !== 'paragraph') return failure('unsupported-node-shape', spellableLink, scan.path)
  scan.openingSpellableLink = true
  return undefined
}

function slotContent(scan: Scan, span: DirectiveSpan, inLink: boolean): Result<Resolved[] | undefined> {
  if (span.content === undefined) return success(undefined)
  const { claims, definitions, path } = scan
  const parsed = scanInline(freshScan(span.content, { definitions, path }, { claims, container: undefined, inLink, spans: span.spans }))
  if (!parsed.ok) return parsed
  return success(parsed.value.pieces)
}

function flush(scan: Scan, strip: boolean): void {
  const raw = strip ? trimTrailingSpace(scan.pending) : scan.pending
  scan.pending = ''
  if (raw !== '') scan.pieces.push({ kind: 'nodes', nodes: [{ text: decodeTextEscapes(raw), type: 'text' }] })
}

function pushNode(scan: Scan, node: AdfNode): void {
  scan.pieces.push({ kind: 'nodes', nodes: [node] })
}

function assemble(scan: Scan): Result<Scanned> {
  const pieces = scan.pieces.flatMap((piece) => linkedAlt(piece, scan.inLink))
  const nodes = markedNodes(pieces, scan, true)
  if (!nodes.ok) return nodes
  const resolved = resolvedPieces(pieces, nodes.value)
  const [only] = scan.pieces
  return success(scan.pieces.length === 1 && only?.kind === 'image' ? { image: mediaSingle(only), pieces: resolved } : { pieces: resolved })
}

// A slot is read before its holder knows where its (image)s go, dropped from an image description or moved after an `!adf:link`, so each stays a piece of its own.
function resolvedPieces(pieces: readonly Piece[], nodes: readonly Inline[][]): Resolved[] {
  const resolved: Resolved[] = []
  let run: Inline[] = []
  for (const [index, piece] of pieces.entries()) {
    const held = nodes[index] ?? []
    if (piece.kind !== 'imageLink') {
      for (const node of held) run.push(node)
      continue
    }
    if (run.length > 0) resolved.push({ kind: 'nodes', nodes: run })
    resolved.push({ ...piece, nodes: held })
    run = []
  }
  if (run.length > 0) resolved.push({ kind: 'nodes', nodes: run })
  return resolved
}

function contentNodes(pieces: readonly Resolved[]): Inline[] {
  return mergeReadText(pieces.flatMap((piece) => piece.nodes))
}

// spec/flavour.md, The CommonMark image: an image no paragraph holds alone reads as its alt text, linked, and inside a link as the link's text, then (image) linked to the image.
function linkedAlt(piece: Piece, inLink: boolean): Piece[] {
  if (piece.kind !== 'image') return [piece]
  if (inLink && piece.link === undefined) return [piece, { image: piece.definition, kind: 'imageLink', nodes: [] }]
  const alt: Piece = { kind: 'nodes', nodes: linkTo(piece.alt === '' ? [] : [{ text: piece.alt, type: 'text' }], piece.link ?? piece.definition) }
  return piece.link === undefined ? [alt] : [alt, ...besideLink([piece.definition], piece.link)]
}

// A link to the image itself needs no (image), as `adfToPortableMarkdown` writes none; one stays to keep an image title the link lacks.
function besideLink(images: readonly LinkDefinition[], link: LinkDefinition): ImageLink[] {
  return images.filter((image) => image.destination !== link.destination || (image.title !== undefined && image.title !== '' && image.title !== link.title)).map(imageLink)
}

function imageLink(definition: LinkDefinition): ImageLink {
  return { image: definition, kind: 'imageLink', nodes: imageAside((text) => [{ marks: [linkMark(definition)], text, type: 'text' }]) }
}

function mediaSingle({ alt, definition, link }: Image): AdfNode {
  const { title } = definition
  const caption: AdfNode[] = title === undefined || title === '' ? [] : [{ content: [{ text: title, type: 'text' }], type: 'caption' }]
  return centeredImage([externalMedia(alt, definition.destination, link), ...caption])
}

// ADF holds no empty text node and a hard break takes no link, so the destination text carries the link ahead of the text's hard breaks; an empty destination leaves the breaks alone.
function linkTo(nodes: readonly Inline[], definition: LinkDefinition): Inline[] {
  if (nodes.some((node) => marksItem(node, 'link'))) return applyMark(nodes, linkMark(definition))
  return definition.destination === '' ? [...nodes] : [{ marks: [linkMark(definition)], text: definition.destination, type: 'text' }, ...nodes]
}

// spec/flavour.md, Inline nodes: the leaf builds no node, so only the pair it parts spells it.
function partText(items: readonly Inline[], scan: Scan): Result<AdfNode[]> {
  const parted: AdfNode[] = []
  for (const [index, item] of items.entries()) {
    if (!isTextBreak(item)) {
      parted.push(isNode(item) ? item : item.node)
      continue
    }
    const previous = items[index - 1]
    const next = items[index + 1]
    if (previous === undefined || next === undefined || !isNode(previous) || !isNode(next) || !joinsWhenRead(previous, next)) {
      return failure('unsupported-node-shape', `delete ${textBreakSpelling} here: it stands only between two runs of text with the same formatting, which would otherwise read as one`, scan.path)
    }
  }
  return success(parted)
}

// spec/flavour.md, Marks: a spelling skips a node Atlassian's schema withholds its mark from.
function marksItem(item: Inline, type: string): boolean {
  return !isNode(item) || takesMark(item, type)
}

function isNode(item: Inline): item is AdfNode {
  return !('kind' in item)
}

function isTextBreak(item: Inline): item is TextBreak {
  return 'kind' in item && item.kind === 'textBreak'
}

function adfNodes(items: readonly Inline[]): AdfNode[] {
  const nodes: AdfNode[] = []
  for (const item of items) {
    if (isNode(item)) nodes.push(item)
    else if (!isTextBreak(item)) nodes.push(item.node)
  }
  return nodes
}

function holdsOwnMarks(item: Inline | Piece): boolean {
  return 'kind' in item && item.kind === 'ownMarks'
}

// Only a link a `nodes` piece spells, or an (image)'s, makes the outer brackets literal; an `ownMarks` node's link is its own, so the own-marks guard in `linkPieces` refuses it.
function holdsLink(pieces: readonly Piece[]): boolean {
  return pieces.some((piece) => piece.kind === 'imageLink' || (piece.kind === 'nodes' && marksLink(piece.nodes)))
}

function marksLink(nodes: readonly Inline[]): boolean {
  return adfNodes(nodes).some((node) => nodeMarks(node).some((mark) => mark.type === 'link'))
}

function linkedText(text: string, scheme: string): AdfNode {
  return { marks: [{ attrs: { href: `${scheme}${text}` }, type: 'link' }], text, type: 'text' }
}

function closeBracket(scan: Scan, index: number): Result<number> {
  flush(scan, false)
  const open = popBracket(scan)
  if (open === undefined) return success(literalClose(scan, index))
  const target = open.active ? resolveTarget(scan, open.start, index) : undefined
  if (target === undefined) return success(unopened(scan, open, index))
  const inner = scan.pieces.slice(open.index + 1)
  // A link closing, or one inside these brackets, leaves every link opener still open literal.
  if (!open.image) scan.linkOpenersFrom = scan.brackets.length
  // Ahead of the own-marks guard in `linkPieces`: brackets going literal put the carry inside no mark for it to refuse.
  if (!open.image && holdsLink(inner)) return success(unopened(scan, open, index))
  const closed = open.image ? imagePieces(scan, inner, target.definition) : linkPieces(scan, inner, target.definition)
  if (!closed.ok) return closed
  scan.pieces.length = open.index
  for (const piece of closed.value) scan.pieces.push(piece)
  return success(index + 1 + target.length)
}

// Every close takes the innermost bracket off the stack, whether it closes a link, an image or nothing.
function popBracket(scan: Scan): (OpenBracket & { active: boolean }) | undefined {
  const open = scan.brackets.pop()
  if (open === undefined) return undefined
  const active = open.image || scan.brackets.length >= scan.linkOpenersFrom
  scan.linkOpenersFrom = Math.min(scan.linkOpenersFrom, scan.brackets.length)
  return { ...open, active }
}

function literalClose(scan: Scan, index: number): number {
  scan.pending += ']'
  return index + 1
}

function unopened(scan: Scan, open: OpenBracket, index: number): number {
  scan.pieces[open.index] = { kind: 'nodes', nodes: bracketNodes(open) }
  return literalClose(scan, index)
}

function bracketNodes(bracket: Bracket | OpenBracket): AdfNode[] {
  return [{ text: bracket.image ? '![' : '[', type: 'text' }]
}

function resolveTarget(scan: Scan, start: number, index: number): { definition: LinkDefinition; length: number } | undefined {
  const after = index + 1
  if (scan.source.charAt(after) === '(') {
    const inline = readInlineTarget(scan.source, after)
    if (inline !== undefined) return { definition: inline.definition, length: inline.length }
  }
  const label = scan.source.charAt(after) === '[' ? readLabel(scan.source, after) : undefined
  // CommonMark: a label holds at most 999 characters, so longer link text names no definition.
  const labelIsText = label === undefined || label.value === ''
  if (labelIsText && index - start > 999) return undefined
  const name = labelIsText ? scan.source.slice(start, index) : label.value
  const definition = scan.definitions.get(normalizeLabel(name))
  if (definition === undefined) return undefined
  return { definition, length: label?.length ?? 0 }
}

// An image alone in the link text keeps its piece, so a paragraph holding nothing else builds the linked image.
function linkPieces(scan: Scan, inner: readonly Piece[], definition: LinkDefinition): Result<Piece[]> {
  if (inner.some(holdsOwnMarks)) return failure('unsupported-node-shape', ownMarksInMark, scan.path)
  const [only] = inner
  if (inner.length === 1 && only?.kind === 'image') return success([{ ...only, link: definition }])
  const nodes = resolveNodes(inner, scan, true)
  if (!nodes.ok) return nodes
  if (!nodes.value.some((node) => marksItem(node, 'link')) && nodes.value.some((node) => isNode(node) && node.type !== 'hardBreak')) {
    return failure('unsupported-node-shape', unlinkable, scan.path)
  }
  const images = inner.flatMap((piece) => (piece.kind === 'image' ? [piece.definition] : []))
  return success([{ kind: 'nodes', nodes: linkTo(nodes.value, definition) }, ...besideLink(images, definition)])
}

function imagePieces(scan: Scan, inner: readonly Piece[], definition: LinkDefinition): Result<Piece[]> {
  const alt = imageAlt(inner, scan)
  return alt.ok ? success([{ alt: alt.value, definition, kind: 'image' }]) : alt
}

function imageAlt(inner: readonly Piece[], scan: Scan): Result<string> {
  const nodes = resolveNodes(inner.filter((piece) => piece.kind !== 'imageLink'), scan, false)
  if (!nodes.ok) return nodes
  if (nodes.value.some(isTextBreak)) return failure('unsupported-node-shape', `delete ${textBreakSpelling} from this image description: the description reads as plain alt text`, scan.path)
  return success(adfNodes(nodes.value).map(altText).join(''))
}

// spec/flavour.md, The CommonMark image: the description's plain text, the content slot included.
function altText(node: AdfNode): string {
  if (node.type === 'hardBreak') return ' '
  const slot = inlineNodeModel(node.type)?.textAttribute
  const spelled = slot === undefined ? undefined : nodeAttrs(node)[slot]
  return typeof spelled === 'string' ? spelled : (node.text ?? '')
}

// An image's alt text is plain, so `highlights` is off there and every `==` stays text.
function resolveNodes(pieces: readonly Piece[], scan: Scan, highlights: boolean): Result<Inline[]> {
  const nodes = markedNodes(pieces, scan, highlights)
  return nodes.ok ? success(mergeReadText(nodes.value.flat())) : nodes
}

// `nodes[index]` holds piece `index`'s nodes, which each step below rewrites in place.
function markedNodes(pieces: readonly Piece[], scan: Scan, highlights: boolean): Result<Inline[][]> {
  const nodes = pieces.map(pieceNodes)
  const runs = delimiterRuns(pieces)
  const pairings = matchEmphasis(runs)
  writeUnpaired(nodes, runs, pairings)
  if (!markPairings(pieces, nodes, pairings)) return failure('unsupported-node-shape', ownMarksInMark, scan.path)
  markHighlights(pieces, nodes, highlights ? pairedHighlights(pieces, nodes) : [])
  return success(nodes)
}

// A text break and a node whose marks are its own are walls: the text on either side joins only its own side.
function mergeReadText(items: readonly Inline[]): Inline[] {
  const merged: Inline[] = []
  let run: AdfNode[] = []
  for (const item of items) {
    if (isNode(item)) {
      run.push(item)
      continue
    }
    for (const node of mergeAdjacentText(run, joinsWhenRead)) merged.push(node)
    merged.push(item)
    run = []
  }
  for (const node of mergeAdjacentText(run, joinsWhenRead)) merged.push(node)
  return merged
}

// The image arm is an image inside an image's description or a link's text, which reads as its plain alt text.
// A highlight delimiter holds an empty text node until it pairs, so the emphasis around it marks it.
function pieceNodes(piece: Piece): Inline[] {
  switch (piece.kind) {
    case 'ownMarks':
      return [piece]
    case 'highlight':
      return [{ text: '', type: 'text' }]
    case 'image':
      return piece.alt === '' ? [] : [{ text: piece.alt, type: 'text' }]
    case 'imageLink':
    case 'nodes':
      return piece.nodes
    case 'open':
      return bracketNodes(piece)
    case 'run':
      return []
    case 'textBreak':
      return [piece]
  }
}

function delimiterRuns(pieces: readonly Piece[]): Run[] {
  const runs: Run[] = []
  for (const [index, piece] of pieces.entries()) {
    if (piece.kind === 'run') runs.push({ canClose: piece.canClose, canOpen: piece.canOpen, character: piece.character, index, length: piece.length })
  }
  return runs
}

// A run gives its delimiters up from the head closing and the tail opening; what is left between them is text.
function writeUnpaired(nodes: Inline[][], runs: readonly Run[], pairings: readonly Pairing[]): void {
  const heads = new Map<Run, number>()
  const tails = new Map<Run, number>()
  for (const pairing of pairings) {
    heads.set(pairing.closer, pairing.closerOffset + pairing.used)
    tails.set(pairing.opener, pairing.openerOffset)
  }
  for (const run of runs) {
    const head = heads.get(run) ?? 0
    const tail = tails.get(run) ?? run.length
    if (tail > head) nodes[run.index] = [{ text: run.character.repeat(tail - head), type: 'text' }]
  }
}

// Pairings nest, so one walk holding the open ones on a stack marks each piece once, the marks outermost first (spec/flavour.md, Marks).
function markPairings(pieces: readonly Piece[], nodes: Inline[][], pairings: readonly Pairing[]): boolean {
  const opening = pairingsByOpener(pairings)
  const open: { closer: number; marks: AdfMark[] }[] = []
  for (const [index, piece] of pieces.entries()) {
    while (open.at(-1)?.closer === index) open.pop()
    const marks = open.at(-1)?.marks
    if (marks !== undefined) {
      if (piece.kind === 'ownMarks') return false
      nodes[index] = marks.reduceRight((marked, mark) => applyMark(marked, mark), nodes[index] ?? [])
    }
    for (const pairing of opening.get(index) ?? []) {
      const type = markType(pairing.opener.character, pairing.used)
      // A type takes its place from the innermost pairing of it.
      const outer = open.at(-1)?.marks.filter((mark) => mark.type !== type) ?? []
      open.push({ closer: pairing.closer.index, marks: [...outer, { type }] })
    }
  }
  return true
}

// `matchEmphasis` lists a run's pairings innermost first, so each list here is reversed to stack the outermost first.
function pairingsByOpener(pairings: readonly Pairing[]): Map<number, Pairing[]> {
  const opening = new Map<number, Pairing[]>()
  for (const pairing of pairings) {
    const opened = opening.get(pairing.opener.index)
    if (opened === undefined) opening.set(pairing.opener.index, [pairing])
    else opened.push(pairing)
  }
  for (const opened of opening.values()) opened.reverse()
  return opening
}

function highlightDelimiters(pieces: readonly Piece[], nodes: readonly Inline[][]): HighlightDelimiter[] {
  const found: HighlightDelimiter[] = []
  // A stretch is a run of text no other inline node breaks.
  let stretch = 0
  let position = 0
  for (const [index, piece] of pieces.entries()) {
    const held = adfNodes(nodes[index] ?? [])
    const [holder] = held
    if (piece.kind === 'highlight' && holder !== undefined) {
      found.push({ closes: piece.closes, holder, index, opens: piece.opens, position, stretch })
      position += highlightDelimiter.length
      continue
    }
    for (const node of held) {
      if (node.type === 'text') position += node.text?.length ?? 0
      else stretch += 1
    }
  }
  return found
}

// Each opener pairs with the next closer at least one character after it, and only when both sit in one stretch under the same marks.
function pairedHighlights(pieces: readonly Piece[], nodes: readonly Inline[][]): { closer: number; opener: number }[] {
  const found = highlightDelimiters(pieces, nodes)
  const paired: { closer: number; opener: number }[] = []
  let closer = 0
  let resume = 0
  for (const opener of found) {
    if (!opener.opens || opener.position < resume) continue
    const earliest = opener.position + highlightDelimiter.length + 1
    let candidate = found[closer]
    while (candidate !== undefined && (!candidate.closes || candidate.position < earliest)) {
      closer += 1
      candidate = found[closer]
    }
    if (candidate === undefined) break
    if (candidate.stretch !== opener.stretch || !identicalMarks(nodeMarks(opener.holder), nodeMarks(candidate.holder))) continue
    paired.push({ closer: candidate.index, opener: opener.index })
    resume = candidate.position + highlightDelimiter.length
  }
  return paired
}

// A node holds one highlight, and a rebuilt node would lose its attributes.
function markHighlights(pieces: readonly Piece[], nodes: Inline[][], paired: readonly { closer: number; opener: number }[]): void {
  for (const [index, piece] of pieces.entries()) {
    if (piece.kind === 'highlight') nodes[index] = adfNodes(nodes[index] ?? []).map((holder) => ({ ...holder, text: highlightDelimiter }))
  }
  for (const { closer, opener } of paired) {
    nodes[opener] = []
    nodes[closer] = []
    for (let index = opener + 1; index < closer; index += 1) nodes[index] = (nodes[index] ?? []).map(highlighted)
  }
}

function highlighted(node: Inline): Inline {
  if (!isNode(node)) return node
  const marks = nodeMarks(node)
  if (node.type !== 'text' || Object.keys(nodeAttrs(node)).length > 0 || !marksItem(node, editorHighlight.type) || marks.some((mark) => mark.type === editorHighlight.type)) return node
  return { ...node, marks: [editorHighlight, ...marks] }
}

function markType(character: string, used: number): string {
  if (character === '~') return 'strike'
  return used === 2 ? 'strong' : 'em'
}

// `*(*a*)*` builds one `em`: a node holds at most one mark of each type.
function applyMark(nodes: readonly Inline[], mark: AdfMark): Inline[] {
  return nodes.map((node) => {
    if (!isNode(node) || !marksItem(node, mark.type)) return node
    const marks = nodeMarks(node)
    return marks.some((carried) => carried.type === mark.type) ? node : { ...node, marks: [mark, ...marks] }
  })
}

function codeSpanText(content: string): string {
  const text = content.replaceAll('\n', ' ')
  const padded = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  return padded ? text.slice(1, -1) : text
}

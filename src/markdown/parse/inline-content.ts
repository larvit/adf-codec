import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { Claims } from '../portable/conventions.ts'
import type { DirectiveSpan, NestedSpans } from '../directive-syntax.ts'
import type { EmphasisPairing } from '../commonmark/emphasis-matching.ts'
import type { InlineToken } from '../inline-tokens.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinition } from '../commonmark/link-syntax.ts'
import { decodeTextEscapes, trimTrailingSpace } from '../commonmark/grammar.ts'
import { centeredImage, externalMedia } from '../external-image.ts'
import { commonMarkLink, linkHref } from '../mark-spellings.ts'
import { matchEmphasis } from '../commonmark/emphasis-matching.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { highlightDelimiter } from '../portable/conventions.ts'
import { identicalMarks, mergeAdjacentText, nodeAttrs, nodeMarks } from '../../adf/document.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { joinsWhenRead, textBreakName, textBreakSpelling } from '../adjacent-text.ts'
import { noSpans, readInlineDirective } from '../directive-syntax.ts'
import { normalizeLabel, readInlineTarget, readLabel } from '../commonmark/link-syntax.ts'
import { openingLinkTakesDirective } from '../emit/inline-line.ts'
import { readCarriedInline } from '../opaque-carry.ts'
import { readDirectiveMark } from './directive-marks.ts'
import { readInlineDirectiveNode } from './directive-nodes.ts'
import { readInlineToken } from '../inline-tokens.ts'
import { readTextDirective } from '../text-directive.ts'

// Only a `paragraph` block takes `image`, the `mediaSingle` a lone image builds; every other container takes `nodes`, where the image is its linked alt text.
export type InlineContent = { image?: AdfNode; nodes: AdfNode[] }

// The text break leaf: it holds no marks, and stands between the nodes it parts until the outermost content checks and drops it.
type TextBreak = { kind: 'textBreak' }

// A node whose marks are its own — an opaque carry, or an inline node spelling marks=empty: no mark spelling wraps it, and it joins no neighbour.
type OwnMarks = { kind: 'ownMarks'; node: AdfNode }

type Inline = AdfNode | OwnMarks | TextBreak

type Scanned = { image?: AdfNode; nodes: Inline[] }

export type LinkDefinitions = ReadonlyMap<string, LinkDefinition>

type Bracket = { active: boolean; image: boolean; kind: 'open'; start: number }

// `link` is the link whose text is this image alone.
type Image = { alt: string; definition: LinkDefinition; kind: 'image'; link?: LinkDefinition }

type HighlightDelimiter = { closes: boolean; holder: AdfNode; index: number; opens: boolean; position: number; stretch: number }

type Pairing = EmphasisPairing<Run>

type Piece =
  | Bracket
  | OwnMarks
  | Image
  | { kind: 'nodes'; nodes: Inline[] }
  | TextBreak
  | { canClose: boolean; canOpen: boolean; character: string; kind: 'run'; length: number }
  | { closes: boolean; kind: 'highlight'; opens: boolean }

type Run = { canClose: boolean; canOpen: boolean; character: string; index: number; length: number }

// `container` is `undefined` inside a directive's content slot, the emitter's `bracketed`.
type Scan = {
  claims: Claims
  container: LineContainer | undefined
  // Pieces below this have been walked for openers to deactivate: an image close folds the link-marked piece into alt text, leaving this the only record that the brackets around it are doomed.
  deactivatedBefore: number
  definitions: LinkDefinitions
  // Whether an `!adf:link` slot holds this content, where an image reads as its plain alt text.
  inLink: boolean
  openingSpellableLink: boolean
  path: ConvertErrorPath
  pending: string
  pieces: Piece[]
  source: string
  spans: NestedSpans
}

// What a directive's content slot inherits from the content holding it.
type SharedScan = Pick<Scan, 'definitions' | 'path'>

type SlotContent = { nodes: Inline[] }

const ownMarksInMark = 'move the opaque carry, or the node spelling marks=empty, out of the mark spelling: it holds its own marks'
const editorHighlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }
const hreflessLink = 'the link mark spells its href: this one spells none'
const linkInLink = 'no link wraps a link: the [content] this one marks already holds one'
const spellableLink = 'link takes the directive form only where CommonMark cannot spell it: this one it can, as [text](url "title") or <url>'
const textBreak: TextBreak = { kind: 'textBreak' }

// The outermost content: only here does a text break see both its neighbours.
export function parseInlineContent(source: string, definitions: LinkDefinitions, path: ConvertErrorPath, container: LineContainer, claims: Claims): Result<InlineContent> {
  const scan = freshScan(source, { definitions, path }, { claims, container, inLink: false, spans: noSpans })
  const scanned = scanInline(scan)
  if (!scanned.ok) return scanned
  const nodes = partText(scanned.value.nodes, scan)
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
  return { ...shared, ...own, deactivatedBefore: 0, openingSpellableLink: false, pending: '', pieces: [], source }
}

function scanInline(scan: Scan): Result<Scanned> {
  let index = 0
  while (index < scan.source.length) {
    const read = readToken(scan, index, readInlineToken(scan.source, index, scan.claims))
    if (!read.ok) return read
    index = read.value
  }
  flush(scan, scan.container !== undefined)
  return assemble(scan)
}

function readToken(scan: Scan, index: number, token: InlineToken): Result<number> {
  switch (token.kind) {
    case 'autolink': {
      const end = index + token.width
      flush(scan, false)
      pushNode(scan, linkedText(scan.source.slice(index + 1, end - 1), token.email ? 'mailto:' : ''))
      return success(end)
    }
    case 'bracket':
      flush(scan, false)
      scan.pieces.push({ active: true, image: token.image, kind: 'open', start: index + token.width })
      return success(index + token.width)
    case 'bracket-close':
      return closeBracket(scan, index)
    case 'code-span': {
      const end = index + token.width
      flush(scan, false)
      pushNode(scan, { marks: [{ type: 'code' }], text: codeSpanText(scan.source.slice(index + token.opener, end - token.opener)), type: 'text' })
      return success(end)
    }
    case 'delimiter-run':
      flush(scan, false)
      scan.pieces.push({ canClose: token.canClose, canOpen: token.canOpen, character: scan.source.charAt(index), kind: 'run', length: token.width })
      return success(index + token.width)
    case 'directive':
      return readDirective(scan, index)
    case 'entity':
    case 'escape':
    case 'text':
      scan.pending += scan.source.slice(index, index + token.width)
      return success(index + token.width)
    case 'hard-break':
      // CommonMark strips the spaces the two-space break is spelled with, and keeps those before a backslash.
      flush(scan, false)
      pushNode(scan, { type: 'hardBreak' })
      return success(index + token.width)
    case 'highlight':
      flush(scan, false)
      scan.pieces.push({ closes: token.closes, kind: 'highlight', opens: token.opens })
      return success(index + token.width)
    case 'html':
      return failure('unmappable-html', `no raw HTML converts at this version: ${token.construct}`, scan.path)
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

function readDirective(scan: Scan, index: number): Result<number> {
  const held = scan.spans.get(index)
  if (held !== undefined) return pushDirective(scan, held, index)
  const directive = readInlineDirective(scan.source, index)
  if (directive.fault !== undefined) return faulted(directive.fault, scan.path)
  return pushDirective(scan, directive.value, index)
}

function pushDirective(scan: Scan, span: DirectiveSpan, index: number): Result<number> {
  const piece = directivePiece(scan, span, index)
  if (!piece.ok) return piece
  flush(scan, false)
  scan.pieces.push(piece.value)
  return success(index + span.length)
}

function directivePiece(scan: Scan, span: DirectiveSpan, index: number): Result<Piece> {
  const carried = readCarriedInline(span)
  if (carried !== undefined) {
    if (carried.fault !== undefined) return faulted(carried.fault, scan.path)
    return success({ kind: 'ownMarks', node: carried.value })
  }
  if (span.name === textBreakName) return span.content === undefined && span.attributes.size === 0 ? success(textBreak) : failure('unsupported-node-shape', `${textBreakName} spells the bare leaf form, ${textBreakSpelling}: this one spells more`, scan.path)
  const text = readTextDirective(span)
  if (text?.fault !== undefined) return faulted(text.fault, scan.path)
  if (text !== undefined) return success({ kind: 'nodes', nodes: [{ text: text.value, type: 'text' }] })
  const slot = slotContent(scan, span)
  if (!slot.ok) return slot
  const mark = readDirectiveMark(span.name, span.attributes, scan.path)
  if (mark !== undefined) return mark.ok ? directiveMarkPiece(scan, span.name, mark.value, slot.value, index) : mark
  const content = slot.value?.nodes
  if (content?.some(isTextBreak) === true) return failure('unsupported-node-shape', `delete ${textBreakSpelling} from this content slot: a slot holds one text node`, scan.path)
  const node = readInlineDirectiveNode(span.name, span.attributes, content === undefined ? undefined : adfNodes(content), scan.path)
  if (!node.ok) return node
  return success(node.value.marks === undefined ? { kind: 'nodes', nodes: [node.value] } : { kind: 'ownMarks', node: node.value })
}

function directiveMarkPiece(scan: Scan, name: string, mark: AdfMark, slot: SlotContent | undefined, index: number): Result<Piece> {
  if (slot === undefined || slot.nodes.length === 0) {
    return failure('unsupported-node-shape', `the ${name} mark wraps the [content] it marks: this one wraps none`, scan.path)
  }
  if (slot.nodes.some(holdsOwnMarks)) return failure('unsupported-node-shape', ownMarksInMark, scan.path)
  if (slot.nodes.every(takesNoMarks)) {
    return failure('unsupported-node-shape', `the ${name} mark wraps the [content] it marks: this one wraps only hard breaks, which take no marks`, scan.path)
  }
  const refused = mark.type === 'link' ? refuseLinkDirective(scan, mark, slot.nodes, index) : undefined
  if (refused !== undefined) return refused
  return success({ kind: 'nodes', nodes: applyMark(slot.nodes, mark) })
}

// spec/flavour.md, Marks. A link opening a paragraph may still need the directive form for the line it opens, which `assemble` asks the emitter.
function refuseLinkDirective(scan: Scan, mark: AdfMark, nodes: readonly Inline[], index: number): Result<Piece> | undefined {
  const href = linkHref(nodeAttrs(mark))
  if (href === undefined) return failure('unsupported-node-shape', hreflessLink, scan.path)
  if (marksLink(nodes)) return failure('unsupported-node-shape', linkInLink, scan.path)
  if (commonMarkLink(nodeAttrs(mark), href, adfNodes(nodes), 0, scan.container === undefined) === undefined) return undefined
  if (index !== 0 || scan.container !== 'paragraph') return failure('unsupported-node-shape', spellableLink, scan.path)
  scan.openingSpellableLink = true
  return undefined
}

function slotContent(scan: Scan, span: DirectiveSpan): Result<SlotContent | undefined> {
  if (span.content === undefined) return success(undefined)
  const { claims, definitions, path } = scan
  const parsed = scanInline(freshScan(span.content, { definitions, path }, { claims, container: undefined, inLink: scan.inLink || span.name === 'link', spans: span.spans }))
  if (!parsed.ok) return parsed
  return success({ nodes: parsed.value.nodes })
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
  const nodes = resolveNodes(scan.pieces.map((piece) => (scan.inLink && piece.kind === 'image' && piece.link === undefined ? piece : linkedAlt(piece))), scan, true)
  if (!nodes.ok) return nodes
  const [only] = scan.pieces
  return success(scan.pieces.length === 1 && only?.kind === 'image' ? { image: mediaSingle(only), nodes: nodes.value } : { nodes: nodes.value })
}

// spec/flavour.md, The CommonMark image: an image no paragraph holds alone reads as its alt text, linked.
function linkedAlt(piece: Piece): Piece {
  if (piece.kind !== 'image') return piece
  return { kind: 'nodes', nodes: linkTo(piece.alt === '' ? [] : [{ text: piece.alt, type: 'text' }], piece.link ?? piece.definition) }
}

function mediaSingle({ alt, definition, link }: Image): AdfNode {
  const media = externalMedia(alt, definition.destination)
  const { title } = definition
  const caption: AdfNode[] = title === undefined || title === '' ? [] : [{ content: [{ text: title, type: 'text' }], type: 'caption' }]
  return centeredImage([link === undefined ? media : { ...media, marks: [linkMark(link)] }, ...caption])
}

function linkMark({ destination, title }: LinkDefinition): AdfMark {
  return { attrs: title === undefined ? { href: destination } : { href: destination, title }, type: 'link' }
}

// ADF holds no empty text node and a hard break takes no marks, so the destination text carries the link ahead of the text's hard breaks; an empty destination leaves the breaks alone.
function linkTo(nodes: readonly Inline[], definition: LinkDefinition): Inline[] {
  if (!nodes.every(takesNoMarks)) return applyMark(nodes, linkMark(definition))
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

function takesNoMarks(item: Inline): boolean {
  return isNode(item) && inlineNodeModel(item.type)?.takesMarks === false
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

// Only a link a `nodes` piece spells, or an image's, makes the outer brackets literal; an `ownMarks` node's link is its own, so the own-marks guard in `closeLink` refuses it.
function holdsLink(pieces: readonly Piece[]): boolean {
  return pieces.some((piece) => (piece.kind === 'nodes' && marksLink(piece.nodes)) || (piece.kind === 'image' && piece.link !== undefined))
}

function marksLink(nodes: readonly Inline[]): boolean {
  return adfNodes(nodes).some((node) => nodeMarks(node).some((mark) => mark.type === 'link'))
}

function linkedText(text: string, scheme: string): AdfNode {
  return { marks: [{ attrs: { href: `${scheme}${text}` }, type: 'link' }], text, type: 'text' }
}

function closeBracket(scan: Scan, index: number): Result<number> {
  flush(scan, false)
  const open = lastBracket(scan.pieces)
  if (open === undefined) return success(literalClose(scan, index))
  const target = open.bracket.active ? resolveTarget(scan, open.bracket, index) : undefined
  if (target === undefined) return success(unopened(scan, open, index))
  const inner = scan.pieces.slice(open.index + 1)
  if (open.bracket.image) {
    const closed = closeImage(scan, open.index, inner, target.definition)
    if (!closed.ok) return closed
    return success(index + 1 + target.length)
  }
  const closed = closeLink(scan, open.index, inner, target.definition)
  if (!closed.ok) return closed
  return success(closed.value ? index + 1 + target.length : unopened(scan, open, index))
}

function literalClose(scan: Scan, index: number): number {
  scan.pending += ']'
  return index + 1
}

function unopened(scan: Scan, open: { bracket: Bracket; index: number }, index: number): number {
  scan.pieces[open.index] = { kind: 'nodes', nodes: bracketNodes(open.bracket) }
  return literalClose(scan, index)
}

function bracketNodes(bracket: Bracket): AdfNode[] {
  return [{ text: bracket.image ? '![' : '[', type: 'text' }]
}

function lastBracket(pieces: readonly Piece[]): { bracket: Bracket; index: number } | undefined {
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index]
    if (piece?.kind === 'open') return { bracket: piece, index }
  }
  return undefined
}

function resolveTarget(scan: Scan, bracket: Bracket, index: number): { definition: LinkDefinition; length: number } | undefined {
  const after = index + 1
  if (scan.source.charAt(after) === '(') {
    const inline = readInlineTarget(scan.source, after)
    if (inline !== undefined) return { definition: inline.definition, length: inline.length }
  }
  const label = scan.source.charAt(after) === '[' ? readLabel(scan.source, after) : undefined
  const name = label === undefined || label.value === '' ? scan.source.slice(bracket.start, index) : label.value
  const definition = scan.definitions.get(normalizeLabel(name))
  if (definition === undefined) return undefined
  return { definition, length: label?.length ?? 0 }
}

function closeLink(scan: Scan, at: number, inner: readonly Piece[], definition: LinkDefinition): Result<boolean> {
  // Ahead of the guard below: brackets going literal put the carry inside no mark for it to refuse.
  if (holdsLink(inner)) {
    deactivateOpeners(scan, at)
    return success(false)
  }
  if (inner.some(holdsOwnMarks)) return failure('unsupported-node-shape', ownMarksInMark, scan.path)
  const piece = linkPiece(scan, inner, definition)
  if (!piece.ok) return piece
  truncatePieces(scan, at)
  deactivateOpeners(scan, at)
  scan.pieces.push(piece.value)
  return success(true)
}

// An image alone in the link text keeps its piece, so a paragraph holding nothing else builds the linked image.
function linkPiece(scan: Scan, inner: readonly Piece[], definition: LinkDefinition): Result<Piece> {
  const [only] = inner
  if (inner.length === 1 && only?.kind === 'image') return success({ ...only, link: definition })
  const nodes = resolveNodes(inner, scan, true)
  return nodes.ok ? success({ kind: 'nodes', nodes: linkTo(nodes.value, definition) }) : nodes
}

// CommonMark: no link nests inside another, though an image's description holds one.
function deactivateOpeners(scan: Scan, before: number): void {
  for (let index = scan.deactivatedBefore; index < before; index += 1) {
    const piece = scan.pieces[index]
    if (piece?.kind === 'open' && !piece.image) piece.active = false
  }
  scan.deactivatedBefore = before
}

function truncatePieces(scan: Scan, to: number): void {
  scan.pieces.length = to
  scan.deactivatedBefore = Math.min(scan.deactivatedBefore, to)
}

function closeImage(scan: Scan, at: number, inner: readonly Piece[], definition: LinkDefinition): Result<null> {
  const alt = imageAlt(inner, scan)
  if (!alt.ok) return alt
  truncatePieces(scan, at)
  scan.pieces.push({ alt: alt.value, definition, kind: 'image' })
  return success(null)
}

function imageAlt(inner: readonly Piece[], scan: Scan): Result<string> {
  const nodes = resolveNodes(inner, scan, false)
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
  const nodes = pieces.map(pieceNodes)
  const runs = delimiterRuns(pieces)
  const pairings = matchEmphasis(runs)
  writeUnpaired(nodes, runs, pairings)
  if (!markPairings(pieces, nodes, pairings)) return failure('unsupported-node-shape', ownMarksInMark, scan.path)
  markHighlights(pieces, nodes, highlights ? pairedHighlights(pieces, nodes) : [])
  return success(mergeReadText(nodes.flat()))
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

// Innermost pairing first, so prepending leaves the marks array outermost first (spec/flavour.md, Marks).
function markPairings(pieces: readonly Piece[], nodes: Inline[][], pairings: readonly Pairing[]): boolean {
  for (const pairing of pairings) {
    const mark: AdfMark = { type: markType(pairing.opener.character, pairing.used) }
    for (let index = pairing.opener.index + 1; index < pairing.closer.index; index += 1) {
      if (pieces[index]?.kind === 'ownMarks') return false
      nodes[index] = applyMark(nodes[index] ?? [], mark)
    }
  }
  return true
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
    while (candidate !== undefined && (!candidate.closes || candidate.position < earliest)) candidate = found[(closer += 1)]
    if (candidate === undefined) break
    if (candidate.stretch !== opener.stretch || !identicalMarks(nodeMarks(opener.holder), nodeMarks(candidate.holder))) continue
    paired.push({ closer: candidate.index, opener: opener.index })
    resume = candidate.position + highlightDelimiter.length
  }
  return paired
}

// Atlassian's schema refuses a highlight on code, a node holds one highlight, and a rebuilt node would lose its attributes.
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
  if (node.type !== 'text' || Object.keys(nodeAttrs(node)).length > 0 || marks.some((mark) => mark.type === 'code' || mark.type === 'backgroundColor')) return node
  return { ...node, marks: [editorHighlight, ...marks] }
}

function markType(character: string, used: number): string {
  if (character === '~') return 'strike'
  return used === 2 ? 'strong' : 'em'
}

// `*(*a*)*` builds one `em`: a node holds at most one mark of each type.
function applyMark(nodes: readonly Inline[], mark: AdfMark): Inline[] {
  return nodes.map((node) => {
    if (!isNode(node) || takesNoMarks(node)) return node
    const marks = nodeMarks(node)
    return marks.some((carried) => carried.type === mark.type) ? node : { ...node, marks: [mark, ...marks] }
  })
}

function codeSpanText(content: string): string {
  const text = content.replaceAll('\n', ' ')
  const padded = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  return padded ? text.slice(1, -1) : text
}

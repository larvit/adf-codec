import type { AdfMark, AdfNode } from '../adf/document.ts'
import type { BracketStack } from './inline-brackets.ts'
import type { ClaimedPrefix, DirectiveSpan } from './directive/syntax.ts'
import type { Claims, Flavour } from './flavour.ts'
import type { ConvertErrorPath, Result } from '../result.ts'
import type { Inline, InlineReading, LinkDefinitions, Piece, Resolved, Scan, SharedScan } from './inline-pieces.ts'
import type { InlineSource, InlineToken } from './inline-tokens.ts'
import type { LineContainer } from './line-container.ts'
import { adfNodes, applyMark, contentNodes, holdsOwnMarks, isNode, isTextBreak, markedItems, marksItem, marksLink, ownMarksInMark, record } from './inline-pieces.ts'
import { asidesAfterLink, bracketStack, linkedAlt, mediaSingle } from './inline-brackets.ts'
import { commonMarkLink, linkDefinition, linkHref } from './mark-spellings.ts'
import { contentOffset, noSpans, readInlineDirective } from './directive/syntax.ts'
import { decodeTextEscapes, trimTrailingSpace } from './commonmark/grammar.ts'
import { failure, faulted, success } from '../result.ts'
import { flavourClaims } from './flavour.ts'
import { inlineSource, readInlineToken } from './inline-tokens.ts'
import { joinsWhenRead, textBreakName, textBreakSpelling } from './adjacent-text.ts'
import { nodeAttrs } from '../adf/document.ts'
import { readCarriedInline } from './opaque-carry.ts'
import { readDirectiveMark } from './directive/mark-reading.ts'
import { readInlineDirectiveNode } from './directive/node-reading.ts'
import { readTextDirective } from './directive/text.ts'
import { targetMemo } from './commonmark/link-syntax.ts'

// Only a `paragraph` block takes `image`, the `mediaSingle` a lone image builds; every other container takes `nodes`, where the image is its linked alt text.
export type InlineContent = { image?: AdfNode; nodes: AdfNode[] }

// `openingSpellableLink`: the paragraph opens with a directive link that CommonMark could spell.
export type OutermostContent = InlineContent & { openingSpellableLink: boolean }

type Scanned = { image?: AdfNode; items: Resolved[]; openingSpellableLink: boolean }

// Where a token stands: `pending` is the text before it that no piece holds yet.
type Reach = { brackets: BracketStack; index: number; inline: InlineSource; pending: string; pieces: readonly Piece[] }

// What a token leaves: the scan goes on at `end`, `pieces` follow those before `from`, and `pending` is the text no piece holds yet.
type Taken = { end: number; from?: number; opensSpellableLink?: boolean; pending?: string; pieces: Piece[] }

const hreflessLink = 'the link mark spells its href: this one spells none'
const linkInLink = 'no link wraps a link: the [content] this one marks already holds one'
const noDefinitions: LinkDefinitions = new Map()
export const spellableLink = 'link takes the directive form only where CommonMark cannot spell it: this one it can, as [text](url "title") or <url>'

// The outermost content: only here does a text break see both its neighbours.
export function parseInlineContent(source: string, definitions: LinkDefinitions, path: ConvertErrorPath, container: LineContainer, flavour: Flavour): Result<OutermostContent> {
  const scanned = scanInline(outermost(source, container, flavourClaims[flavour], { definitions, path, reading: undefined }))
  if (!scanned.ok) return scanned
  const nodes = partText(contentNodes(scanned.value.items), path)
  if (!nodes.ok) return nodes
  const { image, openingSpellableLink } = scanned.value
  return success(image === undefined ? { nodes: nodes.value, openingSpellableLink } : { image, nodes: nodes.value, openingSpellableLink })
}

// The reading of a line that faults still holds what the reader took before the fault.
export function readLineBack(line: string, container: LineContainer, claims: Claims): { faulted: boolean; reading: InlineReading } {
  const reading: InlineReading = { codeSpans: [], emphasis: new Map(), links: [] }
  return { faulted: !scanInline(outermost(line, container, claims, { definitions: noDefinitions, path: [], reading })).ok, reading }
}

function outermost(source: string, container: LineContainer, claims: Claims, shared: Omit<SharedScan, 'targets'>): Scan {
  return { claims, container, inLink: false, offset: 0, shared: { ...shared, targets: targetMemo(source) }, source, spans: noSpans }
}

// The pieces, the pending text and the bracket stack change here alone, by what each token leaves.
function scanInline(scan: Scan): Result<Scanned> {
  const brackets = bracketStack()
  const inline = inlineSource(scan.source)
  const pieces: Piece[] = []
  let index = 0
  let openingSpellableLink = false
  let pending = ''
  while (index < scan.source.length) {
    const token = readInlineToken(inline, index, scan.claims)
    // Only a line ending drops the spaces before it: CommonMark keeps those before a backslash hard break.
    if (!isText(token)) for (const piece of textPieces(pending, token.kind === 'line-ending')) pieces.push(piece)
    const taken = takeToken(scan, { brackets, index, inline, pending, pieces }, token)
    if (!taken.ok) return taken
    if (taken.value.from !== undefined) pieces.length = taken.value.from
    for (const piece of taken.value.pieces) pieces.push(piece)
    index = taken.value.end
    openingSpellableLink ||= taken.value.opensSpellableLink === true
    pending = taken.value.pending ?? ''
  }
  for (const piece of textPieces(pending, scan.container !== undefined)) pieces.push(piece)
  const items = markedItems(pieces.flatMap((piece) => linkedAlt(piece, scan.inLink)), scan, true)
  if (!items.ok) return items
  const [only] = pieces
  return success(pieces.length === 1 && only?.kind === 'image' ? { image: mediaSingle(only), items: items.value, openingSpellableLink } : { items: items.value, openingSpellableLink })
}

function isText(token: InlineToken): boolean {
  return token.kind === 'entity' || token.kind === 'escape' || token.kind === 'text'
}

function textPieces(pending: string, strip: boolean): Piece[] {
  const raw = strip ? trimTrailingSpace(pending) : pending
  return raw === '' ? [] : [nodePiece({ text: decodeTextEscapes(raw), type: 'text' })]
}

function nodePiece(node: AdfNode): Piece {
  return { kind: 'nodes', nodes: [node] }
}

function takeToken(scan: Scan, at: Reach, token: InlineToken): Result<Taken> {
  if (token.kind === 'directive') return readDirective(scan, at.inline, token.prefix)
  if (token.kind === 'html') return failure('unmappable-html', `no raw HTML converts at this version: ${token.construct}`, scan.shared.path)
  const { index } = at
  const end = index + token.width
  switch (token.kind) {
    case 'autolink':
      return success({ end, pieces: [nodePiece(linkedText(scan.source.slice(index + 1, end - 1), token.email ? 'mailto:' : ''))] })
    case 'bracket':
      at.brackets.open({ image: token.image, index: at.pieces.length, start: end })
      return success({ end, pieces: [{ image: token.image, kind: 'open' }] })
    case 'bracket-close':
      return at.brackets.close(scan, at.pieces, index) ?? success({ end: index + 1, pending: ']', pieces: [] })
    case 'code-span':
      record(scan.shared, { at: scan.offset + index, kind: 'codeSpans' })
      return success({ end, pieces: [nodePiece({ marks: [{ type: 'code' }], text: codeSpanText(scan.source.slice(index + token.opener, end - token.opener)), type: 'text' })] })
    case 'delimiter-run':
      return success({ end, pieces: [{ canClose: token.canClose, canOpen: token.canOpen, character: scan.source.charAt(index), kind: 'run', length: token.width, offset: scan.offset + index }] })
    case 'entity':
    case 'escape':
    case 'text':
      return success({ end, pending: at.pending + scan.source.slice(index, end), pieces: [] })
    case 'hard-break':
      return success({ end, pieces: [nodePiece({ type: 'hardBreak' })] })
    case 'highlight':
      return success({ end, pieces: [{ closes: token.closes, kind: 'highlight', opens: token.opens }] })
    case 'line-ending':
      return success(at.pending.endsWith('  ') ? { end: index + 1, pieces: [nodePiece({ type: 'hardBreak' })] } : { end: index + 1, pending: ' ', pieces: [] })
  }
}

function readDirective(scan: Scan, inline: InlineSource, prefix: ClaimedPrefix): Result<Taken> {
  const held = scan.spans.get(prefix.index)
  if (held !== undefined) return takeDirective(scan, held, prefix.index)
  const directive = readInlineDirective(inline, prefix)
  if (directive.fault !== undefined) return faulted(directive.fault, scan.shared.path)
  return takeDirective(scan, directive.value, prefix.index)
}

function takeDirective(scan: Scan, span: DirectiveSpan, index: number): Result<Taken> {
  const read = directivePieces(scan, span, index)
  return read.ok ? success({ ...read.value, end: index + span.length }) : read
}

function directivePieces(scan: Scan, span: DirectiveSpan, index: number): Result<Pick<Taken, 'opensSpellableLink' | 'pieces'>> {
  const carried = readCarriedInline(span)
  if (carried !== undefined) {
    if (carried.fault !== undefined) return faulted(carried.fault, scan.shared.path)
    return success({ pieces: [{ kind: 'ownMarks', node: carried.value }] })
  }
  if (span.name === textBreakName) return span.content === undefined && span.attributes.size === 0 ? success({ pieces: [{ kind: 'textBreak' }] }) : failure('unsupported-node-shape', `${textBreakName} spells the bare leaf form, ${textBreakSpelling}: this one spells more`, scan.shared.path)
  const text = readTextDirective(span)
  if (text?.fault !== undefined) return faulted(text.fault, scan.shared.path)
  if (text !== undefined) return success({ pieces: [nodePiece({ text: text.value, type: 'text' })] })
  const mark = readDirectiveMark(span.name, span.attributes, scan.shared.path)
  // A node's slot is the node's own content, never the text of a link around the node.
  const slot = slotContent(scan, span, index, mark !== undefined && (scan.inLink || span.name === 'link'))
  if (!slot.ok) return slot
  if (mark !== undefined) return mark.ok ? directiveMarkPieces(scan, span.name, mark.value, slot.value, index) : mark
  const content = slot.value === undefined ? undefined : contentNodes(slot.value)
  if (content?.some(isTextBreak) === true) return failure('unsupported-node-shape', `delete ${textBreakSpelling} from this content slot: a slot holds one text node`, scan.shared.path)
  const node = readInlineDirectiveNode(span.name, span.attributes, content === undefined ? undefined : adfNodes(content), scan.shared.path)
  if (!node.ok) return node
  return success({ pieces: [node.value.marks === undefined ? nodePiece(node.value) : { kind: 'ownMarks', node: node.value }] })
}

function directiveMarkPieces(scan: Scan, name: string, mark: AdfMark, slot: readonly Resolved[] | undefined, index: number): Result<Pick<Taken, 'opensSpellableLink' | 'pieces'>> {
  const nodes = slot === undefined ? [] : contentNodes(slot)
  if (slot === undefined || nodes.length === 0) {
    return failure('unsupported-node-shape', `the ${name} mark wraps the [content] it marks: this one wraps none`, scan.shared.path)
  }
  if (nodes.some(holdsOwnMarks)) return failure('unsupported-node-shape', ownMarksInMark, scan.shared.path)
  if (!nodes.some((node) => isNode(node) && marksItem(node, mark.type))) {
    const fix = mark.type === 'border' ? 'only a mediaInline takes border: delete the border spelling' : `write the ${name} mark around text beside them`
    return failure('unsupported-node-shape', `the ${name} mark wraps the [content] it marks: this one wraps only nodes that take no ${name} mark: ${fix}`, scan.shared.path)
  }
  const opensSpellableLink = mark.type === 'link' ? opensSpellableLinkDirective(scan, mark, nodes, index) : success(false)
  if (!opensSpellableLink.ok) return opensSpellableLink
  const marked = applyMark(slot, mark)
  const link = mark.type === 'link' ? linkDefinition(nodeAttrs(mark)) : undefined
  return success({ opensSpellableLink: opensSpellableLink.value, pieces: [{ kind: 'nodes', nodes: link === undefined ? marked : asidesAfterLink(marked, link) }] })
}

// spec/flavour.md, Marks. A link opening a paragraph may still need the directive form for the line it opens.
function opensSpellableLinkDirective(scan: Scan, mark: AdfMark, nodes: readonly Inline[], index: number): Result<boolean> {
  const href = linkHref(nodeAttrs(mark))
  if (href === undefined) return failure('unsupported-node-shape', hreflessLink, scan.shared.path)
  if (marksLink(nodes)) return failure('unsupported-node-shape', linkInLink, scan.shared.path)
  if (commonMarkLink(nodeAttrs(mark), href, adfNodes(nodes), { bracketed: scan.container === undefined, escapes: 'lossless', marksInside: 0 }) === undefined) return success(false)
  return index === 0 && scan.container === 'paragraph' ? success(true) : failure('unsupported-node-shape', spellableLink, scan.shared.path)
}

function slotContent(scan: Scan, span: DirectiveSpan, index: number, inLink: boolean): Result<Resolved[] | undefined> {
  if (span.content === undefined) return success(undefined)
  const offset = scan.offset + index + contentOffset(span)
  const scanned = scanInline({ ...scan, container: undefined, inLink, offset, source: span.content, spans: span.spans })
  return scanned.ok ? success(scanned.value.items) : scanned
}

// spec/flavour.md, Inline nodes: the leaf builds no node, so only the pair it parts spells it.
function partText(items: readonly Inline[], path: ConvertErrorPath): Result<AdfNode[]> {
  const parted: AdfNode[] = []
  for (const [index, item] of items.entries()) {
    if (!isTextBreak(item)) {
      parted.push(isNode(item) ? item : item.node)
      continue
    }
    const previous = items[index - 1]
    const next = items[index + 1]
    if (previous === undefined || next === undefined || !isNode(previous) || !isNode(next) || !joinsWhenRead(previous, next)) {
      return failure('unsupported-node-shape', `delete ${textBreakSpelling} here: it stands only between two runs of text with the same formatting, which would otherwise read as one`, path)
    }
  }
  return success(parted)
}

function linkedText(text: string, scheme: string): AdfNode {
  return { marks: [{ attrs: { href: `${scheme}${text}` }, type: 'link' }], text, type: 'text' }
}

function codeSpanText(content: string): string {
  const text = content.replaceAll('\n', ' ')
  const padded = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  return padded ? text.slice(1, -1) : text
}

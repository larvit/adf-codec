import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import type { WrittenFlavour } from '../flavour.ts'
import { blockDirectiveForm, documentSpelling } from '../directive/block.ts'
import { blockNodeModel, blockNodes } from '../../adf/block-nodes.ts'
import { blockText, emptyLine, joinedText, prefixedText, quotedText, writtenText, type BlockText } from './block-text.ts'
import { carriedBlock } from '../opaque-carry.ts'
import { emitInlineLine } from './inline-line.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { fencedCodeBlock } from '../commonmark/backtick-runs.ts'
import { flavourClaims } from '../flavour.ts'
import { holdsNullCharacter, isThematicBreak, markerInterruptsParagraph } from '../commonmark/grammar.ts'
import { holdsOnlyAttributes, isUnmarkedSpellableText, nodeAttrs, nodeContent, writableContent } from '../../adf/document.ts'
import { languageSlot, type LanguageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { withinEngineLimits, withinLongest } from '../../length-bound.ts'
import { spellBlockDirectiveOpener } from '../directive/block-spelling.ts'
import { spellDirectiveCloser, spellDirectiveOpener } from '../directive/syntax.ts'
import { tryImage } from './image.ts'
import { tryPipeTable } from './pipe-table.ts'

type BlockContainer = 'directive' | 'document' | 'list-item'
type Delimiters = readonly [string, string]
// headroom: the nesting levels the deepest node below may still spend before `largestNesting` refuses it.
export type EmittedBlock = SpelledBlock & { headroom: number }
// spell: the flavour's own blocks, tried before CommonMark's; claimsItem, claimsQuote: whether a list item's or quote's text opens with a marker the flavour's reader would take, so the writer escapes it.
export type FlavourBlockWriters = {
  claimsItem: (text: BlockText) => boolean
  claimsQuote: (text: BlockText) => boolean
  spell: (node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing) => Result<EmittedBlock> | undefined
}
type KeptSpelling = { block: EmittedBlock | undefined; depth: number }
export type PlacedBlock = SpelledBlock & { node: AdfNode }
export type PlacedBlocks = { blocks: readonly PlacedBlock[]; headroom: number }
// CommonMark starts a new list where the marker changes, so every second list in a run of one kind takes `alternateText`.
type SpelledBlock = { spelling: 'commonmark' | 'directive'; text: BlockText } | { alternateText: BlockText; interruptsParagraph: boolean; ordered: boolean; spelling: 'list'; text: BlockText }
// Keyed by reference: only a caller building one object per position (the parse, the portable reduction) passes one; a consumer's document may share a node.
export type SpellingMemo = Map<AdfNode, KeptSpelling>
type WalkedItem = { node: AdfNode; walk: PlacedBlocks }
export type WrittenAs = { flavour: 'lossless' } | { blocks: FlavourBlockWriters; flavour: 'portable' }
export type Writing = WrittenAs & { memo: SpellingMemo | undefined }

const bulletDelimiters: Delimiters = ['-', '*']
export const largestListMarker = 999999999
// Bare because tryList admits no item carrying attributes, marks or text.
const listItemOpener = spellDirectiveOpener('listItem', undefined, '')
const orderedDelimiters: Delimiters = ['.', ')']

export function adfToLosslessMarkdown(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => writeMarkdown(document, { flavour: 'lossless' }))
}

export function writeMarkdown(document: AdfDocument, writtenAs: WrittenAs): Result<string> {
  const content = writableContent(document)
  if (!content.ok) return content
  if (content.value === undefined) return success(`${documentSpelling}\n`)
  const walk = walkBlocks(content.value, [], 0, { ...writtenAs, memo: undefined })
  return walk.ok ? writtenDocument(joinBlocks(walk.value.blocks, 'document')) : walk
}

// Every line of a document's markdown ends with a line break, its last included.
function writtenDocument(text: BlockText): Result<string> {
  if (text.length === 0) return success('')
  const fits = withinLongest(text.length + 1, text)
  return fits.ok ? success(`${writtenText(fits.value)}\n`) : fits
}

export function walkBlocks(nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  let headroom = largestNesting - depth
  if (headroom < 0) return tooDeep(path)
  const blocks: PlacedBlock[] = []
  for (const [index, node] of nodes.entries()) {
    const block = emitBlock(node, [...path, 'content', index], depth, writing)
    if (!block.ok) return block
    // Refused on the measure, before any text is written, so every engine stops at the first block past V8's longest string.
    const fits = withinLongest(block.value.text.length, block.value)
    if (!fits.ok) return fits
    headroom = Math.min(headroom, block.value.headroom)
    blocks.push({ ...block.value, node })
  }
  return success({ blocks, headroom })
}

function tooDeep(path: ConvertErrorPath): Result<never> {
  return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
}

export function joinBlocks(blocks: readonly PlacedBlock[], container: BlockContainer): BlockText {
  const parts: BlockText[] = []
  let alternated = false
  for (const [index, block] of blocks.entries()) {
    const previous = blocks[index - 1]
    if (previous !== undefined && blankLineBetween(previous, block, container)) parts.push(emptyLine)
    alternated = !alternated && previous !== undefined && sharesMarker(previous, block)
    parts.push(alternated && block.spelling === 'list' ? block.alternateText : block.text)
  }
  return joinedText(parts)
}

function sharesMarker(previous: PlacedBlock, next: PlacedBlock): boolean {
  return previous.spelling === 'list' && next.spelling === 'list' && previous.ordered === next.ordered
}

function blankLineBetween(previous: PlacedBlock, next: PlacedBlock, container: BlockContainer): boolean {
  const bothCommonMark = previous.spelling !== 'directive' && next.spelling !== 'directive'
  if (bothCommonMark && next.spelling === 'list' && container === 'list-item') return !next.interruptsParagraph
  return container !== 'directive' || bothCommonMark
}

export function emitBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const model = blockNodeModel(node.type)
  if (model === undefined) return carriedFence(carriedBlock(node, path, depth))
  const readable = readableBlock(node, path, depth, writing, 'walked')
  if (readable !== undefined) return readable
  return emitDirectiveBlock(node, model, path, depth, () => walkBlocks(nodeContent(node), path, depth + 1, writing))
}

// Whether the node takes a CommonMark spelling, rather than its directive.
export function commonMarkSpelling(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing & { memo: SpellingMemo }): Result<boolean> {
  const readable = readableBlock(node, path, depth, writing, 'asked')
  if (readable === undefined) return success(false)
  if (!readable.ok) return readable
  const fits = withinLongest(readable.value.text.length, readable.value)
  if (!fits.ok) return fits
  return success(readable.value.spelling !== 'directive')
}

// Only an `asked` call keeps a spelling, and any read drops it: the ancestor that reads it spells it into its own text, so no two levels hold that text.
function readableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing, caller: 'asked' | 'walked'): Result<EmittedBlock> | undefined {
  const { memo } = writing
  const kept = memo?.get(node)
  memo?.delete(node)
  if (kept !== undefined) {
    if (kept.block === undefined) return undefined
    // An entry holds the spelling at its fill depth. A read at or above it rebases headroom; a read below re-spells, because a hit skips the walk's depth guards.
    if (depth <= kept.depth) return success({ ...kept.block, headroom: kept.block.headroom + kept.depth - depth })
  }
  const spelled = spellReadableBlock(node, path, depth, writing)
  if (caller === 'asked' && spelled === undefined) memo?.set(node, { block: undefined, depth })
  if (caller === 'asked' && spelled?.ok === true) memo?.set(node, { block: spelled.value, depth })
  return spelled
}

function spellReadableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const own = writing.flavour === 'portable' ? writing.blocks.spell(node, path, depth, writing) : undefined
  if (own !== undefined) return own
  if (node.type === 'blockquote') return holdsOnlyAttributes(node, []) ? quotedBlocks(node, path, depth, writing, (body) => alertEscaped(body, writing)) : undefined
  if (node.type === 'bulletList' || node.type === 'orderedList') return tryList(node, path, depth, writing)
  if (node.type === 'codeBlock') return readableText(tryCodeBlock(node, writing.flavour))
  if (node.type === 'heading') return tryHeading(node, path, writing.flavour)
  if (node.type === 'mediaSingle') return readableText(tryImage(node, writing.flavour))
  if (node.type === 'paragraph') return tryParagraph(node, path, writing.flavour)
  if (node.type === 'rule') return readableText(tryRule(node))
  if (node.type === 'table') return readableText(tryPipeTable(node, path, writing.flavour))
  return undefined
}

function readableText(text: string | undefined): Result<EmittedBlock> | undefined {
  return text === undefined ? undefined : success(commonMarkText(blockText(text)))
}

function carriedFence(carried: Result<{ headroom: number; text: string }>): Result<EmittedBlock> {
  if (!carried.ok) return carried
  return success(commonMarkText(blockText(carried.value.text), carried.value.headroom))
}

function commonMarkText(text: BlockText, headroom: number = Number.POSITIVE_INFINITY): EmittedBlock {
  return { headroom, spelling: 'commonmark', text }
}

function directivePair(node: AdfNode, opener: string, body: BlockText, headroom: number = Number.POSITIVE_INFINITY): EmittedBlock {
  const closer = blockText(spellDirectiveCloser(node.type))
  return { headroom, spelling: 'directive', text: joinedText(body.length === 0 ? [blockText(opener), closer] : [blockText(opener), body, closer]) }
}

function emitDirectiveBlock(node: AdfNode, model: BlockNodeModel, path: ConvertErrorPath, depth: number, walkBody: () => Result<PlacedBlocks>): Result<EmittedBlock> {
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text: this one holds text`, path)
  if (blockDirectiveForm(node.type) === 'leaf' && nodeContent(node).length > 0) return failure('unsupported-node-shape', `a ${node.type} holds no content: this one holds some`, path)
  if (model.contentModel === 'code') return emitCodeDirective(node, model, path, depth)
  const opener = spellBlockDirectiveOpener(node, model, path)
  if (opener === undefined) return carriedFence(carriedBlock(node, path, depth))
  if (!opener.ok) return opener
  return emitDirectiveBody(node, model, opener.value, path, walkBody)
}

function emitDirectiveBody(node: AdfNode, model: BlockNodeModel, opener: string, path: ConvertErrorPath, walkBody: () => Result<PlacedBlocks>): Result<EmittedBlock> {
  if (blockDirectiveForm(node.type) === 'leaf') return success({ headroom: Number.POSITIVE_INFINITY, spelling: 'directive', text: blockText(opener) })
  if (model.contentModel === 'inline') {
    const line = emitInlineLine(nodeContent(node), 'paragraph', path, 'lossless')
    if (!line.ok) return line
    return success(directivePair(node, opener, blockText(line.value)))
  }
  const walk = walkBody()
  if (!walk.ok) return walk
  return success(directivePair(node, opener, joinBlocks(walk.value.blocks, 'directive'), walk.value.headroom))
}

function alertEscaped(body: BlockText, writing: Writing): BlockText {
  return writing.flavour === 'portable' && writing.blocks.claimsQuote(body) ? prefixedText('\\', '', body) : body
}

// Quote spellers call this directly, never through a wrapper: each frame a quote level adds lowers the depth the stack holds (docs/decisions.md §Nothing recurses unbounded).
export function quotedBlocks(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing, bodyText: (body: BlockText) => BlockText): Result<EmittedBlock> {
  const inner = walkBlocks(nodeContent(node), path, depth + 1, writing)
  if (!inner.ok) return inner
  return success(commonMarkText(quotedText(bodyText(joinBlocks(inner.value.blocks, 'document'))), inner.value.headroom))
}

function tryCodeBlock(node: AdfNode, flavour: WrittenFlavour): string | undefined {
  if (!holdsOnlyAttributes(node, ['language'])) return undefined
  const slot = languageSlot(nodeAttrs(node)['language'], flavourClaims[flavour])
  if (slot.kind === 'attribute') return undefined
  const [only, ...others] = fencedTexts(node) ?? []
  if (only === undefined || others.length > 0) return undefined
  return fencedCodeBlock(slot.kind === 'fence' ? slot.info : '', only)
}

// spec/flavour.md, The CommonMark blocks: one fence per text node, the language on each; with no fence to carry it, the attribute does.
function emitCodeDirective(node: AdfNode, model: BlockNodeModel, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const texts = fencedTexts(node)
  if (texts === undefined) return carriedFence(carriedBlock(node, path, depth))
  const slot: LanguageSlot = texts.length === 0 ? { kind: 'attribute' } : languageSlot(nodeAttrs(node)['language'], flavourClaims.lossless)
  const opener = spellBlockDirectiveOpener(node, model, path, slot.kind === 'attribute' ? [] : ['language'])
  if (opener === undefined) return carriedFence(carriedBlock(node, path, depth))
  if (!opener.ok) return opener
  const info = slot.kind === 'fence' ? slot.info : ''
  return success(directivePair(node, opener.value, blockText(texts.map((text) => fencedCodeBlock(info, text)).join('\n'))))
}

// The text of each fence, or `undefined` where a child holds what no fence keeps, so the block carry takes the node.
function fencedTexts(node: AdfNode): string[] | undefined {
  if (node.content === undefined) return ['']
  const texts: string[] = []
  for (const child of node.content) {
    if (!isUnmarkedSpellableText(child) || typeof child.text !== 'string' || child.text === '' || /\r/.test(child.text) || holdsNullCharacter(child.text)) return undefined
    texts.push(child.text)
  }
  return texts
}

function tryHeading(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedBlock> | undefined {
  if (!holdsOnlyAttributes(node, ['level'])) return undefined
  const level = nodeAttrs(node)['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) return undefined
  const hashes = '#'.repeat(level)
  const content = nodeContent(node)
  if (content.length === 0) return success(commonMarkText(blockText(hashes)))
  const line = emitInlineLine(content, 'heading', path, flavour)
  if (!line.ok) return line
  return success(commonMarkText(blockText(`${hashes} ${line.value}`)))
}

function tryList(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const ordered = node.type === 'orderedList'
  if (!holdsOnlyAttributes(node, ordered ? ['order'] : [])) return undefined
  const items = nodeContent(node)
  const start = listStart(node, items.length)
  if (start === undefined || items.length === 0) return undefined
  if (items.some((item) => item.type !== 'listItem' || !holdsOnlyAttributes(item, []))) return undefined
  const walked: WalkedItem[] = []
  let headroom = Number.POSITIVE_INFINITY
  for (const [offset, item] of items.entries()) {
    const walk = walkBlocks(nodeContent(item), [...path, 'content', offset], depth + 1, writing)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    walked.push({ node: item, walk: walk.value })
  }
  const inners = walked.map((item) => {
    const inner = joinBlocks(item.walk.blocks, 'list-item')
    return writing.flavour === 'portable' && writing.blocks.claimsItem(inner) ? prefixedText('\\', '', inner) : inner
  })
  const list = spelledList(inners, ordered ? start : undefined, headroom)
  if (list !== undefined) return success(list)
  // The directive form spends a level the walk did not count.
  if (headroom < 1) return tooDeep(path)
  return emitDirectiveBlock(node, ordered ? blockNodes.orderedList : blockNodes.bulletList, path, depth, () => success({ blocks: directiveItems(walked), headroom: headroom - 1 }))
}

// start: an ordered list's first number, undefined for a bullet list.
export function spelledList(inners: readonly BlockText[], start: number | undefined, headroom: number): EmittedBlock | undefined {
  const [usual, alternate] = start === undefined ? bulletDelimiters : orderedDelimiters
  const number = (offset: number): string => (start === undefined ? '' : `${start + offset}`)
  const text = listLines(inners, number, usual)
  const alternateText = listLines(inners, number, alternate)
  if (text === undefined || alternateText === undefined) return undefined
  return { alternateText, headroom, interruptsParagraph: markerInterruptsParagraph(start, inners[0]?.length === 0), ordered: start !== undefined, spelling: 'list', text }
}

function listLines(inners: readonly BlockText[], number: (offset: number) => string, delimiter: string): BlockText | undefined {
  const lines: BlockText[] = []
  for (const [offset, inner] of inners.entries()) {
    const line = tryListItemLines(inner, `${number(offset)}${delimiter} `)
    if (line === undefined) return undefined
    lines.push(line)
  }
  return joinedText(lines)
}

function directiveItems(items: readonly WalkedItem[]): PlacedBlock[] {
  return items.map((item) => ({ ...directivePair(item.node, listItemOpener, joinBlocks(item.walk.blocks, 'directive')), node: item.node }))
}

function listStart(node: AdfNode, items: number): number | undefined {
  if (node.type !== 'orderedList') return 0
  const start = nodeAttrs(node)['order']
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || Object.is(start, -0) || start > largestListMarker) return undefined
  return start + items - 1 > largestListMarker ? undefined : start
}

function tryListItemLines(inner: BlockText, marker: string): BlockText | undefined {
  if (inner.length === 0) return blockText(marker.trimEnd())
  if (inner.firstBlank || inner.blankRest > 0) return undefined
  const indent = ' '.repeat(marker.length)
  const lines = prefixedText(marker, indent, inner)
  if (!lines.firstRuleCharacters || !isThematicBreak(lines.first)) return lines
  // An item opens with `*` only as text, a list there taking `- ` and a rule `---`; a backslash keeps a first line reading as a rule text.
  return inner.firstCharacter === '*' ? prefixedText(`${marker}\\`, indent, inner) : undefined
}

function tryParagraph(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedBlock> | undefined {
  const content = nodeContent(node)
  if (content.length === 0 || !holdsOnlyAttributes(node, [])) return undefined
  const line = emitInlineLine(content, 'paragraph', path, flavour)
  if (!line.ok) return line
  return success(commonMarkText(blockText(line.value)))
}

function tryRule(node: AdfNode): string | undefined {
  if (!holdsOnlyAttributes(node, []) || nodeContent(node).length > 0) return undefined
  return '---'
}

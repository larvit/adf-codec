import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import type { WrittenFlavour } from '../flavour.ts'
import { blockDirectiveForm, documentSpelling } from '../directive/block.ts'
import { blockNodeModel, blockNodes, isHeadingLevel } from '../../adf/block-nodes.ts'
import { blockText, emptyLine, holdsBlankLine, joinedText, opensWithThematicBreak, prefixedText, quotedText, writtenText, type BlockText } from './block-text.ts'
import { carriedBlock } from '../opaque-carry.ts'
import { emitInlineLine } from './inline-line.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { fencedCodeBlock } from '../commonmark/backtick-runs.ts'
import { flavourClaims } from '../flavour.ts'
import { holdsLoneSurrogate, holdsNullCharacter, markerInterruptsParagraph } from '../commonmark/grammar.ts'
import { holdsOnlyAttributes, isUnmarkedSpellableText, nodeAttrs, nodeContent, readAdfDocument, writableContent } from '../../adf/document.ts'
import { idKey, readTrailingMarker, spellIdAttributes, spellIdMarker } from '../directive/id-marker.ts'
import { languageSlot, type LanguageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { markerOpener, spellDirectiveCloser, spellDirectiveOpener } from '../directive/syntax.ts'
import { withinEngineLimits, withinLongest } from '../../length-bound.ts'
import { spellBlockDirectiveOpener } from '../directive/block-spelling.ts'
import { tryImage } from './image.ts'
import { tryPipeTable } from './pipe-table.ts'

type BlockContainer = 'directive' | 'document' | 'list-item' | 'quote'
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
// CommonMark starts a new list where the marker changes, so every second list in a run of one kind takes `alternateText`; `trailing` is a paragraph's spelling with its id at the end, where it opens a quote or a list item.
type SpelledBlock = { spelling: 'commonmark' | 'directive'; text: BlockText; trailing?: BlockText } | { alternateText: BlockText; interruptsParagraph: boolean; ordered: boolean; spelling: 'list'; text: BlockText }
type Spell = () => Result<EmittedBlock> | undefined
// take: read and drop the node's kept spelling, else spell it; ask: as take, keeping a fresh spelling unless refused.
export type SpellingMemo = Readonly<Record<'ask' | 'take', (node: AdfNode, depth: number, spell: Spell) => Result<EmittedBlock> | undefined>>
type WalkedItem = { id: MarkedId; node: AdfNode; walk: PlacedBlocks }
export type WrittenAs = { flavour: 'lossless' } | { blocks: FlavourBlockWriters; flavour: 'portable' }
export type Writing = WrittenAs & { memo: SpellingMemo | undefined }

const bulletDelimiters: Delimiters = ['-', '*']
export const largestListMarker = 999999999
const orderedDelimiters: Delimiters = ['.', ')']

export function adfToLosslessMarkdown(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => {
    const read = readAdfDocument(document)
    return read.ok ? writeMarkdown(read.value, { flavour: 'lossless' }) : read
  })
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
    parts.push(blockSpelling(block, alternated, index === 0 && (container === 'list-item' || container === 'quote')))
  }
  return joinedText(parts)
}

function blockSpelling(block: PlacedBlock, alternated: boolean, opensContainer: boolean): BlockText {
  if (block.spelling === 'list') return alternated ? block.alternateText : block.text
  return opensContainer ? (block.trailing ?? block.text) : block.text
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
  const readable = readableBlock(node, path, depth, writing)
  if (readable !== undefined) return readable
  return emitDirectiveBlock(node, model, path, depth, () => walkBlocks(nodeContent(node), path, depth + 1, writing))
}

// Whether the node takes a CommonMark spelling, rather than its directive.
export function commonMarkSpelling(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing & { memo: SpellingMemo }): Result<boolean> {
  const readable = writing.memo.ask(node, depth, () => spellReadableBlock(node, path, depth, writing))
  if (readable === undefined) return success(false)
  if (!readable.ok) return readable
  const fits = withinLongest(readable.value.text.length, readable.value)
  if (!fits.ok) return fits
  return success(readable.value.spelling !== 'directive')
}

function readableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const spell = () => spellReadableBlock(node, path, depth, writing)
  return writing.memo === undefined ? spell() : writing.memo.take(node, depth, spell)
}

// Keyed by reference: only a caller building one object per position (the parse, the portable reduction) makes one; a consumer's document may share a node.
export function spellingMemo(): SpellingMemo {
  const kept = new Map<AdfNode, KeptSpelling>()
  // Any read drops the entry: the ancestor that reads it spells it into its own text, so no two levels hold that text.
  const take: SpellingMemo['take'] = (node, depth, spell) => {
    const entry = kept.get(node)
    kept.delete(node)
    if (entry === undefined) return spell()
    if (entry.block === undefined) return undefined
    // An entry holds the spelling at its fill depth. A read at or above it rebases headroom; a read below re-spells, because a hit skips the walk's depth guards.
    return depth <= entry.depth ? success({ ...entry.block, headroom: entry.block.headroom + entry.depth - depth }) : spell()
  }
  const ask: SpellingMemo['ask'] = (node, depth, spell) => take(node, depth, () => {
    const spelled = spell()
    if (spelled === undefined) kept.set(node, { block: undefined, depth })
    else if (spelled.ok) kept.set(node, { block: spelled.value, depth })
    return spelled
  })
  return { ask, take }
}

type ReadableSpelling = {
  // The lossless spelling in words, named when the reader refuses a directive written for a node CommonMark spells.
  describe: (node: AdfNode) => string
  spell: (node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing) => Result<EmittedBlock> | undefined
}

const readableSpellings: ReadonlyMap<string, ReadableSpelling> = new Map<string, ReadableSpelling>([
  ['blockquote', {
    describe: () => 'each line behind `> `',
    spell: (node, path, depth, writing) => {
      const id = markedId(node)
      return id === undefined ? undefined : quotedBlocks(node, path, depth, writing, (body) => alertEscaped(body, writing), id)
    },
  }],
  ['bulletList', { describe: () => 'each item behind `- `, or behind `* ` where the list right before it takes `- `', spell: tryList }],
  ['codeBlock', {
    describe: () => 'its text in a fence of more backticks than any run it holds, its language after the opening fence',
    spell: (node, _path, _depth, writing) => readableLines(tryCodeBlock(node, writing.flavour)),
  }],
  ['heading', { describe: () => 'one `#` per level before its text, `## Title` at level 2', spell: (node, path, _depth, writing) => tryHeading(node, path, writing.flavour) }],
  ['mediaSingle', {
    describe: () => '`![alt](url)`, or `[![alt](url)](href)` when linked',
    spell: (node, _path, _depth, writing) => readableText(tryImage(node, writing.flavour)),
  }],
  ['orderedList', {
    describe: (node) => {
      const order = String(nodeAttrs(node)['order'])
      return `each item behind its number, counting up from \`${order}. \`, or from \`${order}) \` where the list right before it takes \`.\``
    },
    spell: tryList,
  }],
  ['paragraph', { describe: () => 'its text alone', spell: (node, path, _depth, writing) => tryParagraph(node, path, writing.flavour) }],
  ['rule', { describe: () => '`---`', spell: (node) => readableLines(tryRule(node)) }],
  ['table', { describe: () => 'a pipe table', spell: (node, path, _depth, writing) => readableText(tryPipeTable(node, path, writing.flavour)) }],
])

export function describeCommonMarkSpelling(node: AdfNode): string | undefined {
  return readableSpellings.get(node.type)?.describe(node)
}

function spellReadableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const own = writing.flavour === 'portable' ? writing.blocks.spell(node, path, depth, writing) : undefined
  if (own !== undefined) return own
  return readableSpellings.get(node.type)?.spell(node, path, depth, writing)
}

function readableText(text: string | undefined): Result<EmittedBlock> | undefined {
  return readableLines(text === undefined ? undefined : blockText(text))
}

function readableLines(text: BlockText | undefined): Result<EmittedBlock> | undefined {
  return text === undefined ? undefined : success(commonMarkText(text))
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
export function quotedBlocks(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing, bodyText: (body: BlockText) => BlockText, id: MarkedId = {}): Result<EmittedBlock> {
  const inner = walkBlocks(nodeContent(node), path, depth + 1, writing)
  if (!inner.ok) return inner
  return success(commonMarkText(markedLines(id, quotedText(bodyText(joinBlocks(inner.value.blocks, 'quote'))), false), inner.value.headroom))
}

type MarkedId = { id?: string }

// The id a marker holds beside a CommonMark spelling of the attributes `spelled` names; `undefined` where the node holds another attribute, or an id no marker holds. The portable reduction drops every id, so only the lossless writer meets one.
function markedId(node: AdfNode, ...spelled: string[]): MarkedId | undefined {
  if (!holdsOnlyAttributes(node, [...spelled, idKey])) return undefined
  const id = nodeAttrs(node)[idKey]
  if (id === undefined) return {}
  return typeof id === 'string' ? { id } : undefined
}

// spec/flavour.md, The CommonMark blocks: the marker on the line above, a blank line parting it from lines CommonMark would otherwise read with it.
function markedLines(marked: MarkedId, text: BlockText, parted: boolean): BlockText {
  if (marked.id === undefined) return text
  const marker = blockText(spellIdMarker(marked.id))
  return joinedText(parted ? [marker, emptyLine, text] : [marker, text])
}

function trailingMarker(marked: MarkedId): string {
  return marked.id === undefined ? '' : ` ${spellIdMarker(marked.id)}`
}

// Text such as `[a](<u` takes the marker into a link destination, so the id then rides the block's directive form.
function holdsMarker(line: string, marked: MarkedId, flavour: WrittenFlavour): boolean {
  return marked.id === undefined || readTrailingMarker(`${line}${trailingMarker(marked)}`, flavourClaims[flavour])?.text === line
}

function tryCodeBlock(node: AdfNode, flavour: WrittenFlavour): BlockText | undefined {
  const id = markedId(node, 'language')
  if (id === undefined) return undefined
  const slot = languageSlot(nodeAttrs(node)['language'], flavourClaims[flavour])
  if (slot.kind === 'attribute') return undefined
  const [only, ...others] = fencedTexts(node) ?? []
  if (only === undefined || others.length > 0) return undefined
  return markedLines(id, blockText(fencedCodeBlock(slot.kind === 'fence' ? slot.info : '', only)), false)
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
    if (!isUnmarkedSpellableText(child) || typeof child.text !== 'string' || child.text === '' || /\r/.test(child.text) || holdsNullCharacter(child.text) || holdsLoneSurrogate(child.text)) return undefined
    texts.push(child.text)
  }
  return texts
}

function tryHeading(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedBlock> | undefined {
  const id = markedId(node, 'level')
  const level = nodeAttrs(node)['level']
  if (id === undefined || !isHeadingLevel(level)) return undefined
  const hashes = '#'.repeat(level)
  const content = nodeContent(node)
  if (content.length === 0) return id.id === undefined ? success(commonMarkText(blockText(hashes))) : undefined
  const line = emitInlineLine(content, 'heading', path, flavour)
  if (!line.ok) return line
  if (!holdsMarker(line.value, id, flavour)) return undefined
  return success(commonMarkText(blockText(`${hashes} ${line.value}${trailingMarker(id)}`)))
}

function tryList(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const ordered = node.type === 'orderedList'
  const id = markedId(node, ...(ordered ? ['order'] : []))
  if (id === undefined) return undefined
  const items = nodeContent(node)
  const start = listStart(node, items.length)
  if (start === undefined || items.length === 0) return undefined
  // Every item is checked before any is walked: a list giving way to its directive walks them again.
  const marked: { id: MarkedId; node: AdfNode }[] = []
  for (const item of items) {
    const itemId = item.type === 'listItem' ? markedId(item) : undefined
    if (itemId === undefined) return undefined
    marked.push({ id: itemId, node: item })
  }
  const walked: WalkedItem[] = []
  let headroom = Number.POSITIVE_INFINITY
  for (const [offset, item] of marked.entries()) {
    const walk = walkBlocks(nodeContent(item.node), [...path, 'content', offset], depth + 1, writing)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    walked.push({ ...item, walk: walk.value })
  }
  const inners = walked.map((item) => {
    const inner = joinBlocks(item.walk.blocks, 'list-item')
    return writing.flavour === 'portable' && writing.blocks.claimsItem(inner) ? prefixedText('\\', '', inner) : inner
  })
  const list = walked.every(holdsItemMarker) ? spelledList(inners, ordered ? start : undefined, headroom, walked.map((item) => item.id.id)) : undefined
  if (list !== undefined) return success(markedList(id, list))
  // The directive form spends a level the walk did not count.
  if (headroom < 1) return tooDeep(path)
  return emitDirectiveBlock(node, ordered ? blockNodes.orderedList : blockNodes.bulletList, path, depth, () => success({ blocks: directiveItems(walked), headroom: headroom - 1 }))
}

// An item's id sits right after its list marker, before its first paragraph's text. An item has no CommonMark spelling when its first block would put its own marker on that line, or when it has an id and no first paragraph.
function holdsItemMarker(item: WalkedItem): boolean {
  const [first] = item.walk.blocks
  if (first?.node.type === 'paragraph' && first.spelling === 'commonmark') return true
  if (item.id.id !== undefined) return false
  return first === undefined || !opensWithMarker(first.text)
}

function opensWithMarker(text: BlockText): boolean {
  return text.first.text.startsWith(markerOpener)
}

function markedList(id: MarkedId, list: Extract<EmittedBlock, { spelling: 'list' }>): EmittedBlock {
  const parted = !list.interruptsParagraph
  return { ...list, alternateText: markedLines(id, list.alternateText, parted), text: markedLines(id, list.text, parted) }
}

// start: an ordered list's first number, undefined for a bullet list; ids: each item's own id, where it holds one.
export function spelledList(inners: readonly BlockText[], start: number | undefined, headroom: number, ids: readonly (string | undefined)[] = []): Extract<EmittedBlock, { spelling: 'list' }> | undefined {
  const [usual, alternate] = start === undefined ? bulletDelimiters : orderedDelimiters
  const number = (offset: number): string => (start === undefined ? '' : `${start + offset}`)
  const text = listLines(inners, ids, number, usual)
  const alternateText = listLines(inners, ids, number, alternate)
  if (text === undefined || alternateText === undefined) return undefined
  return { alternateText, headroom, interruptsParagraph: markerInterruptsParagraph(start, inners[0]?.length === 0), ordered: start !== undefined, spelling: 'list', text }
}

function listLines(inners: readonly BlockText[], ids: readonly (string | undefined)[], number: (offset: number) => string, delimiter: string): BlockText | undefined {
  const lines: BlockText[] = []
  for (const [offset, inner] of inners.entries()) {
    const line = tryListItemLines(inner, `${number(offset)}${delimiter} `, ids[offset])
    if (line === undefined) return undefined
    lines.push(line)
  }
  return joinedText(lines)
}

function directiveItems(items: readonly WalkedItem[]): PlacedBlock[] {
  return items.map((item) => ({ ...directivePair(item.node, spellDirectiveOpener('listItem', undefined, spellIdAttributes(item.id.id)), joinBlocks(item.walk.blocks, 'directive')), node: item.node }))
}

function listStart(node: AdfNode, items: number): number | undefined {
  if (node.type !== 'orderedList') return 0
  const start = nodeAttrs(node)['order']
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || Object.is(start, -0) || start > largestListMarker) return undefined
  return start + items - 1 > largestListMarker ? undefined : start
}

// id: the item's own, standing between its marker and its first paragraph's text.
function tryListItemLines(inner: BlockText, marker: string, id: string | undefined): BlockText | undefined {
  if (inner.length === 0) return blockText(marker.trimEnd())
  if (holdsBlankLine(inner)) return undefined
  const indent = ' '.repeat(marker.length)
  const head = id === undefined ? marker : `${marker}${spellIdMarker(id)} `
  const lines = prefixedText(head, indent, inner)
  if (!opensWithThematicBreak(lines)) return lines
  // An item opens with `*` only as text, a list there taking `- ` and a rule `---`; a backslash keeps a first line reading as a rule text.
  return inner.first.character === '*' ? prefixedText(`${marker}\\`, indent, inner) : undefined
}

function tryParagraph(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedBlock> | undefined {
  const content = nodeContent(node)
  const id = markedId(node)
  if (content.length === 0 || id === undefined) return undefined
  const line = emitInlineLine(content, 'paragraph', path, flavour)
  if (!line.ok) return line
  if (!holdsMarker(line.value, id, flavour)) return undefined
  const text = commonMarkText(markedLines(id, blockText(line.value), false))
  return success(id.id === undefined ? text : { ...text, trailing: blockText(`${line.value}${trailingMarker(id)}`) })
}

function tryRule(node: AdfNode): BlockText | undefined {
  const id = markedId(node)
  return id === undefined ? undefined : markedLines(id, blockText('---'), true)
}

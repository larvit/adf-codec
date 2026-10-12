import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import type { WrittenFlavour } from '../portable/conventions.ts'
import { adfDocumentFault, holdsOnlyAttributes, isUnmarkedSpellableText, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { alertMarker, flavourClaims, foldedAlertMarker, leadingMarker, readAlertMarker, readTaskMarker, taskMarker } from '../portable/conventions.ts'
import { blockDirectiveForm, documentSpelling } from '../block-directive.ts'
import { blockNodeModel, blockNodes, isTaskItem } from '../../adf/block-nodes.ts'
import { boundedThen, joinedWithin, longestMarkdown, separatedBy, tooLong, withinEngineLimits } from '../length-bound.ts'
import { carriedBlock } from '../opaque-carry.ts'
import { emitInlineLine } from './inline-line.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { fencePieces } from '../commonmark/backtick-runs.ts'
import { holdsNullCharacter, isBlankLine, isThematicBreak, markerInterruptsParagraph } from '../commonmark/grammar.ts'
import { languageSlot, type LanguageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { spellBlockDirectiveOpener } from './block-directive-spelling.ts'
import { spellDirectiveCloser, spellDirectiveOpener } from '../directive-syntax.ts'
import { tryImage } from './image.ts'
import { tryPipeTable } from './pipe-table.ts'

type BlockContainer = 'directive' | 'document' | 'list-item'
type Delimiters = readonly [string, string]
// headroom: the nesting levels the deepest node below may still spend before `largestNesting` refuses it.
type EmittedBlock = SpelledBlock & { headroom: number }
type KeptSpelling = { block: EmittedBlock | undefined; depth: number }
type PlacedBlock = SpelledBlock & { node: AdfNode }
type PlacedBlocks = { blocks: readonly PlacedBlock[]; headroom: number }
// CommonMark starts a new list where the marker changes, so every second list in a run of one kind takes `alternateText`.
type SpelledBlock = { spelling: 'commonmark' | 'directive'; text: string } | { alternateText: string; spelling: 'list'; text: string }
// joined: each item's text; start: the first item's number.
type SpelledItems = { joined: readonly string[]; start: number; walked: readonly WalkedItem[] }
// Keyed by reference: only a caller building one object per position (the parse, the portable reduction) passes one; a consumer's document may share a node.
export type SpellingMemo = Map<AdfNode, KeptSpelling>
type WalkedItem = { node: AdfNode; walk: PlacedBlocks }
// indent: the characters the containers around a block surely prefix each of its lines with.
export type Writing = { flavour: WrittenFlavour; indent: number; memo: SpellingMemo | undefined }

const bulletDelimiters: Delimiters = ['-', '*']
const bulletWidth = '- '.length
export const largestListMarker = 999999999
// Bare because tryList admits no item carrying attributes, marks or text.
const listItemOpener = spellDirectiveOpener('listItem', undefined, '')
const orderedDelimiters: Delimiters = ['.', ')']
const quoteWidth = '> '.length

export function adfToLosslessMarkdown(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => writeMarkdown(document, 'lossless'))
}

export function writeMarkdown(document: AdfDocument, flavour: WrittenFlavour): Result<string> {
  const fault = adfDocumentFault(document)
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  if (document.content === undefined) return success(`${documentSpelling}\n`)
  const walk = walkBlocks(document.content, [], 0, { flavour, indent: 0, memo: undefined })
  if (!walk.ok) return walk
  const text = joinedWithin(walk.value.blocks.length === 0 ? [] : [...blockPieces(walk.value.blocks, 'document'), '\n'])
  return boundedThen(text, success)
}

function walkBlocks(nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  let headroom = largestNesting - depth
  if (headroom < 0) return tooDeep(path)
  const blocks: PlacedBlock[] = []
  // A forecast that never overcounts, so a deep subtree refuses where its containers would prefix its lines past the bound, before any of them copies those lines.
  let forecast = 0
  for (const [index, node] of nodes.entries()) {
    const block = emitBlock(node, [...path, 'content', index], depth, writing)
    if (!block.ok) return block
    forecast += prefixedLength(block.value.text, writing.indent)
    if (forecast > longestMarkdown) return tooLong()
    headroom = Math.min(headroom, block.value.headroom)
    blocks.push({ ...block.value, node })
  }
  return success({ blocks, headroom })
}

// A blank line takes no indent in a list item and one `>` in a quote, so only the others are charged it.
function prefixedLength(text: string, indent: number): number {
  let length = text.length
  for (let start = 0; start <= text.length; ) {
    const end = text.indexOf('\n', start)
    const stop = end === -1 ? text.length : end
    if (stop > start) length += indent
    start = stop + 1
  }
  return length
}

function indented(writing: Writing, width: number): Writing {
  return { ...writing, indent: writing.indent + width }
}

function tooDeep(path: ConvertErrorPath): Result<never> {
  return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
}

function joinBlocks(blocks: readonly PlacedBlock[], container: BlockContainer): string | undefined {
  return joinedWithin(blockPieces(blocks, container))
}

function* blockPieces(blocks: readonly PlacedBlock[], container: BlockContainer): Generator<string> {
  let alternated = false
  for (const [index, block] of blocks.entries()) {
    const previous = blocks[index - 1]
    if (previous !== undefined) yield separationBetween(previous, block, container)
    alternated = !alternated && previous !== undefined && sharesMarker(previous, block)
    yield alternated && block.spelling === 'list' ? block.alternateText : block.text
  }
}

// A task list is spelled as a bullet list.
function sharesMarker(previous: PlacedBlock, next: PlacedBlock): boolean {
  return previous.spelling === 'list' && next.spelling === 'list' && (previous.node.type === 'orderedList') === (next.node.type === 'orderedList')
}

function separationBetween(previous: PlacedBlock, next: PlacedBlock, container: BlockContainer): string {
  const bothCommonMark = previous.spelling !== 'directive' && next.spelling !== 'directive'
  if (bothCommonMark && next.spelling === 'list' && container === 'list-item') return interruptsParagraph(next.node) ? '\n' : '\n\n'
  return container === 'directive' && !bothCommonMark ? '\n' : '\n\n'
}

function interruptsParagraph(node: AdfNode): boolean {
  const items = nodeContent(node)
  const empty = node.type !== 'taskList' && (items[0] === undefined || nodeContent(items[0]).length === 0)
  if (node.type !== 'orderedList') return markerInterruptsParagraph(undefined, empty)
  return markerInterruptsParagraph(listStart(node, items.length) ?? 0, empty)
}

function emitBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const model = blockNodeModel(node.type)
  if (model === undefined) return carriedFence(carriedBlock(node, path, depth))
  const readable = readableBlock(node, path, depth, writing)
  if (readable !== undefined) return readable
  return emitDirectiveBlock(node, model, path, depth, () => walkBlocks(nodeContent(node), path, depth + 1, writing))
}

export function commonMarkSpelling(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing & { memo: SpellingMemo }): Result<null> | undefined {
  const readable = readableBlock(node, path, depth, writing)
  if (readable === undefined) writing.memo.set(node, { block: undefined, depth })
  else if (readable.ok) writing.memo.set(node, { block: readable.value, depth })
  if (readable === undefined) return undefined
  if (!readable.ok) return readable
  return readable.value.spelling === 'directive' ? undefined : success(null)
}

function readableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const kept = writing.memo?.get(node)
  // The walk reading an entry spells the node into its own text, so the entry is dropped: kept, every level of a deep subtree would hold its whole text.
  writing.memo?.delete(node)
  if (kept !== undefined) {
    if (kept.block === undefined) return undefined
    // An entry holds the spelling at its fill depth. A read at or above it rebases headroom; a read below re-spells, because a hit skips the walk's depth guards.
    if (depth <= kept.depth) return success({ ...kept.block, headroom: kept.block.headroom + kept.depth - depth })
  }
  return spellReadableBlock(node, path, depth, writing)
}

function spellReadableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const portable = writing.flavour === 'portable' ? spellPortableBlock(node, path, depth, writing) : undefined
  if (portable !== undefined) return portable
  if (node.type === 'blockquote') return tryBlockquote(node, path, depth, writing)
  if (node.type === 'bulletList' || node.type === 'orderedList') return tryList(node, path, depth, writing)
  if (node.type === 'codeBlock') return tryCodeBlock(node, writing.flavour)
  if (node.type === 'heading') return tryHeading(node, path, writing.flavour)
  if (node.type === 'mediaSingle') return readableText(tryImage(node))
  if (node.type === 'paragraph') return tryParagraph(node, path, writing.flavour)
  if (node.type === 'rule') return readableText(tryRule(node))
  if (node.type === 'table') {
    const table = tryPipeTable(node, path, writing.flavour)
    return table === undefined || !table.ok ? table : success(commonMarkText(table.value))
  }
  return undefined
}

// The portable flavour's nodes, in the shapes the portable reduction leaves them.
function spellPortableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  if (node.type === 'panel') return quotedUnder(alertMarker(nodeAttrs(node)['panelType']), node, path, depth, writing)
  if (node.type === 'taskList') return tryTaskList(node, path, depth, writing)
  if (node.type !== 'expand' && node.type !== 'nestedExpand') return undefined
  const title = nodeAttrs(node)['title']
  if (typeof title !== 'string') return quotedUnder(foldedAlertMarker, node, path, depth, writing)
  const line = emitInlineLine([{ text: title, type: 'text' }], 'paragraph', path, writing.flavour)
  return line.ok ? quotedUnder(`${foldedAlertMarker} ${line.value}`, node, path, depth, writing) : line
}

function quotedUnder(head: string, node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const inner = walkBlocks(nodeContent(node), path, depth + 1, indented(writing, quoteWidth))
  if (!inner.ok) return inner
  const text = joinedWithin(inner.value.blocks.length === 0 ? [head] : [head, '\n\n', ...blockPieces(inner.value.blocks, 'document')])
  return quotedBlock(text, inner.value.headroom)
}

function quotedBlock(text: string | undefined, headroom: number): Result<EmittedBlock> {
  const quoted = (whole: string): Result<EmittedBlock> => boundedThen(joinedWithin(quotedPieces(whole)), (quotedText) => success(commonMarkText(quotedText, headroom)))
  return boundedThen(text, quoted)
}


function* quotedPieces(text: string): Generator<string> {
  for (let start = 0; ; ) {
    const end = text.indexOf('\n', start)
    const line = text.slice(start, end === -1 ? text.length : end)
    yield line === '' ? '>' : '> '
    yield line
    if (end === -1) return
    yield '\n'
    start = end + 1
  }
}

function tryTaskList(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const items: PlacedBlock[][] = []
  let headroom = largestNesting - depth - 1
  // A child other than a task nests in the task before it.
  for (const [index, child] of nodeContent(node).entries()) {
    const task = isTaskItem(child)
    const itemWriting = indented(writing, bulletWidth)
    const walk = task ? taskBlocks(child, [...path, 'content', index], depth + 1, itemWriting) : placedBlock(child, [...path, 'content', index], depth + 1, itemWriting)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    const previous = items.at(-1)
    if (task || previous === undefined) items.push([...walk.value.blocks])
    else for (const block of walk.value.blocks) previous.push(block)
  }
  const inners = joinedItems(items.map((blocks) => blockPieces(blocks, 'list-item')))
  // The portable reduction leaves no task a list item cannot hold: a directive here would break the flavour.
  const unspellable = failure<EmittedBlock>('unsupported-node-shape', 'a task holds blocks no list item spells', path)
  return boundedThen(inners, (spelled) => spelledList(spelled, () => '', bulletDelimiters, headroom) ?? unspellable)
}

// Each item's text, or `undefined` where one, or all of them together, would pass the bound: every item is joined before the list is.
function joinedItems(items: readonly Iterable<string>[]): string[] | undefined {
  const inners: string[] = []
  let length = 0
  for (const pieces of items) {
    const inner = joinedWithin(pieces)
    if (inner === undefined) return undefined
    length += inner.length
    if (length > longestMarkdown) return undefined
    inners.push(inner)
  }
  return inners
}

function placedBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  const block = emitBlock(node, path, depth, writing)
  return block.ok ? success({ blocks: [{ ...block.value, node }], headroom: block.value.headroom }) : block
}

// The marker leads the first paragraph, or stands as one where the blocks open with another.
function taskBlocks(task: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  const marker = taskMarker(nodeAttrs(task)['state'])
  const markerBlock: PlacedBlock = { node: { type: 'paragraph' }, spelling: 'commonmark', text: marker }
  if (task.type === 'taskItem') {
    const content = nodeContent(task)
    const line = content.length === 0 ? success('') : emitInlineLine(content, 'paragraph', path, writing.flavour)
    if (!line.ok) return line
    const text = joinedWithin(line.value === '' ? [marker] : [marker, ' ', line.value])
    return boundedThen(text, (spelled) => success({ blocks: [{ ...markerBlock, text: spelled }], headroom: Number.POSITIVE_INFINITY }))
  }
  const walk = walkBlocks(nodeContent(task), path, depth, writing)
  if (!walk.ok) return walk
  const [first, ...rest] = walk.value.blocks
  if (first?.node.type !== 'paragraph') return success({ blocks: [markerBlock, ...walk.value.blocks], headroom: walk.value.headroom })
  const text = joinedWithin([marker, ' ', first.text])
  return boundedThen(text, (spelled) => success({ blocks: [{ ...first, text: spelled }, ...rest], headroom: walk.value.headroom }))
}

function readableText(text: string | undefined): Result<EmittedBlock> | undefined {
  return text === undefined ? undefined : success(commonMarkText(text))
}

function carriedFence(carried: Result<{ headroom: number; text: string }>): Result<EmittedBlock> {
  if (!carried.ok) return carried
  return success({ ...carried.value, spelling: 'commonmark' })
}

function commonMarkText(text: string, headroom: number = Number.POSITIVE_INFINITY): EmittedBlock {
  return { headroom, spelling: 'commonmark', text }
}

function directivePair(node: AdfNode, opener: string, body: string, headroom: number = Number.POSITIVE_INFINITY): Result<EmittedBlock> {
  const closer = spellDirectiveCloser(node.type)
  const text = joinedWithin(body === '' ? [opener, '\n', closer] : [opener, '\n', body, '\n', closer])
  return boundedThen(text, (spelled) => success({ headroom, spelling: 'directive', text: spelled }))
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
  if (blockDirectiveForm(node.type) === 'leaf') return success({ headroom: Number.POSITIVE_INFINITY, spelling: 'directive', text: opener })
  if (model.contentModel === 'inline') {
    const line = emitInlineLine(nodeContent(node), 'paragraph', path, 'lossless')
    if (!line.ok) return line
    return directivePair(node, opener, line.value)
  }
  const walk = walkBody()
  if (!walk.ok) return walk
  const body = joinBlocks(walk.value.blocks, 'directive')
  return boundedThen(body, (spelled) => directivePair(node, opener, spelled, walk.value.headroom))
}

function tryBlockquote(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  if (!holdsOnlyAttributes(node, [])) return undefined
  const inner = walkBlocks(nodeContent(node), path, depth + 1, indented(writing, quoteWidth))
  if (!inner.ok) return inner
  const text = joinBlocks(inner.value.blocks, 'document')
  const alert = text !== undefined && flavourClaims[writing.flavour].alerts && leadingMarker(text, readAlertMarker) !== undefined
  return quotedBlock(alert ? joinedWithin(['\\', text]) : text, inner.value.headroom)
}

function tryCodeBlock(node: AdfNode, flavour: WrittenFlavour): Result<EmittedBlock> | undefined {
  if (!holdsOnlyAttributes(node, ['language'])) return undefined
  const slot = languageSlot(nodeAttrs(node)['language'], flavourClaims[flavour])
  if (slot.kind === 'attribute') return undefined
  const [only, ...others] = fencedTexts(node) ?? []
  if (only === undefined || others.length > 0) return undefined
  const text = joinedWithin(fencePieces(slot.kind === 'fence' ? slot.info : '', only))
  return boundedThen(text, (spelled) => success(commonMarkText(spelled)))
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
  const body = joinedWithin(separatedBy('\n', texts.map((text) => fencePieces(info, text))))
  return boundedThen(body, (spelled) => directivePair(node, opener.value, spelled))
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
  if (content.length === 0) return success(commonMarkText(hashes))
  const line = emitInlineLine(content, 'heading', path, flavour)
  if (!line.ok) return line
  return success(commonMarkText(`${hashes} ${line.value}`))
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
    // Unindented: the list may give way to the directive form, which prefixes nothing, and the forecast must not overcount.
    const walk = walkBlocks(nodeContent(item), [...path, 'content', offset], depth + 1, writing)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    walked.push({ node: item, walk: walk.value })
  }
  return boundedThen(joinedItems(walked.map((item) => blockPieces(item.walk.blocks, 'list-item'))), (joined) => spelledOrDirectiveList(node, { joined, start, walked }, path, depth, headroom, writing))
}

// The list spelling where every item holds lines a list item spells, else the directive form.
function spelledOrDirectiveList(node: AdfNode, { joined, start, walked }: SpelledItems, path: ConvertErrorPath, depth: number, headroom: number, writing: Writing): Result<EmittedBlock> {
  const ordered = node.type === 'orderedList'
  // GitHub reads a task marker opening any item's first paragraph as a checkbox, whatever its siblings hold.
  const inners = joined.map((inner) => (flavourClaims[writing.flavour].taskMarkers && leadingMarker(inner, readTaskMarker) !== undefined ? `\\${inner}` : inner))
  const list = ordered ? spelledList(inners, (offset) => `${start + offset}`, orderedDelimiters, headroom) : spelledList(inners, () => '', bulletDelimiters, headroom)
  if (list !== undefined) return list
  // The directive form spends a level the walk did not count.
  if (headroom < 1) return tooDeep(path)
  return emitDirectiveBlock(node, ordered ? blockNodes.orderedList : blockNodes.bulletList, path, depth, () => directiveItems(walked, headroom - 1))
}

function spelledList(inners: readonly string[], number: (offset: number) => string, [usual, alternate]: Delimiters, headroom: number): Result<EmittedBlock> | undefined {
  const pieces = listLines(inners, number, usual)
  const alternatePieces = listLines(inners, number, alternate)
  if (pieces === undefined || alternatePieces === undefined) return undefined
  const spelled = (text: string, alternateText: string): Result<EmittedBlock> => success({ alternateText, headroom, spelling: 'list', text })
  return boundedThen(joinedWithin(pieces), (text) => boundedThen(joinedWithin(alternatePieces), (alternateText) => spelled(text, alternateText)))
}

// `undefined` where an item holds a line no list item spells.
function listLines(inners: readonly string[], number: (offset: number) => string, delimiter: string): Iterable<string> | undefined {
  const items: Iterable<string>[] = []
  for (const [offset, inner] of inners.entries()) {
    const pieces = listItemPieces(inner, `${number(offset)}${delimiter} `)
    if (pieces === undefined) return undefined
    items.push(pieces)
  }
  return separatedBy('\n', items)
}

function directiveItems(items: readonly WalkedItem[], headroom: number): Result<PlacedBlocks> {
  const blocks: PlacedBlock[] = []
  for (const item of items) {
    const pair = boundedThen(joinBlocks(item.walk.blocks, 'directive'), (body) => directivePair(item.node, listItemOpener, body))
    if (!pair.ok) return pair
    blocks.push({ ...pair.value, node: item.node })
  }
  return success({ blocks, headroom })
}

function listStart(node: AdfNode, items: number): number | undefined {
  if (node.type !== 'orderedList') return 0
  const start = nodeAttrs(node)['order']
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || Object.is(start, -0) || start > largestListMarker) return undefined
  return start + items - 1 > largestListMarker ? undefined : start
}

function listItemPieces(inner: string, marker: string): Iterable<string> | undefined {
  if (inner === '') return [marker.trimEnd()]
  const [first = '', ...rest] = inner.split('\n')
  if (rest.some((line) => line !== '' && isBlankLine(line)) || (first !== '' && isBlankLine(first))) return undefined
  // An item opens with `*` only as text, a list there taking `- ` and a rule `---`; a backslash keeps a first line reading as a rule text.
  const rule = isThematicBreak(`${marker}${first}`)
  if (rule && !inner.startsWith('*')) return undefined
  return itemLinePieces(rule ? `${marker}\\` : marker, first, rest, ' '.repeat(marker.length))
}

function* itemLinePieces(opening: string, first: string, rest: readonly string[], indent: string): Generator<string> {
  yield opening
  yield first
  for (const line of rest) {
    yield '\n'
    if (line === '') continue
    yield indent
    yield line
  }
}

function tryParagraph(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedBlock> | undefined {
  const content = nodeContent(node)
  if (content.length === 0 || !holdsOnlyAttributes(node, [])) return undefined
  const line = emitInlineLine(content, 'paragraph', path, flavour)
  if (!line.ok) return line
  return success(commonMarkText(line.value))
}

function tryRule(node: AdfNode): string | undefined {
  if (!holdsOnlyAttributes(node, []) || nodeContent(node).length > 0) return undefined
  return '---'
}

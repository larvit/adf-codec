import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import type { Flavour } from '../plain/conventions.ts'
import { adfDocumentFault, holdsOnlyAttributes, isUnmarkedBareText, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { alertMarker, foldedAlertMarker, leadingMarker, readAlertMarker, readTaskMarker, taskMarker } from '../plain/conventions.ts'
import { blockDirectiveForm, documentSpelling, listBreakSpelling } from '../block-directive.ts'
import { blockNodeModel, blockNodes } from '../../adf/block-nodes.ts'
import { carriedBlock } from '../opaque-carry.ts'
import { emitInlineLine } from './inline-line.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { fencedCodeBlock } from '../commonmark/backtick-runs.ts'
import { holdsNullCharacter, isBlankLine, isThematicBreak, markerInterruptsParagraph } from '../commonmark/grammar.ts'
import { languageSlot, type LanguageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { spellBlockDirectiveOpener } from './block-directive-spelling.ts'
import { spellDirectiveCloser, spellDirectiveOpener } from '../directive-syntax.ts'
import { tryImage } from './image.ts'
import { tryPipeTable } from './pipe-table.ts'

type BlockContainer = 'directive' | 'document' | 'list-item'
type BlockSpelling = 'commonmark' | 'directive' | 'list'
type EmittedBlock = { headroom: number; spelling: BlockSpelling; text: string }
type KeptSpelling = { block: EmittedBlock | undefined; depth: number }
type PlacedBlock = Omit<EmittedBlock, 'headroom'> & { node: AdfNode }
type PlacedBlocks = { blocks: readonly PlacedBlock[]; headroom: number }
// Keyed by reference: only a caller building one object per position (the parse, the plain reduction) passes one; a consumer's document may share a node.
export type SpellingMemo = Map<AdfNode, KeptSpelling>
type WalkedItem = { node: AdfNode; walk: PlacedBlocks }
export type Writing = { flavour: Flavour; memo: SpellingMemo | undefined }

export const largestListMarker = 999999999
// Bare because tryList admits no item carrying attributes, marks or text.
const listItemOpener = spellDirectiveOpener('listItem', undefined, '')

export function adfToMarkdown(document: AdfDocument): Result<string> {
  return writeMarkdown(document, 'lossless')
}

export function writeMarkdown(document: AdfDocument, flavour: Flavour): Result<string> {
  const fault = adfDocumentFault(document)
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  if (document.content === undefined) return success(`${documentSpelling}\n`)
  const walk = walkBlocks(document.content, [], 0, { flavour, memo: undefined })
  if (!walk.ok) return walk
  const text = joinBlocks(walk.value.blocks, 'document')
  return success(text === '' ? '' : `${text}\n`)
}

// headroom: the least slack any depth guard below the walk has.
function walkBlocks(nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number, writing: Writing): Result<PlacedBlocks> {
  let headroom = largestNesting - depth
  if (headroom < 0) return tooDeep(path)
  const blocks: PlacedBlock[] = []
  for (const [index, node] of nodes.entries()) {
    const block = emitBlock(node, [...path, 'content', index], depth, writing)
    if (!block.ok) return block
    headroom = Math.min(headroom, block.value.headroom)
    blocks.push({ ...block.value, node })
  }
  return success({ blocks, headroom })
}

function tooDeep(path: ConvertErrorPath): Result<never> {
  return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
}

function joinBlocks(blocks: readonly PlacedBlock[], container: BlockContainer): string {
  let text = ''
  for (const [index, block] of blocks.entries()) {
    const previous = blocks[index - 1]
    if (previous !== undefined) text += separationBetween(previous, block, container)
    text += block.text
  }
  return text
}

function separationBetween(previous: PlacedBlock, next: PlacedBlock, container: BlockContainer): string {
  const bothCommonMark = previous.spelling !== 'directive' && next.spelling !== 'directive'
  if (bothCommonMark && next.spelling === 'list') {
    if (previous.spelling === 'list' && previous.node.type === next.node.type) {
      const gap = container === 'directive' ? '\n' : '\n\n'
      return `${gap}${listBreakSpelling}${gap}`
    }
    if (container === 'list-item') return interruptsParagraph(next.node) ? '\n' : '\n\n'
  }
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
  if (model === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  const readable = readableBlock(node, path, depth, writing)
  if (readable !== undefined) return readable
  return emitDirectiveBlock(node, model, path, depth, () => walkBlocks(nodeContent(node), path, depth + 1, writing))
}

export function commonMarkSpelling(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<null> | undefined {
  const readable = readableBlock(node, path, depth, writing)
  if (readable === undefined) return undefined
  if (!readable.ok) return readable
  return readable.value.spelling === 'directive' ? undefined : success(null)
}

function readableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const { memo } = writing
  const kept = memo?.get(node)
  if (kept !== undefined) {
    if (kept.block === undefined) return undefined
    // A read below the fill would skip the depth guards the walk it replaces runs (docs/decisions.md §The spelling memo).
    if (depth <= kept.depth) return success({ ...kept.block, headroom: kept.block.headroom + kept.depth - depth })
  }
  const spelled = spellReadableBlock(node, path, depth, writing)
  if (spelled === undefined) memo?.set(node, { block: undefined, depth })
  else if (spelled.ok) memo?.set(node, { block: spelled.value, depth })
  return spelled
}

function spellReadableBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  const plain = writing.flavour === 'plain' ? spellPlainBlock(node, path, depth, writing) : undefined
  if (plain !== undefined) return plain
  if (node.type === 'blockquote') return tryBlockquote(node, path, depth, writing)
  if (node.type === 'bulletList' || node.type === 'orderedList') return tryList(node, path, depth, writing)
  if (node.type === 'codeBlock') return readableText(tryCodeBlock(node))
  if (node.type === 'heading') return tryHeading(node, path, writing.flavour)
  if (node.type === 'mediaSingle') return readableText(tryImage(node))
  if (node.type === 'paragraph') return tryParagraph(node, path, writing.flavour)
  if (node.type === 'rule') return readableText(tryRule(node))
  if (node.type === 'table') return readableText(tryPipeTable(node, path, writing.flavour))
  return undefined
}

// The plain flavour's nodes, in the shapes the plain reduction leaves them.
function spellPlainBlock(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  if (node.type === 'panel') return quotedUnder(alertMarker(nodeAttrs(node)['panelType']), node, path, depth, writing)
  if (node.type === 'taskList') return tryTaskList(node, path, depth, writing)
  if (node.type !== 'expand' && node.type !== 'nestedExpand') return undefined
  const title = nodeAttrs(node)['title']
  if (typeof title !== 'string') return quotedUnder(foldedAlertMarker, node, path, depth, writing)
  // The reader takes a title as lossless inline text.
  const line = emitInlineLine([{ text: title, type: 'text' }], 'paragraph', path, 'lossless')
  return line.ok ? quotedUnder(`${foldedAlertMarker} ${line.value}`, node, path, depth, writing) : line
}

function quotedUnder(head: string, node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const inner = walkBlocks(nodeContent(node), path, depth + 1, writing)
  if (!inner.ok) return inner
  const body = joinBlocks(inner.value.blocks, 'document')
  return success(commonMarkText(quoted(body === '' ? head : `${head}\n\n${body}`), inner.value.headroom))
}

function quoted(text: string): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')
}

function tryTaskList(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> {
  const items: PlacedBlock[][] = []
  let headroom = largestNesting - depth - 1
  // A child other than a task nests in the task before it.
  for (const [index, child] of nodeContent(node).entries()) {
    const task = child.type === 'taskItem' || child.type === 'blockTaskItem'
    const walk = task ? taskBlocks(child, [...path, 'content', index], depth + 1, writing) : placedBlock(child, [...path, 'content', index], depth + 1, writing)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    const previous = items.at(-1)
    if (task || previous === undefined) items.push([...walk.value.blocks])
    else for (const block of walk.value.blocks) previous.push(block)
  }
  const lines = items.map((blocks) => tryListItemLines(joinBlocks(blocks, 'list-item'), '- '))
  // The plain reduction leaves no task a list item cannot hold: a directive here would break the flavour.
  return lines.includes(undefined) ? failure('unsupported-node-shape', 'a task holds blocks no list item spells', path) : success({ headroom, spelling: 'list', text: lines.join('\n') })
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
    return success({ blocks: [{ ...markerBlock, text: line.value === '' ? marker : `${marker} ${line.value}` }], headroom: Number.POSITIVE_INFINITY })
  }
  const walk = walkBlocks(nodeContent(task), path, depth, writing)
  if (!walk.ok) return walk
  const [first, ...rest] = walk.value.blocks
  const blocks = first?.node.type === 'paragraph' ? [{ ...first, text: `${marker} ${first.text}` }, ...rest] : [markerBlock, ...walk.value.blocks]
  return success({ blocks, headroom: walk.value.headroom })
}

function readableText(text: string | undefined): Result<EmittedBlock> | undefined {
  return text === undefined ? undefined : success(commonMarkText(text))
}

function commonMarkLine(carried: Result<{ headroom: number; text: string }>): Result<EmittedBlock> {
  if (!carried.ok) return carried
  return success({ ...carried.value, spelling: 'commonmark' })
}

function commonMarkText(text: string, headroom: number = Number.POSITIVE_INFINITY): EmittedBlock {
  return { headroom, spelling: 'commonmark', text }
}

function directivePair(node: AdfNode, opener: string, body: string, headroom: number = Number.POSITIVE_INFINITY): EmittedBlock {
  return { headroom, spelling: 'directive', text: `${opener}\n${body === '' ? '' : `${body}\n`}${spellDirectiveCloser(node.type)}` }
}

function emitDirectiveBlock(node: AdfNode, model: BlockNodeModel, path: ConvertErrorPath, depth: number, walkBody: () => Result<PlacedBlocks>): Result<EmittedBlock> {
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text: this one holds text`, path)
  if (blockDirectiveForm(node.type) === 'leaf' && nodeContent(node).length > 0) return failure('unsupported-node-shape', `a ${node.type} holds no content: this one holds some`, path)
  if (model.contentModel === 'code') return emitCodeDirective(node, model, path, depth)
  const opener = spellBlockDirectiveOpener(node, model, path)
  if (opener === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  if (!opener.ok) return opener
  return emitDirectiveBody(node, model, opener.value, path, walkBody)
}

function emitDirectiveBody(node: AdfNode, model: BlockNodeModel, opener: string, path: ConvertErrorPath, walkBody: () => Result<PlacedBlocks>): Result<EmittedBlock> {
  if (blockDirectiveForm(node.type) === 'leaf') return success({ headroom: Number.POSITIVE_INFINITY, spelling: 'directive', text: opener })
  if (model.contentModel === 'inline') {
    const line = emitInlineLine(nodeContent(node), 'paragraph', path, 'lossless')
    if (!line.ok) return line
    return success(directivePair(node, opener, line.value))
  }
  const walk = walkBody()
  if (!walk.ok) return walk
  return success(directivePair(node, opener, joinBlocks(walk.value.blocks, 'directive'), walk.value.headroom))
}

function tryBlockquote(node: AdfNode, path: ConvertErrorPath, depth: number, writing: Writing): Result<EmittedBlock> | undefined {
  if (!holdsOnlyAttributes(node, [])) return undefined
  const inner = walkBlocks(nodeContent(node), path, depth + 1, writing)
  if (!inner.ok) return inner
  const text = joinBlocks(inner.value.blocks, 'document')
  const alert = writing.flavour === 'plain' && leadingMarker(text, readAlertMarker) !== undefined
  return success(commonMarkText(quoted(alert ? `\\${text}` : text), inner.value.headroom))
}

function tryCodeBlock(node: AdfNode): string | undefined {
  if (!holdsOnlyAttributes(node, ['language'])) return undefined
  const slot = languageSlot(nodeAttrs(node)['language'])
  if (slot.kind === 'attribute') return undefined
  const [only, ...others] = fencedTexts(node) ?? []
  if (only === undefined || others.length > 0) return undefined
  return fencedCodeBlock(slot.kind === 'fence' ? slot.info : '', only)
}

// spec/flavour.md, The CommonMark blocks: one fence per text node, the language on each; with no fence to carry it, the attribute does.
function emitCodeDirective(node: AdfNode, model: BlockNodeModel, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const texts = fencedTexts(node)
  if (texts === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  const slot: LanguageSlot = texts.length === 0 ? { kind: 'attribute' } : languageSlot(nodeAttrs(node)['language'])
  const opener = spellBlockDirectiveOpener(node, model, path, slot.kind === 'attribute' ? [] : ['language'])
  if (opener === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  if (!opener.ok) return opener
  const info = slot.kind === 'fence' ? slot.info : ''
  return success(directivePair(node, opener.value, texts.map((text) => fencedCodeBlock(info, text)).join('\n')))
}

// The text of each fence, or `undefined` where a child holds what no fence keeps, so the block carry takes the node.
function fencedTexts(node: AdfNode): string[] | undefined {
  if (node.content === undefined) return ['']
  const texts: string[] = []
  for (const child of node.content) {
    if (!isUnmarkedBareText(child) || typeof child.text !== 'string' || child.text === '' || /\r/.test(child.text) || holdsNullCharacter(child.text)) return undefined
    texts.push(child.text)
  }
  return texts
}

function tryHeading(node: AdfNode, path: ConvertErrorPath, flavour: Flavour): Result<EmittedBlock> | undefined {
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
    const walk = walkBlocks(nodeContent(item), [...path, 'content', offset], depth + 1, writing)
    if (!walk.ok) return walk
    headroom = Math.min(headroom, walk.value.headroom)
    walked.push({ node: item, walk: walk.value })
  }
  const lines: string[] = []
  for (const [offset, item] of walked.entries()) {
    const inner = joinBlocks(item.walk.blocks, 'list-item')
    // GitHub reads a task marker opening any item's first paragraph as a checkbox, whatever its siblings hold.
    const escaped = writing.flavour === 'plain' && leadingMarker(inner, readTaskMarker) !== undefined ? `\\${inner}` : inner
    const line = tryListItemLines(escaped, ordered ? `${start + offset}. ` : '- ')
    if (line === undefined) {
      // The directive form spends a level the walk did not count.
      if (headroom < 1) return tooDeep(path)
      return emitDirectiveBlock(node, ordered ? blockNodes.orderedList : blockNodes.bulletList, path, depth, () => success({ blocks: directiveItems(walked), headroom: headroom - 1 }))
    }
    lines.push(line)
  }
  return success({ headroom, spelling: 'list', text: lines.join('\n') })
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

function tryListItemLines(inner: string, marker: string): string | undefined {
  if (inner === '') return marker.trimEnd()
  const body = inner.split('\n')
  if (body.some((line) => line !== '' && isBlankLine(line))) return undefined
  const indent = ' '.repeat(marker.length)
  const lines = body.map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
  if (isThematicBreak(lines[0] ?? '')) return undefined
  return lines.join('\n')
}

function tryParagraph(node: AdfNode, path: ConvertErrorPath, flavour: Flavour): Result<EmittedBlock> | undefined {
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

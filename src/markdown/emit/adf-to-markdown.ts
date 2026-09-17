import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { BlockDirective } from '../../adf/block-directives.ts'
import { adfDocumentFault, carriesOnly, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { blockDirective, blockDirectives } from '../../adf/block-directives.ts'
import { blockDirectiveForm } from '../block-directive-forms.ts'
import { carriedBlock } from '../opaque-carry.ts'
import { emitInlineLine } from './inline-line.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { fencedCodeBlock } from '../backtick-runs.ts'
import { holdsNullCharacter, isBlankLine, isThematicBreak, markerInterruptsParagraph } from '../commonmark-grammar.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { listBreakSpelling } from '../list-break.ts'
import { spellBlockDirectiveOpener } from './block-directive-spelling.ts'
import { spellDirectiveCloser, spellDirectiveOpener } from '../directive-syntax.ts'
import { tryImage } from './image.ts'
import { tryPipeTable } from './pipe-table.ts'

type BlockContainer = 'directive' | 'document' | 'list-item'
type BlockSpelling = 'commonmark' | 'directive' | 'list'
type EmittedBlock = { headroom: number; spelling: BlockSpelling; text: string }
type PlacedBlock = EmittedBlock & { node: AdfNode }
type Walk = { blocks: readonly PlacedBlock[]; headroom: number }
type WalkedItem = { node: AdfNode; walk: Walk }

const largestListMarker = 999999999
// Bare because emitList admits no item carrying attributes, marks or text.
const listItemOpener = spellDirectiveOpener('listItem', undefined, '')

export function adfToMarkdown(document: AdfDocument): Result<string> {
  const fault = adfDocumentFault(document)
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  const blocks = emitBlocks(nodeContent(document), 'document', [], 0)
  if (!blocks.ok) return blocks
  return success(blocks.value === '' ? '' : `${blocks.value}\n`)
}

function emitBlocks(nodes: readonly AdfNode[], container: BlockContainer, path: ConvertErrorPath, depth: number): Result<string> {
  const walk = walkBlocks(nodes, path, depth)
  if (!walk.ok) return walk
  return success(joinBlocks(walk.value.blocks, container))
}

// The walk's headroom is the least slack any depth guard below it has, so a spelling that sinks the walked blocks a level can refuse rather than walk again.
function walkBlocks(nodes: readonly AdfNode[], path: ConvertErrorPath, depth: number): Result<Walk> {
  let headroom = largestNesting - depth
  if (headroom < 0) return tooDeep(path)
  const blocks: PlacedBlock[] = []
  for (const [index, node] of nodes.entries()) {
    const block = emitBlock(node, [...path, 'content', index], depth)
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
  const plainPair = previous.spelling !== 'directive' && next.spelling !== 'directive'
  if (plainPair && next.spelling === 'list') {
    if (previous.spelling === 'list' && previous.node.type === next.node.type) {
      const gap = container === 'directive' ? '\n' : '\n\n'
      return `${gap}${listBreakSpelling}${gap}`
    }
    if (container === 'list-item') return interruptsParagraph(next.node) ? '\n' : '\n\n'
  }
  return container === 'directive' && !plainPair ? '\n' : '\n\n'
}

function interruptsParagraph(node: AdfNode): boolean {
  const items = nodeContent(node)
  const empty = items[0] === undefined || nodeContent(items[0]).length === 0
  if (node.type !== 'orderedList') return markerInterruptsParagraph(undefined, empty)
  return markerInterruptsParagraph(listStart(node, items.length) ?? 0, empty)
}

function emitBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const directive = blockDirective(node.type)
  if (directive === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  const readable = readableBlock(node, path, depth)
  if (readable !== undefined) return readable
  return emitDirectiveBlock(node, directive, path, depth, () => walkBlocks(nodeContent(node), path, depth + 1))
}

export function commonMarkSpelling(node: AdfNode, path: ConvertErrorPath, depth: number): Result<null> | undefined {
  const readable = readableBlock(node, path, depth)
  if (readable === undefined) return undefined
  if (!readable.ok) return readable
  return readable.value.spelling === 'directive' ? undefined : success(null)
}

function readableBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> | undefined {
  if (node.type === 'blockquote') return emitBlockquote(node, path, depth)
  if (node.type === 'bulletList' || node.type === 'orderedList') return emitList(node, path, depth)
  if (node.type === 'codeBlock') return emitCodeBlock(node, path)
  if (node.type === 'heading') return emitHeading(node, path)
  if (node.type === 'mediaSingle') return readableText(tryImage(node, path))
  if (node.type === 'paragraph') return emitParagraph(node, path)
  if (node.type === 'rule') return emitRule(node)
  if (node.type === 'table') return readableText(tryPipeTable(node, path))
  return undefined
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

function emitDirectiveBlock(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath, depth: number, walkBody: () => Result<Walk>): Result<EmittedBlock> {
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text: this one holds text`, path)
  if (blockDirectiveForm(node.type) === 'leaf' && nodeContent(node).length > 0) return failure('unsupported-node-shape', `a ${node.type} holds no content: this one holds some`, path)
  if (directive.contentModel === 'code') return emitCodeDirective(node, directive, path, depth)
  const opener = spellBlockDirectiveOpener(node, directive)
  if (opener === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  return emitDirectiveBody(node, directive, opener, path, walkBody)
}

function emitDirectiveBody(node: AdfNode, directive: BlockDirective, opener: string, path: ConvertErrorPath, walkBody: () => Result<Walk>): Result<EmittedBlock> {
  if (blockDirectiveForm(node.type) === 'leaf') return success({ headroom: Number.POSITIVE_INFINITY, spelling: 'directive', text: opener })
  if (directive.contentModel === 'inline') {
    const line = emitInlineLine(nodeContent(node), 'paragraph', path)
    if (!line.ok) return line
    return success(directivePair(node, opener, line.value))
  }
  const walk = walkBody()
  if (!walk.ok) return walk
  return success(directivePair(node, opener, joinBlocks(walk.value.blocks, 'directive'), walk.value.headroom))
}

function emitBlockquote(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, [])) return undefined
  const inner = walkBlocks(nodeContent(node), path, depth + 1)
  if (!inner.ok) return inner
  const text = joinBlocks(inner.value.blocks, 'document')
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')
  return success(commonMarkText(text, inner.value.headroom))
}

function emitCodeBlock(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, ['language'])) return undefined
  const slot = languageSlot(nodeAttrs(node)['language'])
  if (slot.kind === 'attribute') return undefined
  const text = codeBlockText(node, path)
  if (!text.ok) return text
  return success(commonMarkText(fencedCodeBlock(slot.kind === 'fence' ? slot.info : '', text.value)))
}

function emitCodeDirective(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const slot = languageSlot(nodeAttrs(node)['language'])
  const opener = spellBlockDirectiveOpener(node, directive, slot.kind === 'attribute' ? [] : ['language'])
  if (opener === undefined) return commonMarkLine(carriedBlock(node, path, depth))
  const text = codeBlockText(node, path)
  if (!text.ok) return text
  return success(directivePair(node, opener, fencedCodeBlock(slot.kind === 'fence' ? slot.info : '', text.value)))
}

function codeBlockText(node: AdfNode, path: ConvertErrorPath): Result<string> {
  let text = ''
  for (const [index, child] of nodeContent(node).entries()) {
    const childPath = [...path, 'content', index]
    if (
      child.type !== 'text' ||
      typeof child.text !== 'string' ||
      child.text === '' ||
      nodeContent(child).length > 0 ||
      nodeMarks(child).length > 0 ||
      Object.keys(nodeAttrs(child)).length > 0
    ) {
      return failure('unsupported-node-shape', `a codeBlock holds plain text nodes only: this ${child.type} node is not one`, childPath)
    }
    if (/\r/.test(child.text)) return failure('unspellable-character', 'a codeBlock holds no carriage return CommonMark keeps: this text holds one', childPath)
    if (holdsNullCharacter(child.text)) return failure('unspellable-character', 'a codeBlock holds a null character CommonMark replaces', childPath)
    text += child.text
  }
  return success(text)
}

function emitHeading(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, ['level'])) return undefined
  const level = nodeAttrs(node)['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) return undefined
  const hashes = '#'.repeat(level)
  const content = nodeContent(node)
  if (content.length === 0) return success(commonMarkText(hashes))
  const line = emitInlineLine(content, 'heading', path)
  if (!line.ok) return line
  return success(commonMarkText(`${hashes} ${line.value}`))
}

function emitList(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> | undefined {
  const ordered = node.type === 'orderedList'
  if (!carriesOnly(node, ordered ? ['order'] : [])) return undefined
  const items = nodeContent(node)
  const start = listStart(node, items.length)
  if (start === undefined || items.length === 0) return undefined
  if (items.some((item) => item.type !== 'listItem' || !carriesOnly(item, []))) return undefined
  const walked: WalkedItem[] = []
  for (const [offset, item] of items.entries()) {
    const walk = walkBlocks(nodeContent(item), [...path, 'content', offset], depth + 1)
    if (!walk.ok) return walk
    walked.push({ node: item, walk: walk.value })
  }
  const headroom = Math.min(...walked.map((item) => item.walk.headroom))
  const lines: string[] = []
  for (const [offset, item] of walked.entries()) {
    const line = listItemLines(item.walk.blocks, ordered ? `${start + offset}. ` : '- ')
    if (line === undefined) return headroom < 1 ? tooDeep(path) : emitDirectiveBlock(node, ordered ? blockDirectives.orderedList : blockDirectives.bulletList, path, depth, () => success(directiveItems(walked)))
    lines.push(line)
  }
  return success({ headroom, spelling: 'list', text: lines.join('\n') })
}

// The directive form sinks each item's blocks a level below where the walk read them.
function directiveItems(items: readonly WalkedItem[]): Walk {
  const blocks = items.map((item) => ({ ...directivePair(item.node, listItemOpener, joinBlocks(item.walk.blocks, 'directive'), item.walk.headroom - 1), node: item.node }))
  return { blocks, headroom: Math.min(...blocks.map((block) => block.headroom)) }
}

function listStart(node: AdfNode, items: number): number | undefined {
  if (node.type !== 'orderedList') return 0
  const start = nodeAttrs(node)['order']
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > largestListMarker) return undefined
  return start + items - 1 > largestListMarker ? undefined : start
}

function listItemLines(blocks: readonly PlacedBlock[], marker: string): string | undefined {
  const inner = joinBlocks(blocks, 'list-item')
  if (inner === '') return marker.trimEnd()
  const body = inner.split('\n')
  if (body.some((line) => line !== '' && isBlankLine(line))) return undefined
  const indent = ' '.repeat(marker.length)
  const lines = body.map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
  if (isThematicBreak(lines[0] ?? '')) return undefined
  return lines.join('\n')
}

function emitParagraph(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> | undefined {
  const content = nodeContent(node)
  if (content.length === 0 || !carriesOnly(node, [])) return undefined
  const line = emitInlineLine(content, 'paragraph', path)
  if (!line.ok) return line
  return success(commonMarkText(line.value))
}

function emitRule(node: AdfNode): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, []) || nodeContent(node).length > 0) return undefined
  return success(commonMarkText('---'))
}

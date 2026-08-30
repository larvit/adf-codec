import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { BlockDirective } from '../../adf/block-directives.ts'
import type { JsonValue } from '../../json-value.ts'
import { blockDirective } from '../../adf/block-directives.ts'
import { carriedBlock, carryName } from '../opaque-carry.ts'
import { carriesOnly, isAdfDocument } from '../../adf/document.ts'
import { emitInlineLine } from './inline-line.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { fencedCodeBlock } from '../backtick-runs.ts'
import { holdsControlCharacter, holdsEntityReference, holdsNullCharacter, isThematicBreak, markerInterruptsParagraph } from '../commonmark-grammar.ts'
import { largestNesting } from '../../nesting.ts'
import { spellDirectiveHeader } from './block-directive-spelling.ts'
import { tryImage } from './image.ts'
import { tryPipeTable } from './pipe-table.ts'

type BlockContainer = 'directive' | 'document' | 'list-item'
type BlockSpelling = 'commonmark' | 'directive' | 'list'
type EmittedBody = { fenceColons: number; text: string }
type EmittedBlock = EmittedBody & { spelling: BlockSpelling }
type PlacedBlock = EmittedBlock & { node: AdfNode; path: ConvertErrorPath }

const largestListMarker = 999999999

export function adfToMarkdown(document: AdfDocument): Result<string> {
  if (!isAdfDocument(document)) return failure('not-an-adf-document', 'the value is not an ADF document', [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  const blocks = emitBlocks(document.content ?? [], 'document', [], 0)
  if (!blocks.ok) return blocks
  return success(blocks.value.text === '' ? '' : `${blocks.value.text}\n`)
}

function emitBlocks(nodes: readonly AdfNode[], container: BlockContainer, path: ConvertErrorPath, depth: number): Result<EmittedBody> {
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
  const blocks: PlacedBlock[] = []
  for (const [index, node] of nodes.entries()) {
    const nodePath = [...path, 'content', index]
    const block = emitBlock(node, nodePath, depth)
    if (!block.ok) return block
    blocks.push({ ...block.value, node, path: nodePath })
  }
  let fenceColons = 0
  let text = ''
  for (const [index, block] of blocks.entries()) {
    const previous = blocks[index - 1]
    if (previous !== undefined) {
      const separation = separationBetween(previous, block, container)
      if (!separation.ok) return separation
      text += separation.value
    }
    fenceColons = Math.max(fenceColons, block.fenceColons)
    text += block.text
  }
  return success({ fenceColons, text })
}

function separationBetween(previous: PlacedBlock, next: PlacedBlock, container: BlockContainer): Result<string> {
  const plainPair = previous.spelling !== 'directive' && next.spelling !== 'directive'
  if (plainPair && next.spelling === 'list') {
    if (previous.spelling === 'list' && previous.node.type === next.node.type) {
      return failure('unspellable-adjacent-lists', `two adjacent ${next.node.type} nodes read back as one list`, next.path)
    }
    if (container === 'list-item') return success(interruptsParagraph(next.node) ? '\n' : '\n\n')
  }
  if (container !== 'directive' || plainPair) return success('\n\n')
  if (previous.spelling === 'directive' && next.spelling === 'directive') return success('\n')
  return failure(
    'unspelled-block-separation',
    `the canonical form leaves the separation between a ${previous.spelling} and a ${next.spelling} block in a container body unspelled`,
    next.path,
  )
}

function interruptsParagraph(node: AdfNode): boolean {
  const items = node.content ?? []
  const empty = (items[0]?.content ?? []).length === 0
  if (node.type !== 'orderedList') return markerInterruptsParagraph(undefined, empty)
  return markerInterruptsParagraph(listStart(node, items.length) ?? 0, empty)
}

function emitBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const directive = blockDirective(node.type)
  if (directive === undefined) return commonMarkLine(carriedBlock(node, path))
  const readable = readableBlock(node, path, depth)
  if (readable !== undefined) return readable
  return emitDirectiveBlock(node, directive, path, depth)
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

function commonMarkLine(text: Result<string>): Result<EmittedBlock> {
  if (!text.ok) return text
  return success(commonMarkText(text.value))
}

function commonMarkText(text: string): EmittedBlock {
  return { fenceColons: 0, spelling: 'commonmark', text }
}

function emitDirectiveBlock(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text`, path)
  const content = node.content ?? []
  if (directive.contentModel === 'none' && content.length > 0) return failure('unsupported-node-shape', `a ${node.type} holds no content`, path)
  if (directive.contentModel === 'code') return emitCodeDirective(node, directive, path)
  const header = spellDirectiveHeader(node, directive)
  if (header === undefined) return commonMarkLine(carriedBlock(node, path))
  if (directive.contentModel === 'none' || (directive.contentModel === 'inline' && content.length === 0)) {
    return success({ fenceColons: 2, spelling: 'directive', text: `::${header}` })
  }
  const body = directive.contentModel === 'inline' ? emitInlineBody(content, path) : emitBlocks(content, 'directive', path, depth + 1)
  if (!body.ok) return body
  const fenceColons = Math.max(3, body.value.fenceColons + 1)
  const fence = ':'.repeat(fenceColons)
  const lines = body.value.text === '' ? '' : `${body.value.text}\n`
  return success({ fenceColons, spelling: 'directive', text: `${fence}${header}\n${lines}${fence}` })
}

function emitInlineBody(content: readonly AdfNode[], path: ConvertErrorPath): Result<EmittedBody> {
  const line = emitInlineLine(content, 'paragraph', path)
  if (!line.ok) return line
  return success({ fenceColons: 0, text: line.value })
}

function emitBlockquote(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, [])) return undefined
  const inner = emitBlocks(node.content ?? [], 'document', path, depth + 1)
  if (!inner.ok) return inner
  const text = inner.value.text
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')
  return success({ fenceColons: inner.value.fenceColons, spelling: 'commonmark', text })
}

function emitCodeBlock(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, ['language'])) return undefined
  const info = fenceInfo(node.attrs?.['language'])
  if (info === undefined) return undefined
  const text = codeBlockText(node, path)
  if (!text.ok) return text
  return success(commonMarkText(fencedCodeBlock(info, text.value)))
}

function emitCodeDirective(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath): Result<EmittedBlock> {
  const info = fenceInfo(node.attrs?.['language'])
  const header = spellDirectiveHeader(node, directive, info === undefined ? [] : ['language'])
  if (header === undefined) return commonMarkLine(carriedBlock(node, path))
  const text = codeBlockText(node, path)
  if (!text.ok) return text
  return success({ fenceColons: 3, spelling: 'directive', text: `:::${header}\n${fencedCodeBlock(info ?? '', text.value)}\n:::` })
}

function codeBlockText(node: AdfNode, path: ConvertErrorPath): Result<string> {
  let text = ''
  for (const [index, child] of (node.content ?? []).entries()) {
    const childPath = [...path, 'content', index]
    if (
      child.type !== 'text' ||
      typeof child.text !== 'string' ||
      child.text === '' ||
      (child.content ?? []).length > 0 ||
      (child.marks ?? []).length > 0 ||
      Object.keys(child.attrs ?? {}).length > 0
    ) {
      return failure('unsupported-node-shape', 'a codeBlock holds plain text nodes only', childPath)
    }
    if (/\r/.test(child.text)) return failure('unspellable-whitespace', 'a codeBlock holds no carriage return CommonMark keeps', childPath)
    if (holdsNullCharacter(child.text)) return failure('unspellable-character', 'a codeBlock holds a null character CommonMark replaces', childPath)
    text += child.text
  }
  return success(text)
}

// spec/flavour.md, The CommonMark blocks.
function fenceInfo(language: JsonValue | undefined): string | undefined {
  if (language === undefined) return ''
  if (typeof language !== 'string' || language === '' || language === carryName) return undefined
  if (/[`\\]/.test(language) || holdsControlCharacter(language) || language !== language.trim() || holdsEntityReference(language)) return undefined
  return language
}

function emitHeading(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, ['level'])) return undefined
  const level = node.attrs?.['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) return undefined
  const hashes = '#'.repeat(level)
  const content = node.content ?? []
  if (content.length === 0) return success(commonMarkText(hashes))
  const line = emitInlineLine(content, 'heading', path)
  if (!line.ok) return line
  return success(commonMarkText(`${hashes} ${line.value}`))
}

function emitList(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> | undefined {
  const ordered = node.type === 'orderedList'
  if (!carriesOnly(node, ordered ? ['order'] : [])) return undefined
  const items = node.content ?? []
  const start = listStart(node, items.length)
  if (start === undefined || items.length === 0) return undefined
  if (items.some((item) => item.type !== 'listItem' || !carriesOnly(item, []))) return undefined
  const lines: string[] = []
  let fenceColons = 0
  for (const [offset, item] of items.entries()) {
    const emitted = emitListItem(item, ordered ? `${start + offset}. ` : '- ', [...path, 'content', offset], depth)
    if (emitted === undefined) return undefined
    if (!emitted.ok) return emitted
    fenceColons = Math.max(fenceColons, emitted.value.fenceColons)
    lines.push(emitted.value.text)
  }
  return success({ fenceColons, spelling: 'list', text: lines.join('\n') })
}

function listStart(node: AdfNode, items: number): number | undefined {
  if (node.type !== 'orderedList') return 0
  const start = node.attrs?.['order']
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > largestListMarker) return undefined
  return start + items - 1 > largestListMarker ? undefined : start
}

function emitListItem(item: AdfNode, marker: string, path: ConvertErrorPath, depth: number): Result<EmittedBody> | undefined {
  const inner = emitBlocks(item.content ?? [], 'list-item', path, depth + 1)
  if (!inner.ok) return inner
  if (inner.value.text === '') return success({ fenceColons: 0, text: marker.trimEnd() })
  const indent = ' '.repeat(marker.length)
  const lines = inner.value.text.split('\n').map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
  if (isThematicBreak(lines[0] ?? '')) return undefined
  return success({ fenceColons: inner.value.fenceColons, text: lines.join('\n') })
}

function emitParagraph(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> | undefined {
  const content = node.content ?? []
  if (content.length === 0 || !carriesOnly(node, [])) return undefined
  const line = emitInlineLine(content, 'paragraph', path)
  if (!line.ok) return line
  return success(commonMarkText(line.value))
}

function emitRule(node: AdfNode): Result<EmittedBlock> | undefined {
  if (!carriesOnly(node, []) || (node.content ?? []).length > 0) return undefined
  return success(commonMarkText('---'))
}

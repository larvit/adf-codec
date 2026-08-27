import type { AdfDocument, AdfNode } from './adf-document.ts'
import type { BlockDirective } from './block-directives.ts'
import type { JsonValue } from './json-value.ts'
import { blockDirective, spellDirectiveHeader } from './block-directives.ts'
import { tryImage } from './markdown-image.ts'
import { emitInlineLine } from './markdown-inline.ts'
import { tryPipeTable } from './markdown-pipe-table.ts'
import { carriedBlock, carryName } from './opaque-carry.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { holdsEntityReference, holdsNullCharacter, isThematicBreak } from './commonmark-grammar.ts'
import { isAdfDocument } from './adf-document.ts'
import { largestNesting } from './nesting.ts'
import { fencedCodeBlock } from './backtick-runs.ts'

type BlockContainer = 'directive' | 'document' | 'list-item'
type BlockSpelling = 'commonmark' | 'directive'
type EmittedBody = { fenceColons: number; text: string }
type EmittedBlock = EmittedBody & { spelling: BlockSpelling }
type PlacedBlock = EmittedBlock & { node: AdfNode; path: ConvertErrorPath }

const largestListMarker = 999999999
const listTypes = ['bulletList', 'orderedList']

export function adfToMarkdown(document: AdfDocument): Result<string> {
  if (!isAdfDocument(document)) return failure('not-an-adf-document', 'the value is not an ADF document', [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  const blocks = emitBlocks(document.content ?? [], 'document', [], 0)
  if (!blocks.ok) return blocks
  return success(blocks.value.text === '' ? '' : `${blocks.value.text}\n`)
}

function emitBlocks(nodes: readonly AdfNode[], container: BlockContainer, path: ConvertErrorPath, depth: number): Result<EmittedBody> {
  if (depth > largestNesting) return failure('unsupported-node-shape', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
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
  if (listTypes.includes(next.node.type) && previous.node.type === next.node.type) {
    return failure('unspellable-adjacent-lists', `two adjacent ${next.node.type} nodes read back as one list`, next.path)
  }
  if (container === 'list-item' && listTypes.includes(next.node.type)) {
    if (!interruptsParagraph(next.node)) {
      return failure('unspellable-line-start', `a ${next.node.type} that cannot interrupt the block above it has no tight spelling`, next.path)
    }
    return success('\n')
  }
  if (container !== 'directive') return success('\n\n')
  if (previous.spelling === 'commonmark' && next.spelling === 'commonmark') return success('\n\n')
  if (previous.spelling === 'directive' && next.spelling === 'directive') return success('\n')
  return failure(
    'unspelled-block-separation',
    `the canonical form leaves the separation between a ${previous.spelling} and a ${next.spelling} block in a container body unspelled`,
    next.path,
  )
}

function interruptsParagraph(node: AdfNode): boolean {
  if (node.type === 'orderedList') return false
  return ((node.content ?? [])[0]?.content ?? []).length > 0
}

function emitBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  if (node.type === 'blockquote') return commonMarkContainer(emitBlockquote(node, path, depth))
  if (node.type === 'bulletList' || node.type === 'orderedList') return commonMarkContainer(emitList(node, path, depth))
  if (node.type === 'codeBlock') return commonMarkLine(emitCodeBlock(node, path))
  if (node.type === 'heading') return commonMarkLine(emitHeading(node, path))
  if (node.type === 'paragraph') return emitParagraph(node, path)
  if (node.type === 'rule') return commonMarkLine(emitRule(node, path))
  const directive = blockDirective(node.type)
  if (directive !== undefined) {
    if (node.type === 'mediaSingle') return emitMediaSingle(node, directive, path, depth)
    if (node.type === 'table') return emitTable(node, directive, path, depth)
    return emitDirectiveBlock(node, directive, path, depth)
  }
  return commonMarkLine(carriedBlock(node, path))
}

function commonMarkLine(text: Result<string>): Result<EmittedBlock> {
  if (!text.ok) return text
  return success(commonMarkText(text.value))
}

function commonMarkText(text: string): EmittedBlock {
  return { fenceColons: 0, spelling: 'commonmark', text }
}

function commonMarkContainer(body: Result<EmittedBody>): Result<EmittedBlock> {
  if (!body.ok) return body
  return success({ ...body.value, spelling: 'commonmark' })
}

function emitDirectiveBlock(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text`, path)
  const content = node.content ?? []
  if (directive.body === 'none' && content.length > 0) return failure('unsupported-node-shape', `a ${node.type} holds no content`, path)
  const header = spellDirectiveHeader(node, directive)
  if (header === undefined) return commonMarkLine(carriedBlock(node, path))
  if (directive.body === 'none') return success({ fenceColons: 2, spelling: 'directive', text: `::${header}` })
  const body = directive.body === 'inline' ? emitInlineBody(content, path) : emitBlocks(content, 'directive', path, depth + 1)
  if (!body.ok) return body
  const fenceColons = Math.max(3, body.value.fenceColons + 1)
  const fence = ':'.repeat(fenceColons)
  const lines = body.value.text === '' ? '' : `${body.value.text}\n`
  return success({ fenceColons, spelling: 'directive', text: `${fence}${header}\n${lines}${fence}` })
}

function emitInlineBody(content: readonly AdfNode[], path: ConvertErrorPath): Result<EmittedBody> {
  if (content.length === 0) return success({ fenceColons: 0, text: '' })
  const line = emitInlineLine(content, 'paragraph', path)
  if (!line.ok) return line
  return success({ fenceColons: 0, text: line.value })
}

function emitMediaSingle(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const image = tryImage(node, path)
  if (image === undefined) return emitDirectiveBlock(node, directive, path, depth)
  return success(commonMarkText(image))
}

function emitTable(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath, depth: number): Result<EmittedBlock> {
  const pipe = tryPipeTable(node, path)
  if (pipe === undefined) return emitDirectiveBlock(node, directive, path, depth)
  return success(commonMarkText(pipe))
}

function emitBlockquote(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBody> {
  const validation = validateBlockNode(node, [], path)
  if (!validation.ok) return validation
  const inner = emitBlocks(node.content ?? [], 'document', path, depth + 1)
  if (!inner.ok) return inner
  const text = inner.value.text
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')
  return success({ fenceColons: inner.value.fenceColons, text })
}

function emitCodeBlock(node: AdfNode, path: ConvertErrorPath): Result<string> {
  if (node.attrs?.['language'] === carryName) return carriedBlock(node, path)
  const validation = validateBlockNode(node, ['language'], path)
  if (!validation.ok) return validation
  const info = spellCodeFenceInfo(node.attrs?.['language'], path)
  if (!info.ok) return info
  let text = ''
  for (const [index, child] of (node.content ?? []).entries()) {
    const childPath = [...path, 'content', index]
    if (child.type !== 'text' || typeof child.text !== 'string' || child.text === '' || (child.marks ?? []).length > 0 || Object.keys(child.attrs ?? {}).length > 0) {
      return failure('unsupported-node-shape', 'a codeBlock holds plain text nodes only', childPath)
    }
    if (/\r/.test(child.text)) return failure('unspellable-whitespace', 'a codeBlock holds no carriage return CommonMark keeps', childPath)
    if (holdsNullCharacter(child.text)) return failure('unspellable-character', 'a codeBlock holds a null character CommonMark replaces', childPath)
    text += child.text
  }
  return success(fencedCodeBlock(info.value, text))
}

function spellCodeFenceInfo(language: JsonValue | undefined, path: ConvertErrorPath): Result<string> {
  if (language === undefined) return success('')
  if (typeof language !== 'string') return failure('unsupported-node-shape', 'a codeBlock language is no string', path)
  if (language === '') {
    return failure('ambiguous-attribute-spelling', 'an empty codeBlock language and an absent one share one markdown spelling', path)
  }
  if (/[`\n\r]/.test(language) || language !== language.trim()) {
    return failure('unspellable-code-block-language', 'a fence info string holds no backtick and no edge whitespace', path)
  }
  if (holdsEntityReference(language)) {
    return failure('unspellable-code-block-language', 'a fence info string shaped like an entity reference decodes on the way back', path)
  }
  return success(language)
}

function emitHeading(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const validation = validateBlockNode(node, ['level'], path)
  if (!validation.ok) return validation
  const level = node.attrs?.['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) {
    return failure('unsupported-heading-level', `no ATX heading spells level ${JSON.stringify(level ?? null)}`, path)
  }
  const hashes = '#'.repeat(level)
  const content = node.content ?? []
  if (content.length === 0) return success(hashes)
  const line = emitInlineLine(content, 'heading', path)
  if (!line.ok) return line
  return success(`${hashes} ${line.value}`)
}

function emitList(node: AdfNode, path: ConvertErrorPath, depth: number): Result<EmittedBody> {
  const ordered = node.type === 'orderedList'
  const validation = validateBlockNode(node, ordered ? ['order'] : [], path)
  if (!validation.ok) return validation
  const items = node.content ?? []
  const start = listStart(node, items.length, path)
  if (!start.ok) return start
  const lines: string[] = []
  let fenceColons = 0
  for (const [offset, item] of items.entries()) {
    const itemPath = [...path, 'content', offset]
    if (item.type !== 'listItem') return failure('unsupported-node-shape', `a ${node.type} holds listItem nodes only`, itemPath)
    const emitted = emitListItem(item, ordered ? `${start.value + offset}. ` : '- ', itemPath, depth)
    if (!emitted.ok) return emitted
    fenceColons = Math.max(fenceColons, emitted.value.fenceColons)
    lines.push(emitted.value.text)
  }
  return success({ fenceColons, text: lines.join('\n') })
}

function listStart(node: AdfNode, items: number, path: ConvertErrorPath): Result<number> {
  if (items === 0) return failure('unsupported-node-shape', `a ${node.type} holds at least one listItem`, path)
  if (node.type !== 'orderedList') return success(0)
  const start = node.attrs?.['order']
  if (start === undefined || start === 1) {
    return failure('ambiguous-attribute-spelling', 'an orderedList starting at 1 and one with no order share one markdown spelling', path)
  }
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > largestListMarker) {
    return failure('unsupported-node-shape', `no list marker spells the order ${JSON.stringify(start)}`, path)
  }
  if (start + items - 1 > largestListMarker) {
    return failure('unspellable-list-marker', `no list marker spells the ${items} items a list starting at ${start} needs`, path)
  }
  return success(start)
}

function emitListItem(item: AdfNode, marker: string, path: ConvertErrorPath, depth: number): Result<EmittedBody> {
  const validation = validateBlockNode(item, [], path)
  if (!validation.ok) return validation
  const inner = emitBlocks(item.content ?? [], 'list-item', path, depth + 1)
  if (!inner.ok) return inner
  if (inner.value.text === '') return success({ fenceColons: 0, text: marker.trimEnd() })
  const indent = ' '.repeat(marker.length)
  const lines = inner.value.text.split('\n').map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
  const first = lines[0] ?? ''
  if (isThematicBreak(first)) {
    return failure('unspellable-line-start', `block parsing would claim the emitted line ${JSON.stringify(first)}`, path)
  }
  return success({ fenceColons: inner.value.fenceColons, text: lines.join('\n') })
}

function emitParagraph(node: AdfNode, path: ConvertErrorPath): Result<EmittedBlock> {
  const validation = validateBlockNode(node, [], path)
  if (!validation.ok) return validation
  const content = node.content ?? []
  if (content.length === 0) return success({ fenceColons: 2, spelling: 'directive', text: '::paragraph' })
  return commonMarkLine(emitInlineLine(content, 'paragraph', path))
}

function emitRule(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const validation = validateBlockNode(node, [], path)
  if (!validation.ok) return validation
  if ((node.content ?? []).length > 0) return failure('unsupported-node-shape', 'a rule holds no content', path)
  return success('---')
}

function validateBlockNode(node: AdfNode, spelled: readonly string[], path: ConvertErrorPath): Result<null> {
  if ((node.marks ?? []).length > 0) {
    return failure('unspelled-block-marks', `the canonical form has no place for the marks a ${node.type} carries`, path)
  }
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text`, path)
  const unspelled = Object.keys(node.attrs ?? {}).find((key) => !spelled.includes(key))
  if (unspelled !== undefined) {
    return failure('unspelled-node-attribute', `the ${node.type} attribute ${unspelled} has no canonical markdown spelling`, path)
  }
  return success(null)
}

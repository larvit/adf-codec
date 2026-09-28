import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block, DirectiveBlock } from './blocks.ts'
import type { BlockDirectiveNode } from './directive-nodes.ts'
import type { ConvertFault } from '../../result.ts'
import type { Flavour } from '../plain-conventions.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinitions } from './inline-content.ts'
import { carryName, readCarriedBlock } from '../opaque-carry.ts'
import { commonMarkSpelling, type SpellingMemo } from '../emit/adf-to-markdown.ts'
import { failure, faulted, positioned, success, type ConvertErrorPath, type ParseError, type Result, type SourcePosition } from '../../result.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { listBreakName, listBreakSpelling } from '../block-directive.ts'
import { nodeAttrs, nodeContent } from '../../adf/document.ts'
import { parseBlocks } from './blocks.ts'
import { parseInlineContent } from './inline-content.ts'
import { readAlertMarker, readTaskMarker } from '../plain-conventions.ts'
import { readBlockDirectiveNode } from './directive-nodes.ts'
import { unsupportedNodeShape } from '../directive-syntax.ts'

type Paragraph = Extract<Block, { kind: 'paragraph' }>

// `inExpand` is whether an expand holds the blocks, which makes a folded callout a nestedExpand.
type Reading = { definitions: LinkDefinitions; flavour: Flavour; inExpand: boolean; memo: SpellingMemo }

const documentStart: SourcePosition = { line: 1, offset: 0 }

export function markdownToAdf(markdown: string): Result<AdfDocument, ParseError> {
  return readDocument(markdown, 'lossless')
}

export function plainMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError> {
  return readDocument(markdown, 'plain')
}

function readDocument(markdown: string, flavour: Flavour): Result<AdfDocument, ParseError> {
  const parsed = parseBlocks(markdown)
  const reading: Reading = { definitions: parsed.definitions, flavour, inExpand: false, memo: new Map() }
  const content = positioned(readBlocks(parsed.blocks, reading, [], 0), documentStart)
  if (!content.ok) return content
  return success(content.value.length === 0 ? { type: 'doc', version: 1 } : { content: content.value, type: 'doc', version: 1 })
}

function readBlocks(blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the input nests deeper than the ${largestNesting} levels the parser carries`, path)
  const content: AdfNode[] = []
  for (const [index, block] of blocks.entries()) {
    const nodePath = [...path, 'content', content.length]
    if (block.kind === 'directive' && block.name === listBreakName) {
      const fault = listBreakFault(block, blocks[index - 1], blocks[index + 1])
      if (fault !== undefined) return positioned(faulted(fault, nodePath), block.position)
      continue
    }
    const node = positioned(readBlock(block, reading, nodePath, depth), block.position)
    if (!node.ok) return node
    content.push(node.value)
  }
  return success(content)
}

// spec/flavour.md, Directives: the separator builds no node, so only the pair it parts spells it.
function listBreakFault(block: DirectiveBlock, previous: Block | undefined, next: Block | undefined): ConvertFault | undefined {
  if (block.argument !== undefined || block.attributes.size > 0) {
    return unsupportedNodeShape(`${listBreakName} spells the bare leaf form, ${listBreakSpelling}: this one spells more`)
  }
  if (previous?.kind !== 'bulletList' && previous?.kind !== 'orderedList') return partsFault()
  return previous.kind === next?.kind ? undefined : partsFault()
}

function partsFault(): ConvertFault {
  return unsupportedNodeShape(`${listBreakName} parts two adjacent lists of one type: this one parts something else`)
}

function readBlock(block: Block, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  switch (block.kind) {
    case 'blockquote':
      return reading.flavour === 'plain' ? quoteNode(block.blocks, reading, path, depth) : containerNode({ type: 'blockquote' }, block.blocks, reading, path, depth)
    case 'bulletList':
      return reading.flavour === 'plain' ? bulletNode(block.items, reading, path, depth) : listNode({ type: 'bulletList' }, block.items, reading, path, depth)
    case 'code':
      return codeBlockNode(block.language, block.text, path, depth)
    case 'directive':
      return directiveNode(block, reading, path, depth)
    case 'fault':
      return faulted(block.fault, path)
    case 'heading':
      return contentNode({ attrs: { level: block.level }, type: 'heading' }, block.text, reading, path, 'heading')
    case 'html':
      return failure('unmappable-html', `no raw HTML converts at this version: ${block.construct}`, path)
    case 'orderedList':
      return listNode({ attrs: { order: block.start }, type: 'orderedList' }, block.items, reading, path, depth)
    case 'paragraph':
      return paragraphNode(block.text, reading, path)
    case 'rule':
      return success({ type: 'rule' })
    case 'table':
      return tableNode(block.rows, reading, path)
  }
}

// The marker opens the paragraph's source, and whitespace or the line's end follows it.
function markerLed<T extends { length: number }>(block: Block | undefined, read: (text: string) => T | undefined): { marker: T; position: SourcePosition; text: string } | undefined {
  if (block?.kind !== 'paragraph') return undefined
  const marker = read(block.text)
  if (marker === undefined) return undefined
  const text = block.text.slice(marker.length)
  return text === '' || /^(?:[ \t\n]|\\\n)/.test(text) ? { marker, position: block.position, text } : undefined
}

// The marker's line, less a hard break ending it, and the lines after.
function markerLine(text: string): { line: string; rest: string } {
  const lineEnd = text.indexOf('\n')
  const line = lineEnd === -1 ? text : text.slice(0, lineEnd)
  const hardBreak = lineEnd !== -1 && /(?:^|[^\\])(?:\\\\)*\\$/.test(line)
  return { line: (hardBreak ? line.slice(0, -1) : line).replace(/^[ \t]+/, ''), rest: lineEnd === -1 ? '' : text.slice(lineEnd + 1) }
}

function paragraphsOf(position: SourcePosition, ...texts: string[]): Paragraph[] {
  return texts.filter((text) => text !== '').map((text) => ({ kind: 'paragraph', position, text }))
}

function quoteNode(blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const [first, ...body] = blocks
  const led = markerLed(first, readAlertMarker)
  if (led === undefined) return containerNode({ type: 'blockquote' }, blocks, reading, path, depth)
  const { folded, panelType } = led.marker
  const { line, rest } = markerLine(led.text)
  if (!folded) return filledNode({ attrs: { panelType }, type: 'panel' }, [...paragraphsOf(led.position, line, rest), ...body], reading, path, depth)
  const title = contentNode({ type: 'paragraph' }, line, reading, path, 'paragraph')
  if (!title.ok) return title
  const text = nodeContent(title.value).map((node) => node.text ?? '').join('')
  const type = reading.inExpand ? 'nestedExpand' : 'expand'
  return filledNode(text === '' ? { type } : { attrs: { title: text }, type }, [...paragraphsOf(led.position, rest), ...body], { ...reading, inExpand: true }, path, depth)
}

// Atlassian's schema requires a panel and an expand to hold a block.
function filledNode(node: AdfNode, blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const built = containerNode(node, blocks, reading, path, depth)
  return built.ok && built.value.content === undefined ? success({ ...built.value, content: [{ type: 'paragraph' }] }) : built
}

// A task list trailing an item's blocks stands beside it, as ADF nests one.
function bulletNode(items: readonly Block[][], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const led = []
  for (const [first, ...others] of items) {
    const marked = markerLed(first, readTaskMarker)
    if (marked === undefined) return listNode({ type: 'bulletList' }, items, reading, path, depth)
    led.push({ ...marked, others })
  }
  const tasks: AdfNode[] = []
  for (const [index, { marker, others, position, text }] of led.entries()) {
    const read = readBlocks([...paragraphsOf(position, text.replace(/^(?:[ \t\n]|\\\n)+/, '')), ...others], reading, [...path, 'content', index], depth + 1)
    if (!read.ok) return read
    let beside = read.value.length
    while (read.value[beside - 1]?.type === 'taskList') beside -= 1
    const kept = read.value.slice(0, beside)
    const [only] = kept
    const attrs = { state: marker.state }
    const inline = kept.length <= 1 && (only === undefined || only.type === 'paragraph')
    tasks.push(inline ? { attrs, content: nodeContent(only ?? {}).slice(), type: 'taskItem' } : { attrs, content: kept, type: 'blockTaskItem' })
    for (const nested of read.value.slice(beside)) tasks.push(nested)
  }
  return success({ content: tasks, type: 'taskList' })
}

function directiveNode(block: DirectiveBlock, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const read = readBlockDirectiveNode(block.name, block.argument, block.attributes, path)
  if (!read.ok) return read
  const inExpand = reading.inExpand || read.value.node.type === 'expand' || read.value.node.type === 'nestedExpand'
  const built = directiveBody(read.value, block.blocks, { ...reading, inExpand }, path, depth)
  if (!built.ok) return built
  const readable = commonMarkSpelling(built.value, path, depth, reading.memo)
  if (readable === undefined) return built
  if (!readable.ok) return readable
  return failure('unsupported-node-shape', `${built.value.type} takes the CommonMark spelling, not the directive form`, path)
}

function directiveBody(read: BlockDirectiveNode, blocks: Block[] | undefined, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const { contentModel, node } = read
  if (blocks === undefined) return success(node)
  if (contentModel === 'code') return codeDirectiveNode(node, blocks, path)
  if (contentModel === 'inline') return inlineBodyNode(node, blocks, reading, path)
  return containerNode(node, blocks, reading, path, depth)
}

function codeDirectiveNode(node: AdfNode, blocks: readonly Block[], path: ConvertErrorPath): Result<AdfNode> {
  const only = blocks.length === 1 ? blocks[0] : undefined
  if (only?.kind !== 'code') return failure('unsupported-node-shape', `${node.type} takes one code block as its body: this body is not one`, path)
  const attribute = nodeAttrs(node)['language']
  const fromFence = only.language !== ''
  const slot = languageSlot(fromFence ? only.language : attribute)
  if ((slot.kind === 'fence') !== fromFence || (fromFence && attribute !== undefined)) {
    return failure('unsupported-node-shape', `${node.type} spells its language in the fence info string, or in the attribute where no info string carries it back`, path)
  }
  const spelled = fromFence ? { ...node, attrs: { ...node.attrs, language: only.language } } : node
  return success(withContent(spelled, only.text === '' ? [] : [{ text: only.text, type: 'text' }]))
}

function tableNode(rows: readonly string[][], reading: Reading, path: ConvertErrorPath): Result<AdfNode> {
  const content: AdfNode[] = []
  for (const [rowIndex, cells] of rows.entries()) {
    const type = rowIndex === 0 ? 'tableHeader' : 'tableCell'
    const row: AdfNode[] = []
    for (const [cellIndex, cell] of cells.entries()) {
      const paragraph = contentNode({ type: 'paragraph' }, cell, reading, [...path, 'content', rowIndex, 'content', cellIndex, 'content', 0], 'table-cell')
      if (!paragraph.ok) return paragraph
      row.push({ content: [paragraph.value], type })
    }
    content.push({ content: row, type: 'tableRow' })
  }
  return success({ content, type: 'table' })
}

function inlineBodyNode(node: AdfNode, blocks: readonly Block[], reading: Reading, path: ConvertErrorPath): Result<AdfNode> {
  if (blocks.length === 0) return success(node)
  const only = blocks.length === 1 ? blocks[0] : undefined
  if (only?.kind === 'fault') return positioned(faulted(only.fault, path), only.position)
  if (only?.kind !== 'paragraph') return failure('unsupported-node-shape', `${node.type} takes one paragraph as its body: this body is not one`, path)
  return positioned(contentNode(node, only.text, reading, path, 'paragraph'), only.position)
}

function containerNode(node: AdfNode, blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content = readBlocks(blocks, reading, path, depth + 1)
  if (!content.ok) return content
  return success(withContent(node, content.value))
}

function withContent(node: AdfNode, content: readonly AdfNode[]): AdfNode {
  return content.length === 0 ? node : { ...node, content: [...content] }
}

function listNode(node: AdfNode, items: readonly Block[][], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content: AdfNode[] = []
  for (const [index, blocks] of items.entries()) {
    const item = containerNode({ type: 'listItem' }, blocks, reading, [...path, 'content', index], depth)
    if (!item.ok) return item
    content.push(item.value)
  }
  return success({ ...node, content })
}

function codeBlockNode(language: string, text: string, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  if (language === carryName) {
    const carried = readCarriedBlock(text, depth)
    if (carried.fault !== undefined) return faulted(carried.fault, path)
    return success(carried.value)
  }
  const node: AdfNode = language === '' ? { type: 'codeBlock' } : { attrs: { language }, type: 'codeBlock' }
  return success(text === '' ? node : { ...node, content: [{ text, type: 'text' }] })
}

// spec/flavour.md, The CommonMark image: only a plain paragraph gives an image the block it needs.
function paragraphNode(text: string, reading: Reading, path: ConvertErrorPath): Result<AdfNode> {
  const content = parseInlineContent(text, reading.definitions, path, 'paragraph', reading.flavour)
  if (!content.ok) return content
  const image = content.value.image
  return success(image === undefined ? withContent({ type: 'paragraph' }, content.value.nodes) : image)
}

function contentNode(node: AdfNode, text: string, reading: Reading, path: ConvertErrorPath, container: LineContainer): Result<AdfNode> {
  const content = parseInlineContent(text, reading.definitions, path, container, reading.flavour)
  if (!content.ok) return content
  if (content.value.image !== undefined) return failure('unmappable-image', `no ADF node carries an image inside a ${node.type}`, path)
  return success(withContent(node, content.value.nodes))
}

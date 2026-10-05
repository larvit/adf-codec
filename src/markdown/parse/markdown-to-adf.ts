import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block, DirectiveBlock } from './blocks.ts'
import type { BlockDirectiveNode } from './directive-nodes.ts'
import type { ConvertFault } from '../../result.ts'
import type { Flavour } from '../plain/conventions.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinitions } from './inline-content.ts'
import { carryFenceType, readCarriedBlock } from '../opaque-carry.ts'
import { commonMarkSpelling, type SpellingMemo } from '../emit/adf-to-markdown.ts'
import { documentAttribute, documentName, documentSpelling, listBreakName, listBreakSpelling } from '../block-directive.ts'
import { emptyKeys, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { failure, faulted, positioned, success, type ConvertErrorPath, type ParseError, type Result, type SourcePosition } from '../../result.ts'
import { inlineLeaves } from '../plain/inline-reduction.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { leadingMarker, readAlertMarker, readTaskMarker } from '../plain/conventions.ts'
import { mintTaskIds } from '../plain/task-ids.ts'
import { parseBlocks } from './blocks.ts'
import { parseInlineContent } from './inline-content.ts'
import { readBlockDirectiveNode } from './directive-nodes.ts'
import { spellStringAttribute, unsupportedNodeShape } from '../directive-syntax.ts'
import { spellsEmpty } from '../empty-keys.ts'

type Paragraph = Extract<Block, { kind: 'paragraph' }>

// `inExpand` is whether an expand holds the blocks, which makes a folded callout a nestedExpand.
type Reading = { carried: Set<AdfNode>; definitions: LinkDefinitions; flavour: Flavour; inExpand: boolean; memo: SpellingMemo }

const documentStart: SourcePosition = { line: 1, offset: 0 }
const imageAfterMarker = 'an image fits only as a paragraph of its own: this one continues the paragraph a marker opens, which a blank line before it ends'
const imageOnMarkerLine = 'an image fits only as a paragraph of its own: this one shares a line with a marker'

export function markdownToAdf(markdown: string): Result<AdfDocument, ParseError> {
  return readDocument(markdown, 'lossless')
}

export function plainMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError> {
  return readDocument(markdown, 'plain')
}

function readDocument(markdown: string, flavour: Flavour): Result<AdfDocument, ParseError> {
  if (typeof markdown !== 'string') return positioned(failure('not-a-string', `markdown is a string: found ${typeName(markdown)}`, []), documentStart)
  const parsed = parseBlocks(markdown)
  const [only] = parsed.blocks
  if (parsed.blocks.length === 1 && only?.kind === 'directive' && only.name === documentName) {
    const fault = documentFault(only)
    return fault === undefined ? success({ type: 'doc', version: 1 }) : positioned(faulted(fault, []), only.position)
  }
  const reading: Reading = { carried: new Set(), definitions: parsed.definitions, flavour, inExpand: false, memo: new Map() }
  const content = positioned(readBlocks(parsed.blocks, reading, [], 0), documentStart)
  if (!content.ok) return content
  const document: AdfDocument = { content: content.value, type: 'doc', version: 1 }
  if (flavour === 'plain') mintTaskIds(document, markdown, reading.carried)
  return success(document)
}

// `typeof` alone, since anything more throws on a revoked Proxy.
function typeName(value: unknown): string {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'undefined') return type
  return type === 'object' ? 'an object' : `a ${type}`
}

function readBlocks(blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the input nests deeper than the ${largestNesting} levels the parser carries`, path)
  const content: AdfNode[] = []
  for (const [index, block] of blocks.entries()) {
    const nodePath = [...path, 'content', content.length]
    if (block.kind === 'directive' && block.name === documentName) {
      const fault = documentFault(block) ?? unsupportedNodeShape(`delete the ${documentSpelling} line to give the document content: it stands only as the whole document`)
      return positioned(faulted(fault, nodePath), block.position)
    }
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

function documentFault(block: DirectiveBlock): ConvertFault | undefined {
  const spelled = block.attributes.get(documentAttribute.key)
  if (block.argument === undefined && block.attributes.size === 1 && spelled?.spelling === documentAttribute.value) return undefined
  if (block.argument === undefined && block.attributes.size === 1 && spellsEmpty(spelled)) {
    return unsupportedNodeShape(`an empty document is empty markdown, and ${documentSpelling} spells a document holding no content key: this one spells ${documentAttribute.key}=empty`)
  }
  return unsupportedNodeShape(`${documentName} spells the one form ${documentSpelling}: this one spells another`)
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
      return codeBlockNode(block.language, block.text, reading, path, depth)
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

function markerLed<T extends { length: number }>(block: Block | undefined, read: (text: string) => T | undefined): { marker: T; position: SourcePosition; text: string } | undefined {
  if (block?.kind !== 'paragraph') return undefined
  const marker = leadingMarker(block.text, read)
  return marker === undefined ? undefined : { marker, position: block.position, text: block.text.slice(marker.length) }
}

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
  if (!folded) return filledNode({ attrs: { panelType }, type: 'panel' }, readMarked(paragraphsOf(led.position, line, rest), line !== '', body, reading, path, depth))
  const title = parseInlineContent(line, reading.definitions, path, 'paragraph', 'lossless')
  if (!title.ok) return title
  if (title.value.image !== undefined) return failure('unmappable-image', imageOnMarkerLine, path)
  const leaves: AdfNode[] = []
  for (const [index, node] of title.value.nodes.entries()) {
    const held = node.text === undefined ? inlineLeaves([node], 'paragraph', [...path, 'content', index], depth) : success([node])
    if (!held.ok) return held
    for (const leaf of held.value) leaves.push(leaf)
  }
  const text = titleText(leaves)
  const type = reading.inExpand ? 'nestedExpand' : 'expand'
  return filledNode(text === '' ? { type } : { attrs: { title: text }, type }, readMarked(paragraphsOf(led.position, rest), false, body, { ...reading, inExpand: true }, path, depth))
}

// docs/decisions.md, A callout title keeps its link targets.
function titleText(nodes: readonly AdfNode[]): string {
  let text = ''
  let linked = ''
  for (const [index, node] of nodes.entries()) {
    const href = linkTarget(node)
    text += node.text ?? ''
    linked += href === undefined ? '' : node.text ?? ''
    if (href === undefined || linkTarget(nodes[index + 1]) === href) continue
    if (href !== linked && href !== `mailto:${linked}`) text += ` (${href})`
    linked = ''
  }
  return text
}

function linkTarget(node: AdfNode | undefined): string | undefined {
  const href = node?.marks?.find((mark) => mark.type === 'link')?.attrs?.href
  return typeof href === 'string' ? href : undefined
}

// Atlassian's schema requires a panel and an expand to hold a block.
function filledNode(node: AdfNode, content: Result<AdfNode[]>): Result<AdfNode> {
  if (!content.ok) return content
  return success({ ...node, content: content.value.length === 0 ? [{ type: 'paragraph' }] : content.value })
}

// A paragraph split off a marker still refuses the image it held beside it; `onMarkerLine` is whether the first one opens on the marker's line.
function readMarked(marked: readonly Paragraph[], onMarkerLine: boolean, others: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  const read = readBlocks([...marked, ...others], reading, path, depth + 1)
  if (!read.ok) return read
  const image = read.value.slice(0, marked.length).findIndex((node) => node.type === 'mediaSingle')
  if (image === -1) return read
  return failure('unmappable-image', image === 0 && onMarkerLine ? imageOnMarkerLine : imageAfterMarker, [...path, 'content', image])
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
    const read = readMarked(paragraphsOf(position, text.replace(/^(?:[ \t\n]|\\\n)+/, '')), markerLine(text).line !== '', others, reading, [...path, 'content', index], depth)
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
  const readable = commonMarkSpelling(built.value, path, depth, { flavour: 'lossless', memo: reading.memo })
  if (readable === undefined) return built
  if (!readable.ok) return readable
  return failure('unsupported-node-shape', `${built.value.type} takes the CommonMark spelling, not the directive form`, path)
}

function directiveBody(read: BlockDirectiveNode, blocks: Block[] | undefined, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const { contentModel, node } = read
  if (blocks === undefined) return success(node)
  // A directive builds a content key only from content=empty, which holds no body.
  if (node.content !== undefined) return blocks.length === 0 ? success(node) : failure('unsupported-node-shape', `remove content=empty to give the ${node.type} a body: content=empty holds none, and this one holds one`, path)
  if (contentModel === 'code') return codeDirectiveNode(node, blocks, path)
  if (contentModel === 'inline') return inlineBodyNode(node, blocks, reading, path)
  return containerNode(node, blocks, reading, path, depth)
}

// spec/flavour.md, The CommonMark blocks: one fence per text node, every fence carrying the one language.
function codeDirectiveNode(node: AdfNode, blocks: readonly Block[], path: ConvertErrorPath): Result<AdfNode> {
  const fences: Extract<Block, { kind: 'code' }>[] = []
  for (const block of blocks) {
    if (block.kind !== 'code') return failure('unsupported-node-shape', `${node.type} takes code blocks as its body: this body holds another block`, path)
    fences.push(block)
  }
  const [first] = fences
  if (first === undefined) return failure('unsupported-node-shape', `${node.type} takes code blocks as its body: this body holds none`, path)
  if (fences.some((fence) => fence.language !== first.language)) return failure('unsupported-node-shape', `${node.type} holds one language, so its fences carry one info string: these differ`, path)
  if (fences.length > 1 && fences.some((fence) => fence.text === '')) return failure('unsupported-node-shape', `delete the empty fence: a fence beside another holds code, and this one holds none`, path)
  const attribute = nodeAttrs(node)['language']
  const fromFence = first.language !== ''
  const slot = languageSlot(fromFence ? first.language : attribute)
  if (!fromFence && slot.kind === 'fence') {
    return failure('unsupported-node-shape', `move language=${spellStringAttribute(slot.info)} to the fences' info strings: they can spell this language`, path)
  }
  if ((slot.kind === 'fence') !== fromFence || (fromFence && attribute !== undefined)) {
    return failure('unsupported-node-shape', `${node.type} spells its language in the fence info string, or in the attribute where no info string carries it back`, path)
  }
  if (fromFence && emptyKeys(node).includes('attrs')) {
    return failure('unsupported-node-shape', `remove attrs=empty to give the ${node.type} the fence's language: attrs=empty holds no language, and this fence names one`, path)
  }
  const spelled = fromFence ? { ...node, attrs: { ...node.attrs, language: first.language } } : node
  return success(withContent(spelled, first.text === '' ? [] : fences.map((fence): AdfNode => ({ text: fence.text, type: 'text' }))))
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

function codeBlockNode(language: string, text: string, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const carriedType = carryFenceType(language)
  if (carriedType !== undefined) {
    const carried = readCarriedBlock(carriedType, text, depth)
    if (carried.fault !== undefined) return faulted(carried.fault, path)
    reading.carried.add(carried.value)
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

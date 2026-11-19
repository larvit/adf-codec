import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block, DirectiveBlock, MarkerBlock } from './blocks.ts'
import type { BlockDirectiveNode } from '../directive/node-reading.ts'
import type { ConvertFault, SourcePosition } from '../../result.ts'
import type { DirectiveAttributes } from '../directive/syntax.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinitions } from '../inline-content.ts'
import { carryFenceType, readCarriedBlock } from '../opaque-carry.ts'
import { commonMarkSpelling, describeCommonMarkSpelling, spellingMemo, type SpellingMemo } from '../emit/spelling-questions.ts'
import { directiveEscape, markerOpener, spellStringAttribute, unsupportedNodeShape } from '../directive/syntax.ts'
import { documentAttribute, documentName, documentSpelling } from '../directive/block.ts'
import { emptyKeys, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { failure, faulted, positioned, success, type ConvertErrorPath, type ParseError, type Result } from '../../result.ts'
import { flavourClaims } from '../flavour.ts'
import { idKey, readMarkerId } from '../directive/id-marker.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { markerInterruptsParagraph } from '../commonmark/grammar.ts'
import { notAString } from '../../not-a-string.ts'
import { parseBlocks } from './blocks.ts'
import { readBlockDirectiveNode } from '../directive/node-reading.ts'
import { readInlineContent } from './inline-content.ts'
import { spellsEmpty } from '../directive/empty-keys.ts'
import { withinEngineLimits } from '../../length-bound.ts'

// A flavour's own reading of a quote, and of a bullet list into one or more blocks; `path` is the container's, `index` the list's place among the container's blocks.
export type FlavourBlockReaders = {
  bulletList: (items: readonly Block[][], reading: FlavourReading, path: ConvertErrorPath, depth: number, index: number) => Result<AdfNode[]>
  quote: (blocks: readonly Block[], reading: FlavourReading, path: ConvertErrorPath, depth: number) => Result<AdfNode>
}

export type FlavourReading = Extract<Reading, { flavour: 'portable' }>

// trailing: the container's first paragraph ends its last line with its id, the line above it being the container's.
type Opening = 'trailing'

export type ReadAs = { flavour: 'commonmark' | 'lossless' } | { blocks: FlavourBlockReaders; flavour: 'portable' }

export type Reading = ReadAs & { definitions: LinkDefinitions; memo: SpellingMemo }

export function commonMarkToAdf(markdown: string): Result<AdfDocument, ParseError> {
  return readDocument(markdown, { flavour: 'commonmark' })
}

export function losslessMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError> {
  return readDocument(markdown, { flavour: 'lossless' })
}

export function readDocument(markdown: string, readAs: ReadAs): Result<AdfDocument, ParseError> {
  return positioned(
    withinEngineLimits(() => readMarkdown(markdown, readAs)),
    { line: 1, offset: 0 },
  )
}

function readMarkdown(markdown: string, readAs: ReadAs): Result<AdfDocument> {
  if (typeof markdown !== 'string') return notAString(markdown, 'markdown')
  const parsed = parseBlocks(markdown, readAs.flavour)
  const [only] = parsed.blocks
  if (parsed.blocks.length === 1 && only?.kind === 'directive' && only.name === documentName) {
    const fault = documentFault(only)
    return fault === undefined ? success({ type: 'doc', version: 1 }) : positioned(faulted(fault, []), only.position)
  }
  const reading: Reading = { ...readAs, definitions: parsed.definitions, memo: spellingMemo() }
  const content = readBlocks(parsed.blocks, reading, [], 0)
  return content.ok ? success({ content: content.value, type: 'doc', version: 1 }) : content
}

export function readBlocks(blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number, opening?: Opening): Result<AdfNode[]> {
  if (depth > largestNesting) return tooDeep(path)
  const content: AdfNode[] = []
  let marker: MarkerBlock | undefined
  for (const block of blocks) {
    const nodePath = [...path, 'content', content.length]
    if (block.kind === 'marker') {
      if (marker !== undefined) return positioned(failure('malformed-directive', twoMarkers, nodePath), block.position)
      marker = block
      continue
    }
    if (block.kind === 'directive' && block.name === documentName) {
      const fault = documentFault(block) ?? unsupportedNodeShape(`delete the ${documentSpelling} line to give the document content: it stands only as the whole document`)
      return positioned(faulted(fault, nodePath), block.position)
    }
    if (block.kind === 'bulletList' && reading.flavour === 'portable') {
      const listed = positioned(reading.blocks.bulletList(block.items, reading, path, depth, content.length), block.position)
      if (!listed.ok) return listed
      for (const node of listed.value) content.push(node)
      continue
    }
    const node = positioned(readBlock(block, reading, nodePath, depth), block.position)
    if (!node.ok) return node
    const marked = markedNode(node.value, block, marker, opening === 'trailing' && content.length === 0, nodePath)
    if (!marked.ok) return marked
    content.push(marked.value)
    marker = undefined
  }
  if (marker === undefined) return success(content)
  return positioned(failure('malformed-directive', `an ${markerOpener}…} marker carries the id of the block right below it: no block follows this one; ${directiveEscape}`, [...path, 'content', content.length]), marker.position)
}

const twoMarkers = `a block carries one ${markerOpener}…} marker: this one carries two`

// spec/flavour.md, The CommonMark blocks: the blocks a marker line stands above, by the node each builds.
const markedTypes: ReadonlyMap<Block['kind'], string> = new Map([
  ['blockquote', 'blockquote'],
  ['bulletList', 'bulletList'],
  ['code', 'codeBlock'],
  ['orderedList', 'orderedList'],
  ['paragraph', 'paragraph'],
  ['rule', 'rule'],
])

function markedNode(node: AdfNode, block: Exclude<Block, MarkerBlock>, line: MarkerBlock | undefined, trails: boolean, path: ConvertErrorPath): Result<AdfNode, ParseError> {
  const trailing = block.kind === 'heading' || block.kind === 'paragraph' ? block.trailing : undefined
  if (trailing === undefined) return line === undefined ? success(node) : lineMarkedNode(node, block, line, trails, path)
  if (trailing.fault !== undefined) return positioned(faulted(trailing.fault, path), block.position)
  if (line !== undefined) return positioned(failure('malformed-directive', twoMarkers, path), block.position)
  if (block.kind === 'paragraph' && !trails) {
    return positioned(failure('unsupported-node-shape', `a paragraph carries its ${markerOpener}…} marker on the line above it, unless it opens a quote or a list item: move this one to the line above the paragraph`, path), block.position)
  }
  if (node.type !== block.kind) return positioned(failure('unsupported-node-shape', `this paragraph reads as a ${node.type}, whose id rides its directive: write the ${node.type} as its directive`, path), block.position)
  return identified(node, trailing.value, path, block.position)
}

function lineMarkedNode(node: AdfNode, block: Exclude<Block, MarkerBlock>, line: MarkerBlock, trails: boolean, path: ConvertErrorPath): Result<AdfNode, ParseError> {
  const at = (message: string): Result<AdfNode, ParseError> => positioned(failure('unsupported-node-shape', message, path), line.position)
  if (block.kind === 'heading') return at(`a heading carries its ${markerOpener}…} marker at the end of its line, one space after its text: move this one there`)
  if (block.kind === 'paragraph' && trails) return at(`the paragraph opening a quote or a list item carries its ${markerOpener}…} marker at the end of its last line, the line above being the container's: move this one there`)
  if (markedTypes.get(block.kind) !== node.type) return at(`an ${markerOpener}…} marker stands above a paragraph, list, quote, code block or rule spelled in CommonMark: this one stands above a ${node.type}`)
  const gap = block.position.line - line.position.line
  if (gap !== (blankBelowMarker(block) ? 2 : 1)) {
    const placement = blankBelowMarker(block) ? `one blank line parts an ${markerOpener}…} marker from the ${node.type} below it, which CommonMark would otherwise read with the marker` : `an ${markerOpener}…} marker stands on the line right above its ${node.type}`
    return positioned(failure('malformed-directive', `${placement}: this one stands ${gap === 1 ? '1 line' : `${gap} lines`} above it`, path), line.position)
  }
  return identified(node, line.attributes, path, line.position)
}

// A text line above a rule makes a setext heading, and above a list whose marker cannot interrupt a paragraph it continues that paragraph.
function blankBelowMarker(block: Exclude<Block, MarkerBlock>): boolean {
  if (block.kind === 'rule') return true
  if (block.kind !== 'bulletList' && block.kind !== 'orderedList') return false
  return !markerInterruptsParagraph(block.kind === 'orderedList' ? block.start : undefined, block.items[0]?.length === 0)
}

function identified(node: AdfNode, attributes: DirectiveAttributes, path: ConvertErrorPath, position: SourcePosition): Result<AdfNode, ParseError> {
  const id = positioned(readMarkerId(attributes, node.type, path), position)
  return id.ok ? success({ ...node, attrs: { ...node.attrs, [idKey]: id.value } }) : id
}

export function tooDeep<T>(path: ConvertErrorPath): Result<T> {
  return failure('unsupported-nesting-depth', `the input nests deeper than the ${largestNesting} levels the parser carries`, path)
}

function documentFault(block: DirectiveBlock): ConvertFault | undefined {
  const spelled = block.attributes.get(documentAttribute.key)
  if (block.argument === undefined && block.attributes.size === 1 && spelled?.spelling === documentAttribute.value) return undefined
  if (block.argument === undefined && block.attributes.size === 1 && spellsEmpty(spelled)) {
    return unsupportedNodeShape(`an empty document is empty markdown, and ${documentSpelling} spells a document holding no content key: this one spells ${documentAttribute.key}=empty`)
  }
  return unsupportedNodeShape(`${documentName} spells the one form ${documentSpelling}: this one spells another`)
}

function readBlock(block: Exclude<Block, MarkerBlock>, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  switch (block.kind) {
    case 'blockquote':
      return reading.flavour === 'portable' ? reading.blocks.quote(block.blocks, reading, path, depth) : containerNode({ type: 'blockquote' }, block.blocks, reading, path, depth, 'trailing')
    case 'bulletList':
      // readBlocks reads a portable bullet list before it reaches here.
      return listNode({ type: 'bulletList' }, block.items, reading, path, depth)
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

function directiveNode(block: DirectiveBlock, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const read = readBlockDirectiveNode(block.name, block.argument, block.attributes, path)
  if (!read.ok) return read
  const built = directiveBody(read.value, block.blocks, reading, path, depth)
  if (!built.ok) return built
  // Refused here so V8's throw past the bound is placed at this directive, like the bound check on other engines.
  const readable = withinEngineLimits(() => commonMarkSpelling(built.value, path, depth, { flavour: 'lossless', memo: reading.memo }))
  if (!readable.ok) return readable
  if (!readable.value || writtenByEarlierRelease(built.value)) return built
  const spelling = describeCommonMarkSpelling(built.value)
  return failure('unsupported-node-shape', `${built.value.type} takes the CommonMark spelling, not the directive form${spelling === undefined ? '' : `: write ${spelling}`}`, path)
}

// 0.3 wrote each of these nodes as its directive where it, or one of a list's items, held an id.
function writtenByEarlierRelease(node: AdfNode): boolean {
  if (node.type === 'bulletList' || node.type === 'orderedList') return holdsId(node) || nodeContent(node).some(holdsId)
  return holdsId(node)
}

function holdsId(node: AdfNode): boolean {
  return nodeAttrs(node)[idKey] !== undefined
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
  const slot = languageSlot(fromFence ? first.language : attribute, flavourClaims.lossless)
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
  if (only.trailing !== undefined) return positioned(failure('unsupported-node-shape', `a directive carries its ${node.type}'s ${idKey} in its {attrs}, never in a trailing ${markerOpener}…} marker`, path), only.position)
  return positioned(contentNode(node, only.text, reading, path, 'paragraph'), only.position)
}

export function containerNode(node: AdfNode, blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number, opening?: Opening): Result<AdfNode> {
  const content = readBlocks(blocks, reading, path, depth + 1, opening)
  if (!content.ok) return content
  return success(withContent(node, content.value))
}

function withContent(node: AdfNode, content: readonly AdfNode[]): AdfNode {
  return content.length === 0 ? node : { ...node, content: [...content] }
}

export function listNode(node: AdfNode, items: readonly Block[][], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content: AdfNode[] = []
  for (const [index, blocks] of items.entries()) {
    const item = listItemNode(blocks, reading, [...path, 'content', index], depth)
    if (!item.ok) return item
    content.push(item.value)
  }
  return success({ ...node, content })
}

// spec/flavour.md, The CommonMark blocks: an item's id stands right after its list marker, before its first paragraph's text.
function listItemNode(blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const [first] = blocks
  if (first?.kind !== 'marker') return containerNode({ type: 'listItem' }, blocks, reading, path, depth, 'trailing')
  if (first.placement === 'line') {
    return positioned(failure('unsupported-node-shape', `a list item's first line carries the item's own ${markerOpener}…} marker, right after its list marker: write the list as directives, or end a paragraph opening this item with a marker, to give the block opening this item an id`, path), first.position)
  }
  const item = containerNode({ type: 'listItem' }, blocks.slice(1), reading, path, depth, 'trailing')
  if (!item.ok) return item
  if (nodeContent(item.value)[0]?.type !== 'paragraph') {
    return positioned(failure('unsupported-node-shape', `a list item's ${markerOpener}…} marker stands before its first paragraph's text: this item opens with no paragraph; write the list as directives to give it an id`, path), first.position)
  }
  return identified(item.value, first.attributes, path, first.position)
}

function codeBlockNode(language: string, text: string, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const carriedType = flavourClaims[reading.flavour].carryFence ? carryFenceType(language) : undefined
  if (carriedType !== undefined) {
    const carried = readCarriedBlock(carriedType, text, depth)
    return carried.fault === undefined ? success(carried.value) : faulted(carried.fault, path)
  }
  const node: AdfNode = language === '' ? { type: 'codeBlock' } : { attrs: { language }, type: 'codeBlock' }
  return success(text === '' ? node : { ...node, content: [{ text, type: 'text' }] })
}

// spec/flavour.md, The CommonMark image: only a `paragraph` block gives a lone image the block it needs.
function paragraphNode(text: string, reading: Reading, path: ConvertErrorPath): Result<AdfNode> {
  const content = readInlineContent(text, reading.definitions, path, 'paragraph', reading.flavour)
  if (!content.ok) return content
  const image = content.value.image
  return success(image === undefined ? withContent({ type: 'paragraph' }, content.value.nodes) : image)
}

export function contentNode(node: AdfNode, text: string, reading: Reading, path: ConvertErrorPath, container: LineContainer): Result<AdfNode> {
  const content = readInlineContent(text, reading.definitions, path, container, reading.flavour)
  if (!content.ok) return content
  return success(withContent(node, content.value.nodes))
}

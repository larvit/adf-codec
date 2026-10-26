import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block, DirectiveBlock } from './blocks.ts'
import type { BlockDirectiveNode } from '../directive/node-reading.ts'
import type { ConvertFault } from '../../result.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinitions } from './inline-content.ts'
import { carryFenceType, readCarriedBlock } from '../opaque-carry.ts'
import { commonMarkSpelling, type SpellingMemo } from '../emit/spelling-questions.ts'
import { documentAttribute, documentName, documentSpelling } from '../directive/block.ts'
import { emptyKeys, nodeAttrs } from '../../adf/document.ts'
import { failure, faulted, positioned, success, type ConvertErrorPath, type ParseError, type Result } from '../../result.ts'
import { flavourClaims } from '../flavour.ts'
import { languageSlot } from '../code-language.ts'
import { largestNesting } from '../../nesting.ts'
import { notAString } from '../../not-a-string.ts'
import { parseBlocks } from './blocks.ts'
import { parseInlineContent } from './inline-content.ts'
import { readBlockDirectiveNode } from '../directive/node-reading.ts'
import { spellStringAttribute, unsupportedNodeShape } from '../directive/syntax.ts'
import { spellsEmpty } from '../directive/empty-keys.ts'
import { withinEngineLimits } from '../../length-bound.ts'

// A flavour's own reading of a quote, and of a bullet list into one or more blocks; `path` is the container's, `index` the list's place among the container's blocks.
export type FlavourBlockReaders = {
  bulletList: (items: readonly Block[][], reading: FlavourReading, path: ConvertErrorPath, depth: number, index: number) => Result<AdfNode[]>
  quote: (blocks: readonly Block[], reading: FlavourReading, path: ConvertErrorPath, depth: number) => Result<AdfNode>
}

export type FlavourReading = Extract<Reading, { flavour: 'portable' }>

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
  const reading: Reading = { ...readAs, definitions: parsed.definitions, memo: new Map() }
  const content = readBlocks(parsed.blocks, reading, [], 0)
  return content.ok ? success({ content: content.value, type: 'doc', version: 1 }) : content
}

export function readBlocks(blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  if (depth > largestNesting) return tooDeep(path)
  const content: AdfNode[] = []
  for (const block of blocks) {
    const nodePath = [...path, 'content', content.length]
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
    content.push(node.value)
  }
  return success(content)
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

function readBlock(block: Block, reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  switch (block.kind) {
    case 'blockquote':
      return reading.flavour === 'portable' ? reading.blocks.quote(block.blocks, reading, path, depth) : containerNode({ type: 'blockquote' }, block.blocks, reading, path, depth)
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
  if (!readable.value) return built
  const spelling = spellingToWrite(built.value)
  return failure('unsupported-node-shape', `${built.value.type} takes the CommonMark spelling, not the directive form${spelling === undefined ? '' : `: write ${spelling}`}`, path)
}

function spellingToWrite(node: AdfNode): string | undefined {
  if (node.type !== 'orderedList') return commonMarkSpellings.get(node.type)
  const order = String(nodeAttrs(node)['order'])
  return `each item behind its number, counting up from \`${order}. \`, or from \`${order}) \` where the list right before it takes \`.\``
}

// One entry per node `commonMarkSpelling` spells in the lossless flavour, kept here because this refusal is its only reader; a node missing here is refused naming no spelling.
const commonMarkSpellings: ReadonlyMap<string, string> = new Map([
  ['blockquote', 'each line behind `> `'],
  ['bulletList', 'each item behind `- `, or behind `* ` where the list right before it takes `- `'],
  ['codeBlock', 'its text in a fence of more backticks than any run it holds, its language after the opening fence'],
  ['heading', 'one `#` per level before its text, `## Title` at level 2'],
  ['mediaSingle', '`![alt](url)`, or `[![alt](url)](href)` when linked'],
  ['paragraph', 'its text alone'],
  ['rule', '`---`'],
  ['table', 'a pipe table'],
])

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
  return positioned(contentNode(node, only.text, reading, path, 'paragraph'), only.position)
}

export function containerNode(node: AdfNode, blocks: readonly Block[], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content = readBlocks(blocks, reading, path, depth + 1)
  if (!content.ok) return content
  return success(withContent(node, content.value))
}

function withContent(node: AdfNode, content: readonly AdfNode[]): AdfNode {
  return content.length === 0 ? node : { ...node, content: [...content] }
}

export function listNode(node: AdfNode, items: readonly Block[][], reading: Reading, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content: AdfNode[] = []
  for (const [index, blocks] of items.entries()) {
    const item = containerNode({ type: 'listItem' }, blocks, reading, [...path, 'content', index], depth)
    if (!item.ok) return item
    content.push(item.value)
  }
  return success({ ...node, content })
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
  const content = parseInlineContent(text, reading.definitions, path, 'paragraph', reading.flavour)
  if (!content.ok) return content
  const image = content.value.image
  return success(image === undefined ? withContent({ type: 'paragraph' }, content.value.nodes) : image)
}

export function contentNode(node: AdfNode, text: string, reading: Reading, path: ConvertErrorPath, container: LineContainer): Result<AdfNode> {
  const content = parseInlineContent(text, reading.definitions, path, container, reading.flavour)
  if (!content.ok) return content
  return success(withContent(node, content.value.nodes))
}

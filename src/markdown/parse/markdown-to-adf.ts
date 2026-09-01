import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block, DirectiveBlock } from './blocks.ts'
import type { LinkDefinitions } from './inline-content.ts'
import { carryName } from '../opaque-carry.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { parseBlocks } from './blocks.ts'
import { parseInlineContent } from './inline-content.ts'
import { readBlockDirectiveNode } from './directive-nodes.ts'

export function markdownToAdf(markdown: string): Result<AdfDocument> {
  const parsed = parseBlocks(markdown)
  const content = blockNodes(parsed.blocks, parsed.definitions, [], 0)
  if (!content.ok) return content
  return success(content.value.length === 0 ? { type: 'doc', version: 1 } : { content: content.value, type: 'doc', version: 1 })
}

function blockNodes(blocks: readonly Block[], definitions: LinkDefinitions, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the input nests deeper than the ${largestNesting} levels the parser carries`, path)
  const content: AdfNode[] = []
  for (const [index, block] of blocks.entries()) {
    const node = blockNode(block, definitions, [...path, 'content', index], depth)
    if (!node.ok) return node
    content.push(node.value)
  }
  return success(content)
}

function blockNode(block: Block, definitions: LinkDefinitions, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  switch (block.kind) {
    case 'blockquote':
      return containerNode({ type: 'blockquote' }, block.blocks, definitions, path, depth)
    case 'bulletList':
      return listNode({ type: 'bulletList' }, block.items, definitions, path, depth)
    case 'code':
      return codeBlockNode(block.language, block.text, path)
    case 'directive':
      return directiveNode(block, definitions, path, depth)
    case 'fault':
      return faulted(block.fault, path)
    case 'heading':
      return contentNode({ attrs: { level: block.level }, type: 'heading' }, block.text, definitions, path)
    case 'html':
      return failure('unmappable-html', `no ADF node carries ${block.construct}`, path)
    case 'orderedList':
      return listNode({ attrs: { order: block.start }, type: 'orderedList' }, block.items, definitions, path, depth)
    case 'paragraph':
      return paragraphNode(block.text, definitions, path)
    case 'rule':
      return success({ type: 'rule' })
  }
}

function directiveNode(block: DirectiveBlock, definitions: LinkDefinitions, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const read = readBlockDirectiveNode(block.name, block.argument, block.attributes, path)
  if (!read.ok) return read
  const { contentModel, node } = read.value
  const blocks = block.blocks
  if (blocks === undefined) {
    if (contentModel === 'none' || contentModel === 'inline') return success(node)
    return failure('unsupported-node-shape', `a ${node.type} spells its body in the container form :::${node.type}`, path)
  }
  if (contentModel === 'none') return failure('unsupported-node-shape', `a ${node.type} holds no content`, path)
  if (contentModel === 'code') return failure('unsupported-node-shape', `the fenced body of a ${node.type} is unsupported`, path)
  if (contentModel === 'block') return containerNode(node, blocks, definitions, path, depth)
  return inlineBodyNode(node, blocks, definitions, path)
}

function inlineBodyNode(node: AdfNode, blocks: readonly Block[], definitions: LinkDefinitions, path: ConvertErrorPath): Result<AdfNode> {
  if (blocks.length === 0) return failure('unsupported-node-shape', `an empty ${node.type} is the leaf form ::${node.type}`, path)
  const only = blocks.length === 1 ? blocks[0] : undefined
  if (only?.kind !== 'paragraph') return failure('unsupported-node-shape', `a ${node.type} takes one paragraph as its body`, path)
  return contentNode(node, only.text, definitions, path)
}

function containerNode(node: AdfNode, blocks: readonly Block[], definitions: LinkDefinitions, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content = blockNodes(blocks, definitions, path, depth + 1)
  if (!content.ok) return content
  return success(withContent(node, content.value))
}

function withContent(node: AdfNode, content: readonly AdfNode[]): AdfNode {
  return content.length === 0 ? node : { ...node, content: [...content] }
}

function listNode(node: AdfNode, items: readonly Block[][], definitions: LinkDefinitions, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content: AdfNode[] = []
  for (const [index, blocks] of items.entries()) {
    const item = containerNode({ type: 'listItem' }, blocks, definitions, [...path, 'content', index], depth)
    if (!item.ok) return item
    content.push(item.value)
  }
  return success({ ...node, content })
}

function codeBlockNode(language: string, text: string, path: ConvertErrorPath): Result<AdfNode> {
  if (language === carryName) return failure('malformed-directive', `the info string ${carryName} is reserved for the opaque carry`, path)
  const node: AdfNode = language === '' ? { type: 'codeBlock' } : { attrs: { language }, type: 'codeBlock' }
  return success(text === '' ? node : { ...node, content: [{ text, type: 'text' }] })
}

// spec/flavour.md, The CommonMark image: only a plain paragraph gives an image the block it needs.
function paragraphNode(text: string, definitions: LinkDefinitions, path: ConvertErrorPath): Result<AdfNode> {
  const content = parseInlineContent(text, definitions, path)
  if (!content.ok) return content
  const image = content.value.image
  return success(image === undefined ? withContent({ type: 'paragraph' }, content.value.nodes) : image)
}

function contentNode(node: AdfNode, text: string, definitions: LinkDefinitions, path: ConvertErrorPath): Result<AdfNode> {
  const content = parseInlineContent(text, definitions, path)
  if (!content.ok) return content
  if (content.value.image !== undefined) return failure('unmappable-image', `no ADF node carries an image inside a ${node.type}`, path)
  return success(withContent(node, content.value.nodes))
}

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block } from './blocks.ts'
import type { LinkDefinitions } from './inline-content.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { parseBlocks } from './blocks.ts'
import { parseInlineContent } from './inline-content.ts'
import { unknownDirectiveFault } from '../directive-syntax.ts'

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
      return success(codeBlockNode(block.language, block.text))
    case 'directive':
      return faulted(unknownDirectiveFault(block.name), path)
    case 'fault':
      return faulted(block.fault, path)
    case 'heading':
      return contentNode({ attrs: { level: block.level }, type: 'heading' }, block.text, definitions, path)
    case 'html':
      return failure('unmappable-html', `no ADF node carries ${block.construct}`, path)
    case 'orderedList':
      return listNode({ attrs: { order: block.start }, type: 'orderedList' }, block.items, definitions, path, depth)
    case 'paragraph':
      return contentNode({ type: 'paragraph' }, block.text, definitions, path)
    case 'rule':
      return success({ type: 'rule' })
  }
}

function containerNode(node: AdfNode, blocks: readonly Block[], definitions: LinkDefinitions, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content = blockNodes(blocks, definitions, path, depth + 1)
  if (!content.ok) return content
  return success(content.value.length === 0 ? node : { ...node, content: content.value })
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

function codeBlockNode(language: string, text: string): AdfNode {
  const node: AdfNode = language === '' ? { type: 'codeBlock' } : { attrs: { language }, type: 'codeBlock' }
  return text === '' ? node : { ...node, content: [{ text, type: 'text' }] }
}

// spec/flavour.md, The CommonMark image: only a paragraph gives an image the block it needs.
function contentNode(node: AdfNode, text: string, definitions: LinkDefinitions, path: ConvertErrorPath): Result<AdfNode> {
  const content = parseInlineContent(text, definitions, path)
  if (!content.ok) return content
  const image = content.value.image
  if (image !== undefined) {
    return node.type === 'paragraph' ? success(image) : failure('unmappable-image', `no ADF node carries an image inside a ${node.type}`, path)
  }
  return success(content.value.nodes.length === 0 ? node : { ...node, content: content.value.nodes })
}

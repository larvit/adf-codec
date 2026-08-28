import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Block, ClaimedConstruct } from './blocks.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { parseBlocks } from './blocks.ts'
import { trimSpace } from '../commonmark-grammar.ts'

export function markdownToAdf(markdown: string): Result<AdfDocument> {
  const content = blockNodes(parseBlocks(markdown).blocks, [], 0)
  if (!content.ok) return content
  return success(content.value.length === 0 ? { type: 'doc', version: 1 } : { content: content.value, type: 'doc', version: 1 })
}

function blockNodes(blocks: readonly Block[], path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the input nests deeper than the ${largestNesting} levels the parser carries`, path)
  const content: AdfNode[] = []
  for (const [index, block] of blocks.entries()) {
    const node = blockNode(block, [...path, 'content', index], depth)
    if (!node.ok) return node
    content.push(node.value)
  }
  return success(content)
}

function blockNode(block: Block, path: ConvertErrorPath, depth: number): Result<AdfNode> {
  if (block.kind === 'blockquote') return containerNode({ type: 'blockquote' }, block.blocks, path, depth)
  if (block.kind === 'bulletList') return listNode({ type: 'bulletList' }, block.items, path, depth)
  if (block.kind === 'claim') return claimFailure(block.construct, path)
  if (block.kind === 'code') return success(codeBlockNode(block.language, block.text))
  if (block.kind === 'heading') return success(withContent({ attrs: { level: block.level }, type: 'heading' }, block.text))
  if (block.kind === 'html') return failure('unmappable-html', `no ADF node carries ${block.construct}`, path)
  if (block.kind === 'orderedList') return listNode({ attrs: { order: block.start }, type: 'orderedList' }, block.items, path, depth)
  if (block.kind === 'paragraph') return success(withContent({ type: 'paragraph' }, block.text))
  return success({ type: 'rule' })
}

function containerNode(node: AdfNode, blocks: readonly Block[], path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content = blockNodes(blocks, path, depth + 1)
  if (!content.ok) return content
  return success(content.value.length === 0 ? node : { ...node, content: content.value })
}

function listNode(node: AdfNode, items: readonly Block[][], path: ConvertErrorPath, depth: number): Result<AdfNode> {
  const content: AdfNode[] = []
  for (const [index, blocks] of items.entries()) {
    const item = containerNode({ type: 'listItem' }, blocks, [...path, 'content', index], depth)
    if (!item.ok) return item
    content.push(item.value)
  }
  return success({ ...node, content })
}

function claimFailure(construct: ClaimedConstruct, path: ConvertErrorPath): Result<AdfNode> {
  if (construct === 'directive') return failure('malformed-directive', 'the line claims a directive and parses as none', path)
  return failure('malformed-pipe-table', 'the line claims a pipe table and parses as none', path)
}

function codeBlockNode(language: string, text: string): AdfNode {
  const node: AdfNode = language === '' ? { type: 'codeBlock' } : { attrs: { language }, type: 'codeBlock' }
  return text === '' ? node : { ...node, content: [{ text, type: 'text' }] }
}

function withContent(node: AdfNode, text: string): AdfNode {
  const content = inlineContent(text)
  return content.length === 0 ? node : { ...node, content }
}

function inlineContent(text: string): AdfNode[] {
  const line = text
    .split('\n')
    .map((part) => trimSpace(part))
    .join(' ')
  return line === '' ? [] : [{ text: line, type: 'text' }]
}

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { ClaimedConstruct, LeafBlock } from './blocks.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { parseBlocks } from './blocks.ts'
import { trimSpace } from '../commonmark-grammar.ts'

export function markdownToAdf(markdown: string): Result<AdfDocument> {
  const content: AdfNode[] = []
  for (const [index, block] of parseBlocks(markdown).blocks.entries()) {
    const node = blockNode(block, ['content', index])
    if (!node.ok) return node
    content.push(node.value)
  }
  return success(content.length === 0 ? { type: 'doc', version: 1 } : { content, type: 'doc', version: 1 })
}

function blockNode(block: LeafBlock, path: ConvertErrorPath): Result<AdfNode> {
  if (block.kind === 'claim') return claimFailure(block.construct, path)
  if (block.kind === 'code') return success(codeBlockNode(block.language, block.text))
  if (block.kind === 'heading') return success(withContent({ attrs: { level: block.level }, type: 'heading' }, block.text))
  if (block.kind === 'html') return failure('unmappable-html', `no ADF node carries ${block.construct}`, path)
  if (block.kind === 'paragraph') return success(withContent({ type: 'paragraph' }, block.text))
  return success({ type: 'rule' })
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

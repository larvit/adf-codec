import type { AdfDocument, AdfNode } from './adf-document.ts'
import { emitInlineLine } from './markdown-inline.ts'
import { failure, success, type Result } from './result.ts'
import { isAdfDocument } from './adf-document.ts'
import { longestBacktickRun } from './backtick-runs.ts'

const listTypes = ['bulletList', 'orderedList']

export function adfToMarkdown(document: AdfDocument): Result<string> {
  if (!isAdfDocument(document)) return failure('not-an-adf-document', 'the value is not an ADF document')
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`)
  const blocks = emitBlocks(document.content ?? [], false)
  if (!blocks.ok) return blocks
  return success(blocks.value === '' ? '' : `${blocks.value}\n`)
}

function emitBlocks(nodes: readonly AdfNode[], inListItem: boolean): Result<string> {
  let output = ''
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index]
    if (node === undefined) return failure('unsupported-node-shape', 'the block content holds a hole')
    const previous = nodes[index - 1]
    if (previous !== undefined) {
      if (listTypes.includes(node.type) && previous.type === node.type) {
        return failure('unspellable-adjacent-lists', `two adjacent ${node.type} nodes read back as one list`)
      }
      output += inListItem && listTypes.includes(node.type) ? '\n' : '\n\n'
    }
    const block = emitBlock(node)
    if (!block.ok) return block
    output += block.value
  }
  return success(output)
}

function emitBlock(node: AdfNode): Result<string> {
  if (node.type === 'blockquote') return emitBlockquote(node)
  if (node.type === 'bulletList' || node.type === 'orderedList') return emitList(node)
  if (node.type === 'codeBlock') return emitCodeBlock(node)
  if (node.type === 'heading') return emitHeading(node)
  if (node.type === 'paragraph') return emitParagraph(node)
  if (node.type === 'rule') return emitRule(node)
  if (node.type === 'hardBreak' || node.type === 'listItem' || node.type === 'text') {
    return failure('unsupported-node-shape', `a ${node.type} node cannot stand where a block belongs`)
  }
  return failure('unsupported-node-type', `the canonical form spells no block node of type ${node.type}`)
}

function emitBlockquote(node: AdfNode): Result<string> {
  const invalid = validateBlockNode(node, [])
  if (!invalid.ok) return invalid
  const inner = emitBlocks(node.content ?? [], false)
  if (!inner.ok) return inner
  return success(
    inner.value
      .split('\n')
      .map((line) => (line === '' ? '>' : `> ${line}`))
      .join('\n'),
  )
}

function emitCodeBlock(node: AdfNode): Result<string> {
  const invalid = validateBlockNode(node, ['language'])
  if (!invalid.ok) return invalid
  const language = node.attrs?.['language']
  if (language !== undefined) {
    if (typeof language !== 'string') return failure('unsupported-node-shape', 'a codeBlock language is no string')
    if (language === '') return failure('ambiguous-empty-code-block-language', 'an empty codeBlock language and an absent one share one markdown spelling')
    if (language === 'adf') return failure('reserved-adf-language', 'the adf info string is reserved for the opaque carry')
    if (/[`\n\r]/.test(language) || language !== language.trim()) {
      return failure('unspellable-code-block-language', 'a fence info string holds no backtick and no edge whitespace')
    }
  }
  let text = ''
  for (const child of node.content ?? []) {
    if (child.type !== 'text' || typeof child.text !== 'string' || (child.marks ?? []).length > 0 || Object.keys(child.attrs ?? {}).length > 0) {
      return failure('unsupported-node-shape', 'a codeBlock holds plain text nodes only')
    }
    text += child.text
  }
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1))
  const opening = `${fence}${language ?? ''}`
  return success(text === '' ? `${opening}\n${fence}` : `${opening}\n${text}\n${fence}`)
}

function emitHeading(node: AdfNode): Result<string> {
  const invalid = validateBlockNode(node, ['level'])
  if (!invalid.ok) return invalid
  const level = node.attrs?.['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) {
    return failure('unsupported-heading-level', `no ATX heading spells level ${JSON.stringify(level ?? null)}`)
  }
  const hashes = '#'.repeat(level)
  const content = node.content ?? []
  if (content.length === 0) return success(hashes)
  const line = emitInlineLine(content, 'heading')
  if (!line.ok) return line
  return success(`${hashes} ${line.value}`)
}

function emitList(node: AdfNode): Result<string> {
  const ordered = node.type === 'orderedList'
  const invalid = validateBlockNode(node, ordered ? ['order'] : [])
  if (!invalid.ok) return invalid
  const start = ordered ? node.attrs?.['order'] : 0
  if (ordered && (start === undefined || start === 1)) {
    return failure('ambiguous-ordered-list-start', 'an orderedList starting at 1 and one with no order share one markdown spelling')
  }
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > 999999999) {
    return failure('unsupported-node-shape', `no list marker spells the order ${JSON.stringify(start ?? null)}`)
  }
  const items: string[] = []
  for (const [offset, item] of (node.content ?? []).entries()) {
    if (item.type !== 'listItem') return failure('unsupported-node-shape', `a ${node.type} holds listItem nodes only`)
    const invalidItem = validateBlockNode(item, [])
    if (!invalidItem.ok) return invalidItem
    const inner = emitBlocks(item.content ?? [], true)
    if (!inner.ok) return inner
    const marker = ordered ? `${start + offset}. ` : '- '
    if (inner.value === '') {
      items.push(marker.trimEnd())
      continue
    }
    const indent = ' '.repeat(marker.length)
    items.push(
      inner.value
        .split('\n')
        .map((line, lineIndex) => (lineIndex === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
        .join('\n'),
    )
  }
  return success(items.join('\n'))
}

function emitParagraph(node: AdfNode): Result<string> {
  const invalid = validateBlockNode(node, [])
  if (!invalid.ok) return invalid
  const content = node.content ?? []
  if (content.length === 0) return success('::paragraph')
  return emitInlineLine(content, 'paragraph')
}

function emitRule(node: AdfNode): Result<string> {
  const invalid = validateBlockNode(node, [])
  if (!invalid.ok) return invalid
  if ((node.content ?? []).length > 0) return failure('unsupported-node-shape', 'a rule holds no content')
  return success('---')
}

function validateBlockNode(node: AdfNode, spelled: readonly string[]): Result<null> {
  if ((node.marks ?? []).length > 0) {
    return failure('unspelled-block-marks', `the canonical form has no place for the marks a ${node.type} carries`)
  }
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text`)
  const unspelled = Object.keys(node.attrs ?? {}).find((key) => !spelled.includes(key))
  if (unspelled !== undefined) {
    return failure('unspelled-node-attribute', `the ${node.type} attribute ${unspelled} has no canonical markdown spelling`)
  }
  return success(null)
}

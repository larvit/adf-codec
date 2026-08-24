import type { AdfDocument, AdfNode } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { emitInlineLine } from './markdown-inline.ts'
import { failure, success, type Result } from './result.ts'
import { isAdfDocument } from './adf-document.ts'
import { longestBacktickRun } from './backtick-runs.ts'

const largestListMarker = 999999999
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
  let previous: AdfNode | undefined
  for (const node of nodes) {
    if (previous !== undefined) {
      if (listTypes.includes(node.type) && previous.type === node.type) {
        return failure('unspellable-adjacent-lists', `two adjacent ${node.type} nodes read back as one list`)
      }
      output += inListItem && listTypes.includes(node.type) ? '\n' : '\n\n'
    }
    const block = emitBlock(node)
    if (!block.ok) return block
    output += block.value
    previous = node
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
  const validation = validateBlockNode(node, [])
  if (!validation.ok) return validation
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
  const validation = validateBlockNode(node, ['language'])
  if (!validation.ok) return validation
  const info = spellCodeFenceInfo(node.attrs?.['language'])
  if (!info.ok) return info
  let text = ''
  for (const child of node.content ?? []) {
    if (child.type !== 'text' || typeof child.text !== 'string' || (child.marks ?? []).length > 0 || Object.keys(child.attrs ?? {}).length > 0) {
      return failure('unsupported-node-shape', 'a codeBlock holds plain text nodes only')
    }
    text += child.text
  }
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1))
  const opening = `${fence}${info.value}`
  return success(text === '' ? `${opening}\n${fence}` : `${opening}\n${text}\n${fence}`)
}

function spellCodeFenceInfo(language: JsonValue | undefined): Result<string> {
  if (language === undefined) return success('')
  if (typeof language !== 'string') return failure('unsupported-node-shape', 'a codeBlock language is no string')
  if (language === '') return failure('ambiguous-empty-code-block-language', 'an empty codeBlock language and an absent one share one markdown spelling')
  if (language === 'adf') return failure('reserved-adf-language', 'the adf info string is reserved for the opaque carry')
  if (/[`\n\r]/.test(language) || language !== language.trim()) {
    return failure('unspellable-code-block-language', 'a fence info string holds no backtick and no edge whitespace')
  }
  return success(language)
}

function emitHeading(node: AdfNode): Result<string> {
  const validation = validateBlockNode(node, ['level'])
  if (!validation.ok) return validation
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
  const validation = validateBlockNode(node, ordered ? ['order'] : [])
  if (!validation.ok) return validation
  const items = node.content ?? []
  if (items.length === 0) return failure('unsupported-node-shape', `a ${node.type} holds at least one listItem`)
  const start = ordered ? node.attrs?.['order'] : 0
  if (ordered && (start === undefined || start === 1)) {
    return failure('ambiguous-ordered-list-start', 'an orderedList starting at 1 and one with no order share one markdown spelling')
  }
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > largestListMarker) {
    return failure('unsupported-node-shape', `no list marker spells the order ${JSON.stringify(start ?? null)}`)
  }
  if (start + items.length - 1 > largestListMarker) {
    return failure('unspellable-list-marker', `no list marker spells the ${items.length} items an orderedList starting at ${start} needs`)
  }
  const lines: string[] = []
  for (const [offset, item] of items.entries()) {
    if (item.type !== 'listItem') return failure('unsupported-node-shape', `a ${node.type} holds listItem nodes only`)
    const emitted = emitListItem(item, ordered ? `${start + offset}. ` : '- ')
    if (!emitted.ok) return emitted
    lines.push(emitted.value)
  }
  return success(lines.join('\n'))
}

function emitListItem(item: AdfNode, marker: string): Result<string> {
  const validation = validateBlockNode(item, [])
  if (!validation.ok) return validation
  const inner = emitBlocks(item.content ?? [], true)
  if (!inner.ok) return inner
  if (inner.value === '') return success(marker.trimEnd())
  const indent = ' '.repeat(marker.length)
  return success(
    inner.value
      .split('\n')
      .map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
      .join('\n'),
  )
}

function emitParagraph(node: AdfNode): Result<string> {
  const validation = validateBlockNode(node, [])
  if (!validation.ok) return validation
  const content = node.content ?? []
  if (content.length === 0) return success('::paragraph')
  return emitInlineLine(content, 'paragraph')
}

function emitRule(node: AdfNode): Result<string> {
  const validation = validateBlockNode(node, [])
  if (!validation.ok) return validation
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

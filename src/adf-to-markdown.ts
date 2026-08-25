import type { AdfDocument, AdfNode } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { emitInlineLine } from './markdown-inline.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { holdsNullCharacter, isThematicBreak } from './commonmark-grammar.ts'
import { isAdfDocument } from './adf-document.ts'
import { longestBacktickRun } from './backtick-runs.ts'

const largestListMarker = 999999999
const largestNesting = 500
const listTypes = ['bulletList', 'orderedList']

export function adfToMarkdown(document: AdfDocument): Result<string> {
  if (!isAdfDocument(document)) return failure('not-an-adf-document', 'the value is not an ADF document', [])
  if (document.version !== 1) return failure('unsupported-document-version', `no markdown spelling carries ADF version ${document.version}`, [])
  const blocks = emitBlocks(document.content ?? [], false, [], 0)
  if (!blocks.ok) return blocks
  return success(blocks.value === '' ? '' : `${blocks.value}\n`)
}

function emitBlocks(nodes: readonly AdfNode[], inListItem: boolean, path: ConvertErrorPath, depth: number): Result<string> {
  if (depth > largestNesting) return failure('unsupported-node-shape', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
  let output = ''
  let previous: AdfNode | undefined
  for (const [index, node] of nodes.entries()) {
    const nodePath = [...path, 'content', index]
    if (previous !== undefined) {
      if (listTypes.includes(node.type) && previous.type === node.type) {
        return failure('unspellable-adjacent-lists', `two adjacent ${node.type} nodes read back as one list`, nodePath)
      }
      output += inListItem && listTypes.includes(node.type) ? '\n' : '\n\n'
    }
    const block = emitBlock(node, nodePath, depth)
    if (!block.ok) return block
    output += block.value
    previous = node
  }
  return success(output)
}

function emitBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  if (node.type === 'blockquote') return emitBlockquote(node, path, depth)
  if (node.type === 'bulletList' || node.type === 'orderedList') return emitList(node, path, depth)
  if (node.type === 'codeBlock') return emitCodeBlock(node, path)
  if (node.type === 'heading') return emitHeading(node, path)
  if (node.type === 'paragraph') return emitParagraph(node, path)
  if (node.type === 'rule') return emitRule(node, path)
  if (node.type === 'hardBreak' || node.type === 'listItem' || node.type === 'text') {
    return failure('unsupported-node-shape', `a ${node.type} node cannot stand where a block belongs`, path)
  }
  return failure('unsupported-node-type', `the canonical form spells no block node of type ${node.type}`, path)
}

function emitBlockquote(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const validation = validateBlockNode(node, [], path)
  if (!validation.ok) return validation
  const inner = emitBlocks(node.content ?? [], false, path, depth + 1)
  if (!inner.ok) return inner
  return success(
    inner.value
      .split('\n')
      .map((line) => (line === '' ? '>' : `> ${line}`))
      .join('\n'),
  )
}

function emitCodeBlock(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const validation = validateBlockNode(node, ['language'], path)
  if (!validation.ok) return validation
  const info = spellCodeFenceInfo(node.attrs?.['language'], path)
  if (!info.ok) return info
  let text = ''
  for (const [index, child] of (node.content ?? []).entries()) {
    const childPath = [...path, 'content', index]
    if (child.type !== 'text' || typeof child.text !== 'string' || (child.marks ?? []).length > 0 || Object.keys(child.attrs ?? {}).length > 0) {
      return failure('unsupported-node-shape', 'a codeBlock holds plain text nodes only', childPath)
    }
    if (/\r/.test(child.text)) return failure('unspellable-whitespace', 'a codeBlock holds no carriage return CommonMark keeps', childPath)
    if (holdsNullCharacter(child.text)) return failure('unspellable-character', 'a codeBlock holds a null character CommonMark replaces', childPath)
    text += child.text
  }
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1))
  const opening = `${fence}${info.value}`
  return success(text === '' ? `${opening}\n${fence}` : `${opening}\n${text}\n${fence}`)
}

function spellCodeFenceInfo(language: JsonValue | undefined, path: ConvertErrorPath): Result<string> {
  if (language === undefined) return success('')
  if (typeof language !== 'string') return failure('unsupported-node-shape', 'a codeBlock language is no string', path)
  if (language === '') {
    return failure('ambiguous-empty-code-block-language', 'an empty codeBlock language and an absent one share one markdown spelling', path)
  }
  if (language === 'adf') return failure('reserved-adf-language', 'the adf info string is reserved for the opaque carry', path)
  if (/[`\n\r]/.test(language) || language !== language.trim()) {
    return failure('unspellable-code-block-language', 'a fence info string holds no backtick and no edge whitespace', path)
  }
  return success(language)
}

function emitHeading(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const validation = validateBlockNode(node, ['level'], path)
  if (!validation.ok) return validation
  const level = node.attrs?.['level']
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 6) {
    return failure('unsupported-heading-level', `no ATX heading spells level ${JSON.stringify(level ?? null)}`, path)
  }
  const hashes = '#'.repeat(level)
  const content = node.content ?? []
  if (content.length === 0) return success(hashes)
  const line = emitInlineLine(content, 'heading', path)
  if (!line.ok) return line
  return success(`${hashes} ${line.value}`)
}

function emitList(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const ordered = node.type === 'orderedList'
  const validation = validateBlockNode(node, ordered ? ['order'] : [], path)
  if (!validation.ok) return validation
  const items = node.content ?? []
  if (items.length === 0) return failure('unsupported-node-shape', `a ${node.type} holds at least one listItem`, path)
  const start = ordered ? node.attrs?.['order'] : 0
  if (ordered && (start === undefined || start === 1)) {
    return failure('ambiguous-ordered-list-start', 'an orderedList starting at 1 and one with no order share one markdown spelling', path)
  }
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0 || start > largestListMarker) {
    return failure('unsupported-node-shape', `no list marker spells the order ${JSON.stringify(start ?? null)}`, path)
  }
  if (start + items.length - 1 > largestListMarker) {
    return failure('unspellable-list-marker', `no list marker spells the ${items.length} items a list starting at ${start} needs`, path)
  }
  const lines: string[] = []
  for (const [offset, item] of items.entries()) {
    const itemPath = [...path, 'content', offset]
    if (item.type !== 'listItem') return failure('unsupported-node-shape', `a ${node.type} holds listItem nodes only`, itemPath)
    const emitted = emitListItem(item, ordered ? `${start + offset}. ` : '- ', itemPath, depth)
    if (!emitted.ok) return emitted
    lines.push(emitted.value)
  }
  return success(lines.join('\n'))
}

function emitListItem(item: AdfNode, marker: string, path: ConvertErrorPath, depth: number): Result<string> {
  const validation = validateBlockNode(item, [], path)
  if (!validation.ok) return validation
  const inner = emitBlocks(item.content ?? [], true, path, depth + 1)
  if (!inner.ok) return inner
  if (inner.value === '') return success(marker.trimEnd())
  const indent = ' '.repeat(marker.length)
  const lines = inner.value.split('\n').map((line, index) => (index === 0 ? `${marker}${line}` : line === '' ? '' : `${indent}${line}`))
  const first = lines[0] ?? ''
  if (isThematicBreak(first)) {
    return failure('unspellable-line-start', `block parsing would claim the emitted line ${JSON.stringify(first)}`, path)
  }
  return success(lines.join('\n'))
}

function emitParagraph(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const validation = validateBlockNode(node, [], path)
  if (!validation.ok) return validation
  const content = node.content ?? []
  if (content.length === 0) return success('::paragraph')
  return emitInlineLine(content, 'paragraph', path)
}

function emitRule(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const validation = validateBlockNode(node, [], path)
  if (!validation.ok) return validation
  if ((node.content ?? []).length > 0) return failure('unsupported-node-shape', 'a rule holds no content', path)
  return success('---')
}

function validateBlockNode(node: AdfNode, spelled: readonly string[], path: ConvertErrorPath): Result<null> {
  if ((node.marks ?? []).length > 0) {
    return failure('unspelled-block-marks', `the canonical form has no place for the marks a ${node.type} carries`, path)
  }
  if (node.text !== undefined) return failure('unsupported-node-shape', `a ${node.type} carries no text`, path)
  const unspelled = Object.keys(node.attrs ?? {}).find((key) => !spelled.includes(key))
  if (unspelled !== undefined) {
    return failure('unspelled-node-attribute', `the ${node.type} attribute ${unspelled} has no canonical markdown spelling`, path)
  }
  return success(null)
}

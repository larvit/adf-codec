import type { LinkDefinition } from './link-reference-definitions.ts'
import type { OpenHtmlBlock } from './html-blocks.ts'
import { atxHeading, claimsDirectiveLine, claimsPipeLine, closingCodeFence, isThematicBreak, openingCodeFence, setextHeadingLevel } from '../commonmark-grammar.ts'
import { failure, success, type Result } from '../../result.ts'
import { openingHtmlBlock } from './html-blocks.ts'
import { readLinkDefinitions } from './link-reference-definitions.ts'

export type LeafBlock =
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'html'; name: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'rule' }

export type ParsedBlocks = { blocks: LeafBlock[]; definitions: Map<string, LinkDefinition> }

type Walk = ParsedBlocks & { paragraph: string[] }

const blankLine = /^[ \t]*$/
const indentedCodeColumns = 4
const largestOpenerIndentation = 3
const tabStop = 4

export function parseBlocks(markdown: string): Result<ParsedBlocks> {
  const lines = normalizeInput(markdown).split('\n')
  const walk: Walk = { blocks: [], definitions: new Map(), paragraph: [] }
  let index = 0
  while (index < lines.length) {
    const line = lines[index] ?? ''
    index += 1
    if (blankLine.test(line)) {
      closeParagraph(walk)
      continue
    }
    if (leadingColumns(line) >= indentedCodeColumns && walk.paragraph.length === 0) {
      index = readIndentedCode(walk, lines, index - 1)
      continue
    }
    const opener = removeColumns(line, largestOpenerIndentation)
    const claim = claimedLine(walk, opener)
    if (claim !== undefined) return claim
    if (readLineBlock(walk, opener)) continue
    const fence = openingCodeFence(opener)
    if (fence !== undefined) {
      closeParagraph(walk)
      index = readFencedCode(walk, lines, index, fence, leadingColumns(line))
      continue
    }
    const html = openingHtmlBlock(opener, walk.paragraph.length > 0)
    if (html !== undefined) {
      closeParagraph(walk)
      index = readHtmlBlock(walk, lines, index - 1, html)
      continue
    }
    walk.paragraph.push(line.replace(/^[ \t]+/, ''))
  }
  closeParagraph(walk)
  return success({ blocks: walk.blocks, definitions: walk.definitions })
}

// The document's last line ending closes its line rather than opening an empty one.
function normalizeInput(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u0000', '\ufffd')
    .replace(/\n$/, '')
}

function claimedLine(walk: Walk, opener: string): Result<ParsedBlocks> | undefined {
  const directive = claimsDirectiveLine(opener)
  if (!directive && !claimsPipeLine(opener)) return undefined
  closeParagraph(walk)
  const path = ['content', walk.blocks.length]
  if (directive) return failure('malformed-directive', 'the line claims a directive and parses as none', path)
  return failure('malformed-pipe-table', 'the line claims a pipe table and parses as none', path)
}

// A setext underline over a paragraph the definitions emptied is no heading: it opens the next block.
function readLineBlock(walk: Walk, opener: string): boolean {
  const level = walk.paragraph.length === 0 ? undefined : setextHeadingLevel(opener)
  if (level !== undefined) {
    const text = takeParagraph(walk)
    if (text !== undefined) {
      walk.blocks.push({ kind: 'heading', level, text })
      return true
    }
  }
  if (isThematicBreak(opener)) {
    closeParagraph(walk)
    walk.blocks.push({ kind: 'rule' })
    return true
  }
  const heading = atxHeading(opener)
  if (heading === undefined) return false
  closeParagraph(walk)
  walk.blocks.push({ kind: 'heading', level: heading.level, text: heading.text })
  return true
}

function readFencedCode(walk: Walk, lines: readonly string[], start: number, fence: { info: string; marker: string }, indentation: number): number {
  const collected: string[] = []
  let index = start
  while (index < lines.length) {
    const line = lines[index] ?? ''
    index += 1
    if (closingCodeFence(removeColumns(line, largestOpenerIndentation), fence.marker)) break
    collected.push(removeColumns(line, indentation))
  }
  walk.blocks.push({ kind: 'code', language: fence.info, text: collected.join('\n') })
  return index
}

function readIndentedCode(walk: Walk, lines: readonly string[], start: number): number {
  const collected: string[] = []
  const held: string[] = []
  let index = start
  let end = start
  while (index < lines.length) {
    const line = lines[index] ?? ''
    index += 1
    if (blankLine.test(line)) {
      held.push(removeColumns(line, indentedCodeColumns))
      continue
    }
    if (leadingColumns(line) < indentedCodeColumns) break
    collected.push(...held, removeColumns(line, indentedCodeColumns))
    held.length = 0
    end = index
  }
  walk.blocks.push({ kind: 'code', language: '', text: collected.join('\n') })
  return end
}

function readHtmlBlock(walk: Walk, lines: readonly string[], start: number, html: OpenHtmlBlock): number {
  let index = start
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (html.closer === undefined && blankLine.test(line)) break
    index += 1
    if (html.closer !== undefined && html.closer.test(line)) break
  }
  walk.blocks.push({ kind: 'html', name: html.name })
  return index
}

function closeParagraph(walk: Walk): void {
  const text = takeParagraph(walk)
  if (text !== undefined) walk.blocks.push({ kind: 'paragraph', text })
}

function takeParagraph(walk: Walk): string | undefined {
  const text = readLinkDefinitions(walk.definitions, walk.paragraph.join('\n'))
  walk.paragraph = []
  return text === '' ? undefined : text
}

function leadingColumns(line: string): number {
  let columns = 0
  for (const character of line) {
    if (character === ' ') columns += 1
    else if (character === '\t') columns += tabStop - (columns % tabStop)
    else break
  }
  return columns
}

// CommonMark's tab stops: a tab the cut splits gives the columns it holds past the cut back as spaces.
function removeColumns(line: string, columns: number): string {
  let removed = 0
  let index = 0
  while (removed < columns && index < line.length) {
    const character = line.charAt(index)
    if (character !== ' ' && character !== '\t') break
    const width = character === ' ' ? 1 : tabStop - (removed % tabStop)
    index += 1
    if (removed + width > columns) return ' '.repeat(removed + width - columns) + line.slice(index)
    removed += width
  }
  return line.slice(index)
}

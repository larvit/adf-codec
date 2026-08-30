import type { LinkDefinition } from './link-reference-definitions.ts'
import {
  atxHeading,
  claimsDirectiveLine,
  claimsPipeLine,
  closingCodeFence,
  isThematicBreak,
  markerInterruptsParagraph,
  openingCodeFence,
  setextHeadingLevel,
} from '../commonmark-grammar.ts'
import { openingHtmlBlock } from './html-blocks.ts'
import { readLinkDefinitions } from './link-reference-definitions.ts'

export type ClaimedConstruct = 'directive' | 'pipe-table'

export type Block =
  | { blocks: Block[]; kind: 'blockquote' }
  | { construct: ClaimedConstruct; kind: 'claim' }
  | { construct: string; kind: 'html' }
  | { items: Block[][]; kind: 'bulletList' }
  | { items: Block[][]; kind: 'orderedList'; start: number }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'rule' }

export type ParsedBlocks = { blocks: Block[]; definitions: Map<string, LinkDefinition> }

type ListBlock = Extract<Block, { items: Block[][] }>

type OpenContainer = Extract<Block, { kind: 'blockquote' }> | { blocks: Block[]; indentation: number; kind: 'item'; list: ListBlock; marker: string }

type OpenLeaf =
  | { closer: RegExp | undefined; construct: string; kind: 'html' }
  | { held: string[]; kind: 'indented-code'; lines: string[] }
  | { indentation: number; info: string; kind: 'fenced-code'; lines: string[]; marker: string }
  | { kind: 'paragraph'; lines: string[] }

type ContainerStart = { kind: 'blockquote'; rest: string } | { fresh: boolean; indentation: number; kind: 'item'; list: ListBlock; marker: string; rest: string }

type ItemMarker = { list: ListBlock; marker: string; width: number }

type Walk = ParsedBlocks & { leaf: OpenLeaf | undefined; stack: OpenContainer[] }

const blankLine = /^[ \t]*$/
const bulletMarker = /^[-*+](?=[ \t]|$)/
const orderedMarker = /^(\d{1,9})([.)])(?=[ \t]|$)/
const indentedCodeColumns = 4
const largestOpenerIndentation = 3
const tabStop = 4

export function parseBlocks(markdown: string): ParsedBlocks {
  const walk: Walk = { blocks: [], definitions: new Map(), leaf: undefined, stack: [] }
  for (const line of normalizeInput(markdown).split('\n')) readLine(walk, line)
  closeLeaf(walk)
  return { blocks: walk.blocks, definitions: walk.definitions }
}

function readLine(walk: Walk, line: string): void {
  const matched = matchContainers(walk, line)
  const paragraphOpen = matched.depth === walk.stack.length && walk.leaf?.kind === 'paragraph'
  const opened = openContainers(walk, matched.rest, paragraphOpen, matched.depth)
  if (!opened.opened && matched.depth < walk.stack.length) {
    if (continuesLazily(walk, opened.rest)) {
      appendParagraph(walk, opened.rest)
      return
    }
    closeContainers(walk, matched.depth)
  }
  readBlockLine(walk, opened.rest)
}

function matchContainers(walk: Walk, line: string): { depth: number; rest: string } {
  let depth = 0
  let rest = line
  for (const container of walk.stack) {
    const next = continuesContainer(walk, container, rest)
    if (next === undefined) break
    depth += 1
    rest = next
  }
  return { depth, rest }
}

function continuesContainer(walk: Walk, container: OpenContainer, line: string): string | undefined {
  if (container.kind === 'blockquote') {
    const opener = removeColumns(line, largestOpenerIndentation)
    return opener.startsWith('>') ? removeColumns(opener.slice(1), 1) : undefined
  }
  // A list item begins with at most one blank line: an empty one gives the second up.
  if (blankLine.test(line)) return container.blocks.length === 0 && walk.leaf === undefined ? undefined : ''
  return leadingColumns(line) < container.indentation ? undefined : removeColumns(line, container.indentation)
}

function openContainers(walk: Walk, line: string, paragraphOpen: boolean, depth: number): { opened: boolean; rest: string } {
  const unmatched = walk.stack[depth]
  let opened = false
  let rest = line
  while (leadingColumns(rest) < indentedCodeColumns) {
    const start = containerStart(rest, opened ? false : paragraphOpen, opened ? undefined : unmatched)
    if (start === undefined) break
    if (!opened) closeContainers(walk, depth)
    opened = true
    openContainer(walk, start)
    rest = start.rest
  }
  return { opened, rest }
}

function containerStart(line: string, paragraphOpen: boolean, enclosing: OpenContainer | undefined): ContainerStart | undefined {
  const opener = removeColumns(line, largestOpenerIndentation)
  if (opener.startsWith('>')) return { kind: 'blockquote', rest: removeColumns(opener.slice(1), 1) }
  if (isThematicBreak(opener) || (paragraphOpen && setextHeadingLevel(opener) !== undefined)) return undefined
  return itemStart(line, opener, paragraphOpen, enclosing)
}

function itemStart(line: string, opener: string, paragraphOpen: boolean, enclosing: OpenContainer | undefined): ContainerStart | undefined {
  const marker = itemMarker(opener)
  if (marker === undefined) return undefined
  const after = opener.slice(marker.width)
  const blank = blankLine.test(after)
  if (paragraphOpen && !markerInterruptsParagraph(marker.list.kind === 'orderedList' ? marker.list.start : undefined, blank)) return undefined
  const spaces = leadingColumns(after)
  const padding = blank || spaces > indentedCodeColumns ? 1 : spaces
  const continued = enclosing?.kind === 'item' && enclosing.list.kind === marker.list.kind && enclosing.marker === marker.marker
  return {
    fresh: !continued,
    indentation: leadingColumns(line) + marker.width + padding,
    kind: 'item',
    list: continued ? enclosing.list : marker.list,
    marker: marker.marker,
    rest: blank ? '' : removeColumns(after, padding),
  }
}

function itemMarker(opener: string): ItemMarker | undefined {
  const ordered = orderedMarker.exec(opener)
  if (ordered !== null) {
    const digits = ordered[1] ?? ''
    const delimiter = ordered[2] ?? ''
    return { list: { items: [], kind: 'orderedList', start: Number(digits) }, marker: delimiter, width: digits.length + 1 }
  }
  const bullet = bulletMarker.exec(opener)?.[0]
  return bullet === undefined ? undefined : { list: { items: [], kind: 'bulletList' }, marker: bullet, width: 1 }
}

function openContainer(walk: Walk, start: ContainerStart): void {
  const blocks: Block[] = []
  if (start.kind === 'blockquote') {
    const blockquote: OpenContainer = { blocks, kind: 'blockquote' }
    currentBlocks(walk).push(blockquote)
    walk.stack.push(blockquote)
    return
  }
  if (start.fresh) currentBlocks(walk).push(start.list)
  start.list.items.push(blocks)
  walk.stack.push({ blocks, indentation: start.indentation, kind: 'item', list: start.list, marker: start.marker })
}

function closeContainers(walk: Walk, depth: number): void {
  closeLeaf(walk)
  walk.stack.length = depth
}

// A claimed line ends the lazy continuation CommonMark would fold it into (spec/flavour.md).
function continuesLazily(walk: Walk, line: string): boolean {
  if (walk.leaf?.kind !== 'paragraph' || blankLine.test(line)) return false
  if (leadingColumns(line) >= indentedCodeColumns) return true
  const opener = removeColumns(line, largestOpenerIndentation)
  if (claimedConstruct(opener) !== undefined || isThematicBreak(opener)) return false
  return atxHeading(opener) === undefined && openingCodeFence(opener) === undefined && openingHtmlBlock(opener, false) === undefined
}

function readBlockLine(walk: Walk, line: string): void {
  const leaf = walk.leaf
  if (leaf?.kind === 'fenced-code') {
    if (closingCodeFence(removeColumns(line, largestOpenerIndentation), leaf.marker)) closeLeaf(walk)
    else leaf.lines.push(removeColumns(line, leaf.indentation))
    return
  }
  if (leaf?.kind === 'html') {
    if (leaf.closer === undefined ? blankLine.test(line) : leaf.closer.test(line)) closeLeaf(walk)
    return
  }
  if (leaf?.kind === 'indented-code') {
    if (readIndentedCodeLine(leaf, line)) return
    closeLeaf(walk)
  }
  if (blankLine.test(line)) {
    closeLeaf(walk)
    return
  }
  if (walk.leaf === undefined && leadingColumns(line) >= indentedCodeColumns) {
    walk.leaf = { held: [], kind: 'indented-code', lines: [removeColumns(line, indentedCodeColumns)] }
    return
  }
  openLeaf(walk, line)
}

function readIndentedCodeLine(leaf: Extract<OpenLeaf, { kind: 'indented-code' }>, line: string): boolean {
  if (blankLine.test(line)) {
    leaf.held.push(removeColumns(line, indentedCodeColumns))
    return true
  }
  if (leadingColumns(line) < indentedCodeColumns) return false
  leaf.lines.push(...leaf.held, removeColumns(line, indentedCodeColumns))
  leaf.held.length = 0
  return true
}

function openLeaf(walk: Walk, line: string): void {
  const opener = removeColumns(line, largestOpenerIndentation)
  const claimed = claimedConstruct(opener)
  if (claimed !== undefined) {
    closeLeaf(walk)
    currentBlocks(walk).push({ construct: claimed, kind: 'claim' })
    return
  }
  if (readLineBlock(walk, opener)) return
  const fence = openingCodeFence(opener)
  if (fence !== undefined) {
    closeLeaf(walk)
    walk.leaf = { indentation: leadingColumns(line), info: fence.info, kind: 'fenced-code', lines: [], marker: fence.marker }
    return
  }
  const html = openingHtmlBlock(opener, walk.leaf?.kind === 'paragraph')
  if (html === undefined) {
    appendParagraph(walk, line)
    return
  }
  closeLeaf(walk)
  walk.leaf = { closer: html.closer, construct: html.construct, kind: 'html' }
  if (html.closer?.test(line) === true) closeLeaf(walk)
}

// A setext underline over a paragraph the definitions emptied is no heading: it opens the next block.
function readLineBlock(walk: Walk, opener: string): boolean {
  const level = walk.leaf?.kind === 'paragraph' ? setextHeadingLevel(opener) : undefined
  if (level !== undefined) {
    const text = takeParagraph(walk)
    if (text !== undefined) {
      currentBlocks(walk).push({ kind: 'heading', level, text })
      return true
    }
  }
  if (isThematicBreak(opener)) {
    closeLeaf(walk)
    currentBlocks(walk).push({ kind: 'rule' })
    return true
  }
  const heading = atxHeading(opener)
  if (heading === undefined) return false
  closeLeaf(walk)
  currentBlocks(walk).push({ kind: 'heading', level: heading.level, text: heading.text })
  return true
}

function appendParagraph(walk: Walk, line: string): void {
  const leaf = walk.leaf
  const text = line.replace(/^[ \t]+/, '')
  if (leaf?.kind === 'paragraph') leaf.lines.push(text)
  else walk.leaf = { kind: 'paragraph', lines: [text] }
}

function closeLeaf(walk: Walk): void {
  const leaf = walk.leaf
  if (leaf === undefined) return
  if (leaf.kind === 'paragraph') {
    const text = takeParagraph(walk)
    if (text !== undefined) currentBlocks(walk).push({ kind: 'paragraph', text })
    return
  }
  walk.leaf = undefined
  if (leaf.kind === 'html') currentBlocks(walk).push({ construct: leaf.construct, kind: 'html' })
  else currentBlocks(walk).push({ kind: 'code', language: leaf.kind === 'fenced-code' ? leaf.info : '', text: leaf.lines.join('\n') })
}

function takeParagraph(walk: Walk): string | undefined {
  const leaf = walk.leaf
  if (leaf?.kind !== 'paragraph') return undefined
  walk.leaf = undefined
  const text = readLinkDefinitions(walk.definitions, leaf.lines.join('\n'))
  return text === '' ? undefined : text
}

function currentBlocks(walk: Walk): Block[] {
  return walk.stack.at(-1)?.blocks ?? walk.blocks
}

function claimedConstruct(opener: string): ClaimedConstruct | undefined {
  if (claimsDirectiveLine(opener)) return 'directive'
  return claimsPipeLine(opener) ? 'pipe-table' : undefined
}

function normalizeInput(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replaceAll('\u0000', '\ufffd')
    .replace(/\n$/, '')
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

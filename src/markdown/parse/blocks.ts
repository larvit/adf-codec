import type { ConvertFault, SourcePosition } from '../../result.ts'
import type { DirectiveAttributes, DirectiveLine } from '../directive-syntax.ts'
import type { LinkDefinition } from '../link-syntax.ts'
import {
  atxHeading,
  claimsDirectiveLine,
  claimsPipeLine,
  closingCodeFence,
  decodeTextEscapes,
  isThematicBreak,
  listMarker,
  markerInterruptsParagraph,
  openingCodeFence,
  openingHtmlBlock,
  replaceNullCharacters,
  setextHeadingLevel,
} from '../commonmark-grammar.ts'
import { isPipeAlignment, isPipeDelimiter, malformedPipeTable, pipeCells } from '../pipe-table-syntax.ts'
import { malformedDirective, readDirectiveLine } from '../directive-syntax.ts'
import { readLinkDefinitions } from './link-reference-definitions.ts'

export type Block = { position: SourcePosition } & (
  | { argument: string | undefined; attributes: DirectiveAttributes; blocks: Block[] | undefined; kind: 'directive'; name: string }
  | { blocks: Block[]; kind: 'blockquote' }
  | { construct: string; kind: 'html' }
  | { fault: ConvertFault; kind: 'fault' }
  | { items: Block[][]; kind: 'bulletList' }
  | { items: Block[][]; kind: 'orderedList'; start: number }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; rows: string[][] }
)

export type ParsedBlocks = { blocks: Block[]; definitions: Map<string, LinkDefinition> }

export type DirectiveBlock = Extract<Block, { kind: 'directive' }>

type ListBlock = Extract<Block, { items: Block[][] }>

type OpenDirective = { blocks: Block[]; colons: number; index: number; kind: 'directive'; parent: Block[]; position: SourcePosition }

type OpenContainer =
  | Extract<Block, { kind: 'blockquote' }>
  | OpenDirective
  | { blocks: Block[]; indentation: number; kind: 'item'; list: ListBlock }

type OpenLeaf = { position: SourcePosition } & (
  | { closer: RegExp | undefined; construct: string; kind: 'html' }
  | { held: string[]; kind: 'indented-code'; lines: string[] }
  | { indentation: number; info: string; kind: 'fenced-code'; lines: string[]; marker: string }
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'pipe-table'; rows: [string[], ...string[][]] }
)

type ContainerStart = { kind: 'blockquote'; rest: Line } | { fresh: boolean; indentation: number; kind: 'item'; list: ListBlock; rest: Line }

// The line from an absolute column on: a tab a cut splits keeps the stop it is measured against.
type Line = { column: number; text: string }

type Walk = ParsedBlocks & { leaf: OpenLeaf | undefined; position: SourcePosition; stack: OpenContainer[] }

const blankLine = /^[ \t]*$/
const indentedCodeColumns = 4
const largestOpenerIndentation = 3
const leafColons = 2
const tabStop = 4

export function parseBlocks(markdown: string): ParsedBlocks {
  const walk: Walk = { blocks: [], definitions: new Map(), leaf: undefined, position: { line: 1, offset: 0 }, stack: [] }
  for (const line of sourceLines(markdown)) {
    walk.position = line.position
    readLine(walk, { column: 0, text: line.text })
  }
  closeContainers(walk, 0)
  return { blocks: walk.blocks, definitions: walk.definitions }
}

function readLine(walk: Walk, line: Line): void {
  const matched = matchContainers(walk, line)
  // CommonMark: no container opens inside an open code or HTML block.
  if (matched.depth === walk.stack.length && swallowsLines(walk.leaf)) {
    readBlockLine(walk, matched.rest)
    return
  }
  const paragraphOpen = matched.depth === walk.stack.length && walk.leaf?.kind === 'paragraph'
  const opened = openContainers(walk, matched.rest, paragraphOpen, matched.depth)
  if (!opened.opened && matched.depth < walk.stack.length) {
    if (continuesLazily(walk, opened.rest)) {
      appendParagraph(walk, opened.rest.text)
      return
    }
    closeContainers(walk, matched.depth)
  }
  readBlockLine(walk, opened.rest)
}

function swallowsLines(leaf: OpenLeaf | undefined): boolean {
  return leaf?.kind === 'fenced-code' || leaf?.kind === 'html'
}

function matchContainers(walk: Walk, line: Line): { depth: number; rest: Line } {
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

function continuesContainer(walk: Walk, container: OpenContainer, line: Line): Line | undefined {
  if (container.kind === 'blockquote') return blockquoteRest(removeColumns(line, largestOpenerIndentation))
  // A directive container has no continuation marker: only its own fence closes it.
  if (container.kind === 'directive') return line
  // A list item begins with at most one blank line: an empty one gives the second up.
  if (blankLine.test(line.text)) {
    return container.blocks.length === 0 && walk.leaf === undefined ? undefined : { column: line.column, text: '' }
  }
  return leadingColumns(line) < container.indentation ? undefined : removeColumns(line, container.indentation)
}

function blockquoteRest(opener: Line): Line | undefined {
  if (!opener.text.startsWith('>')) return undefined
  return removeColumns({ column: opener.column + 1, text: opener.text.slice(1) }, 1)
}

function openContainers(walk: Walk, line: Line, paragraphOpen: boolean, depth: number): { opened: boolean; rest: Line } {
  const unmatched = walk.stack[depth]
  let opened = false
  let rest = line
  while (leadingColumns(rest) < indentedCodeColumns) {
    const start = containerStart(rest, opened ? false : paragraphOpen, opened ? undefined : unmatched, walk.position)
    if (start === undefined) break
    if (!opened) closeContainers(walk, depth)
    opened = true
    openContainer(walk, start)
    rest = start.rest
  }
  return { opened, rest }
}

function containerStart(line: Line, paragraphOpen: boolean, enclosing: OpenContainer | undefined, position: SourcePosition): ContainerStart | undefined {
  const opener = removeColumns(line, largestOpenerIndentation)
  const blockquote = blockquoteRest(opener)
  if (blockquote !== undefined) return { kind: 'blockquote', rest: blockquote }
  if (isThematicBreak(opener.text)) return undefined
  return itemStart(line, opener, paragraphOpen, enclosing, position)
}

function itemStart(line: Line, opener: Line, paragraphOpen: boolean, enclosing: OpenContainer | undefined, position: SourcePosition): ContainerStart | undefined {
  const marker = listMarker(opener.text)
  if (marker === undefined) return undefined
  const after: Line = { column: opener.column + marker.width, text: opener.text.slice(marker.width) }
  const blank = blankLine.test(after.text)
  if (paragraphOpen && !markerInterruptsParagraph(marker.start, blank)) return undefined
  const spaces = leadingColumns(after)
  const padding = blank || spaces > indentedCodeColumns ? 1 : spaces
  const kind = marker.start === undefined ? 'bulletList' : 'orderedList'
  const continued = enclosing?.kind === 'item' && enclosing.list.kind === kind
  return {
    fresh: !continued,
    indentation: leadingColumns(line) + marker.width + padding,
    kind: 'item',
    list: continued ? enclosing.list : openList(marker.start, position),
    rest: blank ? after : removeColumns(after, padding),
  }
}

function openList(start: number | undefined, position: SourcePosition): ListBlock {
  return start === undefined ? { items: [], kind: 'bulletList', position } : { items: [], kind: 'orderedList', position, start }
}

function openContainer(walk: Walk, start: ContainerStart): void {
  const blocks: Block[] = []
  if (start.kind === 'blockquote') {
    const blockquote: OpenContainer = { blocks, kind: 'blockquote', position: walk.position }
    currentBlocks(walk).push(blockquote)
    walk.stack.push(blockquote)
    return
  }
  const list = openedList(walk, start)
  list.items.push(blocks)
  walk.stack.push({ blocks, indentation: start.indentation, kind: 'item', list })
}

// Two lists of a kind never sit adjacent: one `- ` spelling reads them back as one (spec/flavour.md).
function openedList(walk: Walk, start: Extract<ContainerStart, { kind: 'item' }>): ListBlock {
  if (!start.fresh) return start.list
  const blocks = currentBlocks(walk)
  const previous = blocks.at(-1)
  if ((previous?.kind === 'bulletList' || previous?.kind === 'orderedList') && previous.kind === start.list.kind) return previous
  blocks.push(start.list)
  return start.list
}

function closeContainers(walk: Walk, depth: number): void {
  closeLeaf(walk)
  for (const container of walk.stack.slice(depth)) {
    if (container.kind !== 'directive') continue
    container.parent[container.index] = {
      fault: malformedDirective(`a container fenced with ${container.colons} colons is unclosed`),
      kind: 'fault',
      position: container.position,
    }
  }
  dropContainers(walk, depth)
}

function dropContainers(walk: Walk, depth: number): void {
  walk.stack.length = depth
}

function openDirective(walk: Walk, directive: Extract<DirectiveLine, { kind: 'header' }>): void {
  const block: DirectiveBlock = {
    argument: directive.argument,
    attributes: directive.attributes,
    blocks: directive.colons > leafColons ? [] : undefined,
    kind: 'directive',
    name: directive.name,
    position: walk.position,
  }
  const parent = currentBlocks(walk)
  parent.push(block)
  const { position } = block
  if (block.blocks !== undefined) walk.stack.push({ blocks: block.blocks, colons: directive.colons, index: parent.length - 1, kind: 'directive', parent, position })
}

function applyDirectiveLine(walk: Walk, directive: DirectiveLine): void {
  const enclosing = innermostDirective(walk)
  if (directive.kind === 'closing') {
    closeDirective(walk, directive.colons, enclosing)
    return
  }
  if (enclosing !== undefined && directive.colons >= enclosing.container.colons) {
    pushFault(walk, malformedDirective(`a directive fence line is at least as long as the container's ${enclosing.container.colons} colons`))
    return
  }
  openDirective(walk, directive)
}

function closeDirective(walk: Walk, colons: number, enclosing: { container: OpenDirective; depth: number } | undefined): void {
  if (enclosing === undefined) {
    pushFault(walk, malformedDirective('a closing fence closes no open container'))
    return
  }
  if (colons < enclosing.container.colons) {
    pushFault(walk, malformedDirective(`a closing fence is shorter than the ${enclosing.container.colons} colons it would close`))
    return
  }
  dropContainers(walk, enclosing.depth)
}

function innermostDirective(walk: Walk): { container: OpenDirective; depth: number } | undefined {
  for (let depth = walk.stack.length - 1; depth >= 0; depth -= 1) {
    const container = walk.stack[depth]
    if (container?.kind === 'directive') return { container, depth }
  }
  return undefined
}

function pushFault(walk: Walk, fault: ConvertFault): void {
  currentBlocks(walk).push({ fault, kind: 'fault', position: walk.position })
}

// A claimed line ends the lazy continuation CommonMark would fold it into (spec/flavour.md).
function continuesLazily(walk: Walk, line: Line): boolean {
  if (walk.leaf?.kind !== 'paragraph' || blankLine.test(line.text)) return false
  if (leadingColumns(line) >= indentedCodeColumns) return true
  const opener = removeColumns(line, largestOpenerIndentation).text
  if (claimsDirectiveLine(opener) || claimsPipeLine(opener) || isThematicBreak(opener)) return false
  return atxHeading(opener) === undefined && openingCodeFence(opener) === undefined && openingHtmlBlock(opener, true) === undefined
}

function readBlockLine(walk: Walk, line: Line): void {
  const leaf = walk.leaf
  if (leaf?.kind === 'fenced-code') {
    if (closingCodeFence(removeColumns(line, largestOpenerIndentation).text, leaf.marker)) closeLeaf(walk)
    else leaf.lines.push(removeColumns(line, leaf.indentation).text)
    return
  }
  if (leaf?.kind === 'html') {
    if (leaf.closer === undefined ? blankLine.test(line.text) : leaf.closer.test(line.text)) closeLeaf(walk)
    return
  }
  if (leaf?.kind === 'pipe-table') {
    const cells = pipeCells(removeColumns(line, largestOpenerIndentation).text)
    if (cells !== undefined) {
      leaf.rows.push(cells)
      return
    }
    closeLeaf(walk)
  }
  if (leaf?.kind === 'indented-code') {
    if (readIndentedCodeLine(leaf, line)) return
    closeLeaf(walk)
  }
  if (blankLine.test(line.text)) {
    closeLeaf(walk)
    return
  }
  if (walk.leaf === undefined && leadingColumns(line) >= indentedCodeColumns) {
    walk.leaf = { held: [], kind: 'indented-code', lines: [removeColumns(line, indentedCodeColumns).text], position: walk.position }
    return
  }
  openLeaf(walk, line)
}

function readIndentedCodeLine(leaf: Extract<OpenLeaf, { kind: 'indented-code' }>, line: Line): boolean {
  if (blankLine.test(line.text)) {
    leaf.held.push(removeColumns(line, indentedCodeColumns).text)
    return true
  }
  if (leadingColumns(line) < indentedCodeColumns) return false
  leaf.lines.push(...leaf.held, removeColumns(line, indentedCodeColumns).text)
  leaf.held.length = 0
  return true
}

function openLeaf(walk: Walk, line: Line): void {
  const opener = removeColumns(line, largestOpenerIndentation).text
  const directive = readDirectiveLine(opener)
  if (directive !== undefined) {
    closeLeaf(walk)
    if (directive.fault === undefined) applyDirectiveLine(walk, directive.value)
    else pushFault(walk, directive.fault)
    return
  }
  const cells = pipeCells(opener)
  if (cells !== undefined) {
    closeLeaf(walk)
    walk.leaf = { kind: 'pipe-table', position: walk.position, rows: [cells] }
    return
  }
  if (readLineBlock(walk, opener)) return
  const fence = openingCodeFence(opener)
  if (fence !== undefined) {
    closeLeaf(walk)
    walk.leaf = { indentation: leadingColumns(line), info: fence.info, kind: 'fenced-code', lines: [], marker: fence.marker, position: walk.position }
    return
  }
  const html = openingHtmlBlock(opener, walk.leaf?.kind === 'paragraph')
  if (html === undefined) {
    appendParagraph(walk, line.text)
    return
  }
  closeLeaf(walk)
  walk.leaf = { closer: html.closer, construct: html.construct, kind: 'html', position: walk.position }
  if (html.closer?.test(line.text) === true) closeLeaf(walk)
}

// A setext underline over a paragraph the definitions emptied is no heading: it opens the next block.
function readLineBlock(walk: Walk, opener: string): boolean {
  const level = walk.leaf?.kind === 'paragraph' ? setextHeadingLevel(opener) : undefined
  if (level !== undefined) {
    const paragraph = takeParagraph(walk)
    if (paragraph !== undefined) {
      currentBlocks(walk).push({ kind: 'heading', level, position: paragraph.position, text: paragraph.text })
      return true
    }
  }
  if (isThematicBreak(opener)) {
    closeLeaf(walk)
    currentBlocks(walk).push({ kind: 'rule', position: walk.position })
    return true
  }
  const heading = atxHeading(opener)
  if (heading === undefined) return false
  closeLeaf(walk)
  currentBlocks(walk).push({ kind: 'heading', level: heading.level, position: walk.position, text: heading.text })
  return true
}

function appendParagraph(walk: Walk, line: string): void {
  const leaf = walk.leaf
  const text = line.replace(/^[ \t]+/, '')
  if (leaf?.kind === 'paragraph') leaf.lines.push(text)
  else walk.leaf = { kind: 'paragraph', lines: [text], position: walk.position }
}

function closeLeaf(walk: Walk): void {
  const leaf = walk.leaf
  if (leaf === undefined) return
  if (leaf.kind === 'paragraph') {
    const paragraph = takeParagraph(walk)
    if (paragraph !== undefined) currentBlocks(walk).push(paragraph)
    return
  }
  walk.leaf = undefined
  const { position } = leaf
  if (leaf.kind === 'html') currentBlocks(walk).push({ construct: leaf.construct, kind: 'html', position })
  else if (leaf.kind === 'pipe-table') currentBlocks(walk).push(pipeTableBlock(leaf.rows, position))
  else currentBlocks(walk).push({ kind: 'code', language: leaf.kind === 'fenced-code' ? decodeTextEscapes(leaf.info) : '', position, text: leaf.lines.join('\n') })
}

function pipeTableBlock(rows: readonly [string[], ...string[][]], position: SourcePosition): Block {
  const [header, delimiter, ...body] = rows
  if (delimiter !== undefined && delimiter.some(isPipeAlignment)) {
    return faultedBlock('a pipe table carries no column alignment ADF could hold', position)
  }
  if (delimiter === undefined || !delimiter.every(isPipeDelimiter)) {
    return faultedBlock('a pipe table underlines its header with a row of `-` runs', position)
  }
  const ragged = [delimiter, ...body].find((row) => row.length !== header.length)
  if (ragged !== undefined) return faultedBlock(`a pipe table row holds ${ragged.length} cells where its header holds ${header.length}`, position)
  return { kind: 'table', position, rows: [header, ...body] }
}

function faultedBlock(message: string, position: SourcePosition): Block {
  return { fault: malformedPipeTable(message), kind: 'fault', position }
}

function takeParagraph(walk: Walk): Extract<Block, { kind: 'paragraph' }> | undefined {
  const leaf = walk.leaf
  if (leaf?.kind !== 'paragraph') return undefined
  walk.leaf = undefined
  const text = readLinkDefinitions(walk.definitions, leaf.lines.join('\n'))
  return text === '' ? undefined : { kind: 'paragraph', position: leaf.position, text }
}

function currentBlocks(walk: Walk): Block[] {
  return walk.stack.at(-1)?.blocks ?? walk.blocks
}

function sourceLines(markdown: string): { position: SourcePosition; text: string }[] {
  const lines: { position: SourcePosition; text: string }[] = []
  let line = 1
  let start = 0
  for (let index = 0; index < markdown.length; index += 1) {
    const character = markdown.charAt(index)
    if (character !== '\n' && character !== '\r') continue
    lines.push(sourceLine(markdown, line, start, index))
    if (character === '\r' && markdown.charAt(index + 1) === '\n') index += 1
    line += 1
    start = index + 1
  }
  if (start < markdown.length) lines.push(sourceLine(markdown, line, start, markdown.length))
  return lines
}

function sourceLine(markdown: string, line: number, start: number, end: number): { position: SourcePosition; text: string } {
  return { position: { line, offset: start }, text: replaceNullCharacters(markdown.slice(start, end)) }
}

function leadingColumns(line: Line): number {
  let columns = 0
  for (const character of line.text) {
    if (character === ' ') columns += 1
    else if (character === '\t') columns += tabStop - ((line.column + columns) % tabStop)
    else break
  }
  return columns
}

// CommonMark's tab stops: a tab the cut splits gives the columns it holds past the cut back as spaces.
function removeColumns(line: Line, columns: number): Line {
  const target = line.column + columns
  let column = line.column
  let index = 0
  while (column < target && index < line.text.length) {
    const character = line.text.charAt(index)
    if (character !== ' ' && character !== '\t') break
    const width = character === ' ' ? 1 : tabStop - (column % tabStop)
    index += 1
    if (column + width > target) return { column: target, text: ' '.repeat(column + width - target) + line.text.slice(index) }
    column += width
  }
  return { column, text: line.text.slice(index) }
}

import type { Claims } from '../portable/conventions.ts'
import type { ConvertFault, SourcePosition } from '../../result.ts'
import type { DirectiveAttributes, DirectiveLine } from '../directive-syntax.ts'
import type { LinkDefinition } from '../commonmark/link-syntax.ts'
import {
  atxHeading,
  claimsPipeLine,
  closingCodeFence,
  decodeTextEscapes,
  holdsThematicBreak,
  isBlankLine,
  isThematicBreak,
  listMarker,
  markerInterruptsParagraph,
  openingCodeFence,
  openingHtmlBlock,
  replaceNullCharacters,
  setextHeadingLevel,
  thematicBreakTail,
  type ThematicBreakTail,
} from '../commonmark/grammar.ts'
import { barePipeCells, isDelimiterRow, isPipeAlignment, isPipeDelimiter, malformedPipeTable, pipeCells } from '../pipe-table-syntax.ts'
import { blockDirectiveForm } from '../block-directive.ts'
import { directiveEscape, malformedDirective, readDirectiveLine, spellDirectiveCloser } from '../directive-syntax.ts'
import { readLinkDefinitions } from '../commonmark/link-reference-definitions.ts'

export type Block = { position: SourcePosition } & (
  | { argument: string | undefined; attributes: DirectiveAttributes; blocks: Block[] | undefined; kind: 'directive'; name: string }
  | { blocks: Block[]; kind: 'blockquote' }
  | { construct: string; kind: 'html' }
  | { fault: ConvertFault; kind: 'fault' }
  | { delimiter: string; items: Block[][]; kind: 'bulletList' }
  | { delimiter: string; items: Block[][]; kind: 'orderedList'; start: number }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'rule' }
  | { kind: 'table'; rows: string[][] }
)

export type ParsedBlocks = { blocks: Block[]; definitions: Map<string, LinkDefinition> }

export type DirectiveBlock = Extract<Block, { kind: 'directive' }>

type ListBlock = Extract<Block, { items: Block[][] }>

type OpenDirective = { blocks: Block[]; index: number; kind: 'directive'; name: string; parent: Block[]; position: SourcePosition }

type EdgeContainer = Extract<Block, { kind: 'blockquote' }> | { blocks: Block[]; indentation: number; kind: 'item'; list: ListBlock }

type OpenContainer = EdgeContainer | OpenDirective

type OpenLeaf = { position: SourcePosition } & (
  | { closer: RegExp | undefined; construct: string; kind: 'html' }
  | { held: string[]; kind: 'indented-code'; lines: string[] }
  | { indentation: number; info: string; kind: 'fenced-code'; lines: string[]; marker: string }
  | { kind: 'paragraph'; lines: string[]; positions: SourcePosition[] }
  | { kind: 'pipe-table'; rows: [string[], ...string[][]] }
)

type ContainerStart = { kind: 'blockquote'; rest: Line } | { fresh: boolean; indentation: number; kind: 'item'; list: ListBlock; rest: Line }

// The line from an absolute column on: a tab a cut splits keeps the stop it is measured against.
type Line = { column: number; text: string }

type LeafOpener = { index: number; position: SourcePosition }

type ContainerStack = {
  directiveDepth: (name: string) => number | undefined
  drop: (depth: number) => OpenContainer[]
  edges: readonly { container: EdgeContainer; depth: number }[]
  open: readonly OpenContainer[]
  push: (container: OpenContainer) => void
}

type Walk = ParsedBlocks & {
  claims: Claims
  endedLists: Set<ListBlock>
  leaf: OpenLeaf | undefined
  leafOpeners: Map<Block[], Map<string, LeafOpener>>
  position: SourcePosition
  stack: ContainerStack
}

const indentedCodeColumns = 4
const largestOpenerIndentation = 3
const tabStop = 4

export function parseBlocks(markdown: string, claims: Claims): ParsedBlocks {
  const walk: Walk = {
    blocks: [],
    claims,
    definitions: new Map(),
    endedLists: new Set(),
    leaf: undefined,
    leafOpeners: new Map(),
    position: { line: 1, offset: 0 },
    stack: containerStack(),
  }
  for (const line of sourceLines(markdown)) {
    walk.position = line.position
    readLine(walk, { column: 0, text: line.text })
  }
  closeContainers(walk, 0)
  return { blocks: walk.blocks, definitions: walk.definitions }
}

function containerStack(): ContainerStack {
  const directiveDepths = new Map<string, number[]>()
  const depthsOf = (name: string): number[] => entryOf(directiveDepths, name, () => [])
  const edges: { container: EdgeContainer; depth: number }[] = []
  const open: OpenContainer[] = []
  return {
    directiveDepth: (name) => directiveDepths.get(name)?.at(-1),
    drop: (depth) => {
      const dropped = open.splice(depth)
      for (const container of dropped) {
        if (container.kind === 'directive') depthsOf(container.name).pop()
        else edges.pop()
      }
      return dropped
    },
    edges,
    open,
    push: (container) => {
      const depth = open.push(container) - 1
      if (container.kind === 'directive') depthsOf(container.name).push(depth)
      else edges.push({ container, depth })
    },
  }
}

function readLine(walk: Walk, line: Line): void {
  const matched = matchContainers(walk, line)
  // CommonMark: no container opens inside an open code or HTML block.
  if (matched.depth === walk.stack.open.length && swallowsLines(walk.leaf)) {
    readBlockLine(walk, matched.rest)
    return
  }
  const paragraphOpen = matched.depth === walk.stack.open.length && walk.leaf?.kind === 'paragraph'
  const opened = openContainers(walk, matched.rest, paragraphOpen, matched.depth)
  if (!opened.opened && matched.depth < walk.stack.open.length) {
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

// A directive container has no continuation marker, so every line continues it.
function matchContainers(walk: Walk, line: Line): { depth: number; rest: Line } {
  let rest = line
  for (const { container, depth } of walk.stack.edges) {
    const next = continuesContainer(walk, container, rest)
    if (next === undefined) return { depth, rest }
    rest = next
  }
  return { depth: walk.stack.open.length, rest }
}

function continuesContainer(walk: Walk, container: EdgeContainer, line: Line): Line | undefined {
  if (container.kind === 'blockquote') return blockquoteRest(removeColumns(line, largestOpenerIndentation))
  // A list item begins with at most one blank line: an empty one gives the second up.
  if (isBlankLine(line.text)) {
    return container.blocks.length === 0 && walk.leaf === undefined ? undefined : { column: line.column, text: '' }
  }
  return leadingColumns(line) < container.indentation ? undefined : removeColumns(line, container.indentation)
}

function blockquoteRest(opener: Line): Line | undefined {
  if (!opener.text.startsWith('>')) return undefined
  return removeColumns({ column: opener.column + 1, text: opener.text.slice(1) }, 1)
}

function openContainers(walk: Walk, line: Line, paragraphOpen: boolean, depth: number): { opened: boolean; rest: Line } {
  const unmatched = walk.stack.open[depth]
  const tail = thematicBreakTail(line.text)
  let opened = false
  let rest = line
  while (leadingColumns(rest) < indentedCodeColumns) {
    const start = containerStart(rest, tail, opened ? false : paragraphOpen, opened ? undefined : unmatched, walk.position)
    if (start === undefined) break
    if (!opened) closeContainers(walk, depth)
    opened = true
    openContainer(walk, start)
    rest = start.rest
  }
  return { opened, rest }
}

function containerStart(
  line: Line,
  tail: ThematicBreakTail | undefined,
  paragraphOpen: boolean,
  enclosing: OpenContainer | undefined,
  position: SourcePosition,
): ContainerStart | undefined {
  const opener = removeColumns(line, largestOpenerIndentation)
  const blockquote = blockquoteRest(opener)
  if (blockquote !== undefined) return { kind: 'blockquote', rest: blockquote }
  if (holdsThematicBreak(tail, opener.text)) return undefined
  return itemStart(line, opener, paragraphOpen, enclosing, position)
}

function itemStart(line: Line, opener: Line, paragraphOpen: boolean, enclosing: OpenContainer | undefined, position: SourcePosition): ContainerStart | undefined {
  const marker = listMarker(opener.text)
  if (marker === undefined) return undefined
  const after: Line = { column: opener.column + marker.width, text: opener.text.slice(marker.width) }
  const blank = isBlankLine(after.text)
  if (paragraphOpen && !markerInterruptsParagraph(marker.start, blank)) return undefined
  const spaces = leadingColumns(after)
  const padding = blank || spaces > indentedCodeColumns ? 1 : spaces
  const list = openList(marker.delimiter, marker.start, position)
  const continued = enclosing?.kind === 'item' && continuesList(enclosing.list, list)
  return {
    fresh: !continued,
    indentation: leadingColumns(line) + marker.width + padding,
    kind: 'item',
    list: continued ? enclosing.list : list,
    rest: blank ? after : removeColumns(after, padding),
  }
}

function openList(delimiter: string, start: number | undefined, position: SourcePosition): ListBlock {
  return start === undefined ? { delimiter, items: [], kind: 'bulletList', position } : { delimiter, items: [], kind: 'orderedList', position, start }
}

function continuesList(list: ListBlock, next: ListBlock): boolean {
  return list.kind === next.kind && list.delimiter === next.delimiter
}

function openContainer(walk: Walk, start: ContainerStart): void {
  const blocks: Block[] = []
  if (start.kind === 'blockquote') {
    const blockquote: EdgeContainer = { blocks, kind: 'blockquote', position: walk.position }
    currentBlocks(walk).push(blockquote)
    walk.stack.push(blockquote)
    return
  }
  const list = openedList(walk, start)
  list.items.push(blocks)
  walk.stack.push({ blocks, indentation: start.indentation, kind: 'item', list })
}

// An item opening after its list's last item closed, as an empty item a blank line ends does, continues that list.
function openedList(walk: Walk, start: Extract<ContainerStart, { kind: 'item' }>): ListBlock {
  if (!start.fresh) return start.list
  const blocks = currentBlocks(walk)
  const previous = blocks.at(-1)
  if (isList(previous) && !walk.endedLists.has(previous) && continuesList(previous, start.list)) return previous
  blocks.push(start.list)
  return start.list
}

// A paragraph of link reference definitions alone leaves no block, yet ends the list before it as any block does.
function endList(walk: Walk): void {
  const previous = currentBlocks(walk).at(-1)
  if (isList(previous)) walk.endedLists.add(previous)
}

function isList(block: Block | undefined): block is ListBlock {
  return block?.kind === 'bulletList' || block?.kind === 'orderedList'
}

function closeContainers(walk: Walk, depth: number): void {
  closeLeaf(walk)
  for (const container of walk.stack.drop(depth)) {
    if (container.kind !== 'directive') continue
    container.parent[container.index] = {
      fault: malformedDirective(`the ${container.name} container is unclosed: no ${spellDirectiveCloser(container.name)} follows inside the block holding it; ${directiveEscape}`),
      kind: 'fault',
      position: container.position,
    }
  }
}

function applyDirectiveLine(walk: Walk, directive: DirectiveLine): void {
  if (directive.kind === 'closer') closeDirective(walk, directive.name)
  else openDirective(walk, directive)
}

function openDirective(walk: Walk, directive: Extract<DirectiveLine, { kind: 'opener' }>): void {
  const { name } = directive
  const block: DirectiveBlock = {
    argument: directive.argument,
    attributes: directive.attributes,
    blocks: blockDirectiveForm(name) === 'container' ? [] : undefined,
    kind: 'directive',
    name,
    position: walk.position,
  }
  const parent = currentBlocks(walk)
  const index = parent.push(block) - 1
  const { position } = block
  if (block.blocks === undefined) {
    entryOf(walk.leafOpeners, parent, () => new Map<string, LeafOpener>()).set(name, { index, position })
    return
  }
  walk.stack.push({ blocks: block.blocks, index, kind: 'directive', name, parent, position })
}

function closeDirective(walk: Walk, name: string): void {
  const closer = spellDirectiveCloser(name)
  if (blockDirectiveForm(name) === 'leaf') {
    faultLeafOpener(walk, name, malformedDirective(`${name} takes no body, so no ${closer} closes it; ${directiveEscape}`))
    return
  }
  const depth = openDirectiveDepth(walk, name)
  if (depth === undefined) {
    pushFault(walk, malformedDirective(`the closer ${closer} closes no ${name} container open where it stands; ${directiveEscape}`))
    return
  }
  closeContainers(walk, depth + 1)
  walk.stack.drop(depth)
}

// A closer crosses no list item or blockquote edge.
function openDirectiveDepth(walk: Walk, name: string): number | undefined {
  const depth = walk.stack.directiveDepth(name)
  return depth === undefined || depth < (walk.stack.edges.at(-1)?.depth ?? -1) ? undefined : depth
}

function faultLeafOpener(walk: Walk, name: string, fault: ConvertFault): void {
  const blocks = currentBlocks(walk)
  const openers = walk.leafOpeners.get(blocks)
  const opener = openers?.get(name)
  if (openers === undefined || opener === undefined) {
    pushFault(walk, fault)
    return
  }
  openers.delete(name)
  blocks[opener.index] = { fault, kind: 'fault', position: opener.position }
}

function entryOf<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const known = map.get(key)
  if (known !== undefined) return known
  const created = create()
  map.set(key, created)
  return created
}

function pushFault(walk: Walk, fault: ConvertFault): void {
  currentBlocks(walk).push({ fault, kind: 'fault', position: walk.position })
}

// A claimed line ends the lazy continuation CommonMark would fold it into (spec/flavour.md).
function continuesLazily(walk: Walk, line: Line): boolean {
  if (walk.leaf?.kind !== 'paragraph' || isBlankLine(line.text)) return false
  if (leadingColumns(line) >= indentedCodeColumns) return true
  const opener = removeColumns(line, largestOpenerIndentation).text
  if ((walk.claims.directives && readDirectiveLine(opener) !== undefined) || (walk.claims.pipeTables && claimsPipeLine(opener)) || isThematicBreak(opener)) return false
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
    if (leaf.closer === undefined ? isBlankLine(line.text) : leaf.closer.test(line.text)) closeLeaf(walk)
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
  if (isBlankLine(line.text)) {
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
  if (isBlankLine(line.text)) {
    leaf.held.push(removeColumns(line, indentedCodeColumns).text)
    return true
  }
  if (leadingColumns(line) < indentedCodeColumns) return false
  for (const held of leaf.held) leaf.lines.push(held)
  leaf.lines.push(removeColumns(line, indentedCodeColumns).text)
  leaf.held.length = 0
  return true
}

function openLeaf(walk: Walk, line: Line): void {
  const opener = removeColumns(line, largestOpenerIndentation).text
  const directive = walk.claims.directives ? readDirectiveLine(opener) : undefined
  if (directive !== undefined) {
    closeLeaf(walk)
    if (directive.fault === undefined) applyDirectiveLine(walk, directive.value)
    else pushFault(walk, directive.fault)
    return
  }
  const cells = walk.claims.pipeTables ? pipeCells(opener) : undefined
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
      currentBlocks(walk).push(bareTableFault(paragraph, walk.claims) ?? { kind: 'heading', level, position: paragraph.position, text: paragraph.text })
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
  if (leaf?.kind !== 'paragraph') {
    walk.leaf = { kind: 'paragraph', lines: [text], position: walk.position, positions: [walk.position] }
    return
  }
  leaf.lines.push(text)
  leaf.positions.push(walk.position)
}

function closeLeaf(walk: Walk): void {
  const leaf = walk.leaf
  if (leaf === undefined) return
  if (leaf.kind === 'paragraph') {
    const paragraph = takeParagraph(walk)
    if (paragraph === undefined) endList(walk)
    else currentBlocks(walk).push(bareTableFault(paragraph, walk.claims) ?? paragraph)
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
    return faultedBlock('a pipe table carries no column alignment ADF could hold: this delimiter row holds an alignment colon', position)
  }
  if (delimiter === undefined || !delimiter.every(isPipeDelimiter)) {
    return faultedBlock('a pipe table underlines its header with a row of `-` runs: this one has none; \\| at the start of every row keeps them literal text', position)
  }
  const ragged = [delimiter, ...body].find((row) => row.length !== header.length)
  if (ragged !== undefined) return faultedBlock(`a pipe table row holds ${cellCount(ragged.length)} where its header holds ${cellCount(header.length)}`, position)
  return { kind: 'table', position, rows: [header, ...body] }
}

// spec/flavour.md, Tables: GFM's table without the leading pipes, which no line of it claims.
function bareTableFault(paragraph: Extract<Block, { kind: 'paragraph' }>, claims: Claims): Block | undefined {
  if (!claims.pipeTables) return undefined
  let header: string[] | undefined
  for (const line of paragraph.text.split('\n')) {
    const cells = barePipeCells(line)
    if (header !== undefined && cells !== undefined && cells.length === header.length && isDelimiterRow(cells)) {
      return faultedBlock('a pipe table opens every row with `|`: this one does not; \\| keeps a pipe literal text', paragraph.position)
    }
    header = cells
  }
  return undefined
}

function cellCount(count: number): string {
  return `${count} cell${count === 1 ? '' : 's'}`
}

function faultedBlock(message: string, position: SourcePosition): Block {
  return { fault: malformedPipeTable(message), kind: 'fault', position }
}

// The definitions a paragraph gives up are whole lines, so what is left starts at one this held.
function takeParagraph(walk: Walk): Extract<Block, { kind: 'paragraph' }> | undefined {
  const leaf = walk.leaf
  if (leaf?.kind !== 'paragraph') return undefined
  walk.leaf = undefined
  const text = readLinkDefinitions(walk.definitions, leaf.lines.join('\n'))
  if (text === '') return undefined
  const kept = leaf.positions[leaf.lines.length - text.split('\n').length]
  return { kind: 'paragraph', position: kept ?? leaf.position, text }
}

function currentBlocks(walk: Walk): Block[] {
  return walk.stack.open.at(-1)?.blocks ?? walk.blocks
}

function* sourceLines(markdown: string): Generator<{ position: SourcePosition; text: string }> {
  let line = 1
  let start = 0
  for (let index = 0; index < markdown.length; index += 1) {
    const character = markdown.charAt(index)
    if (character !== '\n' && character !== '\r') continue
    yield sourceLine(markdown, line, start, index)
    if (character === '\r' && markdown.charAt(index + 1) === '\n') index += 1
    line += 1
    start = index + 1
  }
  if (start < markdown.length) yield sourceLine(markdown, line, start, markdown.length)
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

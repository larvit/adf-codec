import type { Claims, Flavour } from '../flavour.ts'
import type { ConvertFault, Read, SourcePosition } from '../../result.ts'
import type { DirectiveAttributes, DirectiveLine } from '../directive/syntax.ts'
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
  trimSpace,
} from '../commonmark/grammar.ts'
import { barePipeCells, isDelimiterRow, isPipeAlignment, malformedPipeTable, pipeCells } from '../pipe-table-syntax.ts'
import { blockDirectiveForm } from '../directive/block.ts'
import { directiveEscape, malformedDirective, markerOpener, readDirectiveLine, spellDirectiveCloser } from '../directive/syntax.ts'
import { flavourClaims } from '../flavour.ts'
import { readItemMarker, readTrailingMarker, type TrailingMarker } from '../directive/id-marker.ts'
import { readLinkDefinitions } from '../commonmark/link-reference-definitions.ts'

export type Block = { position: SourcePosition } & (
  | { argument: string | undefined; attributes: DirectiveAttributes; blocks: Block[] | undefined; kind: 'directive'; name: string }
  | { blocks: Block[]; kind: 'blockquote' }
  | { construct: string; kind: 'html' }
  | { fault: ConvertFault; kind: 'fault' }
  | { delimiter: string; items: Block[][]; kind: 'bulletList' }
  | { delimiter: string; items: Block[][]; kind: 'orderedList'; start: number }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'heading'; level: number; text: string; trailing?: Read<DirectiveAttributes> }
  // item: right after a list item's marker; line: alone on the line above its block.
  | { attributes: DirectiveAttributes; kind: 'marker'; placement: 'item' | 'line' }
  | { kind: 'paragraph'; text: string; trailing?: Read<DirectiveAttributes> }
  | { kind: 'rule' }
  | { kind: 'table'; rows: string[][] }
)

export type ParsedBlocks = { blocks: Block[]; definitions: Map<string, LinkDefinition> }

export type DirectiveBlock = Extract<Block, { kind: 'directive' }>

export type MarkerBlock = Extract<Block, { kind: 'marker' }>

type ParagraphBlock = Extract<Block, { kind: 'paragraph' }>

type ListBlock = Extract<Block, { items: Block[][] }>

type OpenDirective = { blocks: Block[]; index: number; kind: 'directive'; name: string; parent: Block[]; position: SourcePosition }

type EdgeContainer = Extract<Block, { kind: 'blockquote' }> | { blocks: Block[]; indentation: number; kind: 'item'; list: ListBlock }

type OpenContainer = EdgeContainer | OpenDirective

type OpenLeaf = { position: SourcePosition } & (
  | { closer: RegExp | undefined; construct: string; kind: 'html' }
  | { held: string[]; kind: 'indented-code'; lines: string[] }
  | { indentation: number; info: string; kind: 'fenced-code'; lines: string[]; marker: string }
  | { kind: 'paragraph'; lines: [ParagraphLine, ...ParagraphLine[]] }
  | { kind: 'pipe-table'; rows: [string[], ...string[][]] }
)

type ContainerStart = { kind: 'blockquote'; rest: Line } | { fresh: boolean; indentation: number; kind: 'item'; list: ListBlock; rest: Line }

type ParagraphLine = { position: SourcePosition; text: string }

// A cut through a tab leaves its columns as blank `spaces` before `text`; a marker check reads `spaces` first unless a code-indent guard precedes.
type Line = { column: number; spaces: number; text: string }

type LeafOpener = { index: number; position: SourcePosition }

type ContainerStack = {
  directiveDepth: (name: string) => number | undefined
  drop: (depth: number) => OpenContainer[]
  edges: readonly { container: EdgeContainer; depth: number }[]
  open: readonly OpenContainer[]
  push: (container: OpenContainer) => void
  // The index in `edges` of each blockquote.
  quoteEdges: readonly number[]
}

type OpenParagraph = Extract<OpenLeaf, { kind: 'paragraph' }>

// `append` and `last` address the blocks of the innermost open container.
type BlockTree = {
  append: (block: Block) => void
  // A directive among the containers closed is unclosed, so a fault takes its place.
  close: (depth: number) => void
  // The directive at `depth` closes by its closer; the containers inside it close as `close` closes them.
  closeDirective: (depth: number) => void
  containers: Pick<ContainerStack, 'directiveDepth' | 'edges' | 'open' | 'quoteEdges'>
  // A paragraph holding only link reference definitions leaves no block, yet ends the list before it as any block does.
  endList: () => void
  faultLeafOpener: (name: string, fault: ConvertFault, position: SourcePosition) => void
  last: () => Block | undefined
  openContainer: (start: ContainerStart, position: SourcePosition) => void
  openDirective: (block: DirectiveBlock) => void
  parsed: ParsedBlocks
  // The paragraph's text after the link reference definitions it opens with.
  takeDefinitions: (paragraph: string) => string
}

type LineContext = { claims: Claims; position: SourcePosition }

const indentedCodeColumns = 4
const largestOpenerIndentation = 3
const tabStop = 4

export function parseBlocks(markdown: string, flavour: Flavour): ParsedBlocks {
  const claims = flavourClaims[flavour]
  const tree = blockTree()
  let leaf: OpenLeaf | undefined
  let position: SourcePosition = { line: 1, offset: 0 }
  for (const line of sourceLines(markdown)) {
    position = line.position
    leaf = readLine(tree, leaf, { column: 0, spaces: 0, text: line.text }, { claims, position })
  }
  closeContainers(tree, leaf, 0, { claims, position })
  return tree.parsed
}

function containerStack(): ContainerStack {
  const directiveDepths = new Map<string, number[]>()
  const depthsOf = (name: string): number[] => entryOf(directiveDepths, name, () => [])
  const edges: { container: EdgeContainer; depth: number }[] = []
  const open: OpenContainer[] = []
  const quoteEdges: number[] = []
  return {
    directiveDepth: (name) => directiveDepths.get(name)?.at(-1),
    drop: (depth) => {
      const dropped = open.splice(depth)
      for (const container of dropped) {
        if (container.kind === 'directive') depthsOf(container.name).pop()
        else {
          edges.pop()
          if (container.kind === 'blockquote') quoteEdges.pop()
        }
      }
      return dropped
    },
    edges,
    open,
    push: (container) => {
      const depth = open.push(container) - 1
      if (container.kind === 'directive') depthsOf(container.name).push(depth)
      else {
        if (container.kind === 'blockquote') quoteEdges.push(edges.length)
        edges.push({ container, depth })
      }
    },
    quoteEdges,
  }
}

function blockTree(): BlockTree {
  const parsed: ParsedBlocks = { blocks: [], definitions: new Map() }
  const endedLists = new Set<ListBlock>()
  const leafOpeners = leafOpenerLedger()
  const stack = containerStack()
  const current = (): Block[] => stack.open.at(-1)?.blocks ?? parsed.blocks
  const close = (depth: number): void => {
    for (const container of stack.drop(depth)) {
      if (container.kind === 'directive') container.parent[container.index] = unclosedDirective(container)
    }
  }
  return {
    append: (block) => void current().push(block),
    close,
    closeDirective: (depth) => {
      close(depth + 1)
      stack.drop(depth)
    },
    containers: stack,
    endList: () => {
      const previous = current().at(-1)
      if (isList(previous)) endedLists.add(previous)
    },
    faultLeafOpener: (name, fault, position) => {
      const held = current()
      const opener = leafOpeners.take(held, name)
      if (opener === undefined) held.push({ fault, kind: 'fault', position })
      else held[opener.index] = { fault, kind: 'fault', position: opener.position }
    },
    last: () => current().at(-1),
    openContainer: (start, position) => {
      if (start.kind === 'blockquote') {
        const blockquote: EdgeContainer = { blocks: [], kind: 'blockquote', position }
        current().push(blockquote)
        return stack.push(blockquote)
      }
      const list = start.fresh ? (continuedList(current().at(-1), start.list, endedLists) ?? start.list) : start.list
      if (start.fresh && list === start.list) current().push(list)
      const held: Block[] = []
      list.items.push(held)
      stack.push({ blocks: held, indentation: start.indentation, kind: 'item', list })
    },
    openDirective: (block) => {
      const parent = current()
      const index = parent.push(block) - 1
      if (block.blocks === undefined) leafOpeners.record(parent, block.name, { index, position: block.position })
      else stack.push({ blocks: block.blocks, index, kind: 'directive', name: block.name, parent, position: block.position })
    },
    parsed,
    takeDefinitions: (paragraph) => readLinkDefinitions(parsed.definitions, paragraph),
  }
}

// A leaf directive's opener, by the blocks holding it and its name, until a closer faults it.
function leafOpenerLedger(): { record: (parent: Block[], name: string, opener: LeafOpener) => void; take: (parent: Block[], name: string) => LeafOpener | undefined } {
  const openers = new Map<Block[], Map<string, LeafOpener>>()
  return {
    record: (parent, name, opener) => void entryOf(openers, parent, () => new Map<string, LeafOpener>()).set(name, opener),
    take: (parent, name) => {
      const opener = openers.get(parent)?.get(name)
      openers.get(parent)?.delete(name)
      return opener
    },
  }
}

function unclosedDirective(container: OpenDirective): Block {
  const fault = malformedDirective(`the ${container.name} container is unclosed: no ${spellDirectiveCloser(container.name)} follows inside the block holding it; ${directiveEscape}`)
  return { fault, kind: 'fault', position: container.position }
}

// An empty item closes at the blank line after it, yet the next item continues its list unless that list ended.
function continuedList(previous: Block | undefined, list: ListBlock, ended: ReadonlySet<ListBlock>): ListBlock | undefined {
  return isList(previous) && !ended.has(previous) && continuesList(previous, list) ? previous : undefined
}

// Returns the leaf open after this line.
function readLine(tree: BlockTree, leaf: OpenLeaf | undefined, line: Line, at: LineContext): OpenLeaf | undefined {
  const matched = matchContainers(tree.containers, leaf, line)
  // CommonMark: no container opens inside an open code or HTML block.
  if (matched.depth === tree.containers.open.length && swallowsLines(leaf)) return readBlockLine(tree, leaf, matched.rest, at)
  const paragraphOpen = matched.depth === tree.containers.open.length && leaf?.kind === 'paragraph'
  const opened = openContainers(tree, leaf, matched.rest, paragraphOpen, matched.depth, at)
  if (opened.opened || matched.depth === tree.containers.open.length) return readBlockLine(tree, opened.leaf, opened.rest, at)
  if (continuesLazily(leaf, opened.rest, at.claims)) return appendParagraph(leaf, lineText(opened.rest), at.position)
  return readBlockLine(tree, closeContainers(tree, leaf, matched.depth, at), opened.rest, at)
}

function swallowsLines(leaf: OpenLeaf | undefined): boolean {
  return leaf?.kind === 'fenced-code' || leaf?.kind === 'html'
}

// A directive container has no continuation marker, so every line continues it.
function matchContainers(containers: BlockTree['containers'], leaf: OpenLeaf | undefined, line: Line): { depth: number; rest: Line } {
  if (isBlankLine(line.text)) return matchBlankLine(containers, leaf, line, 0, 0)
  let quotesPassed = 0
  let rest = line
  for (const [index, { container, depth }] of containers.edges.entries()) {
    const next = continuesContainer(container, rest)
    if (next === undefined) return { depth, rest }
    rest = next
    if (container.kind !== 'blockquote') continue
    quotesPassed += 1
    if (isBlankLine(rest.text)) return matchBlankLine(containers, leaf, rest, index + 1, quotesPassed)
  }
  return { depth: containers.open.length, rest }
}

// A blank line continues every list item up to the next blockquote, so it is matched in one step rather than one per item.
// A list item begins with at most one blank line: an empty one gives the second up. Only the innermost item is empty:
// opening a container inside an item gives it a block.
function matchBlankLine(containers: BlockTree['containers'], leaf: OpenLeaf | undefined, line: Line, from: number, quotesPassed: number): { depth: number; rest: Line } {
  const { edges, quoteEdges } = containers
  const last = edges.length - 1
  const innermost = edges[last]?.container
  const emptyItem = innermost?.kind === 'item' && innermost.blocks.length === 0 && leaf === undefined
  const stop = Math.min(quoteEdges[quotesPassed] ?? edges.length, emptyItem ? last : edges.length)
  return { depth: edges[stop]?.depth ?? containers.open.length, rest: stop === from ? line : { column: line.column, spaces: 0, text: '' } }
}

function continuesContainer(container: EdgeContainer, line: Line): Line | undefined {
  if (container.kind === 'blockquote') return blockquoteRest(removeColumns(line, largestOpenerIndentation))
  return leadingColumns(line, container.indentation) < container.indentation ? undefined : removeColumns(line, container.indentation)
}

function blockquoteRest(opener: Line): Line | undefined {
  if (opener.spaces > 0 || !opener.text.startsWith('>')) return undefined
  return removeColumns({ column: opener.column + 1, spaces: 0, text: opener.text.slice(1) }, 1)
}

function openContainers(tree: BlockTree, leaf: OpenLeaf | undefined, line: Line, paragraphOpen: boolean, depth: number, at: LineContext): { leaf: OpenLeaf | undefined; opened: boolean; rest: Line } {
  const unmatched = tree.containers.open[depth]
  const tail = thematicBreakTail(lineText(line))
  let open = leaf
  let opened = false
  let rest = line
  while (leadingColumns(rest) < indentedCodeColumns) {
    const start = containerStart(rest, tail, opened ? false : paragraphOpen, opened ? undefined : unmatched, at.position)
    if (start === undefined) break
    if (!opened) open = closeContainers(tree, leaf, depth, at)
    opened = true
    tree.openContainer(start, at.position)
    rest = start.kind === 'item' && at.claims.directives ? afterItemMarker(tree, start.rest, at.position) : start.rest
  }
  return { leaf: open, opened, rest }
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
  const after: Line = { column: opener.column + marker.width, spaces: 0, text: opener.text.slice(marker.width) }
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

function afterItemMarker(tree: BlockTree, line: Line, position: SourcePosition): Line {
  const marker = line.spaces === 0 ? readItemMarker(line.text) : undefined
  if (marker === undefined) return line
  tree.append({ attributes: marker.attributes, kind: 'marker', placement: 'item', position })
  return { column: line.column + marker.rest, spaces: 0, text: line.text.slice(marker.rest) }
}

function isList(block: Block | undefined): block is ListBlock {
  return block?.kind === 'bulletList' || block?.kind === 'orderedList'
}

function closeContainers(tree: BlockTree, leaf: OpenLeaf | undefined, depth: number, at: LineContext): undefined {
  closeLeaf(tree, leaf, at)
  tree.close(depth)
  return undefined
}

function applyDirectiveLine(tree: BlockTree, directive: DirectiveLine, position: SourcePosition): void {
  if (directive.kind === 'closer') closeDirective(tree, directive.name, position)
  else if (directive.kind === 'marker') tree.append({ attributes: directive.attributes, kind: 'marker', placement: 'line', position })
  else {
    const { name } = directive
    tree.openDirective({ argument: directive.argument, attributes: directive.attributes, blocks: blockDirectiveForm(name) === 'container' ? [] : undefined, kind: 'directive', name, position })
  }
}

function closeDirective(tree: BlockTree, name: string, position: SourcePosition): void {
  const closer = spellDirectiveCloser(name)
  if (blockDirectiveForm(name) === 'leaf') {
    tree.faultLeafOpener(name, malformedDirective(`${name} takes no body, so no ${closer} closes it; ${directiveEscape}`), position)
    return
  }
  const depth = openDirectiveDepth(tree.containers, name)
  if (depth === undefined) tree.append({ fault: malformedDirective(`the closer ${closer} closes no ${name} container open where it stands; ${directiveEscape}`), kind: 'fault', position })
  else tree.closeDirective(depth)
}

// A closer crosses no list item or blockquote edge.
function openDirectiveDepth(containers: BlockTree['containers'], name: string): number | undefined {
  const depth = containers.directiveDepth(name)
  return depth === undefined || depth < (containers.edges.at(-1)?.depth ?? -1) ? undefined : depth
}

function entryOf<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const known = map.get(key)
  if (known !== undefined) return known
  const created = create()
  map.set(key, created)
  return created
}

// A claimed line ends the lazy continuation CommonMark would fold it into (spec/flavour.md).
function continuesLazily(leaf: OpenLeaf | undefined, line: Line, claims: Claims): boolean {
  if (leaf?.kind !== 'paragraph' || isBlankLine(line.text)) return false
  if (leadingColumns(line) >= indentedCodeColumns) return true
  const opener = lineText(removeColumns(line, largestOpenerIndentation))
  return !opensBlock(claims, opener)
}

// Whether the line opens a block other than a paragraph, a setext underline or indented code.
function opensBlock(claims: Claims, opener: string): boolean {
  if ((claims.directives && readDirectiveLine(opener) !== undefined) || (claims.pipeTables !== false && claimsPipeLine(opener)) || isThematicBreak(opener)) return true
  return atxHeading(opener) !== undefined || openingCodeFence(opener) !== undefined || openingHtmlBlock(opener, true) !== undefined
}

function readBlockLine(tree: BlockTree, leaf: OpenLeaf | undefined, line: Line, at: LineContext): OpenLeaf | undefined {
  if (leaf?.kind === 'fenced-code') {
    if (closingCodeFence(lineText(removeColumns(line, largestOpenerIndentation)), leaf.marker)) return closeLeaf(tree, leaf, at)
    leaf.lines.push(lineText(removeColumns(line, leaf.indentation)))
    return leaf
  }
  if (leaf?.kind === 'html') return (leaf.closer === undefined ? isBlankLine(line.text) : leaf.closer.test(lineText(line))) ? closeLeaf(tree, leaf, at) : leaf
  if (leaf?.kind === 'pipe-table') {
    const cells = leadingColumns(line) < indentedCodeColumns ? pipeTableRow(at.claims, lineText(removeColumns(line, largestOpenerIndentation))) : undefined
    if (cells !== undefined) {
      leaf.rows.push(cells)
      return leaf
    }
  }
  if (leaf?.kind === 'indented-code' && readIndentedCodeLine(leaf, line)) return leaf
  const open = leaf?.kind === 'paragraph' ? leaf : closeLeaf(tree, leaf, at)
  if (isBlankLine(line.text)) return closeLeaf(tree, open, at)
  if (open === undefined && leadingColumns(line) >= indentedCodeColumns) {
    return { held: [], kind: 'indented-code', lines: [lineText(removeColumns(line, indentedCodeColumns))], position: at.position }
  }
  return openLeaf(tree, open, line, at)
}

function readIndentedCodeLine(leaf: Extract<OpenLeaf, { kind: 'indented-code' }>, line: Line): boolean {
  if (isBlankLine(line.text)) {
    leaf.held.push(lineText(removeColumns(line, indentedCodeColumns)))
    return true
  }
  if (leadingColumns(line) < indentedCodeColumns) return false
  for (const held of leaf.held) leaf.lines.push(held)
  leaf.lines.push(lineText(removeColumns(line, indentedCodeColumns)))
  leaf.held.length = 0
  return true
}

function openLeaf(tree: BlockTree, leaf: OpenParagraph | undefined, line: Line, at: LineContext): OpenLeaf | undefined {
  const { claims, position } = at
  const opener = lineText(removeColumns(line, largestOpenerIndentation))
  const directive = claims.directives ? readDirectiveLine(opener) : undefined
  if (directive !== undefined) {
    closeLeaf(tree, leaf, at)
    if (directive.fault === undefined) applyDirectiveLine(tree, directive.value, position)
    else tree.append({ fault: directive.fault, kind: 'fault', position })
    return undefined
  }
  const table = leadingColumns(line) < indentedCodeColumns ? gfmTable(tree, leaf, opener, at) : undefined
  if (table !== undefined) return table
  const cells = claims.pipeTables === false ? undefined : pipeCells(opener)
  if (cells !== undefined) {
    closeLeaf(tree, leaf, at)
    return { kind: 'pipe-table', position, rows: [cells] }
  }
  const underline = readSetextUnderline(tree, leaf, opener, claims)
  if (underline.read || readLineBlock(tree, underline.leaf, opener, at)) return undefined
  const fence = openingCodeFence(opener)
  if (fence !== undefined) {
    closeLeaf(tree, underline.leaf, at)
    return { indentation: leadingColumns(line), info: fence.info, kind: 'fenced-code', lines: [], marker: fence.marker, position }
  }
  const html = openingHtmlBlock(opener, underline.leaf !== undefined)
  if (html === undefined) return appendParagraph(underline.leaf, lineText(line), position)
  closeLeaf(tree, underline.leaf, at)
  const block: OpenLeaf = { closer: html.closer, construct: html.construct, kind: 'html', position }
  return html.closer?.test(lineText(line)) === true ? closeLeaf(tree, block, at) : block
}

// A setext underline over a paragraph the definitions emptied is no heading: it opens the next block.
function readSetextUnderline(tree: BlockTree, leaf: OpenParagraph | undefined, opener: string, claims: Claims): { leaf: OpenParagraph | undefined; read: boolean } {
  if (leaf === undefined) return { leaf, read: false }
  const level = setextHeadingLevel(opener)
  if (level === undefined) return { leaf, read: false }
  const paragraph = takeParagraph(tree, leaf, claims)
  if (paragraph === undefined) return { leaf: undefined, read: false }
  tree.append(paragraph.kind === 'fault' ? paragraph : (bareTableFault(paragraph, claims) ?? { ...paragraph, kind: 'heading', level }))
  return { leaf: undefined, read: true }
}

function readLineBlock(tree: BlockTree, leaf: OpenParagraph | undefined, opener: string, at: LineContext): boolean {
  const { claims, position } = at
  if (isThematicBreak(opener)) {
    closeLeaf(tree, leaf, at)
    tree.append({ kind: 'rule', position })
    return true
  }
  const heading = atxHeading(opener)
  if (heading === undefined) return false
  closeLeaf(tree, leaf, at)
  const trailed = claims.directives ? readTrailingMarker(heading.text, claims) : undefined
  tree.append({ kind: 'heading', level: heading.level, position, ...trailedText(trailed?.text ?? heading.text, trailed) })
  return true
}

function appendParagraph(leaf: OpenLeaf | undefined, line: string, position: SourcePosition): OpenLeaf {
  const text = line.replace(/^[ \t]+/, '')
  if (leaf?.kind !== 'paragraph') return { kind: 'paragraph', lines: [{ position, text }], position }
  leaf.lines.push({ position, text })
  return leaf
}

function closeLeaf(tree: BlockTree, leaf: OpenLeaf | undefined, { claims }: LineContext): undefined {
  if (leaf === undefined) return undefined
  const { position } = leaf
  if (leaf.kind === 'paragraph') {
    const paragraph = takeParagraph(tree, leaf, claims)
    if (paragraph === undefined) tree.endList()
    else tree.append(paragraph.kind === 'fault' ? paragraph : (bareTableFault(paragraph, claims) ?? paragraph))
  } else if (leaf.kind === 'html') tree.append({ construct: leaf.construct, kind: 'html', position })
  else if (leaf.kind === 'pipe-table') tree.append(pipeTableBlock(leaf.rows, position, claims))
  else tree.append({ kind: 'code', language: leaf.kind === 'fenced-code' ? decodeTextEscapes(leaf.info) : '', position, text: leaf.lines.join('\n') })
  return undefined
}

// GFM, Tables: a paragraph's last line heads a table where a delimiter row of its cell count follows.
function gfmTable(tree: BlockTree, paragraph: OpenParagraph | undefined, opener: string, at: LineContext): OpenLeaf | undefined {
  if (at.claims.pipeTables !== 'gfm' || paragraph === undefined) return undefined
  const delimiter = pipeCells(opener) ?? barePipeCells(opener)
  const last = paragraph.lines.at(-1)
  const header = last === undefined ? undefined : barePipeCells(last.text)
  if (last === undefined || delimiter === undefined || header?.length !== delimiter.length || !isDelimiterRow(delimiter)) return undefined
  const [first, ...earlier] = paragraph.lines.slice(0, -1)
  closeLeaf(tree, first === undefined ? undefined : { ...paragraph, lines: [first, ...earlier] }, at)
  return { kind: 'pipe-table', position: last.position, rows: [header, delimiter] }
}

// GFM, Tables: a row without its leading `|` continues the table until a blank line or a line opening another block, and a line holding no `|` is one cell.
function pipeTableRow(claims: Claims, line: string): string[] | undefined {
  const cells = pipeCells(line)
  if (cells !== undefined || claims.pipeTables !== 'gfm' || isBlankLine(line) || opensBlock(claims, line)) return cells
  return barePipeCells(line) ?? [trimSpace(line)]
}

function pipeTableBlock(rows: readonly [string[], ...string[][]], position: SourcePosition, claims: Claims): Block {
  const [header, delimiter, ...body] = rows
  if (claims.pipeTables === 'flavour' && delimiter !== undefined && delimiter.some(isPipeAlignment)) {
    return faultedBlock('a pipe table carries no column alignment ADF could hold: this delimiter row holds an alignment colon', position)
  }
  if (delimiter === undefined || !isDelimiterRow(delimiter)) {
    return faultedBlock('a pipe table underlines its header with a row of `-` runs: this one has none; \\| at the start of every row keeps them literal text', position)
  }
  const padsShortRows = claims.pipeTables === 'gfm'
  const ragged = [delimiter, ...body].find((row) => (padsShortRows && row !== delimiter ? row.length > header.length : row.length !== header.length))
  if (ragged !== undefined) return faultedBlock(`a pipe table row holds ${cellCount(ragged.length)} where its header holds ${cellCount(header.length)}`, position)
  let held = header.length + delimiter.length
  let padding = 0
  for (const row of body) {
    held += row.length
    padding += header.length - row.length
  }
  if (padding > held) {
    return faultedBlock(`a pipe table's short rows would pad ${cellCount(padding)}, more than the ${cellCount(held)} it holds: write the empty cells out`, position)
  }
  const padded = body.map((row) => [...row, ...Array.from({ length: header.length - row.length }, () => '')])
  return { kind: 'table', position, rows: [header, ...padded] }
}

// spec/flavour.md, Tables: GFM's table without the leading pipes, which no line of it claims.
function bareTableFault(paragraph: ParagraphBlock, claims: Claims): Block | undefined {
  if (claims.pipeTables !== 'flavour') return undefined
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

// The definitions a paragraph gives up are whole lines, so what is left starts at one this held. A trailing marker is read first: its id is no definition's destination.
function takeParagraph(tree: BlockTree, leaf: OpenParagraph, claims: Claims): Extract<Block, { kind: 'fault' }> | ParagraphBlock | undefined {
  const lines = leaf.lines.map((line) => line.text).join('\n')
  const trailed = claims.directives ? readTrailingMarker(lines, claims) : undefined
  const text = tree.takeDefinitions(trailed?.text ?? lines)
  if (text === '' && trailed !== undefined) return { fault: malformedDirective(`an ${markerOpener}…} marker ends a paragraph holding no text once its link reference definitions are read; ${directiveEscape}`), kind: 'fault', position: leaf.position }
  if (text === '') return partMarker(tree)
  const kept = leaf.lines[leaf.lines.length - text.split('\n').length]
  return { kind: 'paragraph', position: kept?.position ?? leaf.position, ...trailedText(text, trailed) }
}

// Definitions between a marker line and its block are no blank line: the fault stands after the marker, which reads it first.
function partMarker(tree: BlockTree): undefined {
  const previous = tree.last()
  if (previous?.kind !== 'marker' || previous.placement !== 'line') return undefined
  const fault = malformedDirective(`only a blank line, never a link reference definition, parts an ${markerOpener}…} marker from the rule or list below it, and no line parts it from any other block; ${directiveEscape}`)
  tree.append({ fault, kind: 'fault', position: previous.position })
  return undefined
}


// A block holding no marker has no `trailing` key.
function trailedText(text: string, trailed: TrailingMarker | undefined): { text: string; trailing?: Read<DirectiveAttributes> } {
  return trailed === undefined ? { text } : { text, trailing: trailed.attributes }
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

// `upTo` caps the cost: checking a line against an item's width reads at most that width.
function leadingColumns(line: Line, upTo = Infinity): number {
  let columns = line.spaces
  for (const character of line.text) {
    if (columns >= upTo) break
    if (character === ' ') columns += 1
    else if (character === '\t') columns += tabStop - ((line.column + columns) % tabStop)
    else break
  }
  return columns
}

// CommonMark's tab stops.
function removeColumns(line: Line, columns: number): Line {
  const target = line.column + columns
  if (line.spaces >= columns) return { column: target, spaces: line.spaces - columns, text: line.text }
  let column = line.column + line.spaces
  let index = 0
  while (column < target && index < line.text.length) {
    const character = line.text.charAt(index)
    if (character !== ' ' && character !== '\t') break
    const width = character === ' ' ? 1 : tabStop - (column % tabStop)
    index += 1
    if (column + width > target) return { column: target, spaces: column + width - target, text: line.text.slice(index) }
    column += width
  }
  return { column, spaces: 0, text: line.text.slice(index) }
}

function lineText(line: Line): string {
  return line.spaces === 0 ? line.text : ' '.repeat(line.spaces) + line.text
}

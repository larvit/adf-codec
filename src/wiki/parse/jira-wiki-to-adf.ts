import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { ConvertFault, ParseError, Result } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { notAString } from '../../not-a-string.ts'
import { panelColours } from '../spellings.ts'
import { positioned, success } from '../../result.ts'
import { readAdfMacro } from './adf-macro.ts'
import { readInline } from './inline.ts'
import { withinEngineLimits } from '../../length-bound.ts'

// An open `{quote}` or `{panel}`, or the document: `content` is its node's own array.
type Container = { content: AdfNode[]; kind: 'document' | 'panel' | 'quote' }

type Fault = { fault: ConvertFault }

// One open list per marker of the last item's line: `item` is the content of its last item, `list` its items.
type Level = { item: AdfNode[]; list: AdfNode[]; marker: string }

// `end`: the line's end, less its whitespace; `next`: where the line after it starts.
type Line = { end: number; next: number; start: number; text: string }

// `paragraph`: the content a following text line joins after a hardBreak; `rows`: the rows a following row line joins.
type Reading = { containers: Container[]; levels: Level[]; paragraph: AdfNode[] | undefined; rows: AdfNode[] | undefined; wiki: string }

const codeMacro = /\{(code|noformat)(?::([^}\n]*))?\}/y
const codeEdge = /\r?\n|/y
const documentCarry = /^\s*\{adf:display=block\}\s*\{"type":"doc","version":1\}\s*\{adf\}\s*$/
const image = /^!([^\s!|]+)(?:\|([^!]*))?!$/
const itemMarker = /^([*#]+|-+) +/
const lineSpace = /[^\S\n]*/y
const lineWord = /^(?:bq|h([1-6]))\.\s*/
const panelMacro = /\{panel(?::([^}\n]*))?\}/y
const quoteMacro = '{quote}'
const space = /\s/u

export function jiraWikiToAdf(wiki: string): Result<AdfDocument, ParseError> {
  return positioned(withinEngineLimits(() => readWiki(wiki)), { line: 1, offset: 0 })
}

function readWiki(wiki: string): Result<AdfDocument> {
  if (typeof wiki !== 'string') return notAString(wiki, 'Jira wiki markup')
  if (documentCarry.test(wiki)) return success({ type: 'doc', version: 1 })
  const root: Container = { content: [], kind: 'document' }
  const reading: Reading = { containers: [root], levels: [], paragraph: undefined, rows: undefined, wiki }
  let at = 0
  let next = 0
  while (at < wiki.length) {
    if (at >= next) next = (wiki.indexOf('\n', at) + 1) || wiki.length
    lineSpace.lastIndex = at
    const start = at + (lineSpace.exec(wiki)?.[0].length ?? 0)
    const read = readMacro(reading, start) ?? readRest(reading, start, next)
    if (typeof read !== 'number') return { error: { ...read.fault, path: [], position: lineStart(wiki, start) }, ok: false }
    at = read
  }
  closeContainers(reading, 1)
  return success({ content: root.content, type: 'doc', version: 1 })
}

// A line is cut out once, however many macros open it: `readMacro` reads by index, and every other reader ends its line.
function readRest(reading: Reading, start: number, next: number): Fault | number {
  const text = reading.wiki.slice(start, next).trim()
  return text === '' ? closeBlocks(reading, next) : readLine(reading, { end: start + text.length, next, start, text })
}

// spec/wiki.md, Blocks: reads the block or the line at `line.start`, and returns where reading goes on.
function readLine(reading: Reading, line: Line): Fault | number {
  const { next, start, text } = line
  const worded = lineWord.exec(text)
  if (worded !== null) return readWordedLine(reading, line, start + worded[0].length, worded[1])
  if (/^-{4,}$/.test(text)) return pushBlock(reading, { type: 'rule' }, next)
  const marker = itemMarker.exec(text)
  const markers = marker === null ? undefined : itemMarkers(reading.levels, marker[1] ?? '')
  if (marker !== null && markers !== undefined) return readItem(reading, line, markers, start + marker[0].length)
  if (text.startsWith('|')) {
    const row = readRow(reading, line)
    if (row !== undefined) return row
  }
  const [, url, held] = image.exec(text) ?? []
  if (url?.includes('://') === true) return pushBlock(reading, { attrs: { layout: 'center' }, content: [media(url, held)], type: 'mediaSingle' }, next)
  return readTextLine(reading, line)
}

// spec/wiki.md, Blocks: n dashes keep the open list's first n - 1 markers, padded with `*`, and end in a bullet, as Jira nests them; where no list is open, `--` and its longer runs are no marker.
function itemMarkers(levels: readonly Level[], marker: string): string | undefined {
  if (!marker.startsWith('-')) return marker
  if (marker.length > 1 && levels.length === 0) return undefined
  const kept = levels.slice(0, marker.length - 1).map((level) => level.marker).join('')
  return `${kept.padEnd(marker.length - 1, '*')}*`
}

// `undefined` where no block macro stands at `start`: a line's start, or the end of the macro before it.
function readMacro(reading: Reading, start: number): Fault | number | undefined {
  const { containers, wiki } = reading
  if (!wiki.startsWith('{', start)) return undefined
  const carried = readAdfMacro(wiki, start, wiki.length)
  if (carried?.fault !== undefined) return { fault: carried.fault }
  if (carried !== undefined) return carried.value.inline ? undefined : pushBlock(reading, carried.value.node, carried.value.end)
  codeMacro.lastIndex = start
  const code = codeMacro.exec(wiki)
  if (code !== null) return readCode(reading, codeMacro.lastIndex, code[1] ?? '', code[2])
  if (wiki.startsWith(quoteMacro, start)) {
    const open = containers.findIndex(({ kind }) => kind === 'quote')
    if (open === -1) openContainer(reading, 'quote', { type: 'blockquote' })
    else closeContainers(reading, open)
    return start + quoteMacro.length
  }
  panelMacro.lastIndex = start
  const panel = panelMacro.exec(wiki)
  const open = containers.findIndex(({ kind }) => kind === 'panel')
  if (panel === null || (open !== -1 && panel[1] !== undefined)) return undefined
  if (open === -1) openPanel(reading, parameters(panel[1] ?? '', '|'))
  else closeContainers(reading, open)
  return panelMacro.lastIndex
}

// The text stands between the macros whole, less the line ending after the opening one and the line ending before the closing one.
function readCode(reading: Reading, from: number, name: string, held: string | undefined): number {
  const { wiki } = reading
  const closer = `{${name}}`
  const close = wiki.indexOf(closer, from)
  const end = close === -1 ? wiki.length : close
  codeEdge.lastIndex = from
  const start = from + (codeEdge.exec(wiki)?.[0].length ?? 0)
  const ending = wiki.startsWith('\r\n', end - 2) ? 2 : wiki.startsWith('\n', end - 1) ? 1 : 0
  const text = wiki.slice(start, Math.max(start, end - ending)).replaceAll('\r\n', '\n')
  const [first = ''] = (held ?? '').split('|')
  const language = name === 'noformat' ? '' : first === '' || first.includes('=') ? 'java' : first.trim().toLowerCase()
  return pushBlock(reading, { attrs: { language }, ...(text === '' ? {} : { content: [{ text, type: 'text' }] }), type: 'codeBlock' }, close === -1 ? wiki.length : close + closer.length)
}

function openPanel(reading: Reading, held: ReadonlyMap<string, string>): void {
  const colour = held.get('bgColor')?.toLowerCase()
  const panelType = Object.entries(panelColours).find(([, spelled]) => spelled === colour)?.[0] ?? 'info'
  const title = held.get('title') ?? ''
  const content = openContainer(reading, 'panel', { attrs: { panelType }, type: 'panel' })
  if (title !== '') content.push({ content: [{ marks: [{ type: 'strong' }], text: title, type: 'text' }], type: 'paragraph' })
}

function openContainer(reading: Reading, kind: Container['kind'], node: AdfNode): AdfNode[] {
  const content: AdfNode[] = []
  pushBlock(reading, { ...node, content }, 0)
  reading.containers.push({ content, kind })
  return content
}

// Closes every container from `open` on: one holding nothing holds an empty paragraph.
function closeContainers(reading: Reading, open: number): void {
  closeBlocks(reading, 0)
  for (const { content } of reading.containers.splice(open)) if (content.length === 0) content.push({ type: 'paragraph' })
}

// `h1.` to `h6.` and `bq.`, each one line.
function readWordedLine(reading: Reading, { end, next }: Line, from: number, level: string | undefined): Fault | number {
  const inline = readInline(reading.wiki, from, end, false)
  if (inline.fault !== undefined) return inline
  const content = inline.nodes.length === 0 ? {} : { content: inline.nodes }
  const node: AdfNode = level === undefined ? { content: [{ ...content, type: 'paragraph' }], type: 'blockquote' } : { attrs: { level: Number(level) }, ...content, type: 'heading' }
  return pushBlock(reading, node, next)
}

// A marker per level: the levels the line shares with the item before it stay open, and a level it skips holds an item of an empty paragraph.
function readItem(reading: Reading, { end, next }: Line, markers: string, from: number): Fault | number {
  const { levels } = reading
  if (markers.length > largestNesting) return { fault: { code: 'unsupported-nesting-depth', message: `lists nest deeper than ${largestNesting} levels` } }
  const inline = readInline(reading.wiki, from, end, false)
  if (inline.fault !== undefined) return inline
  let shared = 0
  while (shared < markers.length && levels[shared]?.marker === markers.charAt(shared)) shared += 1
  if (shared === 0) closeBlocks(reading, 0)
  levels.length = shared
  for (let depth = shared; depth < markers.length; depth += 1) {
    const list: AdfNode[] = []
    const marker = markers.charAt(depth)
    const holder = depth === 0 ? blocksOf(reading) : levels[depth - 1]?.item
    holder?.push(marker === '#' ? { attrs: { order: 1 }, content: list, type: 'orderedList' } : { content: list, type: 'bulletList' })
    levels.push({ item: depth < markers.length - 1 ? pushItem(list, { type: 'paragraph' }) : [], list, marker })
  }
  const level = levels[markers.length - 1]
  if (level === undefined) return next
  level.item = pushItem(level.list, inline.nodes.length === 0 ? { type: 'paragraph' } : { content: inline.nodes, type: 'paragraph' })
  reading.paragraph = inline.nodes.length === 0 ? undefined : inline.nodes
  return next
}

function pushItem(list: AdfNode[], paragraph: AdfNode): AdfNode[] {
  const item = [paragraph]
  list.push({ content: item, type: 'listItem' })
  return item
}

// spec/wiki.md, Blocks: a row is one line, and each `|` or `||` opens a cell, the last one closing the row; `undefined` where the line holds no cell.
function readRow(reading: Reading, { end, next, start }: Line): Fault | number | undefined {
  const { wiki } = reading
  const cells: AdfNode[] = []
  let at = start
  while (at < end) {
    const header = wiki.startsWith('||', at)
    let from = at + (header ? 2 : 1)
    if (from >= end) break
    while (space.test(wiki.charAt(from))) from += 1
    const inline = readInline(wiki, from, end, true)
    if (inline.fault !== undefined) return inline
    const nodes = trimmedEnd(inline.nodes)
    cells.push({ content: [nodes.length === 0 ? { type: 'paragraph' } : { content: nodes, type: 'paragraph' }], type: header ? 'tableHeader' : 'tableCell' })
    at = inline.end
  }
  if (cells.length === 0) return undefined
  if (reading.rows === undefined) {
    const rows: AdfNode[] = []
    pushBlock(reading, { attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: rows, type: 'table' }, 0)
    reading.rows = rows
  }
  reading.rows.push({ content: cells, type: 'tableRow' })
  return next
}

// A cell's text ends before the whitespace its closing `|` follows.
function trimmedEnd(nodes: AdfNode[]): AdfNode[] {
  const last = nodes.at(-1)
  if (last?.type !== 'text' || last.text === undefined) return nodes
  const text = last.text.trimEnd()
  const trimmed = nodes.slice(0, -1)
  if (text !== '') trimmed.push({ ...last, text })
  return trimmed
}

function media(url: string, held: string | undefined): AdfNode {
  const alt = parameters(held ?? '', ',').get('alt') ?? ''
  return { attrs: { ...(alt === '' ? {} : { alt }), type: 'external', url }, type: 'media' }
}

// A text line joins the paragraph before it, or its item's, after a hardBreak.
function readTextLine(reading: Reading, { end, next, start }: Line): Fault | number {
  const inline = readInline(reading.wiki, start, end, false)
  if (inline.fault !== undefined) return inline
  if (inline.nodes.length === 0) return next
  if (reading.paragraph === undefined) {
    pushBlock(reading, { content: inline.nodes, type: 'paragraph' }, 0)
    reading.paragraph = inline.nodes
    return next
  }
  reading.paragraph.push({ type: 'hardBreak' })
  for (const node of inline.nodes) reading.paragraph.push(node)
  return next
}

// Ends the open paragraph, list and table, then stands the block in the innermost open container.
function pushBlock(reading: Reading, node: AdfNode, next: number): number {
  closeBlocks(reading, next)
  blocksOf(reading)?.push(node)
  return next
}

function closeBlocks(reading: Reading, next: number): number {
  reading.levels.length = 0
  reading.paragraph = undefined
  reading.rows = undefined
  return next
}

function blocksOf({ containers }: Reading): AdfNode[] | undefined {
  return containers.at(-1)?.content
}

// `key=value` parameters; one holding no `=` is its own key and value.
function parameters(held: string, separator: string): Map<string, string> {
  const read = new Map<string, string>()
  for (const parameter of held.split(separator)) {
    const [key = '', ...value] = parameter.split('=')
    read.set(key.trim(), value.join('=').trim())
  }
  return read
}

function lineStart(wiki: string, index: number): { line: number; offset: number } {
  let line = 1
  let offset = 0
  for (let next = wiki.indexOf('\n'); next >= 0 && next < index; next = wiki.indexOf('\n', next + 1)) {
    line += 1
    offset = next + 1
  }
  return { line, offset }
}

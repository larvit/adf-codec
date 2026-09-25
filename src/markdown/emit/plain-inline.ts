import type { AdfAttributes, AdfMark, AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { mergeAdjacentText, sameMark } from '../../adf/editor-normal.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { plainLineFallback, type PlainLineFallback } from './inline-line.ts'
import { spellDestination, spellLinkTarget } from '../commonmark/link-syntax.ts'

const highlight = 'backgroundColor'
const highlightDelimiter = '=='
const edgeStrippingMarks: readonly string[] = [highlight, 'em', 'strike', 'strong']
const keptMarks: readonly string[] = [...edgeStrippingMarks, 'code', 'link']

export function reduceInline(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  const leaves = inlineLeaves(nodes, container, path, depth)
  if (!leaves.ok) return leaves
  return spellableLine(trimmedEdges(highlighted(trimmedEdges(leaves.value))), container, path)
}

export function isBlockNodeType(type: string): boolean {
  return blockNodeModel(type) !== undefined || type === 'blockCard' || type === 'embedCard'
}

export function inlineLeaves(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  if (depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, path)
  const leaves: AdfNode[] = []
  let joinsNext = false
  for (const [index, node] of nodes.entries()) {
    const held = nodeLeaves(node, container, [...path, 'content', index], depth)
    if (!held.ok) return held
    if (held.value.length === 0) continue
    const block = isBlockNodeType(node.type) && node.type !== 'media'
    if (leaves.length > 0 && (joinsNext || block)) leaves.push(textLeaf(' ', []))
    joinsNext = block
    for (const leaf of held.value) leaves.push(leaf)
  }
  return success(leaves)
}

function nodeLeaves(node: AdfNode, container: LineContainer, path: ConvertErrorPath, depth: number): Result<AdfNode[]> {
  const marks = nodeMarks(node)
  const attrs = nodeAttrs(node)
  if (node.type === 'text') return success(textLeaves(node.text, marks, container))
  if (node.type === 'hardBreak') return success([lineBreak(container)])
  if (node.type === 'date') return success(textLeaves(isoDate(attrs['timestamp']), marks, container))
  if (node.type === 'emoji') return success(textLeaves(nonEmpty(attrs['text']) ?? attrs['shortName'], marks, container))
  if (node.type === 'placeholder') return success([])
  if (node.type === 'mention') return success(textLeaves(nonEmpty(attrs['text']) ?? idMention(attrs['id']), marks, container))
  if (node.type === 'status') return success(textLeaves(attrs['text'], marks, container))
  if (['extension', 'inlineExtension'].includes(node.type)) return success(textLeaves(nonEmpty(attrs['text']), marks, container, noteName(attrs['extensionKey']) ?? 'extension'))
  if (node.type === 'syncBlock') return success(noteLeaves('synced block'))
  if (['media', 'mediaInline'].includes(node.type)) return success(mediaLeaves(attrs, marks, container))
  if (['blockCard', 'embedCard', 'inlineCard'].includes(node.type)) return success(cardLeaves(attrs, marks, container))
  const own = textLeaves(node.text ?? (['expand', 'nestedExpand'].includes(node.type) ? attrs['title'] : undefined), marks, container)
  const held = inlineLeaves(nodeContent(node), container, path, depth + 1)
  if (!held.ok) return held
  return success(own.length > 0 && held.value.length > 0 ? [...own, textLeaf(' ', []), ...held.value] : [...own, ...held.value])
}

function cardLeaves(attrs: Readonly<AdfAttributes>, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  const data = attrs['data']
  const held = typeof data === 'object' && data !== null && !Array.isArray(data) ? data : {}
  const url = nonEmpty(attrs['url'])
  const heldUrl = nonEmpty(held['url'])
  const name = nonEmpty(held['name'])
  const href = url ?? heldUrl
  if (href === undefined) return textLeaves(name, marks, container, 'link card')
  return linkedLeaves(url ?? name ?? href, href, marks, container)
}

function linkedLeaves(text: string, href: string, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  return textLeaves(text, [...marks.filter((mark) => mark.type !== 'link'), { attrs: { href }, type: 'link' }], container)
}

function idMention(id: unknown): string | undefined {
  return typeof id === 'string' && id !== '' ? `@${id}` : undefined
}

// An image standing inline is a link to it: CommonMark's inline image reads back as no node.
function mediaLeaves(attrs: Readonly<AdfAttributes>, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  const alt = nonEmpty(attrs['alt'])
  const url = nonEmpty(attrs['url'])
  if (attrs['type'] !== 'external' || url === undefined) return textLeaves(alt, marks, container, 'image')
  return linkedLeaves(alt ?? url, url, marks, container)
}

function noteLeaves(name: string): AdfNode[] {
  return [textLeaf(`(${name} not included)`, [{ type: 'em' }])]
}

function noteName(value: unknown): string | undefined {
  return typeof value === 'string' ? nonEmpty(oneLine(value).trim()) : undefined
}

export function oneLine(text: string): string {
  return text.replace(/[\r\u0000]/g, '').replace(/\n/g, ' ')
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function isoDate(timestamp: unknown): string | undefined {
  const milliseconds = typeof timestamp === 'string' && /^-?\d+$/.test(timestamp) ? Number(timestamp) : Number.NaN
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) return undefined
  const iso = date.toISOString()
  return iso.slice(0, iso.indexOf('T'))
}

function lineBreak(container: LineContainer): AdfNode {
  return container === 'paragraph' ? { type: 'hardBreak' } : textLeaf(' ', [])
}

// note: what the content is named in the note left where it has none.
function textLeaves(value: unknown, marks: readonly AdfMark[], container: LineContainer, note?: string): AdfNode[] {
  if (typeof value !== 'string') return note === undefined ? [] : noteLeaves(note)
  const text = value.replace(/[\r\u0000]/g, '')
  const kept = plainMarks(marks, container, text)
  const leaves: AdfNode[] = []
  for (const [index, line] of text.split('\n').entries()) {
    if (index > 0) leaves.push(lineBreak(container))
    if (line !== '') leaves.push(textLeaf(line, kept))
  }
  return leaves
}

function textLeaf(text: string, marks: readonly AdfMark[]): AdfNode {
  return marks.length === 0 ? { text, type: 'text' } : { marks: [...marks], text, type: 'text' }
}

// A highlight goes outermost so its run is one run at depth 0, and code innermost, the only place its spelling holds.
function plainMarks(marks: readonly AdfMark[], container: LineContainer, text: string): AdfMark[] {
  const kept: AdfMark[] = []
  for (const mark of marks) {
    if (!keptMarks.includes(mark.type) || kept.some((held) => held.type === mark.type)) continue
    if (mark.type === 'code' && container === 'table-cell' && text.includes('|')) continue
    const plain = mark.type === 'link' ? plainLink(mark, container) : { type: mark.type }
    if (plain !== undefined) kept.push(plain)
  }
  const rank = (mark: AdfMark): number => (mark.type === highlight ? 0 : mark.type === 'code' ? 2 : 1)
  return kept.sort((first, second) => rank(first) - rank(second))
}

function plainLink(mark: AdfMark, container: LineContainer): AdfMark | undefined {
  const attrs = nodeAttrs(mark)
  const held = attrs['href']
  const title = typeof attrs['title'] === 'string' ? attrs['title'].replace(/\r/g, '').replace(/\n/g, ' ') : undefined
  if (typeof held !== 'string') return undefined
  const href = writableHref(container === 'table-cell' ? held.replaceAll('|', '%7C') : held)
  if (title === undefined || spellLinkTarget(href, title) === undefined || (container === 'table-cell' && title.includes('|'))) return { attrs: { href }, type: 'link' }
  return { attrs: { href, title }, type: 'link' }
}

// spec/flavour.md, Links: the characters no destination spelling holds, then an ampersand an entity reference would read.
export function writableHref(href: string): string {
  let written = href
  for (const unwritable of [/[\u0000-\u001f\u007f\\<>]/g, /&/g]) {
    if (spellDestination(written) !== undefined) return written
    written = written.replace(unwritable, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
  }
  return written
}

// The delimiters carry the marks the whole run shares, so they open and close inside them.
function highlighted(leaves: readonly AdfNode[]): AdfNode[] {
  const spelled: AdfNode[] = []
  let run: AdfNode[] = []
  let shared: AdfMark[] = []
  for (const leaf of [...leaves, { type: 'hardBreak' }]) {
    const marks = nodeMarks(leaf)
    if (marks[0]?.type === highlight) {
      const held = marks.slice(1)
      shared = run.length === 0 ? held.filter((mark) => mark.type !== 'code') : shared.filter((mark) => held.some((other) => sameMark(other, mark)))
      run.push(withMarks(leaf, held))
      continue
    }
    if (run.length > 0) for (const held of [textLeaf(highlightDelimiter, shared), ...run, textLeaf(highlightDelimiter, shared)]) spelled.push(held)
    run = []
    spelled.push(leaf)
  }
  return spelled.slice(0, -1)
}

function withMarks(leaf: AdfNode, marks: readonly AdfMark[]): AdfNode {
  const { marks: _, ...unmarked } = leaf
  return marks.length === 0 ? unmarked : { ...unmarked, marks: [...marks] }
}

function trimmedEdges(leaves: readonly AdfNode[]): AdfNode[] {
  for (let current = leaves; ; ) {
    const merged = withoutEdgeBreaks(mergeAdjacentText(current))
    let changed = false
    const trimmed: AdfNode[] = []
    for (const [index, leaf] of merged.entries()) {
      const edges = leafEdges(leaf, merged[index - 1], merged[index + 1])
      if (edges === undefined) {
        trimmed.push(leaf)
        continue
      }
      changed = true
      for (const edge of edges) trimmed.push(edge)
    }
    if (!changed) return merged
    current = trimmed
  }
}

function withoutEdgeBreaks(leaves: readonly AdfNode[]): AdfNode[] {
  let first = 0
  let last = leaves.length - 1
  while (leaves[first]?.type === 'hardBreak') first += 1
  while (last >= first && leaves[last]?.type === 'hardBreak') last -= 1
  return leaves.slice(first, last + 1)
}

// spec/flavour.md, Inline nodes: edge whitespace leaves every stripping mark opening or closing beside it, and goes at a line edge.
function leafEdges(leaf: AdfNode, previous: AdfNode | undefined, next: AdfNode | undefined): AdfNode[] | undefined {
  const marks = nodeMarks(leaf)
  const text = leaf.text
  if (text === undefined || marks.some((mark) => mark.type === 'code')) return undefined
  const lead = text.slice(0, text.search(/[^ \t]|$/))
  const trail = lead === text ? '' : text.slice(text.search(/[ \t]*$/))
  const leadDepth = edgeDepth(marks, previous, lead)
  const trailDepth = edgeDepth(marks, next, trail)
  if (leadDepth === marks.length && trailDepth === marks.length) return undefined
  const edges: AdfNode[] = []
  if (lead !== '' && leadDepth !== undefined) edges.push(textLeaf(lead, marks.slice(0, leadDepth)))
  const core = text.slice(lead.length, text.length - trail.length)
  if (core !== '') edges.push(textLeaf(core, marks))
  if (trail !== '' && trailDepth !== undefined) edges.push(textLeaf(trail, marks.slice(0, trailDepth)))
  return edges
}

// The marks the whitespace keeps, or undefined where it goes.
function edgeDepth(marks: readonly AdfMark[], neighbour: AdfNode | undefined, whitespace: string): number | undefined {
  if (whitespace === '') return marks.length
  const lineEdge = neighbour === undefined || neighbour.type === 'hardBreak'
  const neighbourMarks = lineEdge ? [] : nodeMarks(neighbour)
  let shared = 0
  while (shared < marks.length && sameMarkAt(marks, neighbourMarks, shared)) shared += 1
  const stripping = marks.findIndex((mark, index) => index >= shared && edgeStrippingMarks.includes(mark.type))
  const kept = stripping === -1 ? marks.length : stripping
  return kept === 0 && lineEdge ? undefined : kept
}

function sameMarkAt(marks: readonly AdfMark[], others: readonly AdfMark[], index: number): boolean {
  const mark = marks[index]
  const other = others[index]
  return mark !== undefined && other !== undefined && sameMark(mark, other)
}

function spellableLine(leaves: AdfNode[], container: LineContainer, path: ConvertErrorPath): Result<AdfNode[]> {
  for (let current = leaves; ; ) {
    const fallback = plainLineFallback(current, container, path)
    if (!fallback.ok) return fallback
    if (fallback.value === undefined) return success(current)
    const fixed = withoutFallback(current, fallback.value)
    if (fixed === undefined) return failure('unsupported-node-shape', 'a plain line keeps a spelling that dropping a mark does not change', path)
    current = trimmedEdges(fixed)
  }
}

function withoutFallback(leaves: readonly AdfNode[], fallback: PlainLineFallback): AdfNode[] | undefined {
  if (fallback.kind === 'unspellable-run') return withoutMark(leaves, fallback.run.first, fallback.run.last, fallback.run.depth)
  const first = fallback.kind === 'opening-link' ? 0 : lineStart(leaves, fallback.line)
  const mark = nodeMarks(leaves[first] ?? {})[0]
  if (mark === undefined || mark.type !== (fallback.kind === 'opening-link' ? 'link' : 'code')) return undefined
  let last = first
  while (sameMarkAt(nodeMarks(leaves[last + 1] ?? {}), [mark], 0)) last += 1
  // A code span is what binds the `]` a link definition reads, and dropping it keeps the link target.
  const spans = leaves.slice(first, last + 1).some((leaf) => nodeMarks(leaf).length > 1 && nodeMarks(leaf).at(-1)?.type === 'code')
  if (mark.type === 'link' && spans) return leaves.map((leaf, index) => (index < first || index > last ? leaf : withMarks(leaf, nodeMarks(leaf).filter((held) => held.type !== 'code'))))
  return withoutMark(leaves, first, last, 0)
}

function lineStart(leaves: readonly AdfNode[], line: number): number {
  let index = 0
  for (let breaks = 0; breaks < line && index < leaves.length; index += 1) if (leaves[index]?.type === 'hardBreak') breaks += 1
  return index
}

function withoutMark(leaves: readonly AdfNode[], first: number, last: number, depth: number): AdfNode[] {
  return leaves.map((leaf, index) => (index < first || index > last ? leaf : withMarks(leaf, nodeMarks(leaf).filter((_, held) => held !== depth))))
}

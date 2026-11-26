import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import type { MarkRun } from '../emit/line-escaping.ts'
import type { RunGrouping } from '../emit/inline-runs.ts'
import type { ShownNote } from '../../adf/shown-text.ts'
import { codeTextMarkTypes } from '../../adf/inline-nodes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { identicalMark, mergeAdjacentText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { imageAside } from '../image-aside.ts'
import { inlineRuns, insideRun, type RunNode } from '../emit/inline-runs.ts'
import { isEmphasis } from '../mark-spellings.ts'
import { joinsWhenEditorNormal, sourceIndex, type SourceIndexes } from './editor-normal.ts'
import { largestNesting } from '../../nesting.ts'
import { oneLine, partsShownText, shownImage, shownLink, shownNote, shownText, shownUrl } from '../../adf/shown-text.ts'
import { portableLineFallback, settledLine, type LineJudgement, type PortableLineFallback } from '../emit/inline-line.ts'
import { spellDestination } from '../commonmark/link-syntax.ts'

// What stands beside a leaf's edge: whether a line edge does, and how many runs hold the leaf and its neighbour both.
type Beside = { lineEdge: boolean; sharedRuns: number }

// `keep`: how many of the leaf's marks its edge whitespace keeps; `drop`: the whitespace goes, at a line edge.
type EdgeOutcome = { kind: 'drop' } | { depth: number; kind: 'keep' }

// A text leaf in `withoutEdgeWhitespace`'s list; `lead` and `trail` count its edge whitespace, 0 once gone, and `runsAs` is the leaf with its text cut to one character, so no judging scans the text.
type LinkedLeaf = { breakBefore: AdfNode | undefined; dropped: boolean; lead: number; leaf: AdfNode; next: number; previous: number; runsAs: AdfNode; text: string; trail: number }

// Where a reduction stands: its path, counted in the caller's document by `sources`, and its level as the emitter counts it.
export type ReductionPlace = { depth: number; path: ConvertErrorPath; sources: SourceIndexes }

const highlight = 'backgroundColor'
const highlightMark: AdfMark = { type: highlight }
const edgeStrippingMarks: readonly string[] = [highlight, 'em', 'strike', 'strong']
const keptMarks: readonly string[] = [...edgeStrippingMarks, 'code', 'link']

export function reduceInline(nodes: readonly AdfNode[], container: LineContainer, place: ReductionPlace): Result<AdfNode[]> {
  const leaves = portableLeaves(nodes, container, place)
  if (!leaves.ok) return leaves
  const { path } = place
  // Terminates: withoutFallback refuses a pass that drops no mark, and trimmedEdges adds none.
  return settledLine<readonly AdfNode[], PortableLineFallback, AdfNode[]>(leaves.value, {
    giveUpEmphasis: withoutEmphasis,
    judge: (line, grouping) => portableJudgement(line, grouping, container, path),
    spansEachPass: true,
    take: (line, fallback) => withoutFallback(line, fallback, path),
  })
}

// Trimmed once for `highlightsInsideSharedMarks`; `portableJudgement` trims each grouping's line again.
export function portableLeaves(nodes: readonly AdfNode[], container: LineContainer, place: ReductionPlace): Result<AdfNode[]> {
  const leaves = inlineLeaves(nodes, container, place)
  if (!leaves.ok) return leaves
  return success(highlightsInsideSharedMarks(trimmedEdges(leaves.value, 'spanned')))
}

export function inlineLeaves(nodes: readonly AdfNode[], container: LineContainer, place: ReductionPlace): Result<AdfNode[]> {
  if (place.depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the emitter carries`, place.path)
  const leaves: AdfNode[] = []
  let joinsNext = false
  for (const [index, node] of nodes.entries()) {
    const held = nodeLeaves(node, container, { ...place, path: [...place.path, 'content', sourceIndex(nodes, index, place.sources)] })
    if (!held.ok) return held
    if (held.value.length === 0) continue
    const block = partsShownText(node.type)
    if (leaves.length > 0 && (joinsNext || block)) leaves.push(textLeaf(' ', []))
    joinsNext = block
    for (const leaf of held.value) leaves.push(leaf)
  }
  return success(leaves)
}

function nodeLeaves(node: AdfNode, container: LineContainer, place: ReductionPlace): Result<AdfNode[]> {
  const marks = nodeMarks(node)
  if (node.type === 'text') return success(textLeaves(node.text, marks, container))
  if (node.type === 'hardBreak') return success([lineBreak(container)])
  if (['date', 'emoji', 'mention', 'status'].includes(node.type)) return success(textLeaves(shownText(node), marks, container))
  if (node.type === 'placeholder') return success([])
  if (['extension', 'inlineExtension', 'syncBlock'].includes(node.type)) return success(textLeaves(shownText(node), marks, container, shownNote(node)))
  if (['media', 'mediaInline'].includes(node.type)) return success(mediaLeaves(node, marks, container))
  if (['blockCard', 'embedCard', 'inlineCard'].includes(node.type)) return success(cardLeaves(node, marks, container))
  const own = textLeaves(node.text ?? shownText(node), marks, container)
  const held = inlineLeaves(nodeContent(node), container, { ...place, depth: place.depth + 1 })
  if (!held.ok) return held
  return success(own.length > 0 && held.value.length > 0 ? [...own, textLeaf(' ', []), ...held.value] : [...own, ...held.value])
}

function cardLeaves(card: AdfNode, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  const href = shownUrl(card)
  if (href === undefined) return textLeaves(shownText(card), marks, container, shownNote(card))
  return linkedLeaves(shownText(card) ?? href, href, marks, container)
}

function linkedLeaves(text: string, href: string, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  return textLeaves(text, [...marks.filter((mark) => mark.type !== 'link'), { attrs: { href }, type: 'link' }], container)
}

// An image standing inline is a link to it: the reader builds no node for an inline image, reading it as its alt text linked, and inside a link as the link's text, then (image).
function mediaLeaves(media: AdfNode, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  const image = shownImage(media, shownLink(media)?.href)
  if (image === undefined) return textLeaves(undefined, marks, container, shownNote(media))
  const { after, link, text } = image
  const shown = link === undefined ? textLeaves(text, marks, container) : linkedLeaves(text, link, marks, container)
  return after === undefined ? shown : [...shown, ...imageAside((word) => linkedLeaves(word, after, marks, container))]
}

function noteLeaves({ link, name }: ShownNote, container: LineContainer): AdfNode[] {
  const kept = link === undefined ? undefined : portableLink({ attrs: link, type: 'link' }, container)
  return [textLeaf(`(${name} not included)`, kept === undefined ? [{ type: 'em' }] : [kept, { type: 'em' }])]
}

function lineBreak(container: LineContainer): AdfNode {
  return container === 'paragraph' ? { type: 'hardBreak' } : textLeaf(' ', [])
}

function textLeaves(value: unknown, marks: readonly AdfMark[], container: LineContainer, note?: ShownNote): AdfNode[] {
  if (typeof value !== 'string') return note === undefined ? [] : noteLeaves(note, container)
  const text = value.replace(/[\r\0\p{Cs}]/gu, '')
  const kept = portableMarks(marks, container, text)
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

// A highlight goes first, where `highlighted` looks for it, and code last, the only place its spelling holds.
function portableMarks(marks: readonly AdfMark[], container: LineContainer, text: string): AdfMark[] {
  const kept: AdfMark[] = []
  for (const mark of marks) {
    if (!keptMarks.includes(mark.type) || kept.some((held) => held.type === mark.type)) continue
    if (mark.type === 'code' && container === 'table-cell' && text.includes('|')) continue
    const portable = mark.type === 'link' ? portableLink(mark, container) : { type: mark.type }
    if (portable !== undefined) kept.push(portable)
  }
  const rank = (mark: AdfMark): number => (mark.type === highlight ? 0 : mark.type === 'code' ? 2 : 1)
  const code = kept.some((mark) => mark.type === 'code')
  return kept.filter((mark) => !code || codeTextMarkTypes.includes(mark.type)).sort((first, second) => rank(first) - rank(second))
}

export function portableLink(mark: AdfMark, container: LineContainer): AdfMark | undefined {
  const attrs = nodeAttrs(mark)
  const held = attrs['href']
  const title = typeof attrs['title'] === 'string' ? oneLine(attrs['title']) : undefined
  if (typeof held !== 'string') return undefined
  const href = writableHref(container === 'table-cell' ? held.replaceAll('|', '%7C') : held)
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
}

// A lone surrogate is escaped as U+FFFD's bytes (docs/decisions.md, Portable markdown drops a lone surrogate). spec/flavour.md, Links: then the characters no destination spelling holds, then an ampersand an entity reference would read.
export function writableHref(href: string): string {
  let written = href.replace(/\p{Cs}/gu, '%EF%BF%BD')
  for (const unwritable of [/[\u0000-\u001f\u007f\\<>]/g, /&/g]) {
    if (spellDestination(written) !== undefined) return written
    written = written.replace(unwritable, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)
  }
  return written
}

// The marks a whole highlight run shares go outside the highlight, so its delimiters open and close inside them.
function highlightsInsideSharedMarks(leaves: readonly AdfNode[]): AdfNode[] {
  const spelled: AdfNode[] = []
  let run: AdfNode[] = []
  let shared: AdfMark[] = []
  for (const leaf of [...leaves, { type: 'hardBreak' }]) {
    const marks = nodeMarks(leaf)
    if (marks[0]?.type === highlight) {
      const held = marks.slice(1)
      shared = run.length === 0 ? held : shared.filter((mark) => held.some((other) => identicalMark(other, mark)))
      run.push(leaf)
      continue
    }
    for (const held of run) spelled.push(withMarks(held, [...shared, highlightMark, ...nodeMarks(held).slice(1).filter((mark) => !shared.some((other) => identicalMark(other, mark)))]))
    run = []
    spelled.push(leaf)
  }
  return spelled.slice(0, -1)
}

function withMarks(leaf: AdfNode, marks: readonly AdfMark[]): AdfNode {
  const { marks: _, ...unmarked } = leaf
  return marks.length === 0 ? unmarked : { ...unmarked, marks: [...marks] }
}

export function trimmedEdges(leaves: readonly AdfNode[], grouping: RunGrouping): AdfNode[] {
  // Terminates: a pass that changes a leaf drops whitespace from the leaf's edge or takes a mark off that whitespace, and merging adds no whitespace or mark.
  for (let current = leaves; ; ) {
    const pass = trimmedEdgesPass(current, grouping)
    if (pass.settled) return pass.line
    current = pass.line
  }
}

// `withoutEdgeWhitespace` runs after a pass, never before the first: the first pass takes marks off whitespace by the line as it came.
export function trimmedEdgesPass(leaves: readonly AdfNode[], grouping: RunGrouping): { line: AdfNode[]; settled: boolean } {
  const pass = trimPass(leaves, (line) => trimmingRuns(line, grouping))
  return pass.settled ? pass : { line: withoutEdgeWhitespace(mergeAdjacentText(pass.line, joinsWhenEditorNormal), grouping), settled: false }
}

// Drops the edge whitespace the `trimPass` passes to come would drop, a round per pass.
function withoutEdgeWhitespace(leaves: readonly AdfNode[], grouping: RunGrouping): AdfNode[] {
  const linked: LinkedLeaf[] = []
  let gap: AdfNode | undefined
  for (const leaf of leaves) {
    const text = leaf.text
    if (leaf.type === 'hardBreak') gap = leaf
    // A link run crosses a leaf holding no text, so whitespace beside it goes by leaves further off than a round reads.
    else if (text === undefined) return leaves.slice()
    else {
      const edges = edgeWhitespace(text)
      const { lead, trail } = nodeMarks(leaf).some((mark) => mark.type === 'code') ? { lead: 0, trail: 0 } : edges
      linked.push({ breakBefore: gap, dropped: false, lead, leaf, next: linked.length + 1, previous: linked.length - 1, runsAs: { ...leaf, text: edges.lead === text.length ? ' ' : 'x' }, text, trail })
      gap = undefined
    }
  }
  // Terminates: a round after the first judges only leaves beside a leaf the round before dropped, and each leaf drops once.
  for (let judged = new Set(linked.keys()); judged.size > 0; ) {
    // Every leaf of a round is judged before any changes, as `trimPass` judges against one snapshot.
    const outcomes = [...judged].flatMap((position) => {
      const node = linked[position]
      return node === undefined || node.dropped ? [] : [{ goes: lineEdgesGoing(node, linked, grouping), node }]
    })
    judged = new Set()
    for (const { goes, node } of outcomes) {
      if (!goes.lead && !goes.trail) continue
      if (node.lead === node.text.length) {
        unlink(node, linked)
        judged.add(node.previous).add(node.next)
        continue
      }
      node.text = node.text.slice(goes.lead ? node.lead : 0, node.text.length - (goes.trail ? node.trail : 0))
      node.leaf = textLeaf(node.text, nodeMarks(node.leaf))
      if (goes.lead) node.lead = 0
      if (goes.trail) node.trail = 0
    }
  }
  const kept: AdfNode[] = []
  let position = 0
  for (const leaf of leaves) {
    if (leaf.type === 'hardBreak') {
      kept.push(leaf)
      continue
    }
    const node = linked[position]
    position += 1
    if (node !== undefined && !node.dropped) kept.push(node.leaf)
  }
  return kept
}

function unlink(node: LinkedLeaf, linked: readonly LinkedLeaf[]): void {
  node.dropped = true
  const previous = linked[node.previous]
  const next = linked[node.next]
  if (previous !== undefined) previous.next = node.next
  if (next !== undefined) {
    next.previous = node.previous
    next.breakBefore ??= node.breakBefore
  }
}

// Which of the leaf's edge whitespace goes at a line edge.
function lineEdgesGoing(node: LinkedLeaf, linked: readonly LinkedLeaf[], grouping: RunGrouping): { lead: boolean; trail: boolean } {
  const { breakBefore, runsAs } = node
  const marks = nodeMarks(node.leaf)
  const previous = linked[node.previous]
  const next = linked[node.next]
  return {
    lead: (previous === undefined || breakBefore !== undefined) && edgeOutcome(marks, { lineEdge: true, sharedRuns: runsAcross(previous?.runsAs, breakBefore, runsAs, grouping) }, node.lead).kind === 'drop',
    trail: (next === undefined || next.breakBefore !== undefined) && edgeOutcome(marks, { lineEdge: true, sharedRuns: runsAcross(runsAs, next?.breakBefore, next?.runsAs, grouping) }, node.trail).kind === 'drop',
  }
}

// Counted by index: `/[ \t]*$/` scans a run of blanks again from each of its characters.
function edgeWhitespace(text: string): { lead: number; trail: number } {
  let lead = 0
  while (blankAt(text, lead)) lead += 1
  let trail = 0
  while (blankAt(text, text.length - 1 - trail)) trail += 1
  return { lead, trail }
}

function blankAt(text: string, index: number): boolean {
  const unit = text[index]
  return unit === ' ' || unit === '\t'
}

// The reducer's hard breaks are all alike, so one stands for every hard break between two leaves.
function runsAcross(left: AdfNode | undefined, hardBreak: AdfNode | undefined, right: AdfNode | undefined, grouping: RunGrouping): number {
  return left === undefined || hardBreak === undefined || right === undefined ? 0 : (trimmingRuns([left, hardBreak, right], grouping)[0] ?? 0)
}

// Judges every leaf against one snapshot of `shared`'s counts.
export function trimPass(leaves: readonly AdfNode[], shared: (line: readonly AdfNode[]) => readonly number[]): { line: AdfNode[]; settled: boolean } {
  const merged = withoutEdgeBreaks(mergeAdjacentText(leaves, joinsWhenEditorNormal))
  const counts = shared(merged)
  let changed = false
  const trimmed: AdfNode[] = []
  for (const [index, leaf] of merged.entries()) {
    const edges = leafEdges(leaf, beside(merged[index - 1], counts[index - 1]), beside(merged[index + 1], counts[index]))
    if (edges === undefined) {
      trimmed.push(leaf)
      continue
    }
    changed = true
    for (const edge of edges) trimmed.push(edge)
  }
  return changed ? { line: trimmed, settled: false } : { line: merged, settled: true }
}

function withoutEdgeBreaks(leaves: readonly AdfNode[]): AdfNode[] {
  let first = 0
  let last = leaves.length - 1
  while (leaves[first]?.type === 'hardBreak') first += 1
  while (last >= first && leaves[last]?.type === 'hardBreak') last -= 1
  return leaves.slice(first, last + 1)
}

function beside(neighbour: AdfNode | undefined, sharedRuns = 0): Beside {
  return { lineEdge: neighbour === undefined || neighbour.type === 'hardBreak', sharedRuns }
}

// spec/flavour.md, Inline nodes: edge whitespace leaves every stripping mark opening or closing beside it, and goes at a line edge.
function leafEdges(leaf: AdfNode, before: Beside, after: Beside): AdfNode[] | undefined {
  const marks = nodeMarks(leaf)
  const text = leaf.text
  if (text === undefined || marks.some((mark) => mark.type === 'code')) return undefined
  const blanks = edgeWhitespace(text)
  const lead = text.slice(0, blanks.lead)
  const trail = text.slice(text.length - blanks.trail)
  const leading = edgeOutcome(marks, before, lead.length)
  const trailing = edgeOutcome(marks, after, trail.length)
  if (leading.kind === 'keep' && trailing.kind === 'keep' && leading.depth === marks.length && trailing.depth === marks.length) return undefined
  if (lead === text) return leading.kind === 'drop' || trailing.kind === 'drop' ? [] : [textLeaf(text, marks.slice(0, Math.min(leading.depth, trailing.depth)))]
  const edges: AdfNode[] = []
  if (lead !== '' && leading.kind === 'keep') edges.push(textLeaf(lead, marks.slice(0, leading.depth)))
  const core = text.slice(lead.length, text.length - trail.length)
  if (core !== '') edges.push(textLeaf(core, marks))
  if (trail !== '' && trailing.kind === 'keep') edges.push(textLeaf(trail, marks.slice(0, trailing.depth)))
  return edges
}

// Text not marked `code` holds every run over it, so the runs it shares are its outermost marks.
function edgeOutcome(marks: readonly AdfMark[], { lineEdge, sharedRuns }: Beside, whitespace: number): EdgeOutcome {
  if (whitespace === 0) return { depth: marks.length, kind: 'keep' }
  // A run crossing a hard break holds this whitespace at the edge of a line, where CommonMark strips it.
  if (lineEdge && sharedRuns > 0) return { kind: 'drop' }
  const stripping = marks.findIndex((mark, index) => index >= sharedRuns && edgeStrippingMarks.includes(mark.type))
  const depth = stripping === -1 ? marks.length : stripping
  return depth === 0 && lineEdge ? { kind: 'drop' } : { depth, kind: 'keep' }
}

// For each leaf but the last, how many of `grouping`'s runs hold it and the next leaf; an edge-stripping mark's run reaches only from its first to its last non-blank holder, since the trim strips the mark off the blank holders outside, one pass each if they counted.
export function trimmingRuns(leaves: readonly AdfNode[], grouping: RunGrouping): number[] {
  const shared = leaves.map(() => 0)
  countTrimmingRuns(leaves.map((node) => ({ carried: false, node, outer: 0 })), 0, grouping, shared)
  return shared
}

// Recurses once per mark of a leaf, and the reducer's leaves hold one mark of each kept type.
function countTrimmingRuns(nodes: readonly RunNode[], firstIndex: number, grouping: RunGrouping, shared: number[]): void {
  for (const run of inlineRuns(nodes, firstIndex, grouping)) {
    if (run.kind === 'plain') continue
    const holds = edgeStrippingMarks.includes(run.mark.type) ? ({ node }: RunNode) => nodeMarks(node).some((mark) => identicalMark(mark, run.mark)) && (node.text === undefined || /[^ \t]/.test(node.text)) : () => true
    const holders = run.nodes.flatMap((runNode, offset) => (holds(runNode) ? [offset] : []))
    const first = holders[0]
    const last = holders.at(-1)
    if (first === undefined || last === undefined) continue
    for (let index = first; index < last; index += 1) shared[run.index + index] = (shared[run.index + index] ?? 0) + 1
    countTrimmingRuns(run.nodes.slice(first, last + 1), run.index + first, grouping, shared)
  }
}

// Trims the line by `grouping`'s runs and judges it; a fallback's indexes name the trimmed line.
export function portableJudgement(leaves: readonly AdfNode[], grouping: RunGrouping, container: LineContainer, path: ConvertErrorPath): Result<LineJudgement<readonly AdfNode[], PortableLineFallback, AdfNode[]>> {
  const line = trimmedEdges(leaves, grouping)
  const fallback = portableLineFallback(line, container, path, grouping)
  if (!fallback.ok) return fallback
  return success(fallback.value === undefined ? { kind: 'written', written: line } : { fallback: fallback.value, kind: 'fallback', line })
}

export function withoutFallback(leaves: readonly AdfNode[], fallback: PortableLineFallback, path: ConvertErrorPath): Result<AdfNode[]> {
  const fixed = fallback.kind === 'unspellable-run' ? withoutMarks(leaves, fallback.runs) : withoutOpeningLinkCode(leaves)
  return fixed === undefined ? failure('unsupported-node-shape', 'a portable line keeps a spelling that dropping a mark does not change', path) : success(fixed)
}

function withoutOpeningLinkCode(leaves: readonly AdfNode[]): AdfNode[] | undefined {
  const mark = nodeMarks(leaves[0] ?? {})[0]
  if (mark === undefined || mark.type !== 'link') return undefined
  const past = leaves.findIndex((leaf) => insideRun({ carried: false, node: leaf, outer: 0 }, mark) === undefined)
  const end = past === -1 ? leaves.length : past
  // A code span is what binds the `]` a link definition reads, and dropping it keeps the link target.
  const spans = leaves.slice(0, end).some((leaf) => nodeMarks(leaf).length > 1 && nodeMarks(leaf).at(-1)?.type === 'code')
  return spans ? leaves.map((leaf, index) => (index >= end ? leaf : withMarks(leaf, nodeMarks(leaf).filter((held) => held.type !== 'code')))) : undefined
}

function withoutEmphasis(leaves: readonly AdfNode[]): AdfNode[] {
  return leaves.map((leaf) => withMarks(leaf, nodeMarks(leaf).filter((mark) => !isEmphasis(mark))))
}

// The runs one pass takes back may nest, so a leaf drops the mark of each run over it.
function withoutMarks(leaves: readonly AdfNode[], runs: readonly MarkRun[]): AdfNode[] | undefined {
  const droppedAt = new Map<number, AdfMark[]>()
  for (const run of runs) {
    for (let index = run.first; index <= run.last; index += 1) {
      const dropped = droppedAt.get(index)
      if (dropped === undefined) droppedAt.set(index, [run.mark])
      else dropped.push(run.mark)
    }
  }
  const kept = leaves.map((leaf, index) => {
    const dropped = droppedAt.get(index)
    return dropped === undefined ? leaf : withMarks(leaf, nodeMarks(leaf).filter((held) => !dropped.some((mark) => identicalMark(held, mark))))
  })
  return markCount(kept) < markCount(leaves) ? kept : undefined
}

function markCount(leaves: readonly AdfNode[]): number {
  return leaves.reduce((count, leaf) => count + nodeMarks(leaf).length, 0)
}

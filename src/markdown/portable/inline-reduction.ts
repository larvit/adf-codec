import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import type { MarkRun } from '../emit/line-escaping.ts'
import type { RunGrouping } from '../emit/inline-runs.ts'
import { codeTextMarkTypes } from '../../adf/inline-nodes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { identicalMark, mergeAdjacentText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { imageAside } from '../image-aside.ts'
import { insideRun, runsSharedWithNext } from '../emit/inline-runs.ts'
import { isEmphasis } from '../mark-spellings.ts'
import { joinsWhenEditorNormal, sourceIndex, type SourceIndexes } from './editor-normal.ts'
import { largestNesting } from '../../nesting.ts'
import { partsShownText, referenceName, shownImage, shownLink, shownText, shownUrl } from '../../adf/shown-text.ts'
import { portableLineFallback, settledLine, type LineJudgement, type PortableLineFallback } from '../emit/inline-line.ts'
import { spellDestination } from '../commonmark/link-syntax.ts'

// What stands beside a leaf's edge: whether a line edge does, and how many runs hold the leaf and its neighbour both.
type Beside = { lineEdge: boolean; sharedRuns: number }

// `keep`: how many of the leaf's marks its edge whitespace keeps; `drop`: the whitespace goes, at a line edge.
type EdgeOutcome = { kind: 'drop' } | { depth: number; kind: 'keep' }

type PlacedLeaf = { after: Beside; before: Beside; leaf: AdfNode }

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
  if (['extension', 'inlineExtension', 'syncBlock'].includes(node.type)) return success(textLeaves(shownText(node), marks, container, referenceName(node)))
  if (['media', 'mediaInline'].includes(node.type)) return success(mediaLeaves(node, marks, container))
  if (['blockCard', 'embedCard', 'inlineCard'].includes(node.type)) return success(cardLeaves(node, marks, container))
  const own = textLeaves(node.text ?? shownText(node), marks, container)
  const held = inlineLeaves(nodeContent(node), container, { ...place, depth: place.depth + 1 })
  if (!held.ok) return held
  return success(own.length > 0 && held.value.length > 0 ? [...own, textLeaf(' ', []), ...held.value] : [...own, ...held.value])
}

function cardLeaves(card: AdfNode, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  const href = shownUrl(card)
  if (href === undefined) return textLeaves(shownText(card), marks, container, referenceName(card))
  return linkedLeaves(shownText(card) ?? href, href, marks, container)
}

function linkedLeaves(text: string, href: string, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  return textLeaves(text, [...marks.filter((mark) => mark.type !== 'link'), { attrs: { href }, type: 'link' }], container)
}

// An image standing inline is a link to it: the reader builds no node for an inline image, reading it as its alt text linked, and inside a link as the link's text, then (image).
function mediaLeaves(media: AdfNode, marks: readonly AdfMark[], container: LineContainer): AdfNode[] {
  const image = shownImage(media, shownLink(media)?.href)
  if (image === undefined) return textLeaves(undefined, marks, container, referenceName(media))
  const { after, link, text } = image
  const shown = link === undefined ? textLeaves(text, marks, container) : linkedLeaves(text, link, marks, container)
  return after === undefined ? shown : [...shown, ...imageAside((word) => linkedLeaves(word, after, marks, container))]
}

function noteLeaves(name: string): AdfNode[] {
  return [textLeaf(`(${name} not included)`, [{ type: 'em' }])]
}

function lineBreak(container: LineContainer): AdfNode {
  return container === 'paragraph' ? { type: 'hardBreak' } : textLeaf(' ', [])
}

function textLeaves(value: unknown, marks: readonly AdfMark[], container: LineContainer, note?: string): AdfNode[] {
  if (typeof value !== 'string') return note === undefined ? [] : noteLeaves(note)
  const text = value.replace(/[\r\u0000]/g, '')
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
  const title = typeof attrs['title'] === 'string' ? attrs['title'].replace(/[\r\0]/g, '').replace(/\n/g, ' ') : undefined
  if (typeof held !== 'string') return undefined
  const href = writableHref(container === 'table-cell' ? held.replaceAll('|', '%7C') : held)
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
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
    const merged = withoutEdgeBreaks(mergeAdjacentText(current, joinsWhenEditorNormal))
    let changed = false
    const trimmed: AdfNode[] = []
    for (const { after, before, leaf } of placedLeaves(merged, grouping)) {
      const edges = leafEdges(leaf, before, after)
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

function placedLeaves(leaves: readonly AdfNode[], grouping: RunGrouping): PlacedLeaf[] {
  const shared = runsSharedWithNext(leaves, grouping)
  return leaves.map((leaf, index) => ({ after: beside(leaves[index + 1], shared[index]), before: beside(leaves[index - 1], shared[index - 1]), leaf }))
}

function beside(neighbour: AdfNode | undefined, sharedRuns = 0): Beside {
  return { lineEdge: neighbour === undefined || neighbour.type === 'hardBreak', sharedRuns }
}

// spec/flavour.md, Inline nodes: edge whitespace leaves every stripping mark opening or closing beside it, and goes at a line edge.
function leafEdges(leaf: AdfNode, before: Beside, after: Beside): AdfNode[] | undefined {
  const marks = nodeMarks(leaf)
  const text = leaf.text
  if (text === undefined || marks.some((mark) => mark.type === 'code')) return undefined
  const lead = text.slice(0, text.search(/[^ \t]|$/))
  const trail = text.slice(text.search(/[ \t]*$/))
  const leading = edgeOutcome(marks, before, lead)
  const trailing = edgeOutcome(marks, after, trail)
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
function edgeOutcome(marks: readonly AdfMark[], { lineEdge, sharedRuns }: Beside, whitespace: string): EdgeOutcome {
  if (whitespace === '') return { depth: marks.length, kind: 'keep' }
  // A run crossing a hard break holds this whitespace at the edge of a line, where CommonMark strips it.
  if (lineEdge && sharedRuns > 0) return { kind: 'drop' }
  const stripping = marks.findIndex((mark, index) => index >= sharedRuns && edgeStrippingMarks.includes(mark.type))
  const depth = stripping === -1 ? marks.length : stripping
  return depth === 0 && lineEdge ? { kind: 'drop' } : { depth, kind: 'keep' }
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

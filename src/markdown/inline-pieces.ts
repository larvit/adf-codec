import type { AdfMark, AdfNode } from '../adf/document.ts'
import type { Claims } from './flavour.ts'
import type { EmphasisPairing } from './commonmark/emphasis-matching.ts'
import type { LineContainer } from './line-container.ts'
import type { LinkDefinition, TargetMemo } from './commonmark/link-syntax.ts'
import type { NestedSpans } from './directive/syntax.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { highlightDelimiter } from './inline-tokens.ts'
import { identicalMarks, mergeAdjacentText, nodeAttrs, nodeMarks } from '../adf/document.ts'
import { joinsWhenRead } from './adjacent-text.ts'
import { matchEmphasis } from './commonmark/emphasis-matching.ts'
import { takesMark } from '../adf/inline-nodes.ts'

// The text break leaf: it holds no marks, and stands between the nodes it parts until the outermost content checks and drops it.
export type TextBreak = { kind: 'textBreak' }

// A node whose marks are its own — an opaque carry, or an inline node spelling marks=empty: no mark spelling wraps it, and it joins no neighbour.
export type OwnMarks = { kind: 'ownMarks'; node: AdfNode }

// The (image) after a link for one image its text holds: running text keeps it, alt text drops it. In an `!adf:link`'s text it holds no nodes until the link builds it after itself.
export type ImageAside = { image: LinkDefinition; kind: 'imageAside'; nodes: AdfNode[] }

export type Inline = AdfNode | OwnMarks | TextBreak

// What a scan resolves its source to: an (image) stays one item until the content holding it knows where it goes.
export type Resolved = ImageAside | Inline

export type LinkDefinitions = ReadonlyMap<string, LinkDefinition>

type Bracket = { image: boolean; kind: 'open' }

// `link` is the link whose text is this image alone.
export type Image = { alt: string; definition: LinkDefinition; kind: 'image'; link?: LinkDefinition }

type Nodes = { kind: 'nodes'; nodes: Resolved[] }

type HighlightDelimiter = { closes: boolean; index: number; marks: readonly AdfMark[]; opens: boolean; position: number; stretch: number }

type HighlightPair = { closer: number; opener: number }

type Pairing = EmphasisPairing<Run>

type HighlightPiece = { closes: boolean; kind: 'highlight'; opens: boolean }
// `offset` is where the delimiter starts in the outermost content.
type RunPiece = { canClose: boolean; canOpen: boolean; character: string; kind: 'run'; length: number; offset: number }

export type Piece = Bracket | HighlightPiece | Image | Nodes | OwnMarks | RunPiece | TextBreak

type Run = RunPiece & { index: number }

// What the reader took where, by offset into the outermost content, so a writer can check its line reads as it meant.
export type InlineReading = {
  // Where the opening backtick string of each code span stands.
  readonly codeSpans: number[]
  // Each emphasis pairing, keyed by where its opening delimiters start.
  readonly emphasis: Map<number, { closer: number; width: number }>
  // Where the `[` of each link or image stands.
  readonly links: number[]
}

type ReadingEntry = { at: number; closer: number; kind: 'emphasis'; width: number } | { at: number; kind: 'codeSpans' | 'links' }

// What one content is read under. `container` is `undefined` inside a directive's content slot, the emitter's `bracketed`.
export type Scan = {
  readonly claims: Claims
  readonly container: LineContainer | undefined
  // Whether this content is an `!adf:link`'s text, where an image reads as its plain alt text.
  readonly inLink: boolean
  // Where `source` starts in the outermost content, the text `shared.targets` reads.
  readonly offset: number
  readonly shared: SharedScan
  readonly source: string
  readonly spans: NestedSpans
}

// What a directive's content slot inherits from the content holding it.
export type SharedScan = {
  readonly definitions: LinkDefinitions
  readonly path: ConvertErrorPath
  // Only a read-back takes a reading; parsing records none.
  readonly reading: InlineReading | undefined
  readonly targets: TargetMemo
}

const editorHighlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }
export const ownMarksInMark = 'move the opaque carry, or the node spelling marks=empty, out of the mark spelling: it holds its own marks'

export function record({ reading }: SharedScan, entry: ReadingEntry): void {
  if (reading === undefined) return
  if (entry.kind === 'emphasis') reading.emphasis.set(entry.at, { closer: entry.closer, width: entry.width })
  else reading[entry.kind].push(entry.at)
}

// The content whole: each (image) stands as its nodes, and the text around it joins it.
export function contentNodes(items: readonly Resolved[]): Inline[] {
  return mergeReadText(items.flatMap((item): Inline[] => (isImageAside(item) ? item.nodes : [item])))
}

// spec/flavour.md, Marks: a spelling skips a node Atlassian's schema withholds its mark from.
export function marksItem(item: Resolved, type: string): boolean {
  return !isNode(item) || takesMark(item, type)
}

export function isNode(item: AdfNode | { kind: string }): item is AdfNode {
  return !('kind' in item)
}

export function isImageAside(item: Resolved): item is ImageAside {
  return 'kind' in item && item.kind === 'imageAside'
}

export function isTextBreak(item: Resolved): item is TextBreak {
  return 'kind' in item && item.kind === 'textBreak'
}

export function adfNodes(items: readonly Resolved[]): AdfNode[] {
  const nodes: AdfNode[] = []
  for (const item of items) {
    if (isNode(item)) nodes.push(item)
    else if (item.kind === 'ownMarks') nodes.push(item.node)
    else if (item.kind === 'imageAside') for (const node of item.nodes) nodes.push(node)
  }
  return nodes
}

export function holdsOwnMarks(item: Piece | Resolved): boolean {
  return 'kind' in item && item.kind === 'ownMarks'
}

export function marksLink(items: readonly Resolved[]): boolean {
  return adfNodes(items).some((node) => nodeMarks(node).some((mark) => mark.type === 'link'))
}

// An image's alt text is plain, so `highlights` is off there and every `==` stays text.
export function resolveNodes(pieces: readonly Piece[], scan: Scan, highlights: boolean): Result<Resolved[]> {
  const items = markedItems(pieces, scan, highlights)
  return items.ok ? success(mergeReadText(items.value)) : items
}

export function markedItems(pieces: readonly Piece[], scan: Scan, highlights: boolean): Result<Resolved[]> {
  const runs = delimiterRuns(pieces)
  const pairings = matchEmphasis(runs)
  for (const { closer, closerOffset, opener, openerOffset, used } of pairings) record(scan.shared, { at: opener.offset + openerOffset, closer: closer.offset + closerOffset, kind: 'emphasis', width: used })
  const marks = pairingMarks(pieces, pairings)
  if (marks === undefined) return failure('unsupported-node-shape', ownMarksInMark, scan.shared.path)
  const items = unpairedAsText(pieces.map(pieceItems), runs, pairings)
  const paired = highlights ? pairedHighlights(pieces, items, marks) : []
  const marked = items.map((held, index) => (marks[index] ?? []).reduceRight((inner, mark) => applyMark(inner, mark), held))
  return success(highlightedBetween(marked, paired).flat())
}

// A text break, a node whose marks are its own and an (image) are walls: the text on either side joins only its own side.
function mergeReadText<Wall extends { kind: string }>(items: readonly (AdfNode | Wall)[]): (AdfNode | Wall)[] {
  const merged: (AdfNode | Wall)[] = []
  let run: AdfNode[] = []
  for (const item of items) {
    if (isNode(item)) {
      run.push(item)
      continue
    }
    for (const node of mergeAdjacentText(run, joinsWhenRead)) merged.push(node)
    merged.push(item)
    run = []
  }
  for (const node of mergeAdjacentText(run, joinsWhenRead)) merged.push(node)
  return merged
}

// The image arm is an image inside an image's description or a link's text, which reads as its plain alt text.
// An unpaired highlight delimiter stays the text `==`, under the emphasis around it.
function pieceItems(piece: Piece): Resolved[] {
  switch (piece.kind) {
    case 'ownMarks':
      return [piece]
    case 'highlight':
      return [{ text: highlightDelimiter, type: 'text' }]
    case 'image':
      return piece.alt === '' ? [] : [{ text: piece.alt, type: 'text' }]
    case 'nodes':
      return piece.nodes
    case 'open':
      return [{ text: piece.image ? '![' : '[', type: 'text' }]
    case 'run':
      return []
    case 'textBreak':
      return [piece]
  }
}

function delimiterRuns(pieces: readonly Piece[]): Run[] {
  const runs: Run[] = []
  for (const [index, piece] of pieces.entries()) {
    if (piece.kind === 'run') runs.push({ ...piece, index })
  }
  return runs
}

// A run gives its delimiters up from the head closing and the tail opening; what is left between them is text.
function unpairedAsText(items: readonly Resolved[][], runs: readonly Run[], pairings: readonly Pairing[]): Resolved[][] {
  const heads = new Map<Run, number>()
  const tails = new Map<Run, number>()
  for (const pairing of pairings) {
    heads.set(pairing.closer, pairing.closerOffset + pairing.used)
    tails.set(pairing.opener, pairing.openerOffset)
  }
  const written = items.slice()
  for (const run of runs) {
    const head = heads.get(run) ?? 0
    const tail = tails.get(run) ?? run.length
    if (tail > head) written[run.index] = [{ text: run.character.repeat(tail - head), type: 'text' }]
  }
  return written
}

// Pairings nest, so one walk holding the open ones on a stack gives each piece its marks, outermost first (spec/flavour.md, Marks).
function pairingMarks(pieces: readonly Piece[], pairings: readonly Pairing[]): AdfMark[][] | undefined {
  const opening = pairingsByOpener(pairings)
  const open: { closer: number; marks: AdfMark[] }[] = []
  const marks: AdfMark[][] = []
  for (const [index, piece] of pieces.entries()) {
    while (open.at(-1)?.closer === index) open.pop()
    const here = open.at(-1)?.marks ?? []
    if (here.length > 0 && piece.kind === 'ownMarks') return undefined
    marks.push(here)
    for (const pairing of opening.get(index) ?? []) {
      const type = markType(pairing.opener.character, pairing.used)
      // Each type once, so a piece's marks stay at most three however deep the pairings nest.
      const outer = open.at(-1)?.marks.filter((mark) => mark.type !== type) ?? []
      open.push({ closer: pairing.closer.index, marks: [...outer, { type }] })
    }
  }
  return marks
}

// `matchEmphasis` lists a run's pairings innermost first, so each list here is reversed to stack the outermost first.
function pairingsByOpener(pairings: readonly Pairing[]): Map<number, Pairing[]> {
  const opening = new Map<number, Pairing[]>()
  for (const pairing of pairings) {
    const opened = opening.get(pairing.opener.index)
    if (opened === undefined) opening.set(pairing.opener.index, [pairing])
    else opened.push(pairing)
  }
  for (const opened of opening.values()) opened.reverse()
  return opening
}

function highlightDelimiters(pieces: readonly Piece[], items: readonly Resolved[][], marks: readonly AdfMark[][]): HighlightDelimiter[] {
  const found: HighlightDelimiter[] = []
  // A stretch is a run of text no other inline node breaks.
  let stretch = 0
  let position = 0
  for (const [index, piece] of pieces.entries()) {
    if (piece.kind === 'highlight') found.push({ closes: piece.closes, index, marks: marks[index] ?? [], opens: piece.opens, position, stretch })
    for (const node of adfNodes(items[index] ?? [])) {
      if (node.type === 'text') position += node.text?.length ?? 0
      else stretch += 1
    }
  }
  return found
}

// Each opener pairs with the next closer at least one character after it, and only when both sit in one stretch under the same marks.
function pairedHighlights(pieces: readonly Piece[], items: readonly Resolved[][], marks: readonly AdfMark[][]): HighlightPair[] {
  const found = highlightDelimiters(pieces, items, marks)
  const paired: HighlightPair[] = []
  let closer = 0
  let resume = 0
  for (const opener of found) {
    if (!opener.opens || opener.position < resume) continue
    const earliest = opener.position + highlightDelimiter.length + 1
    let candidate = found[closer]
    while (candidate !== undefined && (!candidate.closes || candidate.position < earliest)) {
      closer += 1
      candidate = found[closer]
    }
    if (candidate === undefined) break
    if (candidate.stretch !== opener.stretch || !identicalMarks(opener.marks, candidate.marks)) continue
    paired.push({ closer: candidate.index, opener: opener.index })
    resume = candidate.position + highlightDelimiter.length
  }
  return paired
}

// Runs after the emphasis marks are on: a paired delimiter gives up its text, which an unpaired one keeps under those marks.
function highlightedBetween(items: readonly Resolved[][], paired: readonly HighlightPair[]): Resolved[][] {
  const marked = items.slice()
  for (const { closer, opener } of paired) {
    marked[opener] = []
    marked[closer] = []
    for (let index = opener + 1; index < closer; index += 1) marked[index] = eachNode(marked[index] ?? [], highlighted)
  }
  return marked
}

// A node holds one highlight, and a rebuilt node would lose its attributes.
function highlighted(node: AdfNode): AdfNode {
  const marks = nodeMarks(node)
  if (node.type !== 'text' || Object.keys(nodeAttrs(node)).length > 0 || !takesMark(node, editorHighlight.type) || marks.some((mark) => mark.type === editorHighlight.type)) return node
  return { ...node, marks: [editorHighlight, ...marks] }
}

function markType(character: string, used: number): string {
  if (character === '~') return 'strike'
  return used === 2 ? 'strong' : 'em'
}

// `*(*a*)*` builds one `em`: a node holds at most one mark of each type.
export function applyMark(items: readonly Resolved[], mark: AdfMark): Resolved[] {
  return eachNode(items, (node) => {
    const marks = nodeMarks(node)
    return !takesMark(node, mark.type) || marks.some((carried) => carried.type === mark.type) ? node : { ...node, marks: [mark, ...marks] }
  })
}

// An (image)'s nodes change as the nodes beside it do.
function eachNode(items: readonly Resolved[], change: (node: AdfNode) => AdfNode): Resolved[] {
  return items.map((item) => {
    if (isNode(item)) return change(item)
    return item.kind === 'imageAside' ? { ...item, nodes: item.nodes.map(change) } : item
  })
}

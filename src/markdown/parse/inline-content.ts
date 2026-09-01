import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { EmphasisPairing } from '../emphasis-matching.ts'
import type { LinkDefinition } from '../link-syntax.ts'
import { backslashEscape, decodeTextEscapes, inlineHtmlConstruct, readBracketedAutolink, readEmailAutolink, trimTrailingSpace } from '../commonmark-grammar.ts'
import { backtickRun, closingBacktickRun } from '../backtick-runs.ts'
import { delimiterFlags, matchEmphasis, runLength } from '../emphasis-matching.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { mergeAdjacentText } from '../../adf/editor-normal.ts'
import { normalizeLabel, readInlineTarget, readLabel } from '../link-syntax.ts'
import { readInlineDirective } from '../directive-syntax.ts'
import { readInlineDirectiveNode } from './directive-nodes.ts'

export type InlineContent = { image: AdfNode; nodes?: undefined } | { image?: undefined; nodes: AdfNode[] }

export type LinkDefinitions = ReadonlyMap<string, LinkDefinition>

type Bracket = { active: boolean; image: boolean; kind: 'open'; start: number }

type Pairing = EmphasisPairing<Run>

type Piece =
  | Bracket
  | { alt: string; kind: 'image'; node: AdfNode }
  | { kind: 'nodes'; nodes: AdfNode[] }
  | { canClose: boolean; canOpen: boolean; character: string; kind: 'run'; length: number }

type Run = { canClose: boolean; canOpen: boolean; character: string; index: number; length: number }

type Scan = { definitions: LinkDefinitions; path: ConvertErrorPath; pending: string; pieces: Piece[]; source: string }

const imageAlone = 'an image fits only as a paragraph of its own'

export function parseInlineContent(source: string, definitions: LinkDefinitions, path: ConvertErrorPath): Result<InlineContent> {
  const scan: Scan = { definitions, path, pending: '', pieces: [], source }
  let index = 0
  while (index < source.length) {
    switch (source.charAt(index)) {
      case '\\':
        index = readBackslash(scan, index)
        break
      case '\n':
        index = readLineEnding(scan, index)
        break
      case '`':
        index = readBackticks(scan, index)
        break
      case '<': {
        const angle = readAngle(scan, index)
        if (!angle.ok) return angle
        index = angle.value
        break
      }
      case ':': {
        const directive = readDirective(scan, index)
        if (!directive.ok) return directive
        index = directive.value
        break
      }
      case '!':
      case '[':
        index = openBracket(scan, index)
        break
      case ']': {
        const closed = closeBracket(scan, index)
        if (!closed.ok) return closed
        index = closed.value
        break
      }
      case '*':
      case '_':
      case '~':
        index = readDelimiterRun(scan, index)
        break
      default:
        scan.pending += source.charAt(index)
        index += 1
    }
  }
  flush(scan, true)
  return assemble(scan)
}

function readBackslash(scan: Scan, index: number): number {
  if (scan.source.charAt(index + 1) === '\n') {
    // CommonMark strips the spaces the two-space break is spelled with, and keeps those before a backslash.
    flush(scan, false)
    pushNode(scan, { type: 'hardBreak' })
    return index + 2
  }
  const width = backslashEscape(scan.source, index) === undefined ? 1 : 2
  scan.pending += scan.source.slice(index, index + width)
  return index + width
}

function readLineEnding(scan: Scan, index: number): number {
  const hard = scan.pending.endsWith('  ')
  flush(scan, true)
  if (hard) pushNode(scan, { type: 'hardBreak' })
  else scan.pending = ' '
  return index + 1
}

function readBackticks(scan: Scan, index: number): number {
  const span = readCodeSpan(scan.source, index)
  if (span === undefined) {
    const run = backtickRun(scan.source, index)
    scan.pending += scan.source.slice(index, index + run)
    return index + run
  }
  flush(scan, false)
  pushNode(scan, { marks: [{ type: 'code' }], text: span.text, type: 'text' })
  return span.end
}

function readAngle(scan: Scan, index: number): Result<number> {
  const autolink = readAutolink(scan.source, index)
  if (autolink !== undefined) {
    flush(scan, false)
    pushNode(scan, autolink.node)
    return success(index + autolink.length)
  }
  const construct = inlineHtmlConstruct(scan.source, index)
  if (construct !== undefined) return failure('unmappable-html', `no ADF node carries ${construct}`, scan.path)
  scan.pending += '<'
  return success(index + 1)
}

function openBracket(scan: Scan, index: number): number {
  const image = scan.source.charAt(index) === '!'
  if (image && scan.source.charAt(index + 1) !== '[') {
    scan.pending += '!'
    return index + 1
  }
  const width = image ? 2 : 1
  flush(scan, false)
  scan.pieces.push({ active: true, image, kind: 'open', start: index + width })
  return index + width
}

function readDirective(scan: Scan, index: number): Result<number> {
  const directive = readInlineDirective(scan.source, index)
  if (directive === undefined) {
    scan.pending += ':'
    return success(index + 1)
  }
  if (directive.fault !== undefined) return faulted(directive.fault, scan.path)
  const node = readInlineDirectiveNode(directive.value, scan.path)
  if (!node.ok) return node
  flush(scan, false)
  pushNode(scan, node.value)
  return success(index + directive.value.length)
}

function flush(scan: Scan, strip: boolean): void {
  const raw = strip ? trimTrailingSpace(scan.pending) : scan.pending
  scan.pending = ''
  if (raw !== '') scan.pieces.push({ kind: 'nodes', nodes: [{ text: decodeTextEscapes(raw), type: 'text' }] })
}

function pushNode(scan: Scan, node: AdfNode): void {
  scan.pieces.push({ kind: 'nodes', nodes: [node] })
}

function assemble(scan: Scan): Result<InlineContent> {
  const only = scan.pieces[0]
  if (scan.pieces.length === 1 && only?.kind === 'image') return success({ image: only.node })
  if (holdsImage(scan.pieces)) return failure('unmappable-image', imageAlone, scan.path)
  return success({ nodes: resolveNodes(scan.pieces) })
}

function holdsImage(pieces: readonly Piece[]): boolean {
  return pieces.some((piece) => piece.kind === 'image')
}

function readDelimiterRun(scan: Scan, index: number): number {
  const character = scan.source.charAt(index)
  const length = runLength(scan.source, index)
  const flags = delimiterFlags(character, scan.source.charAt(index - 1), scan.source.charAt(index + length))
  if ((character === '~' && length !== 2) || (!flags.canOpen && !flags.canClose)) scan.pending += scan.source.slice(index, index + length)
  else {
    flush(scan, false)
    scan.pieces.push({ canClose: flags.canClose, canOpen: flags.canOpen, character, kind: 'run', length })
  }
  return index + length
}

function readAutolink(source: string, index: number): { length: number; node: AdfNode } | undefined {
  const bracketed = readBracketedAutolink(source, index)
  if (bracketed !== undefined) return { length: bracketed, node: linkedText(source.slice(index + 1, index + bracketed - 1), '') }
  const email = readEmailAutolink(source, index)
  if (email === undefined) return undefined
  return { length: email, node: linkedText(source.slice(index + 1, index + email - 1), 'mailto:') }
}

function linkedText(text: string, scheme: string): AdfNode {
  return { marks: [{ attrs: { href: `${scheme}${text}` }, type: 'link' }], text, type: 'text' }
}

function closeBracket(scan: Scan, index: number): Result<number> {
  flush(scan, false)
  const open = lastBracket(scan.pieces)
  if (open === undefined) return success(literalClose(scan, index))
  const target = open.bracket.active ? resolveTarget(scan, open.bracket, index) : undefined
  if (target === undefined) return success(unopened(scan, open, index))
  const inner = scan.pieces.slice(open.index + 1)
  if (open.bracket.image) {
    const closed = closeImage(scan, open.index, inner, target.definition)
    if (!closed.ok) return closed
    return success(index + 1 + target.length)
  }
  const closed = closeLink(scan, open.index, inner, target.definition)
  if (!closed.ok) return closed
  return success(closed.value ? index + 1 + target.length : unopened(scan, open, index))
}

function literalClose(scan: Scan, index: number): number {
  scan.pending += ']'
  return index + 1
}

function unopened(scan: Scan, open: { bracket: Bracket; index: number }, index: number): number {
  scan.pieces[open.index] = { kind: 'nodes', nodes: bracketNodes(open.bracket) }
  return literalClose(scan, index)
}

function bracketNodes(bracket: Bracket): AdfNode[] {
  return [{ text: bracket.image ? '![' : '[', type: 'text' }]
}

function lastBracket(pieces: readonly Piece[]): { bracket: Bracket; index: number } | undefined {
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index]
    if (piece?.kind === 'open') return { bracket: piece, index }
  }
  return undefined
}

function resolveTarget(scan: Scan, bracket: Bracket, index: number): { definition: LinkDefinition; length: number } | undefined {
  const after = index + 1
  if (scan.source.charAt(after) === '(') {
    const inline = readInlineTarget(scan.source, after)
    if (inline !== undefined) return { definition: inline.definition, length: inline.length }
  }
  const label = scan.source.charAt(after) === '[' ? readLabel(scan.source, after) : undefined
  const name = label === undefined || label.value === '' ? scan.source.slice(bracket.start, index) : label.value
  const definition = scan.definitions.get(normalizeLabel(name))
  if (definition === undefined) return undefined
  return { definition, length: label?.length ?? 0 }
}

// `false` where the link text is empty: the mark has no node to ride, so the brackets stay text.
function closeLink(scan: Scan, at: number, inner: readonly Piece[], definition: LinkDefinition): Result<boolean> {
  if (holdsImage(inner)) return failure('unmappable-image', imageAlone, scan.path)
  const nodes = resolveNodes(inner)
  if (nodes.length === 0) return success(false)
  const attrs = definition.title === undefined ? { href: definition.destination } : { href: definition.destination, title: definition.title }
  scan.pieces.length = at
  // CommonMark: no link nests inside another, though an image's description holds one.
  for (const piece of scan.pieces) if (piece.kind === 'open' && !piece.image) piece.active = false
  scan.pieces.push({ kind: 'nodes', nodes: applyMark(nodes, { attrs, type: 'link' }) })
  return success(true)
}

function closeImage(scan: Scan, at: number, inner: readonly Piece[], definition: LinkDefinition): Result<null> {
  if (definition.title !== undefined) return failure('unmappable-image', 'no media node carries a link title', scan.path)
  const alt = imageAlt(inner)
  const attrs = alt === '' ? { type: 'external', url: definition.destination } : { alt, type: 'external', url: definition.destination }
  scan.pieces.length = at
  scan.pieces.push({ alt, kind: 'image', node: { attrs: { layout: 'center' }, content: [{ attrs, type: 'media' }], type: 'mediaSingle' } })
  return success(null)
}

function imageAlt(inner: readonly Piece[]): string {
  return resolveNodes(inner)
    .map((node) => (node.type === 'hardBreak' ? ' ' : (node.text ?? '')))
    .join('')
}

function resolveNodes(pieces: readonly Piece[]): AdfNode[] {
  const nodes = pieces.map(pieceNodes)
  const runs = delimiterRuns(pieces)
  const pairings = matchEmphasis(runs)
  writeUnpaired(nodes, runs, pairings)
  markPairings(nodes, pairings)
  return mergeAdjacentText(nodes.flat())
}

// Only `imageAlt` reaches the image arm: everywhere else an image amid other content is refused first.
function pieceNodes(piece: Piece): AdfNode[] {
  switch (piece.kind) {
    case 'image':
      return piece.alt === '' ? [] : [{ text: piece.alt, type: 'text' }]
    case 'nodes':
      return piece.nodes
    case 'open':
      return bracketNodes(piece)
    case 'run':
      return []
  }
}

function delimiterRuns(pieces: readonly Piece[]): Run[] {
  const runs: Run[] = []
  for (const [index, piece] of pieces.entries()) {
    if (piece.kind === 'run') runs.push({ canClose: piece.canClose, canOpen: piece.canOpen, character: piece.character, index, length: piece.length })
  }
  return runs
}

// A run gives its delimiters up from the head closing and the tail opening; what is left between them is text.
function writeUnpaired(nodes: AdfNode[][], runs: readonly Run[], pairings: readonly Pairing[]): void {
  const heads = new Map<Run, number>()
  const tails = new Map<Run, number>()
  for (const pairing of pairings) {
    heads.set(pairing.closer, pairing.closerOffset + pairing.used)
    tails.set(pairing.opener, pairing.openerOffset)
  }
  for (const run of runs) {
    const head = heads.get(run) ?? 0
    const tail = tails.get(run) ?? run.length
    if (tail > head) nodes[run.index] = [{ text: run.character.repeat(tail - head), type: 'text' }]
  }
}

// Innermost pairing first, so prepending leaves the marks array outermost first (spec/flavour.md, Marks).
function markPairings(nodes: AdfNode[][], pairings: readonly Pairing[]): void {
  for (const pairing of pairings) {
    const mark: AdfMark = { type: markType(pairing.opener.character, pairing.used) }
    for (let index = pairing.opener.index + 1; index < pairing.closer.index; index += 1) nodes[index] = applyMark(nodes[index] ?? [], mark)
  }
}

function markType(character: string, used: number): string {
  if (character === '~') return 'strike'
  return used === 2 ? 'strong' : 'em'
}

// A node cannot carry one mark type twice (AGENTS.md §14).
function applyMark(nodes: readonly AdfNode[], mark: AdfMark): AdfNode[] {
  return nodes.map((node) => {
    const marks = node.marks ?? []
    return marks.some((carried) => carried.type === mark.type) ? node : { ...node, marks: [mark, ...marks] }
  })
}

function readCodeSpan(source: string, index: number): { end: number; text: string } | undefined {
  const opener = backtickRun(source, index)
  const closer = closingBacktickRun(source, index + opener, opener)
  if (closer === undefined) return undefined
  return { end: closer + opener, text: codeSpanText(source.slice(index + opener, closer)) }
}

function codeSpanText(content: string): string {
  const text = content.replaceAll('\n', ' ')
  const padded = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  return padded ? text.slice(1, -1) : text
}

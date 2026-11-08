import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { InlineNodeModel } from '../../adf/inline-nodes.ts'
import type { InlineRun, PlainRun, RunGrouping, RunNode } from './inline-runs.ts'
import type { LineContainer } from '../line-container.ts'
import type { LinkDefinition, TitleEscapes } from '../commonmark/link-syntax.ts'
import type { RunFallback } from './unspellable-runs.ts'
import type { WrittenFlavour } from '../flavour.ts'
import { assembleInlineLine, isSyntax, type InlineEscaping, type InlineSegment, type MarkRun, type NodeRange } from './line-escaping.ts'
import { carriedInline } from '../opaque-carry.ts'
import { commonMarkLink, isEmphasis, linkHref, markSpelling, spellMarkAttributes } from '../mark-spellings.ts'
import { escapeUnbalanced, spellDestination, spellLinkTarget } from '../commonmark/link-syntax.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { flavourClaims } from '../flavour.ts'
import { highlightDelimiter } from '../inline-tokens.ts'
import { holdsNullCharacter, trimTrailingSpace } from '../commonmark/grammar.ts'
import { inlineNodeModel, takenMarkTypes } from '../../adf/inline-nodes.ts'
import { inlineRuns } from './inline-runs.ts'
import { isSpellableText, nodeAttrs, nodeMarks } from '../../adf/document.ts'
import { joinsWhenRead, textBreakSpelling } from '../adjacent-text.ts'
import { largestNesting } from '../../nesting.ts'
import { longestBacktickRun } from '../commonmark/backtick-runs.ts'
import { slotFault, spellInlineDirectiveOpener, spellInlineLeafDirective } from '../directive/syntax.ts'
import { spellInlineNodeAttributes } from '../directive/inline-spelling.ts'
import { spellTextDirective } from '../directive/text.ts'

type EmittedLine = { line: string; openingLinkAsDirective: boolean; segments: InlineSegment[] }

// Every carry one walk finds, taken together: carrying a node changes no other carry's range.
type Emission = { carries: [NodeRange, ...NodeRange[]]; segments?: undefined } | { carries?: undefined; segments: InlineSegment[] }

type Fallback = [NodeRange, ...NodeRange[]] | 'opening-link'

// How a line is judged and what its fallbacks do: the writer carries nodes, the portable reduction drops marks.
export type FallbackAction<Line, LineFallback, Written> = {
  giveUpEmphasis: (line: Line) => Line
  judge: (line: Line, grouping: RunGrouping) => Result<LineJudgement<Line, LineFallback, Written>>
  // A line whose fallbacks rewrite its nodes judges its spanned line again on every pass.
  spansEachPass: boolean
  take: (line: Line, fallback: LineFallback) => Result<Line>
}

type InlineContext = {
  atBlockEnd: boolean
  bracketed: boolean
  container: LineContainer
  flavour: WrittenFlavour
  grouping: RunGrouping
  lineNodes: readonly AdfNode[]
  openingLinkAsDirective: boolean
  path: ConvertErrorPath
  spansLines: boolean
}

type LineAttempt = { fallback: Fallback; line?: undefined; segments?: undefined } | { fallback?: undefined; line: string; segments: InlineSegment[] }

// What one grouping writes, or the fallback it needs and the line that fallback's indexes name.
export type LineJudgement<Line, LineFallback, Written> = { fallback: LineFallback; kind: 'fallback'; line: Line } | { kind: 'written'; written: Written }

type LineFallbacks = { carried: Set<number>; flavour: WrittenFlavour; openingLinkAsDirective: boolean }

// docs/decisions.md §After 32 passes, a line carries or drops every em, strike and strong mark.
const readBackPasses = 32

export type PortableLineFallback = { kind: 'opening-link' } | { kind: 'unspellable-run'; runs: [MarkRun, ...MarkRun[]] }

export function emitInlineLine(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, flavour: WrittenFlavour): Result<string> {
  const emitted = emitLine(nodes, container, path, flavour)
  if (!emitted.ok) return emitted
  return success(emitted.value.line)
}

export function openingLinkTakesDirective(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<boolean> {
  const emitted = emitLine(nodes, 'paragraph', path, 'lossless')
  if (!emitted.ok) return emitted
  return success(emitted.value.openingLinkAsDirective)
}

export function portableLineFallback(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, grouping: RunGrouping): Result<PortableLineFallback | undefined> {
  const fallbacks = withheldMarkFallbacks(nodes, 'portable')
  const emission = lineSegments(nodes, container, path, fallbacks, grouping)
  if (!emission.ok) return emission
  if (fallbacks.carried.size > 0 || emission.value.carries !== undefined) return failure('unsupported-node-shape', 'an inline node on a portable line has no spelling but the carry', path)
  const verdict = lineVerdict(emission.value.segments, container, 'portable', { kind: 'drop', nodes })
  return success(verdict.kind === 'line' ? undefined : verdict)
}

export function tryPipeCell(nodes: readonly AdfNode[], path: ConvertErrorPath, flavour: WrittenFlavour): string | undefined {
  const emitted = emitLine(nodes, 'table-cell', path, flavour)
  if (!emitted.ok) return undefined
  // spec/flavour.md, Tables; the portable reduction leaves a `|` in syntax only escaped, in a link title.
  if (flavour === 'lossless' && emitted.value.segments.some((segment) => isSyntax(segment.escaping) && segment.text.includes('|'))) return undefined
  return emitted.value.line
}

export function tryImageLine(alt: string | undefined, url: string, flavour: WrittenFlavour, link?: LinkDefinition): string | undefined {
  if (alt !== undefined && (/^[ \t]|[ \t]$|[\n\r]/.test(alt) || holdsNullCharacter(alt))) return undefined
  const destination = spellDestination(url)
  if (destination === undefined) return undefined
  const description: InlineSegment[] = alt === undefined ? [] : [{ escaping: 'bracketed', text: alt }]
  // Both flavours read an image's description with highlights off, so the lossless flavour's escapes read back in either.
  if (link === undefined) return attemptLine([syntax('!['), ...description, syntax(`](${destination})`)], 'paragraph', 'lossless').line
  const target = spellLinkTarget(link.destination, link.title, titleEscapes(flavour, 'paragraph'))
  if (target === undefined) return undefined
  return attemptLine([syntax('[!['), ...description, syntax(']('), bracketedLinkTarget(destination), syntax(`)](${target})`)], 'paragraph', 'lossless').line
}

function emitLine(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedLine> {
  return settledLine(withheldMarkFallbacks(nodes, flavour), {
    giveUpEmphasis: (fallbacks) => carryEveryEmphasis(fallbacks, nodes),
    judge: (fallbacks, grouping) => writerJudgement(nodes, container, path, fallbacks, grouping),
    spansEachPass: false,
    take: (fallbacks, fallback) => {
      const taken = takeFallback(fallbacks, fallback, path)
      return taken.ok ? success(fallbacks) : taken
    },
  })
}

// spec/flavour.md, Marks: the spanned line where it reads back, else the parted line, taking one fallback a pass.
export function settledLine<Line, LineFallback, Written>(line: Line, action: FallbackAction<Line, LineFallback, Written>): Result<Written> {
  // Terminates while each `take` refuses or moves one way: the writer carries more nodes, the reduction keeps fewer marks.
  for (let current = line, pass = 1; ; pass += 1) {
    let parting = current
    if (pass === 1 || action.spansEachPass) {
      const spanned = action.judge(current, 'spanned')
      if (!spanned.ok) return spanned
      if (spanned.value.kind === 'written') return success(spanned.value.written)
      parting = spanned.value.line
    }
    const parted = action.judge(parting, 'parted')
    if (!parted.ok) return parted
    if (parted.value.kind === 'written') return success(parted.value.written)
    const taken = action.take(parted.value.line, parted.value.fallback)
    if (!taken.ok) return taken
    current = pass === readBackPasses ? action.giveUpEmphasis(taken.value) : taken.value
  }
}

function writerJudgement(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, fallbacks: LineFallbacks, grouping: RunGrouping): Result<LineJudgement<LineFallbacks, Fallback, EmittedLine>> {
  const attempt = linePass(nodes, container, path, fallbacks, grouping)
  if (!attempt.ok) return attempt
  const { fallback, line, segments } = attempt.value
  return success(fallback === undefined ? { kind: 'written', written: { line, openingLinkAsDirective: fallbacks.openingLinkAsDirective, segments } } : { fallback, kind: 'fallback', line: fallbacks })
}

export function linePass(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, fallbacks: LineFallbacks, grouping: RunGrouping): Result<LineAttempt> {
  const emission = lineSegments(nodes, container, path, fallbacks, grouping)
  if (!emission.ok) return emission
  const { carries, segments } = emission.value
  return success(segments === undefined ? { fallback: carries } : attemptLine(segments, container, fallbacks.flavour))
}

function carryEveryEmphasis(fallbacks: LineFallbacks, nodes: readonly AdfNode[]): LineFallbacks {
  for (const [index, node] of nodes.entries()) if (nodeMarks(node).some(isEmphasis)) fallbacks.carried.add(index)
  return fallbacks
}

// Seeds the withheld-mark carries once per line, so the run at each mark depth does not rescan every node's marks.
export function withheldMarkFallbacks(nodes: readonly AdfNode[], flavour: WrittenFlavour): LineFallbacks {
  const carried = new Set<number>()
  for (const [index, node] of nodes.entries()) {
    const taken = takenMarkTypes(node)
    if (taken !== undefined && nodeMarks(node).some((mark) => !taken.includes(mark.type))) carried.add(index)
  }
  return { carried, flavour, openingLinkAsDirective: false }
}

// Decides the text-node and slot-fault carries up front, `withheldMarkFallbacks` the withheld-mark ones, so a line holding many of them is emitted once.
function carries(node: AdfNode, carried: ReadonlySet<number>, index: number): boolean {
  if (carried.has(index)) return true
  if (node.type === 'text') return !isSpellableText(node) || typeof node.text !== 'string' || node.text === ''
  const model = inlineNodeModel(node.type)
  if (model === undefined) return true
  const slot = model.textAttribute === undefined ? undefined : nodeAttrs(node)[model.textAttribute]
  return typeof slot === 'string' && slotFault(node.type, slot) !== undefined
}

export function takeFallback(fallbacks: LineFallbacks, fallback: Fallback, path: ConvertErrorPath): Result<null> {
  if (fallback === 'opening-link') {
    if (fallbacks.openingLinkAsDirective) return failure('unsupported-node-shape', 'an opening link spelled as a directive still reads as a link definition, so the line has no spelling left', path)
    fallbacks.openingLinkAsDirective = true
    return success(null)
  }
  const before = fallbacks.carried.size
  for (const range of fallback) for (let index = range.first; index <= range.last; index += 1) fallbacks.carried.add(index)
  if (fallbacks.carried.size === before) return failure('unsupported-node-shape', 'a carry took no inline node the line had not carried, so the line has no spelling left', path)
  return success(null)
}

function lineSegments(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, { carried, flavour, openingLinkAsDirective }: LineFallbacks, grouping: RunGrouping): Result<Emission> {
  const context: InlineContext = { atBlockEnd: true, bracketed: false, container, flavour, grouping, lineNodes: nodes, openingLinkAsDirective, path, spansLines: container === 'paragraph' }
  const emission = emitRun(nodes.map((node, index) => ({ carried: carries(node, carried, index), node, outer: 0 })), 0, 0, context)
  if (!emission.ok) return emission
  if (emission.value.carries !== undefined) return emission
  return success({ segments: spellEdgeWhitespace(emission.value.segments, flavour) })
}

function attemptLine(segments: InlineSegment[], container: LineContainer, flavour: WrittenFlavour): LineAttempt {
  const verdict = lineVerdict(segments, container, flavour, { kind: 'carry' })
  if (verdict.kind === 'opening-link') return { fallback: 'opening-link' }
  if (verdict.kind === 'unspellable-run') return { fallback: verdict.runs }
  return { line: verdict.text, segments }
}

// The fallbacks in the order a line takes them, or the line where it takes none.
function lineVerdict(segments: readonly InlineSegment[], container: LineContainer, flavour: WrittenFlavour, fallback: RunFallback): PortableLineFallback | { kind: 'line'; text: string } {
  const assembled = assembleInlineLine(segments, container, flavour, fallback)
  if (assembled.openingLinkAsDirective) return { kind: 'opening-link' }
  const [run, ...others] = assembled.unspellableRuns
  return run === undefined ? { kind: 'line', text: assembled.line } : { kind: 'unspellable-run', runs: [run, ...others] }
}

// A space or tab CommonMark strips at a line edge rides !adf:text{text="…"}. A flavour without directives leaves it raw, since the reducer trims each line by its own runs.
function spellEdgeWhitespace(segments: InlineSegment[], flavour: WrittenFlavour): InlineSegment[] {
  if (!flavourClaims[flavour].directives) return segments
  const spelled: InlineSegment[] = []
  for (const [index, segment] of segments.entries()) {
    const previous = segments[index - 1]
    const next = segments[index + 1]
    const leading = previous === undefined || previous.text.includes('\n')
    const trailing = next === undefined || next.text.includes('\n')
    spelled.push(...edgeWhitespaceSegments(segment, leading, trailing))
  }
  return spelled
}

function edgeWhitespaceSegments(segment: InlineSegment, leading: boolean, trailing: boolean): InlineSegment[] {
  if (segment.escaping !== 'backslash' && segment.escaping !== 'bracketed') return [segment]
  const head = leading ? (/^[ \t]+/.exec(segment.text)?.[0] ?? '') : ''
  const body = segment.text.slice(head.length)
  const middle = trailing ? trimTrailingSpace(body) : body
  const tail = body.slice(middle.length)
  const edges: InlineSegment[] = []
  if (head !== '') edges.push(textDirectiveSegment(head))
  if (middle !== '') edges.push({ escaping: segment.escaping, text: middle })
  if (tail !== '') edges.push(textDirectiveSegment(tail))
  return edges
}

function textDirectiveSegment(text: string): InlineSegment {
  return syntax(spellTextDirective(text))
}

function syntax(text: string): InlineSegment {
  return { escaping: 'none', text }
}

function titleEscapes(flavour: WrittenFlavour, container: LineContainer): TitleEscapes {
  if (flavour === 'lossless') return 'lossless'
  return container === 'table-cell' ? 'portable-table-cell' : 'portable'
}

function bracketedLinkTarget(target: string): InlineSegment {
  return { escaping: 'bracketed-link-target', text: escapeUnbalanced(target, '[', ']') }
}

function emitRun(nodes: readonly RunNode[], depth: number, firstIndex: number, context: InlineContext): Result<Emission> {
  if (depth > largestNesting) {
    return failure('unsupported-nesting-depth', `the marks nest deeper than the ${largestNesting} levels the emitter carries`, context.path)
  }
  const runs = inlineRuns(nodes, firstIndex, context.grouping)
  const carries: NodeRange[] = []
  const segments: InlineSegment[] = []
  for (const [offset, run] of runs.entries()) {
    if (takesTextBreak(runs[offset - 1], run)) segments.push(syntax(textBreakSpelling))
    const runContext = { ...context, atBlockEnd: context.atBlockEnd && offset === runs.length - 1 }
    const emitted = run.kind === 'plain' ? emitLeaf(run, runContext) : emitMarkedRun(run.nodes, run.mark, depth, run.index, runContext)
    if (!emitted.ok) return emitted
    if (emitted.value.carries !== undefined) for (const carry of emitted.value.carries) carries.push(carry)
    else for (const segment of emitted.value.segments) segments.push(segment)
  }
  const [carry, ...others] = carries
  return success(carry === undefined ? { segments } : { carries: [carry, ...others] })
}

function takesTextBreak(previous: InlineRun | undefined, run: InlineRun): boolean {
  if (previous?.kind !== 'plain' || run.kind !== 'plain' || previous.carried || run.carried) return false
  return joinsWhenRead(previous.node, run.node)
}

function nodePath(context: InlineContext, index: number): ConvertErrorPath {
  return [...context.path, 'content', index]
}

// Builds the node's path only to refuse it: a path copies every level above, and a line may hold a million leaves.
function emitLeaf({ carried, index, node }: PlainRun, context: InlineContext): Result<Emission> {
  if (carried) {
    const carry = carriedInline(node, nodePath(context, index))
    if (!carry.ok) return carry
    return success({ segments: [syntax(carry.value)] })
  }
  const types = nodeMarks(node).map((mark) => mark.type)
  if (new Set(types).size !== types.length) return failure('unsupported-node-shape', `a ${node.type} node carries one mark type twice`, nodePath(context, index))
  const model = inlineNodeModel(node.type)
  const segments = model === undefined ? textSegments(node, context) : node.type === 'hardBreak' ? hardBreakSegments(node, model, context) : inlineDirectiveSegments(node, model)
  return segments === undefined ? carriedRun({ first: index, last: index }, context) : success({ segments })
}

// Builds the carry's JSON where the walk makes the carry, so its refusal comes ahead of any later node's.
function carriedRun(range: NodeRange, context: InlineContext): Result<Emission> {
  for (const [offset, node] of context.lineNodes.slice(range.first, range.last + 1).entries()) {
    const carried = carriedInline(node, nodePath(context, range.first + offset))
    if (!carried.ok) return carried
  }
  return success({ carries: [range] })
}

function hardBreakSegments(node: AdfNode, model: InlineNodeModel, context: InlineContext): InlineSegment[] | undefined {
  const attributes = spellInlineNodeAttributes(node, model)
  if (attributes === undefined) return undefined
  if (attributes === '' && context.spansLines && !context.atBlockEnd) return [syntax('\\\n')]
  return [syntax(spellInlineLeafDirective('hardBreak', attributes))]
}

function inlineDirectiveSegments(node: AdfNode, model: InlineNodeModel): InlineSegment[] | undefined {
  const attributes = spellInlineNodeAttributes(node, model)
  if (attributes === undefined) return undefined
  const slot = model.textAttribute === undefined ? undefined : nodeAttrs(node)[model.textAttribute]
  if (slot === undefined) return [syntax(spellInlineLeafDirective(node.type, attributes))]
  if (typeof slot !== 'string' || slotFault(node.type, slot) !== undefined) return undefined
  const content: InlineSegment[] = slot === '' ? [] : [{ escaping: 'bracketed', text: slot }]
  return [syntax(spellInlineDirectiveOpener(node.type)), ...content, syntax(`]${attributes}`)]
}

// CommonMark reads a raw carriage return as a line ending and a null character as U+FFFD, so neither is written raw.
function textSegments(node: AdfNode, context: InlineContext): InlineSegment[] | undefined {
  if (!isSpellableText(node) || typeof node.text !== 'string' || node.text === '') return undefined
  const escaping: InlineEscaping = context.bracketed ? 'bracketed' : 'backslash'
  const parts = node.text.split(/(\n+|\0+|\r)/).filter((part) => part !== '')
  return parts.map((part) => (part === '\r' ? syntax('&#13;') : /^[\n\0]/.test(part) ? textDirectiveSegment(part) : { escaping, text: part }))
}

function emitMarkedRun(nodes: readonly [RunNode, ...RunNode[]], mark: AdfMark, depth: number, index: number, context: InlineContext): Result<Emission> {
  const range: NodeRange = { first: index, last: index + nodes.length - 1 }
  if (mark.type === 'backgroundColor' && flavourClaims[context.flavour].highlights) return emitHighlight(nodes, depth, { ...range, mark }, context)
  const spelling = markSpelling(mark.type)
  const attributes = spelling === undefined ? undefined : spellMarkAttributes(mark, spelling)
  if (spelling === undefined || attributes === undefined) return carriedRun(range, context)
  if (spelling.kind === 'code') {
    const spans = codeSpans(nodes)
    return spans === undefined ? carriedRun(range, context) : success({ segments: [syntax(spans)] })
  }
  if (spelling.kind === 'emphasis') return emitEmphasis(nodes, spelling.spelling, depth, { ...range, mark }, context)
  const link = spelling.kind === 'link' ? tryLink(nodes, mark, depth, range, context) : undefined
  if (link !== undefined) return link
  const inner = emitRun(nodes, depth + 1, index, { ...context, bracketed: true, spansLines: false })
  if (!inner.ok) return inner
  if (inner.value.carries !== undefined) return inner
  return success({ segments: [syntax(spellInlineDirectiveOpener(mark.type)), ...inner.value.segments, syntax(`]${attributes}`)] })
}

function emitEmphasis(nodes: readonly RunNode[], spelling: string, depth: number, run: MarkRun, context: InlineContext): Result<Emission> {
  const inner = emitRun(nodes, depth + 1, run.first, context)
  if (!inner.ok) return inner
  if (inner.value.carries !== undefined) return inner
  const spelled = spellEdgeWhitespace(inner.value.segments, context.flavour)
  return success({
    segments: [{ emphasis: 'open', escaping: 'none', nodes: run, text: spelling }, ...spelled, { emphasis: 'close', escaping: 'none', nodes: run, text: spelling }],
  })
}

function emitHighlight(nodes: readonly RunNode[], depth: number, run: MarkRun, context: InlineContext): Result<Emission> {
  const inner = emitRun(nodes, depth + 1, run.first, context)
  if (!inner.ok || inner.value.carries !== undefined) return inner
  return success({
    segments: [{ escaping: 'none', highlight: 'open', nodes: run, text: highlightDelimiter }, ...inner.value.segments, { escaping: 'none', highlight: 'close', nodes: run, text: highlightDelimiter }],
  })
}

// Each node its own span: CommonMark reads two adjacent text nodes in one span back as one.
function codeSpans(nodes: readonly RunNode[]): string | undefined {
  const spans: string[] = []
  for (const { node, outer } of nodes) {
    const { text } = node
    if (!isSpellableText(node) || nodeMarks(node).length !== outer || typeof text !== 'string' || text === '' || /[\n\r]/.test(text) || holdsNullCharacter(text)) return undefined
    const fence = '`'.repeat(longestBacktickRun(text) + 1)
    spans.push(`${fence}${needsPadding(text) ? ` ${text} ` : text}${fence}`)
  }
  return spans.join(textBreakSpelling)
}

function needsPadding(text: string): boolean {
  if (text.startsWith('`') || text.endsWith('`')) return true
  return text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
}

function tryLink(nodes: readonly [RunNode, ...RunNode[]], mark: AdfMark, depth: number, range: NodeRange, context: InlineContext): Result<Emission> | undefined {
  const href = linkHref(nodeAttrs(mark))
  if (href === undefined) return carriedRun(range, context)
  const opening = depth === 0 && range.first === 0 && context.openingLinkAsDirective
  const commonMark = opening ? undefined : commonMarkLink(nodeAttrs(mark), href, nodes.map(({ node }) => node), { bracketed: context.bracketed, escapes: titleEscapes(context.flavour, context.container), marksInside: nodes[0].outer })
  if (commonMark === undefined) return undefined
  if (commonMark.form === 'autolink') return success({ segments: [syntax(`<${href}>`)] })
  const inner = emitRun(nodes, depth + 1, range.first, { ...context, bracketed: true })
  if (!inner.ok) return inner
  if (inner.value.carries !== undefined) return inner
  const target = context.bracketed ? bracketedLinkTarget(commonMark.target) : syntax(commonMark.target)
  return success({ segments: [{ escaping: 'none', nodes: range, text: '[' }, ...inner.value.segments, syntax(']('), target, syntax(')')] })
}


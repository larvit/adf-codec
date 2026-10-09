import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { InlineNodeModel } from '../../adf/inline-nodes.ts'
import type { LineContainer } from '../line-container.ts'
import type { WrittenFlavour } from '../portable/conventions.ts'
import { assembleInlineLine, isSyntax, type InlineEscaping, type InlineSegment, type MarkRun, type NodeRange } from './line-escaping.ts'
import { carriedInline } from '../opaque-carry.ts'
import { commonMarkLink, linkHref, markSpelling, spellMarkAttributes } from '../mark-spellings.ts'
import { escapeUnbalanced, spellDestination } from '../commonmark/link-syntax.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { flavourClaims, highlightDelimiter } from '../portable/conventions.ts'
import { holdsNullCharacter, trimTrailingSpace } from '../commonmark/grammar.ts'
import { identicalMark, isSpellableText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { joinsWhenRead, textBreakSpelling } from '../adjacent-text.ts'
import { largestNesting } from '../../nesting.ts'
import { longestBacktickRun } from '../commonmark/backtick-runs.ts'
import { slotFault, spellInlineDirectiveOpener, spellInlineLeafDirective } from '../directive-syntax.ts'
import { spellInlineNodeAttributes } from './inline-directive-spelling.ts'
import { spellTextDirective } from '../text-directive.ts'

type EmittedLine = { line: string; openingLinkAsDirective: boolean; segments: InlineSegment[] }

type Emission = { carry: NodeRange; segments?: undefined } | { carry?: undefined; segments: InlineSegment[] }

type InlineContext = {
  atBlockEnd: boolean
  bracketed: boolean
  carried: ReadonlySet<number>
  flavour: WrittenFlavour
  openingLinkAsDirective: boolean
  path: ConvertErrorPath
  spansLines: boolean
}

type InlineRun = { index: number; kind: 'marked'; mark: AdfMark; nodes: AdfNode[] } | { index: number; kind: 'plain'; node: AdfNode }

type LineAttempt = { fallback: NodeRange | 'opening-link'; line?: undefined } | { fallback?: undefined; line: string }

type LineFallbacks = { carried: Set<number>; flavour: WrittenFlavour; openingLinkAsDirective: boolean }

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

export function portableLineFallback(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath): Result<PortableLineFallback | undefined> {
  const emission = lineSegments(nodes, container, path, { carried: new Set(), flavour: 'portable', openingLinkAsDirective: false })
  if (!emission.ok) return emission
  if (emission.value.carry !== undefined) return failure('unsupported-node-shape', 'an inline node on a portable line has no spelling but the carry', path)
  const verdict = lineVerdict(emission.value.segments, container, 'portable')
  return success(verdict.kind === 'line' ? undefined : verdict)
}

export function tryPipeCell(nodes: readonly AdfNode[], path: ConvertErrorPath, flavour: WrittenFlavour): string | undefined {
  const emitted = emitLine(nodes, 'table-cell', path, flavour)
  if (!emitted.ok) return undefined
  if (emitted.value.segments.some((segment) => isSyntax(segment.escaping) && segment.text.includes('|'))) return undefined
  return emitted.value.line
}

export function tryImageLine(alt: string | undefined, href: string): string | undefined {
  if (alt !== undefined && (/^[ \t]|[ \t]$|[\n\r]/.test(alt) || holdsNullCharacter(alt))) return undefined
  const destination = spellDestination(href)
  if (destination === undefined) return undefined
  const description: InlineSegment[] = alt === undefined ? [] : [{ escaping: 'bracketed', text: alt }]
  return attemptLine([syntax('!['), ...description, syntax(`](${destination})`)], 'paragraph', 'lossless').line
}

function emitLine(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, flavour: WrittenFlavour): Result<EmittedLine> {
  const fallbacks: LineFallbacks = { carried: new Set(), flavour, openingLinkAsDirective: false }
  // Terminates because takeFallback refuses a pass that took no new fallback.
  for (;;) {
    const emission = lineSegments(nodes, container, path, fallbacks)
    if (!emission.ok) return emission
    if (emission.value.carry !== undefined) {
      const taken = takeFallback(fallbacks, emission.value.carry, path)
      if (!taken.ok) return taken
      continue
    }
    const attempt = attemptLine(emission.value.segments, container, flavour)
    if (attempt.line !== undefined) {
      return success({ line: attempt.line, openingLinkAsDirective: fallbacks.openingLinkAsDirective, segments: emission.value.segments })
    }
    const taken = takeFallback(fallbacks, attempt.fallback, path)
    if (!taken.ok) return taken
  }
}

function takeFallback(fallbacks: LineFallbacks, fallback: NodeRange | 'opening-link', path: ConvertErrorPath): Result<null> {
  if (fallback === 'opening-link') {
    if (fallbacks.openingLinkAsDirective) return failure('unsupported-node-shape', 'an opening link spelled as a directive still reads as a link definition, so the line has no spelling left', path)
    fallbacks.openingLinkAsDirective = true
    return success(null)
  }
  const before = fallbacks.carried.size
  for (let index = fallback.first; index <= fallback.last; index += 1) fallbacks.carried.add(index)
  if (fallbacks.carried.size === before) return failure('unsupported-node-shape', 'a carry took no inline node the line had not carried, so the line has no spelling left', path)
  return success(null)
}

function lineSegments(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, fallbacks: LineFallbacks): Result<Emission> {
  const context: InlineContext = { atBlockEnd: true, bracketed: false, ...fallbacks, path, spansLines: container === 'paragraph' }
  const emission = emitRun(nodes, 0, 0, context)
  if (!emission.ok) return emission
  if (emission.value.carry !== undefined) return emission
  return success({ segments: spellEdgeWhitespace(emission.value.segments) })
}

function attemptLine(segments: readonly InlineSegment[], container: LineContainer, flavour: WrittenFlavour): LineAttempt {
  const verdict = lineVerdict(segments, container, flavour)
  if (verdict.kind === 'opening-link') return { fallback: 'opening-link' }
  if (verdict.kind === 'unspellable-run') return { fallback: verdict.runs[0] }
  return { line: verdict.text }
}

// The fallbacks in the order a line takes them, or the line where it takes none.
function lineVerdict(segments: readonly InlineSegment[], container: LineContainer, flavour: WrittenFlavour): PortableLineFallback | { kind: 'line'; text: string } {
  const assembled = assembleInlineLine(segments, container, flavour)
  if (assembled.openingLinkAsDirective) return { kind: 'opening-link' }
  const [run, ...others] = assembled.unspellableRuns
  return run === undefined ? { kind: 'line', text: assembled.line } : { kind: 'unspellable-run', runs: [run, ...others] }
}

// A space or tab CommonMark strips at a line edge rides !adf:text{text="…"}.
function spellEdgeWhitespace(segments: readonly InlineSegment[]): InlineSegment[] {
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

function refuseContentAndText(node: AdfNode, path: ConvertErrorPath): Result<null> {
  const holdsContent = nodeContent(node).length > 0
  if (holdsContent || node.text !== undefined) {
    const held = holdsContent ? 'content' : 'text'
    return failure('unsupported-node-shape', `a ${node.type} node holds neither content nor text: this one holds ${held}`, path)
  }
  return success(null)
}

function emitRun(nodes: readonly AdfNode[], depth: number, firstIndex: number, context: InlineContext): Result<Emission> {
  if (depth > largestNesting) {
    return failure('unsupported-nesting-depth', `the marks nest deeper than the ${largestNesting} levels the emitter carries`, context.path)
  }
  const runs = inlineRuns(nodes, depth, firstIndex, context.carried)
  const segments: InlineSegment[] = []
  for (const [offset, run] of runs.entries()) {
    if (takesTextBreak(runs[offset - 1], run, context.carried)) segments.push(syntax(textBreakSpelling))
    const runContext = { ...context, atBlockEnd: context.atBlockEnd && offset === runs.length - 1 }
    const emitted = run.kind === 'plain' ? emitLeaf(run.node, runContext, run.index) : emitMarkedRun(run.nodes, run.mark, depth, run.index, runContext)
    if (!emitted.ok) return emitted
    if (emitted.value.carry !== undefined) return emitted
    for (const segment of emitted.value.segments) segments.push(segment)
  }
  return success({ segments })
}

function inlineRuns(nodes: readonly AdfNode[], depth: number, firstIndex: number, carried: ReadonlySet<number>): InlineRun[] {
  const runs: InlineRun[] = []
  for (const [offset, node] of nodes.entries()) {
    const index = firstIndex + offset
    // `depth` indexes each node's marks, outermost first; a carried node spells its marks inside the carry.
    const mark = carries(node, carried, index) ? undefined : nodeMarks(node)[depth]
    if (mark === undefined) {
      runs.push({ index, kind: 'plain', node })
      continue
    }
    const previous = runs[runs.length - 1]
    if (previous?.kind === 'marked' && identicalMark(previous.mark, mark)) previous.nodes.push(node)
    else runs.push({ index, kind: 'marked', mark, nodes: [node] })
  }
  return runs
}

function takesTextBreak(previous: InlineRun | undefined, run: InlineRun, carried: ReadonlySet<number>): boolean {
  if (previous?.kind !== 'plain' || run.kind !== 'plain') return false
  if (carries(previous.node, carried, previous.index) || carries(run.node, carried, run.index)) return false
  return joinsWhenRead(previous.node, run.node)
}

function nodePath(context: InlineContext, index: number): ConvertErrorPath {
  return [...context.path, 'content', index]
}

// Decides the text-node and slot-fault carries up front, so a line holding many of them is emitted once.
function carries(node: AdfNode, carried: ReadonlySet<number>, index: number): boolean {
  if (carried.has(index)) return true
  if (node.type === 'text') return !isSpellableText(node) || typeof node.text !== 'string' || node.text === ''
  const model = inlineNodeModel(node.type)
  if (model === undefined) return true
  const slot = model.textAttribute === undefined ? undefined : nodeAttrs(node)[model.textAttribute]
  return typeof slot === 'string' && slotFault(node.type, slot) !== undefined && nodeContent(node).length === 0 && node.text === undefined
}

function emitLeaf(node: AdfNode, context: InlineContext, index: number): Result<Emission> {
  const path = nodePath(context, index)
  if (carries(node, context.carried, index)) {
    const carried = carriedInline(node, path)
    if (!carried.ok) return carried
    return success({ segments: [syntax(carried.value)] })
  }
  const types = nodeMarks(node).map((mark) => mark.type)
  if (new Set(types).size !== types.length) return failure('unsupported-node-shape', `a ${node.type} node carries one mark type twice`, path)
  const model = inlineNodeModel(node.type)
  if (model === undefined) return success(emitText(node, context, index))
  if (node.type === 'hardBreak') return emitHardBreak(node, model, context, index, path)
  return emitInlineDirective(node, model, index, path)
}

function emitHardBreak(node: AdfNode, model: InlineNodeModel, context: InlineContext, index: number, path: ConvertErrorPath): Result<Emission> {
  const empty = refuseContentAndText(node, path)
  if (!empty.ok) return empty
  const attributes = spellInlineNodeAttributes(node, model)
  if (attributes === undefined) return success({ carry: { first: index, last: index } })
  if (attributes === '' && context.spansLines && !context.atBlockEnd) return success({ segments: [syntax('\\\n')] })
  return success({ segments: [syntax(spellInlineLeafDirective('hardBreak', attributes))] })
}

function emitInlineDirective(node: AdfNode, model: InlineNodeModel, index: number, path: ConvertErrorPath): Result<Emission> {
  const empty = refuseContentAndText(node, path)
  if (!empty.ok) return empty
  const attributes = spellInlineNodeAttributes(node, model)
  if (attributes === undefined) return success({ carry: { first: index, last: index } })
  const slot = model.textAttribute === undefined ? undefined : nodeAttrs(node)[model.textAttribute]
  if (slot === undefined) return success({ segments: [syntax(spellInlineLeafDirective(node.type, attributes))] })
  if (typeof slot !== 'string' || slotFault(node.type, slot) !== undefined) return success({ carry: { first: index, last: index } })
  const content: InlineSegment[] = slot === '' ? [] : [{ escaping: 'bracketed', text: slot }]
  return success({ segments: [syntax(spellInlineDirectiveOpener(node.type)), ...content, syntax(`]${attributes}`)] })
}

// CommonMark reads a raw carriage return as a line ending and a null character as U+FFFD, so neither is written raw.
function emitText(node: AdfNode, context: InlineContext, index: number): Emission {
  if (!isSpellableText(node) || typeof node.text !== 'string' || node.text === '') return { carry: { first: index, last: index } }
  const escaping: InlineEscaping = context.bracketed ? 'bracketed' : 'backslash'
  const parts = node.text.split(/(\n+|\0+|\r)/).filter((part) => part !== '')
  return { segments: parts.map((part) => (part === '\r' ? syntax('&#13;') : /^[\n\0]/.test(part) ? textDirectiveSegment(part) : { escaping, text: part })) }
}

function emitMarkedRun(nodes: readonly AdfNode[], mark: AdfMark, depth: number, index: number, context: InlineContext): Result<Emission> {
  const range: NodeRange = { first: index, last: index + nodes.length - 1 }
  if (mark.type === 'backgroundColor' && flavourClaims[context.flavour].highlights) return emitHighlight(nodes, depth, range, context)
  const spelling = markSpelling(mark.type)
  if (spelling === undefined) return success({ carry: range })
  const attributes = spellMarkAttributes(mark, spelling)
  if (attributes === undefined) return success({ carry: range })
  if (spelling.kind === 'code') return success(emitCodeSpan(nodes, depth, range))
  if (spelling.kind === 'emphasis') return emitEmphasis(nodes, spelling.spelling, depth, range, context)
  const link = spelling.kind === 'link' ? tryLink(nodes, mark, depth, range, context) : undefined
  if (link !== undefined) return link
  const inner = emitRun(nodes, depth + 1, index, { ...context, bracketed: true, spansLines: false })
  if (!inner.ok) return inner
  if (inner.value.carry !== undefined) return inner
  return success({ segments: [syntax(spellInlineDirectiveOpener(mark.type)), ...inner.value.segments, syntax(`]${attributes}`)] })
}

function emitEmphasis(nodes: readonly AdfNode[], spelling: string, depth: number, range: NodeRange, context: InlineContext): Result<Emission> {
  const inner = emitRun(nodes, depth + 1, range.first, context)
  if (!inner.ok) return inner
  if (inner.value.carry !== undefined) return inner
  const spelled = spellEdgeWhitespace(inner.value.segments)
  return success({
    segments: [
      { emphasis: 'open', escaping: 'none', nodes: { ...range, depth }, text: spelling },
      ...spelled,
      { emphasis: 'close', escaping: 'none', nodes: { ...range, depth }, text: spelling },
    ],
  })
}

function emitHighlight(nodes: readonly AdfNode[], depth: number, range: NodeRange, context: InlineContext): Result<Emission> {
  const inner = emitRun(nodes, depth + 1, range.first, context)
  if (!inner.ok || inner.value.carry !== undefined) return inner
  const run = { ...range, depth }
  return success({
    segments: [{ escaping: 'none', highlight: 'open', nodes: run, text: highlightDelimiter }, ...inner.value.segments, { escaping: 'none', highlight: 'close', nodes: run, text: highlightDelimiter }],
  })
}

// Each node its own span: CommonMark reads two adjacent text nodes in one span back as one.
function emitCodeSpan(nodes: readonly AdfNode[], depth: number, range: NodeRange): Emission {
  const spans: string[] = []
  for (const node of nodes) {
    const { text } = node
    if (!isSpellableText(node) || nodeMarks(node).length !== depth + 1 || typeof text !== 'string' || text === '' || /[\n\r]/.test(text) || holdsNullCharacter(text)) return { carry: range }
    const fence = '`'.repeat(longestBacktickRun(text) + 1)
    spans.push(`${fence}${needsPadding(text) ? ` ${text} ` : text}${fence}`)
  }
  return { segments: [syntax(spans.join(textBreakSpelling))] }
}

function needsPadding(text: string): boolean {
  if (text.startsWith('`') || text.endsWith('`')) return true
  return text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
}

function tryLink(nodes: readonly AdfNode[], mark: AdfMark, depth: number, range: NodeRange, context: InlineContext): Result<Emission> | undefined {
  const href = linkHref(nodeAttrs(mark))
  if (href === undefined) return success({ carry: range })
  const opening = depth === 0 && range.first === 0 && context.openingLinkAsDirective
  const commonMark = opening ? undefined : commonMarkLink(nodeAttrs(mark), href, nodes, depth + 1, context.bracketed)
  if (commonMark === undefined) return undefined
  if (commonMark.form === 'autolink') return success({ segments: [syntax(`<${href}>`)] })
  const inner = emitRun(nodes, depth + 1, range.first, { ...context, bracketed: true })
  if (!inner.ok) return inner
  if (inner.value.carry !== undefined) return inner
  const target: InlineSegment = context.bracketed ? { escaping: 'bracketed-link-target', text: escapeUnbalanced(commonMark.target, '[', ']') } : syntax(commonMark.target)
  return success({ segments: [{ escaping: 'none', nodes: range, text: '[' }, ...inner.value.segments, syntax(']('), target, syntax(')')] })
}


import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { InlineDirective } from '../../adf/inline-directives.ts'
import { assembleInlineLine, isSyntax, type InlineEscaping, type InlineSegment, type LineContainer, type NodeRange } from './line-escaping.ts'
import { carriedInline } from '../opaque-carry.ts'
import { claimsLine, holdsNullCharacter, isAutolink } from '../commonmark-grammar.ts'
import { escapeUnbalanced, spellDestination, spellLinkTarget } from '../link-syntax.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { holdsEntityReference } from '../entity-references.ts'
import { inlineDirective } from '../../adf/inline-directives.ts'
import { largestNesting } from '../../nesting.ts'
import { longestBacktickRun } from '../backtick-runs.ts'
import { markSpelling, spellMarkAttributes } from '../mark-spellings.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { sameMark } from '../../adf/editor-normal.ts'
import { slotLineEndingFault, spellLeafDirective } from '../directive-syntax.ts'
import { spellInlineNodeAttributes } from './inline-directive-spelling.ts'
import { spellTextDirective } from '../text-directive.ts'

type EmittedLine = { line: string; segments: InlineSegment[] }

type Emission = { carry: NodeRange; segments?: undefined } | { carry?: undefined; segments: InlineSegment[] }

type InlineContext = {
  atBlockEnd: boolean
  bracketed: boolean
  carried: ReadonlySet<number>
  path: ConvertErrorPath
  spansLines: boolean
}

type InlineRun = { index: number; kind: 'marked'; mark: AdfMark; nodes: AdfNode[] } | { index: number; kind: 'plain'; node: AdfNode }

type LineAttempt = { carry: NodeRange; line?: undefined } | { carry?: undefined; line: string }

export function emitInlineLine(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath): Result<string> {
  const emitted = emitLine(nodes, container, path)
  if (!emitted.ok) return emitted
  return success(emitted.value.line)
}

export function tryPipeCell(nodes: readonly AdfNode[], path: ConvertErrorPath): string | undefined {
  const emitted = emitLine(nodes, 'table-cell', path)
  if (!emitted.ok) return undefined
  if (emitted.value.segments.some((segment) => isSyntax(segment.escaping) && segment.text.includes('|'))) return undefined
  return emitted.value.line
}

export function tryImageLine(alt: string | undefined, href: string, path: ConvertErrorPath): string | undefined {
  if (alt !== undefined && (/^[ \t]|[ \t]$|[\n\r]/.test(alt) || holdsNullCharacter(alt))) return undefined
  const destination = spellDestination(href, path)
  if (!destination.ok) return undefined
  const description: InlineSegment[] = alt === undefined ? [] : [{ escaping: 'bracketed', text: alt }]
  const attempt = attemptLine([syntax('!['), ...description, syntax(`](${destination.value})`)], 'paragraph', path)
  return attempt.ok ? attempt.value.line : undefined
}

// A carried node joins no run, so every pass carries at least one more node.
function emitLine(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath): Result<EmittedLine> {
  const carried = new Set<number>()
  for (;;) {
    const emission = lineSegments(nodes, container, path, carried)
    if (!emission.ok) return emission
    if (emission.value.carry !== undefined) {
      carryRange(carried, emission.value.carry)
      continue
    }
    const attempt = attemptLine(emission.value.segments, container, path)
    if (!attempt.ok) return attempt
    if (attempt.value.carry === undefined) return success({ line: attempt.value.line, segments: emission.value.segments })
    carryRange(carried, attempt.value.carry)
  }
}

function carryRange(carried: Set<number>, range: NodeRange): void {
  for (let index = range.first; index <= range.last; index += 1) carried.add(index)
}

function lineSegments(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath, carried: ReadonlySet<number>): Result<Emission> {
  const emission = emitRun(nodes, 0, 0, { atBlockEnd: true, bracketed: false, carried, path, spansLines: container === 'paragraph' })
  if (!emission.ok) return emission
  if (emission.value.carry !== undefined) return emission
  return success({ segments: carryStrippedWhitespace(emission.value.segments) })
}

function attemptLine(segments: readonly InlineSegment[], container: LineContainer, path: ConvertErrorPath): Result<LineAttempt> {
  const assembled = assembleInlineLine(segments, container)
  if (assembled.unspellableRun !== undefined) return success({ carry: assembled.unspellableRun })
  for (const [index, single] of assembled.line.split('\n').entries()) {
    if (container === 'paragraph' && claimsLine(single, index === 0 ? 'first' : 'later')) {
      return failure('unspellable-line-start', `block parsing would claim the emitted line ${JSON.stringify(single)}`, path)
    }
  }
  return success({ line: assembled.line })
}

// spec/flavour.md, Inline nodes.
function carryStrippedWhitespace(segments: readonly InlineSegment[]): InlineSegment[] {
  const carried: InlineSegment[] = []
  for (const [index, segment] of segments.entries()) {
    const previous = segments[index - 1]
    const next = segments[index + 1]
    const leading = previous === undefined || previous.text.includes('\n')
    const trailing = next === undefined || next.text.includes('\n')
    carried.push(...carryEdges(segment, leading, trailing))
  }
  return carried
}

function carryEdges(segment: InlineSegment, leading: boolean, trailing: boolean): InlineSegment[] {
  if (segment.escaping !== 'backslash' && segment.escaping !== 'bracketed') return [segment]
  const head = leading ? (/^[ \t]+/.exec(segment.text)?.[0] ?? '') : ''
  const body = segment.text.slice(head.length)
  const tail = trailing ? (/[ \t]+$/.exec(body)?.[0] ?? '') : ''
  const middle = body.slice(0, body.length - tail.length)
  const edges: InlineSegment[] = []
  if (head !== '') edges.push(carriedText(head))
  if (middle !== '') edges.push({ escaping: segment.escaping, text: middle })
  if (tail !== '') edges.push(carriedText(tail))
  return edges
}

function carriedText(text: string): InlineSegment {
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
    const runContext = { ...context, atBlockEnd: context.atBlockEnd && offset === runs.length - 1 }
    const emitted = run.kind === 'plain' ? emitLeaf(run.node, runContext, run.index) : emitMarkedRun(run.nodes, run.mark, depth, run.index, runContext)
    if (!emitted.ok) return emitted
    if (emitted.value.carry !== undefined) return emitted
    segments.push(...emitted.value.segments)
  }
  return success({ segments })
}

function inlineRuns(nodes: readonly AdfNode[], depth: number, firstIndex: number, carried: ReadonlySet<number>): InlineRun[] {
  const runs: InlineRun[] = []
  for (const [offset, node] of nodes.entries()) {
    const index = firstIndex + offset
    // spec/flavour.md, Marks.
    const mark = carries(node, carried, index) ? undefined : nodeMarks(node)[depth]
    if (mark === undefined) {
      runs.push({ index, kind: 'plain', node })
      continue
    }
    const previous = runs[runs.length - 1]
    if (previous?.kind === 'marked' && sameMark(previous.mark, mark)) previous.nodes.push(node)
    else runs.push({ index, kind: 'marked', mark, nodes: [node] })
  }
  return runs
}

function nodePath(context: InlineContext, index: number): ConvertErrorPath {
  return [...context.path, 'content', index]
}

function carries(node: AdfNode, carried: ReadonlySet<number>, index: number): boolean {
  if (carried.has(index)) return true
  return node.type !== 'text' && inlineDirective(node.type) === undefined
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
  const directive = inlineDirective(node.type)
  if (directive === undefined) return emitText(node, context, index, path)
  if (node.type === 'hardBreak') return emitHardBreak(node, directive, context, index, path)
  return emitInlineDirective(node, directive, index, path)
}

function emitHardBreak(node: AdfNode, directive: InlineDirective, context: InlineContext, index: number, path: ConvertErrorPath): Result<Emission> {
  const empty = refuseContentAndText(node, path)
  if (!empty.ok) return empty
  const attributes = spellInlineNodeAttributes(node, directive)
  if (attributes === undefined) return success({ carry: { first: index, last: index } })
  if (attributes === '' && context.spansLines && !context.atBlockEnd) return success({ segments: [syntax('\\\n')] })
  return success({ segments: [syntax(spellLeafDirective('hardBreak', attributes))] })
}

function emitInlineDirective(node: AdfNode, directive: InlineDirective, index: number, path: ConvertErrorPath): Result<Emission> {
  const empty = refuseContentAndText(node, path)
  if (!empty.ok) return empty
  const attributes = spellInlineNodeAttributes(node, directive)
  if (attributes === undefined) return success({ carry: { first: index, last: index } })
  const slot = directive.textAttribute === undefined ? undefined : nodeAttrs(node)[directive.textAttribute]
  if (slot === undefined) return success({ segments: [syntax(spellLeafDirective(node.type, attributes))] })
  if (typeof slot !== 'string') return success({ carry: { first: index, last: index } })
  const spans = slotLineEndingFault(node.type, slot)
  if (spans !== undefined) return faulted(spans, path)
  if (holdsNullCharacter(slot)) return failure('unspellable-character', `a ${node.type} content slot holds a null character CommonMark replaces`, path)
  const content: InlineSegment[] = slot === '' ? [] : [{ escaping: 'bracketed', text: slot }]
  return success({ segments: [syntax(`:${node.type}[`), ...content, syntax(`]${attributes}`)] })
}

function emitText(node: AdfNode, context: InlineContext, index: number, path: ConvertErrorPath): Result<Emission> {
  if (Object.keys(nodeAttrs(node)).length > 0) return success({ carry: { first: index, last: index } })
  if (typeof node.text !== 'string' || node.text === '') return failure('unsupported-node-shape', 'a text node holds text: this one has none', path)
  if (nodeContent(node).length > 0) return failure('unsupported-node-shape', 'a text node holds no content: this one holds some', path)
  if (/\r/.test(node.text)) return failure('unspellable-character', 'a text node holds a carriage return CommonMark rewrites', path)
  if (holdsNullCharacter(node.text)) return failure('unspellable-character', 'a text node holds a null character CommonMark replaces', path)
  const escaping: InlineEscaping = context.bracketed ? 'bracketed' : 'backslash'
  const parts = node.text.split(/(\n+)/).filter((part) => part !== '')
  return success({ segments: parts.map((part) => (part.startsWith('\n') ? carriedText(part) : { escaping, text: part })) })
}

function emitMarkedRun(nodes: readonly AdfNode[], mark: AdfMark, depth: number, index: number, context: InlineContext): Result<Emission> {
  const path = nodePath(context, index)
  const range: NodeRange = { first: index, last: index + nodes.length - 1 }
  const spelling = markSpelling(mark.type)
  if (spelling === undefined) return success({ carry: range })
  const attributes = spellMarkAttributes(mark, spelling.attributes)
  if (attributes === undefined) return success({ carry: range })
  if (spelling.kind === 'code') return emitCodeSpan(nodes, depth, range, path)
  if (spelling.kind === 'emphasis') return emitEmphasis(nodes, spelling.spelling, depth, range, context)
  if (spelling.kind === 'link') return emitLink(nodes, mark, depth, range, context, path)
  const inner = emitRun(nodes, depth + 1, index, { ...context, bracketed: true, spansLines: false })
  if (!inner.ok) return inner
  if (inner.value.carry !== undefined) return inner
  return success({ segments: [syntax(`:${mark.type}[`), ...inner.value.segments, syntax(`]${attributes}`)] })
}

function emitEmphasis(nodes: readonly AdfNode[], spelling: string, depth: number, range: NodeRange, context: InlineContext): Result<Emission> {
  const inner = emitRun(nodes, depth + 1, range.first, context)
  if (!inner.ok) return inner
  if (inner.value.carry !== undefined) return inner
  const carried = carryStrippedWhitespace(inner.value.segments)
  return success({
    segments: [
      { emphasis: 'open', escaping: 'none', nodes: range, text: spelling },
      ...carried,
      { emphasis: 'close', escaping: 'none', nodes: range, text: spelling },
    ],
  })
}

function emitCodeSpan(nodes: readonly AdfNode[], depth: number, range: NodeRange, path: ConvertErrorPath): Result<Emission> {
  let text = ''
  for (const node of nodes) {
    if (node.type !== 'text' || nodeMarks(node).length !== depth + 1) return success({ carry: range })
    if (typeof node.text !== 'string' || node.text === '') return failure('unsupported-node-shape', 'a text node holds text: this one has none', path)
    if (nodeContent(node).length > 0) return failure('unsupported-node-shape', 'a text node holds no content: this one holds some', path)
    text += node.text
  }
  if (/[\n\r]/.test(text)) return success({ carry: range })
  if (holdsNullCharacter(text)) return failure('unspellable-character', 'a code span holds a null character CommonMark replaces', path)
  const fence = '`'.repeat(longestBacktickRun(text) + 1)
  const padded = needsPadding(text) ? ` ${text} ` : text
  return success({ segments: [syntax(`${fence}${padded}${fence}`)] })
}

function needsPadding(text: string): boolean {
  if (text.startsWith('`') || text.endsWith('`')) return true
  return text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
}

function emitLink(nodes: readonly AdfNode[], mark: AdfMark, depth: number, range: NodeRange, context: InlineContext, path: ConvertErrorPath): Result<Emission> {
  const href = nodeAttrs(mark)['href']
  const title = nodeAttrs(mark)['title']
  if (typeof href !== 'string') return success({ carry: range })
  const node = nodes[0]
  const bare = nodes.length === 1 && node !== undefined && node.type === 'text' && node.text === href && nodeMarks(node).length === depth + 1
  const autolinkHolds = !context.bracketed || (!href.includes('`') && escapeUnbalanced(href, '[', ']') === href)
  if (bare && autolinkHolds && title === undefined && isAutolink(href) && !holdsEntityReference(href)) return success({ segments: [syntax(`<${href}>`)] })
  const target = spellLinkTarget(href, typeof title === 'string' ? title : undefined, path)
  if (!target.ok) return target
  const inner = emitRun(nodes, depth + 1, range.first, { ...context, bracketed: true })
  if (!inner.ok) return inner
  if (inner.value.carry !== undefined) return inner
  const spelledTarget: InlineSegment = context.bracketed ? { escaping: 'bracketed-link-target', text: escapeUnbalanced(target.value, '[', ']') } : syntax(target.value)
  return success({ segments: [syntax('['), ...inner.value.segments, syntax(']('), spelledTarget, syntax(')')] })
}


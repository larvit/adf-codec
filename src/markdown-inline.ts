import type { AdfMark, AdfNode } from './adf-document.ts'
import type { InlineDirective } from './inline-directives.ts'
import { assembleInlineLine, type InlineEscaping, type InlineSegment, type LineContainer } from './markdown-escaping.ts'
import { inlineDirective, markDirective, spellInlineNodeAttributes, spellMarkAttributes } from './inline-directives.ts'
import { largestNesting } from './nesting.ts'
import { claimsLine, holdsControlCharacter, holdsEntityReference, holdsNullCharacter, isAutolink, isUnicodeWhitespace } from './commonmark-grammar.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { longestBacktickRun } from './backtick-runs.ts'
import { serializeCanonicalJson } from './canonical-json.ts'
import { spellStringAttribute } from './directive-attributes.ts'

type Brackets = 'directive' | 'link' | 'none'

type InlineContext = {
  atBlockEnd: boolean
  brackets: Brackets
  container: LineContainer
  path: ConvertErrorPath
}

type InlineRun = { index: number; kind: 'marked'; mark: AdfMark; nodes: AdfNode[] } | { index: number; kind: 'plain'; node: AdfNode }

const emphasisSpellings: Readonly<Record<string, string>> = { em: '_', strike: '~~', strong: '**' }
const linkAttributes = ['href', 'title']

export function emitInlineLine(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath): Result<string> {
  const segments = lineSegments(nodes, container, path)
  if (!segments.ok) return segments
  return finishLine(segments.value, container, path)
}

// undefined where the cell holds a pipe no backslash reaches, leaving the table its directive form.
export function emitPipeCell(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> | undefined {
  const segments = lineSegments(nodes, 'table-cell', path)
  if (!segments.ok) return segments
  if (segments.value.some((segment) => segment.escaping === 'none' && segment.text.includes('|'))) return undefined
  return finishLine(segments.value, 'table-cell', path)
}

export function emitImageLine(alt: string | undefined, href: string, path: ConvertErrorPath): Result<string> {
  if (alt !== undefined && /^[ \t]|[ \t]$|[\n\r]/.test(alt)) {
    return failure('unspellable-whitespace', 'a media alt holds whitespace no image description spells', path)
  }
  if (alt !== undefined && holdsNullCharacter(alt)) return failure('unspellable-character', 'a media alt holds a null character CommonMark replaces', path)
  const destination = spellDestination(href, path)
  if (!destination.ok) return destination
  const description: InlineSegment[] = alt === undefined ? [] : [{ escaping: 'bracketed', text: alt }]
  return finishLine([syntax('!['), ...description, syntax(`](${destination.value})`)], 'paragraph', path)
}

function lineSegments(nodes: readonly AdfNode[], container: LineContainer, path: ConvertErrorPath): Result<InlineSegment[]> {
  const segments = emitRun(nodes, 0, 0, { atBlockEnd: true, brackets: 'none', container, path })
  if (!segments.ok) return segments
  return success(carryStrippedWhitespace(segments.value))
}

function finishLine(segments: readonly InlineSegment[], container: LineContainer, path: ConvertErrorPath): Result<string> {
  const assembled = assembleInlineLine(segments, container)
  if (assembled.unspellableMark !== undefined) {
    return failure('unspellable-mark', `the ${assembled.unspellableMark} spelling cannot open or close where it sits`, path)
  }
  const line = assembled.line
  for (const [index, single] of line.split('\n').entries()) {
    if (/^[ \t\v\f]|[ \t\v\f]$/.test(single)) {
      return failure('unspellable-whitespace', 'a line begins or ends with whitespace CommonMark strips', path)
    }
    if (container === 'paragraph' && claimsLine(single, index === 0 ? 'first' : 'later')) {
      return failure('unspellable-line-start', `block parsing would claim the emitted line ${JSON.stringify(single)}`, path)
    }
  }
  return success(line)
}

// spec/flavour.md, Inline nodes: whitespace CommonMark strips at a line edge rides the reserved text directive.
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
  return { escaping: 'attribute', text: `:text{text=${spellStringAttribute(text)}}` }
}

function syntax(text: string): InlineSegment {
  return { escaping: 'none', text }
}

function refuseContentAndText(node: AdfNode, path: ConvertErrorPath): Result<null> {
  if ((node.content ?? []).length > 0 || node.text !== undefined) {
    return failure('unsupported-node-shape', `a ${node.type} node carries neither content nor text`, path)
  }
  return success(null)
}

function emitRun(nodes: readonly AdfNode[], depth: number, firstIndex: number, context: InlineContext): Result<InlineSegment[]> {
  if (depth > largestNesting) {
    return failure('unsupported-node-shape', `the marks nest deeper than the ${largestNesting} levels the emitter carries`, context.path)
  }
  const runs = inlineRuns(nodes, depth, firstIndex)
  const segments: InlineSegment[] = []
  for (const [offset, run] of runs.entries()) {
    const runContext = { ...context, atBlockEnd: context.atBlockEnd && offset === runs.length - 1 }
    const emitted = run.kind === 'plain' ? emitLeaf(run.node, runContext, run.index) : emitMarkedRun(run.nodes, run.mark, depth, run.index, runContext)
    if (!emitted.ok) return emitted
    segments.push(...emitted.value)
  }
  return success(segments)
}

function inlineRuns(nodes: readonly AdfNode[], depth: number, firstIndex: number): InlineRun[] {
  const runs: InlineRun[] = []
  for (const [offset, node] of nodes.entries()) {
    const index = firstIndex + offset
    const mark = (node.marks ?? [])[depth]
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

function emitLeaf(node: AdfNode, context: InlineContext, index: number): Result<InlineSegment[]> {
  const path = nodePath(context, index)
  const types = (node.marks ?? []).map((mark) => mark.type)
  if (new Set(types).size !== types.length) return failure('unsupported-node-shape', `a ${node.type} node carries one mark type twice`, path)
  if (node.type === 'text') return emitText(node, context, path)
  if (node.type === 'hardBreak') return emitHardBreak(node, context, path)
  const directive = inlineDirective(node.type)
  if (directive === undefined) return failure('unsupported-node-type', `the canonical form spells no inline node of type ${node.type}`, path)
  return emitInlineDirective(node, directive, path)
}

function emitHardBreak(node: AdfNode, context: InlineContext, path: ConvertErrorPath): Result<InlineSegment[]> {
  const unspelled = Object.keys(node.attrs ?? {})[0]
  if (unspelled !== undefined) return failure('unspelled-node-attribute', `the hardBreak attribute ${unspelled} has no canonical markdown spelling`, path)
  const empty = refuseContentAndText(node, path)
  if (!empty.ok) return empty
  if (context.container === 'paragraph' && !context.atBlockEnd && context.brackets !== 'directive') return success([syntax('\\\n')])
  return success([syntax(':hardBreak{}')])
}

function emitInlineDirective(node: AdfNode, directive: InlineDirective, path: ConvertErrorPath): Result<InlineSegment[]> {
  const empty = refuseContentAndText(node, path)
  if (!empty.ok) return empty
  const attributes = spellInlineNodeAttributes(node, directive, path)
  if (!attributes.ok) return attributes
  const slot = directive.slot === undefined ? undefined : node.attrs?.[directive.slot]
  if (slot === undefined) return success([syntax(`:${node.type}${attributes.value === '' ? '{}' : attributes.value}`)])
  if (typeof slot !== 'string') return failure('unsupported-node-shape', `the ${node.type} attribute ${directive.slot} holds no string`, path)
  if (/[\n\r]/.test(slot)) return failure('unspellable-whitespace', `a ${node.type} content slot holds a newline no inline directive spans`, path)
  if (holdsNullCharacter(slot)) return failure('unspellable-character', `a ${node.type} content slot holds a null character CommonMark replaces`, path)
  const content: InlineSegment[] = slot === '' ? [] : [{ escaping: 'bracketed', text: slot }]
  return success([syntax(`:${node.type}[`), ...content, syntax(`]${attributes.value}`)])
}

function emitText(node: AdfNode, context: InlineContext, path: ConvertErrorPath): Result<InlineSegment[]> {
  const unspelled = Object.keys(node.attrs ?? {})[0]
  if (unspelled !== undefined) return failure('unspelled-node-attribute', `the text attribute ${unspelled} has no canonical markdown spelling`, path)
  if (typeof node.text !== 'string' || node.text === '') return failure('unsupported-node-shape', 'a text node carries no text', path)
  if ((node.content ?? []).length > 0) return failure('unsupported-node-shape', 'a text node carries no content', path)
  if (/\r/.test(node.text)) return failure('unspellable-whitespace', 'a text node holds a carriage return CommonMark rewrites', path)
  if (holdsNullCharacter(node.text)) return failure('unspellable-character', 'a text node holds a null character CommonMark replaces', path)
  const escaping: InlineEscaping = context.brackets === 'none' ? 'backslash' : 'bracketed'
  const parts = node.text.split(/(\n+)/).filter((part) => part !== '')
  return success(parts.map((part) => (part.startsWith('\n') ? carriedText(part) : { escaping, text: part })))
}

function emitMarkedRun(nodes: readonly AdfNode[], mark: AdfMark, depth: number, index: number, context: InlineContext): Result<InlineSegment[]> {
  if (mark.type === 'code') return emitCodeSpan(nodes, depth, nodePath(context, index))
  if (mark.type === 'link') return emitLink(nodes, mark, depth, index, context)
  const path = nodePath(context, index)
  const spelling = Object.hasOwn(emphasisSpellings, mark.type) ? emphasisSpellings[mark.type] : undefined
  if (spelling !== undefined) return emitEmphasis(nodes, mark, spelling, depth, index, context, path)
  const vocabulary = markDirective(mark.type)
  if (vocabulary === undefined) return failure('unspellable-mark', `no markdown spelling holds the ${mark.type} mark`, path)
  const attributes = spellMarkAttributes(mark, vocabulary, path)
  if (!attributes.ok) return attributes
  const inner = emitRun(nodes, depth + 1, index, { ...context, brackets: 'directive' })
  if (!inner.ok) return inner
  return success([syntax(`:${mark.type}[`), ...inner.value, syntax(`]${attributes.value}`)])
}

function emitEmphasis(
  nodes: readonly AdfNode[],
  mark: AdfMark,
  spelling: string,
  depth: number,
  index: number,
  context: InlineContext,
  path: ConvertErrorPath,
): Result<InlineSegment[]> {
  if (Object.keys(mark.attrs ?? {}).length > 0) return failure('unspellable-mark', `the ${mark.type} spelling holds no attributes`, path)
  const inner = emitRun(nodes, depth + 1, index, context)
  if (!inner.ok) return inner
  const carried = carryStrippedWhitespace(inner.value)
  const text = carried.map((segment) => segment.text).join('')
  if (holdsEdgeWhitespace(text)) return failure('unspellable-whitespace', `the ${mark.type} spelling cannot open or close beside whitespace`, path)
  return success([
    { emphasis: 'open', escaping: 'none', mark: mark.type, text: spelling },
    ...carried,
    { emphasis: 'close', escaping: 'none', mark: mark.type, text: spelling },
  ])
}

function emitCodeSpan(nodes: readonly AdfNode[], depth: number, path: ConvertErrorPath): Result<InlineSegment[]> {
  let text = ''
  for (const node of nodes) {
    if (node.type !== 'text' || typeof node.text !== 'string' || node.text === '') return failure('unspellable-mark', 'a code span holds text nodes only', path)
    if ((node.marks ?? []).length !== depth + 1) return failure('unspellable-mark', 'a code span cannot sit inside the marks it carries', path)
    text += node.text
  }
  if (/[\n\r]/.test(text)) return failure('unspellable-mark', 'a code span holds no newline', path)
  if (holdsNullCharacter(text)) return failure('unspellable-character', 'a code span holds a null character CommonMark replaces', path)
  const fence = '`'.repeat(longestBacktickRun(text) + 1)
  const padded = needsPadding(text) ? ` ${text} ` : text
  return success([syntax(`${fence}${padded}${fence}`)])
}

function holdsEdgeWhitespace(text: string): boolean {
  return isUnicodeWhitespace(text.charAt(0)) || isUnicodeWhitespace(text.charAt(text.length - 1))
}

function needsPadding(text: string): boolean {
  if (text.startsWith('`') || text.endsWith('`')) return true
  return text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
}

function emitLink(nodes: readonly AdfNode[], mark: AdfMark, depth: number, index: number, context: InlineContext): Result<InlineSegment[]> {
  const path = nodePath(context, index)
  const unspelled = Object.keys(mark.attrs ?? {}).find((key) => !linkAttributes.includes(key))
  if (unspelled !== undefined) return failure('unspellable-mark', `the link spelling holds no ${unspelled} attribute`, path)
  const href = mark.attrs?.['href']
  const title = mark.attrs?.['title']
  if (typeof href !== 'string') return failure('unsupported-node-shape', 'a link mark carries no href', path)
  if (title !== undefined && typeof title !== 'string') return failure('unsupported-node-shape', 'a link title is no string', path)
  const node = nodes[0]
  const bare = nodes.length === 1 && node !== undefined && node.type === 'text' && node.text === href && (node.marks ?? []).length === depth + 1
  if (bare && title === undefined && isAutolink(href) && !holdsEntityReference(href)) return success([syntax(`<${href}>`)])
  const destination = spellDestination(href, path)
  if (!destination.ok) return destination
  const spelledTitle = title === undefined ? success('') : spellTitle(title, path)
  if (!spelledTitle.ok) return spelledTitle
  const inner = emitRun(nodes, depth + 1, index, { ...context, brackets: 'link' })
  if (!inner.ok) return inner
  return success([syntax('['), ...inner.value, syntax(`](${destination.value}${spelledTitle.value})`)])
}

function spellDestination(href: string, path: ConvertErrorPath): Result<string> {
  if (holdsControlCharacter(href)) return failure('unspellable-link-destination', 'a link destination holds a control character', path)
  if (href.includes('\\')) return failure('unspellable-link-destination', 'no canonical escape spells a backslash in a link destination', path)
  if (holdsEntityReference(href)) {
    return failure('unspellable-link-destination', 'a link destination shaped like an entity reference decodes on the way back', path)
  }
  if (href.includes(' ')) {
    if (/[<>]/.test(href)) {
      return failure('unspellable-link-destination', 'no canonical escape spells an angle bracket beside a space in a link destination', path)
    }
    return success(`<${href}>`)
  }
  if (href.startsWith('<')) return failure('unspellable-link-destination', 'a bare link destination cannot begin with an angle bracket', path)
  if (!balanced(href)) return failure('unspellable-link-destination', 'no canonical escape spells an unbalanced parenthesis in a link destination', path)
  return success(href)
}

function spellTitle(title: string, path: ConvertErrorPath): Result<string> {
  if (/["\n\r\\]/.test(title)) {
    return failure('unspellable-link-title', 'no canonical escape spells a quote, backslash or newline in a link title', path)
  }
  if (holdsEntityReference(title)) return failure('unspellable-link-title', 'a link title shaped like an entity reference decodes on the way back', path)
  return success(` "${title}"`)
}

function balanced(href: string): boolean {
  let depth = 0
  for (const character of href) {
    if (character === '(') depth += 1
    if (character === ')') depth -= 1
    if (depth < 0) return false
  }
  return depth === 0
}

function sameMark(candidate: AdfMark, mark: AdfMark): boolean {
  if (candidate.type !== mark.type) return false
  return serializeCanonicalJson(candidate.attrs ?? {}, 'compact') === serializeCanonicalJson(mark.attrs ?? {}, 'compact')
}

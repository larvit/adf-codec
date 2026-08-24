import type { AdfMark, AdfNode } from './adf-document.ts'
import { assembleInlineLine, lineOpensBlock, type InlineSegment, type LineContainer } from './markdown-escaping.ts'
import { failure, success, type Result } from './result.ts'
import { longestBacktickRun } from './backtick-runs.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

type InlineContext = {
  atBlockEnd: boolean
  container: LineContainer
  inLinkText: boolean
}

const autolink = /^[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>\u0000-\u001f\u007f]*$/
const controlCharacter = /[\u0000-\u001f\u007f]/
const entityReference = /&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#[Xx][A-Fa-f0-9]{1,6});/
const linkAttributes = ['href', 'title']

export function emitInlineLine(nodes: readonly AdfNode[], container: LineContainer): Result<string> {
  const segments = emitRun(nodes, 0, { atBlockEnd: true, container, inLinkText: false })
  if (!segments.ok) return segments
  const line = assembleInlineLine(segments.value, container)
  for (const single of line.split('\n')) {
    if (/^[ \t]|[ \t]$/.test(single)) {
      return failure('unspellable-whitespace', 'a line begins or ends with whitespace CommonMark strips')
    }
    if (container === 'paragraph' && lineOpensBlock(single)) {
      return failure('unspellable-line-start', `block parsing would claim the emitted line ${JSON.stringify(single)}`)
    }
  }
  return success(line)
}

function emitRun(nodes: readonly AdfNode[], depth: number, context: InlineContext): Result<InlineSegment[]> {
  const segments: InlineSegment[] = []
  let index = 0
  while (index < nodes.length) {
    const node = nodes[index]
    if (node === undefined) return failure('unsupported-node-shape', 'the inline content holds a hole')
    const mark = (node.marks ?? [])[depth]
    if (mark === undefined) {
      const leaf = emitLeaf(node, { ...context, atBlockEnd: context.atBlockEnd && index === nodes.length - 1 })
      if (!leaf.ok) return leaf
      segments.push(...leaf.value)
      index += 1
      continue
    }
    let end = index + 1
    while (end < nodes.length && sameMark((nodes[end]?.marks ?? [])[depth], mark)) end += 1
    const wrapped = emitMarkedRun(nodes.slice(index, end), mark, depth, { ...context, atBlockEnd: context.atBlockEnd && end === nodes.length })
    if (!wrapped.ok) return wrapped
    segments.push(...wrapped.value)
    index = end
  }
  return success(segments)
}

function emitLeaf(node: AdfNode, context: InlineContext): Result<InlineSegment[]> {
  if (node.type !== 'hardBreak' && node.type !== 'text') {
    return failure('unsupported-node-type', `the canonical form spells no inline node of type ${node.type}`)
  }
  const unspelled = Object.keys(node.attrs ?? {})[0]
  if (unspelled !== undefined) {
    return failure('unspelled-node-attribute', `the ${node.type} attribute ${unspelled} has no canonical markdown spelling`)
  }
  if (node.type === 'hardBreak') {
    if (context.container === 'heading' || context.atBlockEnd) return success([{ kind: 'syntax', text: ':hardBreak{}' }])
    return success([{ kind: 'syntax', text: '\\\n' }])
  }
  if (typeof node.text !== 'string') return failure('unsupported-node-shape', 'a text node carries no text')
  if ((node.content ?? []).length > 0) return failure('unsupported-node-shape', 'a text node carries content')
  if (/[\n\r]/.test(node.text)) return failure('unspellable-whitespace', 'a text node holds a newline CommonMark cannot spell')
  return success([{ kind: context.inLinkText ? 'link-text' : 'literal', text: node.text }])
}

function emitMarkedRun(nodes: readonly AdfNode[], mark: AdfMark, depth: number, context: InlineContext): Result<InlineSegment[]> {
  if (mark.type === 'code') return emitCodeSpan(nodes, depth)
  if (mark.type === 'link') return emitLink(nodes, mark, depth, context)
  const spelling = mark.type === 'em' ? '_' : mark.type === 'strike' ? '~~' : mark.type === 'strong' ? '**' : undefined
  if (spelling === undefined) return failure('unspellable-mark', `no markdown spelling holds the ${mark.type} mark`)
  if (Object.keys(mark.attrs ?? {}).length > 0) return failure('unspellable-mark', `the ${mark.type} spelling holds no attributes`)
  const inner = emitRun(nodes, depth + 1, context)
  if (!inner.ok) return inner
  const text = inner.value.map((segment) => segment.text).join('')
  if (/^[ \t]|[ \t]$/.test(text)) return failure('unspellable-whitespace', `the ${mark.type} spelling cannot open or close beside whitespace`)
  if (mark.type === 'em') {
    return success([{ kind: 'emphasis-open', text: spelling }, ...inner.value, { kind: 'emphasis-close', text: spelling }])
  }
  return success([{ kind: 'syntax', text: spelling }, ...inner.value, { kind: 'syntax', text: spelling }])
}

function emitCodeSpan(nodes: readonly AdfNode[], depth: number): Result<InlineSegment[]> {
  const node = nodes[0]
  if (nodes.length !== 1 || node === undefined || node.type !== 'text' || typeof node.text !== 'string') {
    return failure('unspellable-mark', 'a code span holds exactly one text node')
  }
  if ((node.marks ?? []).length !== depth + 1) return failure('unspellable-mark', 'a code span cannot sit inside the marks it carries')
  if (/[\n\r]/.test(node.text)) return failure('unspellable-mark', 'a code span holds no newline')
  const fence = '`'.repeat(longestBacktickRun(node.text) + 1)
  const padded = needsPadding(node.text) ? ` ${node.text} ` : node.text
  return success([{ kind: 'syntax', text: `${fence}${padded}${fence}` }])
}

function needsPadding(text: string): boolean {
  if (text.startsWith('`') || text.endsWith('`')) return true
  return text.startsWith(' ') && text.endsWith(' ') && text.trim() !== ''
}

function emitLink(nodes: readonly AdfNode[], mark: AdfMark, depth: number, context: InlineContext): Result<InlineSegment[]> {
  const unspelled = Object.keys(mark.attrs ?? {}).find((key) => !linkAttributes.includes(key))
  if (unspelled !== undefined) return failure('unspellable-mark', `the link spelling holds no ${unspelled} attribute`)
  const href = mark.attrs?.['href']
  const title = mark.attrs?.['title']
  if (typeof href !== 'string') return failure('unsupported-node-shape', 'a link mark carries no href')
  if (title !== undefined && typeof title !== 'string') return failure('unsupported-node-shape', 'a link title is no string')
  const node = nodes[0]
  const bare = nodes.length === 1 && node !== undefined && node.type === 'text' && node.text === href && (node.marks ?? []).length === depth + 1
  if (bare && title === undefined && autolink.test(href)) return success([{ kind: 'syntax', text: `<${href}>` }])
  const destination = spellDestination(href)
  if (!destination.ok) return destination
  const spelledTitle = title === undefined ? success('') : spellTitle(title)
  if (!spelledTitle.ok) return spelledTitle
  const inner = emitRun(nodes, depth + 1, { ...context, inLinkText: true })
  if (!inner.ok) return inner
  return success([{ kind: 'syntax', text: '[' }, ...inner.value, { kind: 'syntax', text: `](${destination.value}${spelledTitle.value})` }])
}

function spellDestination(href: string): Result<string> {
  if (controlCharacter.test(href)) return failure('unspellable-link-destination', 'a link destination holds a control character')
  if (href.includes('\\')) return failure('unspellable-link-destination', 'no canonical escape spells a backslash in a link destination')
  if (entityReference.test(href)) {
    return failure('unspellable-link-destination', 'a link destination shaped like an entity reference decodes on the way back')
  }
  if (href.includes(' ')) {
    if (/[<>]/.test(href)) {
      return failure('unspellable-link-destination', 'no canonical escape spells an angle bracket beside a space in a link destination')
    }
    return success(`<${href}>`)
  }
  if (href.startsWith('<')) return failure('unspellable-link-destination', 'a bare link destination cannot begin with an angle bracket')
  if (!balanced(href)) return failure('unspellable-link-destination', 'no canonical escape spells an unbalanced parenthesis in a link destination')
  return success(href)
}

function spellTitle(title: string): Result<string> {
  if (/["\n\r\\]/.test(title)) return failure('unspellable-link-title', 'no canonical escape spells a quote, backslash or newline in a link title')
  if (entityReference.test(title)) return failure('unspellable-link-title', 'a link title shaped like an entity reference decodes on the way back')
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

function sameMark(candidate: AdfMark | undefined, mark: AdfMark): boolean {
  if (candidate === undefined || candidate.type !== mark.type) return false
  return serializeCanonicalJson(candidate.attrs ?? {}, 'compact') === serializeCanonicalJson(mark.attrs ?? {}, 'compact')
}

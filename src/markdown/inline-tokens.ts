import type { ClaimedPrefix } from './directive-syntax.ts'
import type { Claims } from './portable/conventions.ts'
import { backslashEscape, inlineHtmlConstruct, readBracketedAutolink, readEmailAutolink } from './commonmark/grammar.ts'
import { backtickRun, closingBacktickRun } from './commonmark/backtick-runs.ts'
import { claimDirectivePrefix } from './directive-syntax.ts'
import { delimiterFlags, runLength } from './commonmark/emphasis-matching.ts'
import { highlightDelimiter, highlightFlanking } from './portable/conventions.ts'
import { readEntityReference } from './commonmark/entity-references.ts'

// `directive` and `html` carry no `width`: a directive reads by its own grammar, and the reader refuses HTML.
export type InlineToken =
  | { email: boolean; kind: 'autolink'; width: number }
  | { image: boolean; kind: 'bracket'; width: number }
  | { kind: 'bracket-close' | 'entity' | 'escape' | 'hard-break' | 'line-ending' | 'text'; width: number }
  | { kind: 'code-span'; opener: number; width: number }
  | { canClose: boolean; canOpen: boolean; kind: 'delimiter-run'; width: number }
  | { kind: 'directive'; prefix: ClaimedPrefix }
  | { closes: boolean; kind: 'highlight'; opens: boolean; width: number }
  | { construct: string; kind: 'html' }

export function readInlineToken(source: string, index: number, claims: Claims): InlineToken {
  switch (source.charAt(index)) {
    case '<':
      return angleToken(source, index)
    case '!': {
      const prefix = claims.directives ? claimDirectivePrefix(source, index) : undefined
      if (prefix !== undefined) return { kind: 'directive', prefix }
      return source.charAt(index + 1) === '[' ? { image: true, kind: 'bracket', width: 2 } : text(1)
    }
    case '[':
      return { image: false, kind: 'bracket', width: 1 }
    case ']':
      return { kind: 'bracket-close', width: 1 }
    case '\\':
      if (source.charAt(index + 1) === '\n') return { kind: 'hard-break', width: 2 }
      return backslashEscape(source, index) === undefined ? text(1) : { kind: 'escape', width: 2 }
    case '\n':
      return { kind: 'line-ending', width: 1 }
    case '&': {
      const reference = readEntityReference(source, index)
      return reference === undefined ? text(1) : { kind: 'entity', width: reference.length }
    }
    case '`':
      return backtickToken(source, index)
    case '*':
    case '_':
    case '~':
      return delimiterRunToken(source, index, runLength(source, index), claims)
    case '=':
      return claims.highlights && source.startsWith(highlightDelimiter, index) ? { ...highlightFlanking(source, index), kind: 'highlight', width: highlightDelimiter.length } : text(1)
    default:
      return text(1)
  }
}

// The run of `length` delimiters from `index`, which a caller knowing the run's end reads without rescanning it.
export function delimiterRunToken(source: string, index: number, length: number, claims: Claims): InlineToken {
  const character = source.charAt(index)
  if (character === '~' && (!claims.strikethrough || length !== 2)) return text(length)
  const flags = delimiterFlags(character, source.charAt(index - 1), source.charAt(index + length))
  return flags.canOpen || flags.canClose ? { ...flags, kind: 'delimiter-run', width: length } : text(length)
}

function angleToken(source: string, index: number): InlineToken {
  const bracketed = readBracketedAutolink(source, index)
  if (bracketed !== undefined) return { email: false, kind: 'autolink', width: bracketed }
  const email = readEmailAutolink(source, index)
  if (email !== undefined) return { email: true, kind: 'autolink', width: email }
  const construct = inlineHtmlConstruct(source, index)
  return construct === undefined ? text(1) : { construct, kind: 'html' }
}

function backtickToken(source: string, index: number): InlineToken {
  const opener = backtickRun(source, index)
  const closer = closingBacktickRun(source, index + opener, opener)
  return closer === undefined ? text(opener) : { kind: 'code-span', opener, width: closer + opener - index }
}

function text(width: number): InlineToken {
  return { kind: 'text', width }
}

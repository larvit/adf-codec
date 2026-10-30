import { holdsOnlyRuleCharacters, isBlankLine, isThematicBreak } from '../commonmark/grammar.ts'

// A block's markdown, its prefixes applied only when written out, so a nesting level costs its own blocks rather than the text below it.
export type BlockText = Readonly<Lines & { first: FirstLine; later: LaterLines; length: number }>
type Lines =
  | { body: BlockText; head: string; indent: string; kind: 'prefixed' }
  | { body: BlockText; kind: 'quoted' }
  | { kind: 'joined'; parts: readonly BlockText[] }
  | { kind: 'text'; lines: readonly string[] }
type Prefix = Lines & { kind: 'prefixed' | 'quoted' }
// The written first line. The flags describe `text` so no caller reads it: reading a concatenated string copies it whole, once per nesting level.
type FirstLine = Readonly<{ blank: boolean; character: string; ruleCharacters: boolean; text: string }>
// How many written lines after the first are blank, empty, or hold text, blank ones included.
type LaterLines = Readonly<{ blank: number; empty: number; written: number }>

export const emptyLine = blockText('')

export function blockText(text: string): BlockText {
  const [first = '', ...rest] = text.split('\n')
  const empty = rest.filter((line) => line === '').length
  const later = { blank: rest.filter((line) => line !== '' && isBlankLine(line)).length, empty, written: rest.length - empty }
  return { first: { blank: first !== '' && isBlankLine(first), character: first.charAt(0), ruleCharacters: holdsOnlyRuleCharacters(first), text: first }, kind: 'text', later, length: text.length, lines: [first, ...rest] }
}

export function joinedText(parts: readonly BlockText[]): BlockText {
  const [first, ...others] = parts
  if (first === undefined) return emptyLine
  let { blank, empty, written } = first.later
  let { length } = first
  for (const part of others) {
    blank += part.later.blank + (part.first.blank ? 1 : 0)
    empty += part.later.empty + (part.first.text === '' ? 1 : 0)
    written += part.later.written + (part.first.text === '' ? 0 : 1)
    length += 1 + part.length
  }
  return { first: first.first, kind: 'joined', later: { blank, empty, written }, length, parts }
}

// head, never blank, leads the first line; indent, spaces alone, leads every later line holding text.
export function prefixedText(head: string, indent: string, body: BlockText): BlockText {
  const length = body.length + head.length + indent.length * body.later.written
  return { body, first: headedLine(head, body.first), head, indent, kind: 'prefixed', later: body.later, length }
}

// Each line takes `> `, an empty one `>`.
export function quotedText(body: BlockText): BlockText {
  const head = body.first.text === '' ? '>' : '> '
  const later = { blank: 0, empty: 0, written: body.later.empty + body.later.written }
  return { body, first: headedLine(head, body.first), kind: 'quoted', later, length: body.length + head.length + 2 * body.later.written + body.later.empty }
}

// A line holds only rule characters exactly when each of its parts does.
function headedLine(head: string, line: FirstLine): FirstLine {
  return { blank: false, character: head.charAt(0), ruleCharacters: holdsOnlyRuleCharacters(head) && line.ruleCharacters, text: `${head}${line.text}` }
}

export function holdsBlankLine(text: BlockText): boolean {
  return text.first.blank || text.later.blank > 0
}

export function opensWithThematicBreak(text: BlockText): boolean {
  return text.first.ruleCharacters && isThematicBreak(text.first.text)
}

// The first line, and the line break after it where one follows: enough to read a marker opening the text.
export function opening(text: BlockText): string {
  return text.later.empty + text.later.written > 0 ? `${text.first.text}\n` : text.first.text
}

export function writtenText(text: BlockText): string {
  const lines: string[] = []
  // The open prefixes, outermost first. A line starts every open prefix, so the unstarted ones are the innermost.
  const open: Prefix[] = []
  let started = 0
  // Each pending text with how many prefixes stay open around it.
  const pending: { text: BlockText; within: number }[] = [{ text, within: 0 }]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    open.length = next.within
    started = Math.min(started, next.within)
    const current = next.text
    if (current.kind === 'text') {
      for (const line of current.lines) {
        lines.push(prefixedLine(line, open, started))
        started = open.length
      }
    } else if (current.kind === 'joined') for (const part of current.parts.slice().reverse()) pending.push({ text: part, within: open.length })
    else {
      open.push(current)
      pending.push({ text: current.body, within: open.length })
    }
  }
  return lines.join('\n')
}

// Innermost first, since an empty line takes no indent and a quote turns it into `>`.
function prefixedLine(line: string, open: readonly Prefix[], started: number): string {
  return open.reduceRight((written, prefix, depth) => {
    if (prefix.kind === 'quoted') return written === '' ? '>' : `> ${written}`
    if (depth >= started) return `${prefix.head}${written}`
    return written === '' ? '' : `${prefix.indent}${written}`
  }, line)
}

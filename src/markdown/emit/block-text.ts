import { isBlankLine } from '../commonmark/grammar.ts'

// A block's markdown, its prefixes applied only when written out, so a nesting level costs its own blocks rather than the text below it.
export type BlockText = Lines & Shape
type Prefix = { prefix: Lines & { kind: 'prefixed' | 'quoted' }; started: boolean }
type Lines =
  | { body: BlockText; head: string; indent: string; kind: 'prefixed' }
  | { body: BlockText; kind: 'quoted' }
  | { kind: 'joined'; parts: readonly BlockText[] }
  | { kind: 'text'; lines: readonly string[] }
// The written text's measures; the flags answer for the first line unread, since reading a concatenated string copies it whole, at every level it nests.
type Shape = { blankRest: number; emptyRest: number; first: string; firstBlank: boolean; firstCharacter: string; firstRuleCharacters: boolean; length: number; lineCount: number }

const ruleCharacters = /^[-*_ \t]*$/

export const emptyLine = blockText('')

export function blockText(text: string): BlockText {
  const [first = '', ...rest] = text.split('\n')
  const blankRest = rest.filter((line) => line !== '' && isBlankLine(line)).length
  const firstShape = { first, firstBlank: first !== '' && isBlankLine(first), firstCharacter: first.charAt(0), firstRuleCharacters: ruleCharacters.test(first) }
  return { ...firstShape, blankRest, emptyRest: rest.filter((line) => line === '').length, kind: 'text', length: text.length, lineCount: rest.length + 1, lines: [first, ...rest] }
}

// The parts' lines one after another.
export function joinedText(parts: readonly BlockText[]): BlockText {
  const [first, ...others] = parts
  if (first === undefined) return emptyLine
  let { blankRest, emptyRest, length, lineCount } = first
  for (const part of others) {
    blankRest += part.blankRest + (part.firstBlank ? 1 : 0)
    emptyRest += part.emptyRest + (part.first === '' ? 1 : 0)
    length += 1 + part.length
    lineCount += part.lineCount
  }
  const { firstBlank, firstCharacter, firstRuleCharacters } = first
  return { blankRest, emptyRest, first: first.first, firstBlank, firstCharacter, firstRuleCharacters, kind: 'joined', length, lineCount, parts }
}

// head, never blank, leads the first line, and indent, spaces alone, every later line holding text.
export function prefixedText(head: string, indent: string, body: BlockText): BlockText {
  const first = `${head}${body.first}`
  const length = body.length + head.length + indent.length * (body.lineCount - 1 - body.emptyRest)
  const firstRuleCharacters = ruleCharacters.test(head) && body.firstRuleCharacters
  return { blankRest: body.blankRest, body, emptyRest: body.emptyRest, first, firstBlank: false, firstCharacter: head.charAt(0), firstRuleCharacters, head, indent, kind: 'prefixed', length, lineCount: body.lineCount }
}

export function quotedText(body: BlockText): BlockText {
  const empty = body.emptyRest + (body.first === '' ? 1 : 0)
  const first = body.first === '' ? '>' : `> ${body.first}`
  return { blankRest: 0, body, emptyRest: 0, first, firstBlank: false, firstCharacter: '>', firstRuleCharacters: false, kind: 'quoted', length: body.length + 2 * body.lineCount - empty, lineCount: body.lineCount }
}

// The first line, and the line break after it where one follows: enough to read a marker opening the text.
export function opening(text: BlockText): string {
  return text.lineCount > 1 ? `${text.first}\n` : text.first
}

export function writtenText(text: BlockText): string {
  const lines: string[] = []
  const prefixes: Prefix[] = []
  const pending: (BlockText | 'leave')[] = [text]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (next === 'leave') prefixes.pop()
    else if (next.kind === 'text') for (const line of next.lines) lines.push(prefixedLine(line, prefixes))
    else if (next.kind === 'joined') for (const part of next.parts.slice().reverse()) pending.push(part)
    else {
      prefixes.push({ prefix: next, started: false })
      pending.push('leave', next.body)
    }
  }
  return lines.join('\n')
}

// Innermost first: whether a line is empty when an outer prefix meets it depends on the prefixes inside.
function prefixedLine(line: string, prefixes: readonly Prefix[]): string {
  return prefixes.reduceRight((written, level) => {
    const { prefix, started } = level
    level.started = true
    if (prefix.kind === 'quoted') return written === '' ? '>' : `> ${written}`
    if (!started) return `${prefix.head}${written}`
    return written === '' ? '' : `${prefix.indent}${written}`
  }, line)
}

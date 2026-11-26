import type { JsonValue } from './json-value.ts'
import { joinedWithin, longestOutput } from './length-bound.ts'

// 'five-level' is the block carry's (docs/decisions.md §The block carry indents five levels in two spaces and writes deeper values compact): indenting every level makes the length quadratic in the nesting.
export type JsonSpelling = 'compact' | 'five-level' | 'two-space'

const indentedLevels: Record<JsonSpelling, number> = { compact: 0, 'five-level': 5, 'two-space': Infinity }

type Member = { key: string | undefined; value: JsonValue }

type Pending = string | { depth: number; value: JsonValue }

export function serializeCanonicalJson(value: JsonValue, spelling: JsonSpelling): string {
  const joined = joinedWithin(canonicalJsonPieces(value, spelling))
  // V8's own throw past its longest string, so every engine answers alike and `withinEngineLimits` refuses it as `tooLong`.
  if (!joined.ok) throw new RangeError('Invalid string length')
  return joined.value
}

// Stops at the first piece, passed through `respell`, that does not match `text`: built whole, the 'two-space' spelling of a short compact text can pass the engine's longest string.
export function spellsCanonicalJson(value: JsonValue, spelling: JsonSpelling, text: string, respell = (canonical: string): string => canonical): boolean {
  let length = 0
  let offset = 0
  for (const canonical of canonicalJsonPieces(value, spelling)) {
    // An engine whose strings outgrow the bound can hold a text that matches the unspelled pieces of a string past it.
    length += canonical.length
    if (length > longestOutput) return false
    const piece = respell(canonical)
    if (!text.startsWith(piece, offset)) return false
    offset += piece.length
  }
  return offset === text.length
}

export function* canonicalJsonPieces(value: JsonValue, spelling: JsonSpelling): Generator<string> {
  const levels = indentedLevels[spelling]
  const pending: Pending[] = [{ depth: 0, value }]
  let length = 0
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (typeof next === 'string') {
      length += next.length
      yield next
      continue
    }
    const { depth, value: held } = next
    const indent = depth < levels ? '  ' : ''
    if (Array.isArray(held)) schedule(pending, '[', held.map((item) => ({ key: undefined, value: item })), ']', indent, depth)
    else if (held !== null && typeof held === 'object') schedule(pending, '{', objectMembers(held), '}', indent, depth)
    else if (typeof held === 'string' && length + held.length + 2 > longestOutput) {
      // JSON.stringify can abort V8 on a string this long, past any try: yield it raw, then the two characters its quotes add, so the pieces' total passes the bound and the caller refuses.
      yield held
      yield '""'
      return
    } else {
      const spelled = Object.is(held, -0) ? '-0' : JSON.stringify(held)
      length += spelled.length
      yield spelled
    }
  }
}

function objectMembers(value: { [key: string]: JsonValue }): Member[] {
  return Object.keys(value)
    .sort()
    .map((key) => ({ key, value: value[key] ?? null }))
}

// A key is scheduled as a string value, so it is measured before it is spelled, as every string value is.
function schedule(pending: Pending[], open: string, members: readonly Member[], close: string, indent: string, depth: number): void {
  if (members.length === 0) {
    pending.push(`${open}${close}`)
    return
  }
  const colon = indent === '' ? ':' : ': '
  const inner = indent === '' ? '' : `\n${indent.repeat(depth + 1)}`
  const scheduled: Pending[] = []
  for (const [index, member] of members.entries()) {
    scheduled.push(`${index === 0 ? open : ','}${inner}`)
    if (member.key !== undefined) scheduled.push({ depth, value: member.key }, colon)
    scheduled.push({ depth: depth + 1, value: member.value })
  }
  scheduled.push(indent === '' ? close : `\n${indent.repeat(depth)}${close}`)
  for (const item of scheduled.reverse()) pending.push(item)
}

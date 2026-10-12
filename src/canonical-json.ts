import type { JsonValue } from './json-value.ts'

export type JsonSpelling = 'compact' | 'two-space'

type Member = { label: string; value: JsonValue }

type Pending = string | { depth: number; value: JsonValue }

export function serializeCanonicalJson(value: JsonValue, spelling: JsonSpelling): string {
  return [...canonicalJsonPieces(value, spelling)].join('')
}

// Stops at the first piece that does not match `text`: re-spelled with two-space indentation, a short compact text can pass the engine's longest string.
export function spellsCanonicalJson(value: JsonValue, spelling: JsonSpelling, text: string): boolean {
  let offset = 0
  for (const piece of canonicalJsonPieces(value, spelling)) {
    if (!text.startsWith(piece, offset)) return false
    offset += piece.length
  }
  return offset === text.length
}

export function* canonicalJsonPieces(value: JsonValue, spelling: JsonSpelling): Generator<string> {
  const indent = spelling === 'compact' ? '' : '  '
  const pending: Pending[] = [{ depth: 0, value }]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (typeof next === 'string') {
      yield next
      continue
    }
    const { depth, value: held } = next
    if (Array.isArray(held)) schedule(pending, '[', held.map((item) => ({ label: '', value: item })), ']', indent, depth)
    else if (held !== null && typeof held === 'object') schedule(pending, '{', objectMembers(held, indent), '}', indent, depth)
    else yield Object.is(held, -0) ? '-0' : JSON.stringify(held)
  }
}

function objectMembers(value: { [key: string]: JsonValue }, indent: string): Member[] {
  const separator = indent === '' ? ':' : ': '
  return Object.keys(value)
    .sort()
    .map((key) => ({ label: `${JSON.stringify(key)}${separator}`, value: value[key] ?? null }))
}

function schedule(pending: Pending[], open: string, members: readonly Member[], close: string, indent: string, depth: number): void {
  if (members.length === 0) {
    pending.push(`${open}${close}`)
    return
  }
  const inner = indent === '' ? '' : `\n${indent.repeat(depth + 1)}`
  const scheduled: Pending[] = []
  for (const [index, member] of members.entries()) scheduled.push(`${index === 0 ? open : ','}${inner}${member.label}`, { depth: depth + 1, value: member.value })
  scheduled.push(indent === '' ? close : `\n${indent.repeat(depth)}${close}`)
  for (const item of scheduled.reverse()) pending.push(item)
}

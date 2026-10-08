import type { JsonValue } from './json-value.ts'

type Frame = { entries: [string, JsonValue][]; key: string; kind: 'object' } | { items: JsonValue[]; kind: 'array' }

type Scanned<T> = { end: number; value: T } | undefined

const escapes = new Map([
  ['"', '"'],
  ['/', '/'],
  ['\\', '\\'],
  ['b', '\b'],
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
])
const hexDigits = /[0-9A-Fa-f]{4}/y
const literals = new Map<string, JsonValue>([
  ['false', false],
  ['null', null],
  ['true', true],
])
const numberSyntax = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[Ee][+-]?[0-9]+)?/y

// In place of JSON.parse: V8 reads an escaped key against keys earlier parses saw (https://issues.chromium.org/issues/521080746).
export function parseJsonText(text: string): { value: JsonValue } | undefined {
  const frames: Frame[] = []
  let index = skipWhitespace(text, 0)
  for (;;) {
    const opened = openValue(text, index, frames)
    if (opened === undefined) return undefined
    let { end, value } = opened
    if (value === undefined) {
      index = end
      continue
    }
    for (;;) {
      index = skipWhitespace(text, end)
      const frame = frames[frames.length - 1]
      if (frame === undefined) return index === text.length ? { value } : undefined
      if (frame.kind === 'array') frame.items.push(value)
      else frame.entries.push([frame.key, value])
      const separator = text.charAt(index)
      if (separator === ',') break
      if (separator !== (frame.kind === 'array' ? ']' : '}')) return undefined
      frames.pop()
      end = index + 1
      value = frame.kind === 'array' ? frame.items : Object.fromEntries(frame.entries)
    }
    const frame = frames[frames.length - 1]
    index = skipWhitespace(text, index + 1)
    if (frame?.kind === 'object') {
      const key = readKey(text, index)
      if (key === undefined) return undefined
      frame.key = key.value
      index = key.end
    }
  }
}

// A value whose `value` is undefined opened a container, and `end` is where its first member starts.
function openValue(text: string, index: number, frames: Frame[]): Scanned<JsonValue | undefined> {
  const opener = text.charAt(index)
  if (opener !== '[' && opener !== '{') return readScalar(text, index)
  const first = skipWhitespace(text, index + 1)
  if (text.charAt(first) === (opener === '[' ? ']' : '}')) return { end: first + 1, value: opener === '[' ? [] : {} }
  if (opener === '[') {
    frames.push({ items: [], kind: 'array' })
    return { end: first, value: undefined }
  }
  const key = readKey(text, first)
  if (key === undefined) return undefined
  frames.push({ entries: [], key: key.value, kind: 'object' })
  return { end: key.end, value: undefined }
}

function readKey(text: string, index: number): Scanned<string> {
  const key = readString(text, index)
  if (key === undefined) return undefined
  const colon = skipWhitespace(text, key.end)
  return text.charAt(colon) === ':' ? { end: skipWhitespace(text, colon + 1), value: key.value } : undefined
}

function readScalar(text: string, index: number): Scanned<JsonValue> {
  if (text.charAt(index) === '"') return readString(text, index)
  for (const [spelling, value] of literals) if (text.startsWith(spelling, index)) return { end: index + spelling.length, value }
  numberSyntax.lastIndex = index
  const number = numberSyntax.exec(text)?.[0]
  return number === undefined ? undefined : { end: index + number.length, value: Number(number) }
}

function readString(text: string, start: number): Scanned<string> {
  if (text.charAt(start) !== '"') return undefined
  const pieces: string[] = []
  let from = start + 1
  let index = from
  while (index < text.length) {
    const code = text.charCodeAt(index)
    if (code === 0x22) {
      pieces.push(text.slice(from, index))
      return { end: index + 1, value: pieces.join('') }
    }
    if (code < 0x20) return undefined
    if (code !== 0x5c) {
      index += 1
      continue
    }
    pieces.push(text.slice(from, index))
    const escape = text.charAt(index + 1)
    hexDigits.lastIndex = index + 2
    const decoded = escape === 'u' ? (hexDigits.test(text) ? String.fromCharCode(parseInt(text.slice(index + 2, index + 6), 16)) : undefined) : escapes.get(escape)
    if (decoded === undefined) return undefined
    pieces.push(decoded)
    index += escape === 'u' ? 6 : 2
    from = index
  }
  return undefined
}

function skipWhitespace(text: string, index: number): number {
  let end = index
  while (end < text.length && ' \t\n\r'.includes(text.charAt(end))) end += 1
  return end
}

import type { JsonValue } from './json-value.ts'

type Frame = { entries: [string, JsonValue][]; key: string; kind: 'object' } | { items: JsonValue[]; kind: 'array' }

type Item = { end: number; frame: Frame; kind: 'opened' } | { end: number; kind: 'value'; value: JsonValue } | { kind: 'refused' }

export type JsonReading = { refusal: JsonRefusal; value?: undefined } | { refusal?: undefined; value: JsonValue }

type JsonRefusal = 'non-finite' | 'syntax'

type Scanned<T> = { end: number; value: T } | undefined

type State = { expect: 'separator'; index: number; value: JsonValue } | { expect: 'value'; index: number }

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
const syntaxRefusal: Item = { kind: 'refused' }

// In place of JSON.parse: V8 can read an escaped key as another key it read before (https://issues.chromium.org/issues/521080746).
export function parseJsonText(text: string): JsonReading {
  const frames: Frame[] = []
  let overflowed = false
  let state: State = { expect: 'value', index: skipWhitespace(text, 0) }
  for (;;) {
    if (state.expect === 'value') {
      const item = readItem(text, state.index)
      if (item.kind === 'refused') return { refusal: 'syntax' }
      if (item.kind === 'opened') frames.push(item.frame)
      else if (typeof item.value === 'number' && !Number.isFinite(item.value)) overflowed = true
      state = item.kind === 'opened' ? { expect: 'value', index: item.end } : { expect: 'separator', index: skipWhitespace(text, item.end), value: item.value }
      continue
    }
    const index: number = state.index
    const value = state.value
    const frame = frames[frames.length - 1]
    if (frame === undefined) return index !== text.length ? { refusal: 'syntax' } : overflowed ? { refusal: 'non-finite' } : { value }
    if (frame.kind === 'array') frame.items.push(value)
    else frame.entries.push([frame.key, value])
    const separator = text.charAt(index)
    if (separator === (frame.kind === 'array' ? ']' : '}')) {
      frames.pop()
      state = { expect: 'separator', index: skipWhitespace(text, index + 1), value: frame.kind === 'array' ? frame.items : Object.fromEntries(frame.entries) }
      continue
    }
    if (separator !== ',') return { refusal: 'syntax' }
    state = { expect: 'value', index: skipWhitespace(text, index + 1) }
    if (frame.kind === 'array') continue
    const key = readKey(text, state.index)
    if (key === undefined) return { refusal: 'syntax' }
    frame.key = key.value
    state = { expect: 'value', index: key.end }
  }
}

function readItem(text: string, index: number): Item {
  const opener = text.charAt(index)
  if (opener !== '[' && opener !== '{') return readScalar(text, index)
  const first = skipWhitespace(text, index + 1)
  if (text.charAt(first) === (opener === '[' ? ']' : '}')) return { end: first + 1, kind: 'value', value: opener === '[' ? [] : {} }
  if (opener === '[') return { end: first, frame: { items: [], kind: 'array' }, kind: 'opened' }
  const key = readKey(text, first)
  return key === undefined ? syntaxRefusal : { end: key.end, frame: { entries: [], key: key.value, kind: 'object' }, kind: 'opened' }
}

function readKey(text: string, index: number): Scanned<string> {
  const key = readString(text, index)
  if (key === undefined) return undefined
  const colon = skipWhitespace(text, key.end)
  return text.charAt(colon) === ':' ? { end: skipWhitespace(text, colon + 1), value: key.value } : undefined
}

function readScalar(text: string, index: number): Item {
  if (text.charAt(index) === '"') {
    const string = readString(text, index)
    return string === undefined ? syntaxRefusal : { end: string.end, kind: 'value', value: string.value }
  }
  for (const [spelling, value] of literals) if (text.startsWith(spelling, index)) return { end: index + spelling.length, kind: 'value', value }
  numberSyntax.lastIndex = index
  const number = numberSyntax.exec(text)?.[0]
  return number === undefined ? syntaxRefusal : { end: index + number.length, kind: 'value', value: Number(number) }
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

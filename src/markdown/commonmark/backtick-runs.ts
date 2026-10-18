import { runLength } from './emphasis-matching.ts'

export type CodeSpanCloser = (from: number, opener: number) => number | undefined

export function backtickRun(text: string, index: number): number {
  return text.charAt(index) === '`' ? runLength(text, index) : 0
}

// Where the first run of exactly `opener` backticks at or after `from` begins, `from` never inside a run. Ask with
// `from` rising, so each length's cursor only moves forward and a walk stays linear; an earlier `from` rescans that length.
export function backtickCloser(text: string): CodeSpanCloser {
  const counts = new Map<number, number>()
  eachRun(text, (_, length) => counts.set(length, (counts.get(length) ?? 0) + 1))
  const firsts = new Map<number, number>()
  let total = 0
  for (const [length, count] of counts) {
    firsts.set(length, total)
    total += count
  }
  // Each length's starts in order, packed off the JS heap: a text near V8's longest string holds a run every two characters.
  const starts = new Int32Array(total)
  const ends = new Map(firsts)
  eachRun(text, (start, length) => {
    const at = ends.get(length) ?? 0
    starts[at] = start
    ends.set(length, at + 1)
  })
  const cursors = new Map<number, number>()
  return (from, opener) => {
    const first = firsts.get(opener) ?? 0
    const end = ends.get(opener) ?? 0
    let at = cursors.get(opener) ?? first
    if (at > first && (starts[at - 1] ?? -1) >= from) at = first
    while (at < end && (starts[at] ?? Infinity) < from) at += 1
    cursors.set(opener, at)
    return at < end ? starts[at] : undefined
  }
}

export function fencedCodeBlock(info: string, body: string): string {
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(body) + 1))
  return body === '' ? `${fence}${info}\n${fence}` : `${fence}${info}\n${body}\n${fence}`
}

export function longestBacktickRun(text: string): number {
  let longest = 0
  for (let start = text.indexOf('`'); start !== -1; ) {
    let end = start + 1
    while (text.charAt(end) === '`') end += 1
    longest = Math.max(longest, end - start)
    start = text.indexOf('`', end)
  }
  return longest
}

function eachRun(text: string, visit: (start: number, length: number) => void): void {
  for (let start = text.indexOf('`'); start !== -1; ) {
    const length = runLength(text, start)
    visit(start, length)
    start = text.indexOf('`', start + length)
  }
}

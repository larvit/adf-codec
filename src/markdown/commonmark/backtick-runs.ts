import { runLength } from './emphasis-matching.ts'

export function backtickRun(text: string, index: number): number {
  return text.charAt(index) === '`' ? runLength(text, index) : 0
}

// Where the first run of exactly `opener` backticks at or after `from` begins, `from` never inside a run. Ask with
// `from` rising, so each length's cursor only moves forward and a walk stays linear; an earlier `from` rescans that length.
export function backtickCloser(text: string): (from: number, opener: number) => number | undefined {
  const cursors = new Map<number, number>()
  const starts = new Map<number, number[]>()
  for (let start = text.indexOf('`'); start !== -1; ) {
    const length = runLength(text, start)
    const known = starts.get(length)
    if (known === undefined) starts.set(length, [start])
    else known.push(start)
    start = text.indexOf('`', start + length)
  }
  return (from, opener) => {
    const runs = starts.get(opener)
    if (runs === undefined) return undefined
    let at = cursors.get(opener) ?? 0
    if ((runs[at - 1] ?? -1) >= from) at = 0
    while ((runs[at] ?? Infinity) < from) at += 1
    cursors.set(opener, at)
    return runs[at]
  }
}

// Where the run of exactly `opener` backticks closing a code span begins, `undefined` where none does.
export function closingBacktickRun(text: string, from: number, opener: number): number | undefined {
  let cursor = from
  while (cursor < text.length) {
    const run = backtickRun(text, cursor)
    if (run === opener) return cursor
    cursor += run === 0 ? 1 : run
  }
  return undefined
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

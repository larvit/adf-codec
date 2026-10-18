import { runLength } from './emphasis-matching.ts'

export function backtickRun(text: string, index: number): number {
  return text.charAt(index) === '`' ? runLength(text, index) : 0
}

// As `closingBacktickRun`, for `from` past the end of an opener's run, with each run's start read once by its length.
// Readers ask with `from` rising, which keeps each length's cursor moving forward, so asking at every opener stays
// linear in the text; an ask behind the cursor restarts that length from its first run.
export function backtickCloser(text: string): (from: number, opener: number) => number | undefined {
  const asked = new Map<number, number>()
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
    let at = asked.get(opener) ?? 0
    if ((runs[at - 1] ?? -1) >= from) at = 0
    while ((runs[at] ?? Infinity) < from) at += 1
    asked.set(opener, at)
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

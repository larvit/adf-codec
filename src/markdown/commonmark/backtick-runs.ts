import { runLength } from './emphasis-matching.ts'

// Each run's start by its length, read once, so asking for a closer at every opener stays linear in the text.
export interface BacktickRuns {
  readonly asked: Map<number, number>
  readonly starts: ReadonlyMap<number, readonly number[]>
}

export function backtickRun(text: string, index: number): number {
  return text.charAt(index) === '`' ? runLength(text, index) : 0
}

export function backtickRuns(text: string): BacktickRuns {
  const starts = new Map<number, number[]>()
  for (let start = text.indexOf('`'); start !== -1; ) {
    const length = runLength(text, start)
    const known = starts.get(length)
    if (known === undefined) starts.set(length, [start])
    else known.push(start)
    start = text.indexOf('`', start + length)
  }
  return { asked: new Map(), starts }
}

// As `closingBacktickRun`, for `from` past the end of an opener's run. Readers ask with `from` rising, which keeps
// each length's cursor moving forward; an ask behind the cursor restarts that length from its first run.
export function closingRun(runs: BacktickRuns, from: number, opener: number): number | undefined {
  const starts = runs.starts.get(opener)
  if (starts === undefined) return undefined
  let at = runs.asked.get(opener) ?? 0
  if ((starts[at - 1] ?? -1) >= from) at = 0
  while ((starts[at] ?? Infinity) < from) at += 1
  runs.asked.set(opener, at)
  return starts[at]
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

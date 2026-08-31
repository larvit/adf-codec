import { runLength } from './emphasis-matching.ts'

export function backtickRun(text: string, index: number): number {
  return text.charAt(index) === '`' ? runLength(text, index) : 0
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
  let current = 0
  for (const character of text) {
    current = character === '`' ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

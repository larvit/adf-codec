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

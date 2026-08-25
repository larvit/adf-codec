export function longestBacktickRun(text: string): number {
  let longest = 0
  let current = 0
  for (const character of text) {
    current = character === '`' ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return longest
}

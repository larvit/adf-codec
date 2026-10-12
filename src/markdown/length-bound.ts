import { failure, success, type Result } from '../result.ts'

// V8's longest string (docs/decisions.md §Markdown past V8's longest string is refused on every engine).
export const longestMarkdown = 2 ** 29 - 24

// Measured on Firefox 155, Node 24 and Bun 1.4. SpiderMonkey's overflow and V8's string overflow both mean a string past longestMarkdown; the other two name an engine's own limit, and JavaScriptCore's also a heap running short.
const pastLongestString = ['InternalError: allocation size overflow', 'RangeError: Invalid string length']
const pastEngineLimit = ['RangeError: Invalid array length', 'RangeError: Out of memory']

export function tooLong<T>(): Result<T> {
  return failure('unsupported-node-shape', `the markdown for this document, or for a directive's plain CommonMark, would be longer than ${longestMarkdown} characters, the longest this library writes`, [])
}

export function withinLongest(text: string): Result<string> {
  return text.length > longestMarkdown ? tooLong() : success(text)
}

export function joinedWithin(pieces: Iterable<string>): Result<string> {
  const kept: string[] = []
  let length = 0
  for (const piece of pieces) {
    length += piece.length
    if (length > longestMarkdown) return tooLong()
    kept.push(piece)
  }
  return success(kept.join(''))
}

// Any concatenation can pass an engine's longest string or array; wrap every call that builds one.
export function withinEngineLimits<T>(convert: () => Result<T>): Result<T> {
  try {
    return convert()
  } catch (error) {
    if (!(error instanceof Error)) throw error
    const thrown = `${error.name}: ${error.message}`
    if (pastLongestString.includes(thrown)) return tooLong()
    // A stack overflow is a bug (docs/decisions.md §Nothing recurses unbounded), so it stays a throw.
    if (!pastEngineLimit.includes(thrown)) throw error
    return failure('unsupported-node-shape', `the conversion passed this JavaScript engine's longest string or array, or its heap (${error.message})`, [])
  }
}

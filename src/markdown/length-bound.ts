import { failure, type Result } from '../result.ts'

// V8's longest string, held on every engine so a document converts alike everywhere (docs/decisions.md §Markdown past V8's longest string is refused on every engine).
export const longestMarkdown = 2 ** 29 - 24

// Measured on Firefox 155, Node 24 and Bun 1.4. The first two say a string passed longestMarkdown, so they refuse as tooLong; the others name the engine's own limit.
const pastLongestString = ['InternalError: allocation size overflow', 'RangeError: Invalid string length']
const pastEngineLimit = ['RangeError: Invalid array length', 'RangeError: Out of memory']

export function tooLong<T>(): Result<T> {
  return failure('unsupported-node-shape', `spelled as markdown, this would be longer than ${longestMarkdown} characters, the longest string V8 holds`, [])
}

// The pieces joined, or `undefined` once their length passes longestMarkdown, so nothing past it is built.
export function joinedWithin(pieces: Iterable<string>): string | undefined {
  const kept: string[] = []
  let length = 0
  for (const piece of pieces) {
    length += piece.length
    if (length > longestMarkdown) return undefined
    kept.push(piece)
  }
  return kept.join('')
}

// The refusal where a bounded builder stopped, else what `next` makes of what it built.
export function boundedThen<T, U>(built: T | undefined, next: (built: T) => Result<U>): Result<U> {
  return built === undefined ? tooLong() : next(built)
}

export function* separatedBy(separator: string, parts: Iterable<Iterable<string>>): Generator<string> {
  let first = true
  for (const part of parts) {
    if (!first) yield separator
    first = false
    yield* part
  }
}

// A builder this module does not bound can still pass an engine's longest string or array, so this wraps a whole conversion.
export function withinEngineLimits<T>(convert: () => Result<T>): Result<T> {
  try {
    return convert()
  } catch (error) {
    // A stack overflow is a bug (docs/decisions.md §Nothing recurses unbounded), so it stays a throw.
    if (!(error instanceof Error)) throw error
    const thrown = `${error.name}: ${error.message}`
    if (pastLongestString.includes(thrown)) return tooLong()
    if (!pastEngineLimit.includes(thrown)) throw error
    return failure('unsupported-node-shape', `the output would be longer than the longest string or array this JavaScript engine builds (${error.message})`, [])
  }
}

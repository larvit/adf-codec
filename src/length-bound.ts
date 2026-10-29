import { failure, success, type Result } from './result.ts'

// V8's longest string, refused on every engine so a document converts alike everywhere (docs/decisions.md §Output past V8's longest string is refused on every engine).
export const longestOutput = 2 ** 29 - 24

// Measured on Firefox 155, Node 24 and Bun 1.4; SpiderMonkey's `invalid array length` is taken from its js.msg. SpiderMonkey's overflow and V8's string overflow both mean a string past longestOutput; the others name an engine's own limit or its memory running short.
const pastLongestString = ['InternalError: allocation size overflow', 'RangeError: Invalid string length']
const pastEngineLimit = [
  'RangeError: Array buffer allocation failed',
  'RangeError: Invalid array length',
  'RangeError: Map maximum size exceeded',
  'RangeError: Out of memory',
  'RangeError: Set maximum size exceeded',
  'RangeError: invalid array length',
]

export function tooLong<T>(): Result<T> {
  return failure('unsupported-node-shape', `this conversion would build text longer than ${longestOutput} characters, the longest this library writes`, [])
}

export function withinLongest<T>(length: number, value: T): Result<T> {
  return length > longestOutput ? tooLong() : success(value)
}

export function joinedWithin(pieces: Iterable<string>): Result<string> {
  const kept: string[] = []
  let length = 0
  for (const piece of pieces) {
    length += piece.length
    if (length > longestOutput) return tooLong()
    kept.push(piece)
  }
  return success(kept.join(''))
}

// Any concatenation can pass an engine's longest string or array; wrap every call that builds one.
export function withinEngineLimits<T>(convert: () => Result<T>): Result<T> {
  try {
    return convert()
  } catch (error) {
    // SpiderMonkey throws a bare string where it finds no memory for a buffer (measured on Firefox 155).
    if (error === 'out of memory') return engineLimit(error)
    if (!(error instanceof Error)) throw error
    const thrown = `${error.name}: ${error.message}`
    if (pastLongestString.includes(thrown)) return tooLong()
    // A stack overflow is a bug (docs/decisions.md §Nothing recurses unbounded), so it stays a throw.
    if (!pastEngineLimit.includes(thrown)) throw error
    return engineLimit(error.message)
  }
}

function engineLimit<T>(thrown: string): Result<T> {
  return failure('engine-limit', `the conversion passed a limit of this JavaScript engine on a string, array, Map or Set, or ran it out of memory (${thrown})`, [])
}

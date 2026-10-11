import { failure, type ConvertErrorPath, type Result } from './result.ts'

// V8's longest string, held on every engine so a document converts alike everywhere (docs/decisions.md §Markdown past V8's longest string is refused on every engine).
export const longestOutput = 2 ** 29 - 24

export function tooLong<T>(path: ConvertErrorPath): Result<T> {
  return failure('unsupported-node-shape', `the markdown would be longer than ${longestOutput} characters, the longest string V8 holds`, path)
}

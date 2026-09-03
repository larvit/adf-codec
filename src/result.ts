export type ConvertErrorCode =
  | 'malformed-directive'
  | 'malformed-pipe-table'
  | 'not-an-adf-document'
  | 'unknown-directive-name'
  | 'unmappable-html'
  | 'unmappable-image'
  | 'unspellable-adjacent-lists'
  | 'unspellable-character'
  | 'unspellable-line-start'
  | 'unspellable-link-destination'
  | 'unspellable-link-title'
  | 'unspellable-whitespace'
  | 'unsupported-document-version'
  | 'unsupported-nesting-depth'
  | 'unsupported-node-shape'

export type ConvertErrorPath = readonly (number | string)[]

export type SourcePosition = { line: number; offset: number }

export type ConvertError = {
  code: ConvertErrorCode
  message: string
  path: ConvertErrorPath
  position?: SourcePosition
}

export type ConvertFault = Omit<ConvertError, 'path' | 'position'>

export type Result<T> = { error: ConvertError; ok: false } | { ok: true; value: T }

export function failure<T>(code: ConvertErrorCode, message: string, path: ConvertErrorPath): Result<T> {
  return { error: { code, message, path }, ok: false }
}

export function faulted<T>(fault: ConvertFault, path: ConvertErrorPath): Result<T> {
  return failure(fault.code, fault.message, path)
}

export function positioned<T>(result: Result<T>, position: SourcePosition): Result<T> {
  if (result.ok || result.error.position !== undefined) return result
  return { error: { ...result.error, position }, ok: false }
}

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

export type ConvertErrorCode =
  | 'malformed-directive'
  | 'malformed-pipe-table'
  | 'not-a-string'
  | 'not-an-adf-document'
  | 'unknown-directive-name'
  | 'unmappable-html'
  | 'unspellable-whitespace'
  | 'unsupported-document-version'
  | 'unsupported-nesting-depth'
  | 'unsupported-node-shape'

export type ConvertErrorPath = readonly (number | string)[]

export type SourcePosition = { line: number; offset: number }

export type ConvertFault = {
  code: ConvertErrorCode
  message: string
}

export type ConvertError = ConvertFault & { path: ConvertErrorPath; position?: SourcePosition }

export type ParseError = ConvertError & { position: SourcePosition }

export type Result<T, E extends ConvertError = ConvertError> = { error: E; ok: false } | { ok: true; value: T }

export function failure<T>(code: ConvertErrorCode, message: string, path: ConvertErrorPath): Result<T> {
  return { error: { code, message, path }, ok: false }
}

export function faulted<T>(fault: ConvertFault, path: ConvertErrorPath): Result<T> {
  return failure(fault.code, fault.message, path)
}

export function positioned<T>(result: Result<T>, position: SourcePosition): Result<T, ParseError> {
  if (result.ok) return result
  return { error: { ...result.error, position: result.error.position ?? position }, ok: false }
}

export function success<T>(value: T): { ok: true; value: T } {
  return { ok: true, value }
}

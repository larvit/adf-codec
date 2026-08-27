export type ConvertErrorCode =
  | 'not-an-adf-document'
  | 'unspellable-adjacent-lists'
  | 'unspellable-character'
  | 'unspellable-line-start'
  | 'unspellable-link-destination'
  | 'unspellable-link-title'
  | 'unspellable-whitespace'
  | 'unspelled-block-separation'
  | 'unspelled-node-attribute'
  | 'unsupported-document-version'
  | 'unsupported-node-shape'

export type ConvertErrorPath = readonly (number | string)[]

export type ConvertError = {
  code: ConvertErrorCode
  message: string
  path: ConvertErrorPath
}

export type Result<T> = { error: ConvertError; ok: false } | { ok: true; value: T }

export function failure<T>(code: ConvertErrorCode, message: string, path: ConvertErrorPath): Result<T> {
  return { error: { code, message, path }, ok: false }
}

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

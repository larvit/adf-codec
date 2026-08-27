export type ConvertErrorCode =
  | 'ambiguous-attribute-spelling'
  | 'not-an-adf-document'
  | 'unspellable-adjacent-lists'
  | 'unspellable-character'
  | 'unspellable-code-block-language'
  | 'unspellable-line-start'
  | 'unspellable-link-destination'
  | 'unspellable-link-title'
  | 'unspellable-list-marker'
  | 'unspellable-whitespace'
  | 'unspelled-block-marks'
  | 'unspelled-block-separation'
  | 'unspelled-node-attribute'
  | 'unsupported-document-version'
  | 'unsupported-heading-level'
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

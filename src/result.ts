export type ConvertErrorCode =
  | 'ambiguous-empty-code-block-language'
  | 'ambiguous-ordered-list-start'
  | 'not-an-adf-document'
  | 'reserved-adf-language'
  | 'unspellable-adjacent-lists'
  | 'unspellable-code-block-language'
  | 'unspellable-line-start'
  | 'unspellable-link-destination'
  | 'unspellable-link-title'
  | 'unspellable-list-marker'
  | 'unspellable-mark'
  | 'unspellable-whitespace'
  | 'unspelled-block-marks'
  | 'unspelled-node-attribute'
  | 'unsupported-document-version'
  | 'unsupported-heading-level'
  | 'unsupported-node-shape'
  | 'unsupported-node-type'

export type ConvertError = {
  code: ConvertErrorCode
  message: string
}

export type Result<T> = { error: ConvertError; ok: false } | { ok: true; value: T }

export function failure<T>(code: ConvertErrorCode, message: string): Result<T> {
  return { error: { code, message }, ok: false }
}

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

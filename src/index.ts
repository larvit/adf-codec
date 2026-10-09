// Export only the conversions, their types, isAdfDocument and what a guarantee or a persona needs.
export type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from './adf/document.ts'
export type { ConvertError, ConvertErrorCode, ConvertErrorPath, ParseError, Result, SourcePosition } from './result.ts'
export type { JsonValue } from './json-value.ts'
export { adfToLosslessMarkdown } from './markdown/emit/adf-to-markdown.ts'
export { adfToPortableMarkdown } from './markdown/portable/adf-to-portable-markdown.ts'
export { commonMarkToAdf, losslessMarkdownToAdf, portableMarkdownToAdf } from './markdown/parse/markdown-to-adf.ts'
export { isAdfDocument } from './adf/document.ts'

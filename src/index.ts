// Export only the conversions, their types, isAdfDocument and what checking a README guarantee needs.
export type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from './adf/document.ts'
export type { ConvertError, ConvertErrorCode, ConvertErrorPath, ParseError, Result, SourcePosition } from './result.ts'
export type { JsonValue } from './json-value.ts'
export { adfToMarkdown } from './markdown/emit/adf-to-markdown.ts'
export { adfToPlainMarkdown } from './markdown/emit/plain-reduction.ts'
export { isAdfDocument } from './adf/document.ts'
export { markdownToAdf, plainMarkdownToAdf } from './markdown/parse/markdown-to-adf.ts'

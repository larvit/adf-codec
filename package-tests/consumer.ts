import { adfToLosslessMarkdown, adfToPortableMarkdown, commonMarkToAdf, isAdfDocument, losslessMarkdownToAdf, portableMarkdownToAdf, type AdfDocument, type ConvertErrorCode, type ParseError, type Result } from '@larvit/adf-codec'

const document: AdfDocument = { content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }

const emitted: Result<string> = adfToLosslessMarkdown(document)
const parsed: Result<AdfDocument, ParseError> = losslessMarkdownToAdf('x\n')
const portableEmitted: Result<string> = adfToPortableMarkdown(document)
const portableParsed: Result<AdfDocument, ParseError> = portableMarkdownToAdf('x\n')
const commonMarkParsed: Result<AdfDocument, ParseError> = commonMarkToAdf('x\n')
const guarded: boolean = isAdfDocument(document)
const code: ConvertErrorCode | undefined = emitted.ok ? undefined : emitted.error.code
const line: number | undefined = parsed.ok ? undefined : parsed.error.position.line

export const surface = { code, commonMarkParsed, guarded, line, portableEmitted, portableParsed }

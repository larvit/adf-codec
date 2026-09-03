import { adfToMarkdown, isAdfDocument, markdownToAdf, type AdfDocument, type ConvertErrorCode, type ParseError, type Result } from '@larvit/adf-codec'

const document: AdfDocument = { content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }

const emitted: Result<string> = adfToMarkdown(document)
const parsed: Result<AdfDocument, ParseError> = markdownToAdf('x\n')
const guarded: boolean = isAdfDocument(document)
const code: ConvertErrorCode | undefined = emitted.ok ? undefined : emitted.error.code
const line: number | undefined = parsed.ok ? undefined : parsed.error.position.line

export const surface = { code, guarded, line }

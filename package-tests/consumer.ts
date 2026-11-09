import { adfToHtml, adfToLosslessMarkdown, adfToPortableMarkdown, commonMarkToAdf, htmlToAdf, losslessMarkdownToAdf, portableMarkdownToAdf, readAdfDocument, type AdfDocument, type ConvertErrorCode, type ParseError, type Result } from '@larvit/adf-codec'

const document: AdfDocument = { content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }

const emitted: Result<string> = adfToLosslessMarkdown(document)
const htmlEmitted: Result<string> = adfToHtml(document)
const parsed: Result<AdfDocument, ParseError> = losslessMarkdownToAdf('x\n')
const portableEmitted: Result<string> = adfToPortableMarkdown(document)
const portableParsed: Result<AdfDocument, ParseError> = portableMarkdownToAdf('x\n')
const commonMarkParsed: Result<AdfDocument, ParseError> = commonMarkToAdf('x\n')
const read: Result<AdfDocument> = readAdfDocument(document)
const htmlParsed: Result<AdfDocument, ParseError> = htmlToAdf('<p>x</p>\n')
const code: ConvertErrorCode | undefined = emitted.ok ? undefined : emitted.error.code
const line: number | undefined = parsed.ok ? undefined : parsed.error.position.line

export const surface = { code, commonMarkParsed, htmlEmitted, htmlParsed, line, portableEmitted, portableParsed, read }

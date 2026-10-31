import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorCode, ConvertErrorPath, ParseError, Result, SourcePosition } from '../../result.ts'
import { misspelledAt, unescapedValue } from '../escaping.ts'

// A node's place among its parent's content, the document's own content where `parent` is undefined; a path is built only for a refusal.
export type Place = { index: number; parent: Place | undefined }

export type ReadNode = Result<{ end: number; node: AdfNode }, ParseError>

// A start tag as `adfToHtml` or a browser writes it, its attributes' values unescaped.
export type StartTag = { attributes: (readonly [string, string])[]; end: number; name: string; start: number }

// A tag whose name reads, its attributes or its `>` not: `stopped` is where reading them stopped.
type CutTag = { name: string; stopped: number }

const attribute = / ([a-z][a-z0-9-]*)="([^"]*)"/y
const invisible = /(?! )[\p{Cf}\p{Z}\u007f-\u009f]/gu
const tagName = /<([a-z][a-z0-9]*)/y

// `undefined` where no start tag stands at `index`, or one of its values is not escaped as the dialect escapes it.
export function readStartTag(html: string, index: number): StartTag | undefined {
  const tag = scanStartTag(html, index)
  return tag !== undefined && 'end' in tag ? tag : undefined
}

// The name of the start tag at `index`, read whatever its attributes hold.
export function startTagName(html: string, index: number): string | undefined {
  tagName.lastIndex = index
  return tagName.exec(html)?.[1]
}

// Why reading stopped at `index` short of `expected`, and where: a tag the caller takes none of is `unexpected`.
export function misread(html: string, index: number, expected: string, unexpected: string): { at: number; message: string } {
  const tag = scanStartTag(html, index)
  if (tag === undefined) return { at: index, message: `${expected}: ${foundAt(html, index)}` }
  if ('end' in tag) return { at: index, message: `<${tag.name}> as written here is ${unexpected}: ${foundAt(html, index)}` }
  return { at: tag.stopped, message: `<${tag.name}> holds its attributes as name="value", each value escaping & as &amp; and " as &quot;, then >: ${foundAt(html, tag.stopped)}` }
}

// What stands at `index`, for a refusal's message, a character no one sees spelled as its escape.
export function foundAt(html: string, index: number): string {
  if (index >= html.length) return 'found the end of the HTML'
  const found = html.slice(index, index + 24)
  const spelled = JSON.stringify(found).replace(invisible, (character) => Array.from({ length: character.length }, (_, unit) => `\\u${character.charCodeAt(unit).toString(16).padStart(4, '0')}`).join(''))
  return `found ${spelled}${index + found.length < html.length ? '…' : ''}`
}

// The position of the start of `line` in `html` as handed in, for a line counted after each `\r\n` became a line feed.
export function positionIn(html: string, { line }: SourcePosition): SourcePosition {
  let offset = 0
  for (let passed = 1; passed < line; passed += 1) offset = html.indexOf('\n', offset) + 1
  return { line, offset }
}

// At the start of the line `index` stands on.
export function refused<T>(code: ConvertErrorCode, message: string, html: string, index: number, place: Place | undefined): Result<T, ParseError> {
  return { error: { code, message, path: pathOf(place), position: lineStart(html, index) }, ok: false }
}

// One attribute a match, since a pattern repeating over them all overflows V8's regular expression stack on a long tag.
function scanStartTag(html: string, index: number): CutTag | StartTag | undefined {
  const name = startTagName(html, index)
  if (name === undefined) return undefined
  const attributes: (readonly [string, string])[] = []
  let at = index + 1 + name.length
  for (;;) {
    attribute.lastIndex = at
    const match = attribute.exec(html)
    if (match === null) return html.startsWith('>', at) ? { attributes, end: at + 1, name, start: index } : { name, stopped: at }
    const [whole, key = '', spelled = ''] = match
    const value = unescapedValue(spelled, 'attribute')
    if (value === undefined) return { name, stopped: at + whole.length - 1 - spelled.length + misspelledAt(spelled, 'attribute') }
    attributes.push([key, value])
    at += whole.length
  }
}

// Only a line feed ends a line: readHtml has made each \r\n one, and a lone carriage return is refused.
function lineStart(html: string, index: number): SourcePosition {
  let line = 1
  let offset = 0
  for (let next = html.indexOf('\n'); next >= 0 && next < index; next = html.indexOf('\n', next + 1)) {
    line += 1
    offset = next + 1
  }
  return { line, offset }
}

function pathOf(place: Place | undefined): ConvertErrorPath {
  const steps: (number | string)[] = []
  for (let at = place; at !== undefined; at = at.parent) steps.push(at.index, 'content')
  return steps.reverse()
}

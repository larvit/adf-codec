import type { ConvertErrorCode, ConvertErrorPath, ParseError, Result, SourcePosition } from '../../result.ts'
import { unescapedValue } from '../escaping.ts'

// A node's place among its parent's content, the document's own content where `parent` is undefined; a path is built only for a refusal.
export type Place = { index: number; parent: Place | undefined }

// A start tag as `adfToHtml` writes it, its attributes' values unescaped.
export type StartTag = { attributes: (readonly [string, string])[]; end: number; name: string; start: number }

const attribute = / ([a-z][a-z0-9-]*)="([^"]*)"/g
const lineEnding = /\r\n?|\n/g
const startTag = /<([a-z][a-z0-9]*)((?: [a-z][a-z0-9-]*="[^"]*")*)>/y

// `undefined` where no start tag stands at `index`, or one of its values is not escaped as the dialect escapes it.
export function readStartTag(html: string, index: number): StartTag | undefined {
  startTag.lastIndex = index
  const match = startTag.exec(html)
  if (match === null) return undefined
  const attributes: (readonly [string, string])[] = []
  for (const [, name = '', spelled = ''] of (match[2] ?? '').matchAll(attribute)) {
    const value = unescapedValue(spelled)
    if (value === undefined) return undefined
    attributes.push([name, value])
  }
  return { attributes, end: index + match[0].length, name: match[1] ?? '', start: index }
}

// What stands at `index`, for a refusal's message.
export function foundAt(html: string, index: number): string {
  if (index >= html.length) return 'found the end of the HTML'
  const found = html.slice(index, index + 24)
  return `found ${JSON.stringify(found)}${index + found.length < html.length ? '…' : ''}`
}

// At the start of the line `index` stands on.
export function refused<T>(code: ConvertErrorCode, message: string, html: string, index: number, place: Place | undefined): Result<T, ParseError> {
  return { error: { code, message, path: pathOf(place), position: lineStart(html, index) }, ok: false }
}

// A line ends at a line feed, a carriage return or both, as an HTML parser reads it.
function lineStart(html: string, index: number): SourcePosition {
  let line = 1
  let offset = 0
  for (const ending of html.slice(0, index).matchAll(lineEnding)) {
    line += 1
    offset = ending.index + ending[0].length
  }
  return { line, offset }
}

function pathOf(place: Place | undefined): ConvertErrorPath {
  const steps: (number | string)[] = []
  for (let at = place; at !== undefined; at = at.parent) steps.push(at.index, 'content')
  return steps.reverse()
}

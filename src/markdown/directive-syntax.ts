import type { AttributeKind, VocabularyPair, VocabularyValue } from '../adf/attribute-vocabulary.ts'
import type { ConvertFault } from '../result.ts'
import type { JsonValue } from '../json-value.ts'
import { backslashEscape, claimsDirectiveLine } from './commonmark-grammar.ts'
import { backtickRun, closingBacktickRun } from './backtick-runs.ts'
import { isJsonValue, overNested } from '../json-value.ts'
import { largestNesting } from '../nesting.ts'
import { runLength } from './emphasis-matching.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export type AttributeReading = { refusal: 'kind' | 'nesting'; value?: undefined } | { refusal?: undefined; value: VocabularyValue }

export type DirectiveValue = { decoded: string; spelling: string }

export type DirectiveAttributes = ReadonlyMap<string, DirectiveValue>

export type DirectiveLine =
  | { argument: string | undefined; attributes: DirectiveAttributes; colons: number; kind: 'header'; name: string }
  | { colons: number; kind: 'closing' }

export type DirectiveSpan = { attributes: DirectiveAttributes; content: string | undefined; length: number; name: string }

export type Read<T> = { fault: ConvertFault; value?: undefined } | { fault?: undefined; value: T }

type Attributes = { attributes: DirectiveAttributes; length: number }

type AttributePair = { end: number; key: string; value: DirectiveValue }

const bareTokenSource = '[A-Za-z0-9_-]+'
const bareRun = new RegExp(bareTokenSource, 'y')
const bareToken = new RegExp(`^${bareTokenSource}$`)
const directiveName = /[a-z][A-Za-z0-9]*/y
const inlineDirectiveOpener = /:[a-z][A-Za-z0-9]*[[{]/y
const lineEnd = /^[ \t]*$/
// spec/flavour.md, Attributes.
const reservedSource = '[&<`|]'
const quotedEscapes = new RegExp(reservedSource, 'g')
const rawReserved = new RegExp(reservedSource)
const noAttributes: DirectiveAttributes = new Map()

export const directiveLineEscape = '\\::: keeps the line literal text'
export const inlineDirectiveEscape = '\\: keeps the colon literal'

const emptyFault = 'an empty {attrs} is omitted unless the { itself claims the directive: this one spells {}'
const nameFault = `a directive name reads [a-z][A-Za-z0-9]*: this one does not; ${directiveLineEscape}`
const orderFault = 'the {attrs} keys read in alphabetical order'
const pairFault = 'an attribute reads key=value, the value bare or double-quoted: this one does not'
const shapeFault = `a directive line reads a name, one bare argument and {attrs}, one space apart: this one does not; ${directiveLineEscape}`

export function attributeValue(text: string, kind: AttributeKind): AttributeReading {
  if (kind === 'string') return { value: { kind, value: text } }
  if (kind === 'boolean') return text === 'true' || text === 'false' ? { value: { kind, value: text === 'true' } } : { refusal: 'kind' }
  const parsed = parseJson(text)
  if (parsed === undefined) return { refusal: 'kind' }
  if (kind === 'number') return typeof parsed === 'number' ? { value: { kind, value: parsed } } : { refusal: 'kind' }
  return overNested(parsed) ? { refusal: 'nesting' } : { value: { kind, value: parsed } }
}

export function holdsInlineDirectiveOpener(text: string): boolean {
  for (let index = text.indexOf(':'); index !== -1; index = text.indexOf(':', index + 1)) if (opensInlineDirective(text, index)) return true
  return false
}

export function isBareToken(text: string): boolean {
  return bareToken.test(text)
}

export function malformedDirective(message: string): ConvertFault {
  return { code: 'malformed-directive', message }
}

export function opensInlineDirective(text: string, index: number): boolean {
  return inlineDirectiveName(text, index) !== undefined
}

export function readDirectiveLine(line: string): Read<DirectiveLine> | undefined {
  if (!claimsDirectiveLine(line)) return undefined
  const colons = runLength(line, 0)
  const rest = line.slice(colons)
  if (lineEnd.test(rest)) return { value: { colons, kind: 'closing' } }
  const header = readDirectiveHeader(rest)
  if (header.fault !== undefined) return { fault: header.fault }
  return { value: { argument: header.value.argument, attributes: header.value.attributes, colons, kind: 'header', name: header.value.name } }
}

export function readInlineDirective(text: string, index: number): Read<DirectiveSpan> | undefined {
  return readNestedDirective(text, index, 1)
}

export function readSoleStringAttribute(span: DirectiveSpan, key: string): Read<string> {
  if (span.content !== undefined) return { fault: unsupportedNodeShape(`${span.name} takes no content: this one holds some`) }
  const spelled = span.attributes.get(key)
  if (spelled === undefined || span.attributes.size !== 1) return { fault: unsupportedNodeShape(`${span.name} holds one ${key} attribute alone: this one does not`) }
  const spelling = spellStringAttribute(spelled.decoded)
  if (spelling !== spelled.spelling) return { fault: unsupportedNodeShape(`${span.name} spells its ${key} attribute as ${key}=${spelling}`) }
  return { value: spelled.decoded }
}

// Both directions answer alike: an inline directive never spans lines, so no content slot holds a line ending.
export function slotLineEndingFault(type: string, text: string): ConvertFault | undefined {
  if (!/[\n\r]/.test(text)) return undefined
  return { code: 'unspellable-whitespace', message: `the ${type} content slot holds a newline no inline directive spans` }
}

export function spellAttributes(pairs: readonly (readonly [string, string])[]): string {
  if (pairs.length === 0) return ''
  const spelled = [...pairs].sort(([left], [right]) => keyOrder(left, right)).map(([key, value]) => `${key}=${value}`)
  return `{${spelled.join(' ')}}`
}

export function spellJsonAttribute(value: JsonValue): string {
  return quote(serializeCanonicalJson(value, 'compact'))
}

export function spellLeafDirective(name: string, attributes: string): string {
  return `:${name}${attributes === '' ? '{}' : attributes}`
}

export function spellStringAttribute(text: string): string {
  return isBareToken(text) ? text : quote(text)
}

export function spellAttributeValue(value: VocabularyValue): string {
  if (value.kind === 'boolean') return `${value.value}`
  if (value.kind === 'json') return spellJsonAttribute(value.value)
  if (value.kind === 'number') return spellStringAttribute(JSON.stringify(value.value))
  return spellStringAttribute(value.value)
}

export function spellVocabulary(pairs: readonly VocabularyPair[]): [string, string][] {
  return pairs.map((pair): [string, string] => [pair.key, spellAttributeValue(pair)])
}

export function unknownDirectiveFault(name: string, escape: string): ConvertFault {
  return { code: 'unknown-directive-name', message: `the directive name ${name} reads back to no node; ${escape}` }
}

export function unsupportedNodeShape(message: string): ConvertFault {
  return { code: 'unsupported-node-shape', message }
}

function attributePairFault(escape: string): ConvertFault {
  return malformedDirective(`${pairFault}; ${escape}`)
}

function keyOrder(left: string, right: string): number {
  if (left < right) return -1
  return left > right ? 1 : 0
}

function quote(text: string): string {
  return JSON.stringify(text).replace(quotedEscapes, (character) => `\\u${escapeDigits(character)}`)
}

function escapeDigits(character: string): string {
  return character.charCodeAt(0).toString(16).padStart(4, '0')
}

function inlineDirectiveName(text: string, index: number): string | undefined {
  inlineDirectiveOpener.lastIndex = index
  const opened = inlineDirectiveOpener.exec(text)?.[0]
  return opened === undefined ? undefined : opened.slice(1, -1)
}

function readDirectiveHeader(rest: string): Read<{ argument: string | undefined; attributes: DirectiveAttributes; name: string }> {
  directiveName.lastIndex = 0
  const name = directiveName.exec(rest)?.[0]
  if (name === undefined) return { fault: malformedDirective(nameFault) }
  let cursor = name.length
  let argument: string | undefined
  let attributes = noAttributes
  if (rest.charAt(cursor) === ' ' && rest.charAt(cursor + 1) !== '{' && !lineEnd.test(rest.slice(cursor))) {
    bareRun.lastIndex = cursor + 1
    argument = bareRun.exec(rest)?.[0]
    if (argument === undefined) return { fault: malformedDirective(shapeFault) }
    cursor += 1 + argument.length
  }
  if (rest.charAt(cursor) === ' ' && rest.charAt(cursor + 1) === '{') {
    const read = readAttributes(rest, cursor + 1, directiveLineEscape)
    if (read.fault !== undefined) return { fault: read.fault }
    if (read.value.attributes.size === 0) return { fault: malformedDirective(emptyFault) }
    attributes = read.value.attributes
    cursor += 1 + read.value.length
  }
  if (!lineEnd.test(rest.slice(cursor))) return { fault: malformedDirective(shapeFault) }
  return { value: { argument, attributes, name } }
}

function readNestedDirective(text: string, index: number, depth: number): Read<DirectiveSpan> | undefined {
  const name = inlineDirectiveName(text, index)
  if (name === undefined) return undefined
  if (depth > largestNesting) {
    return { fault: { code: 'unsupported-nesting-depth', message: `the input nests inline directives deeper than the ${largestNesting} levels the parser carries` } }
  }
  let cursor = index + 1 + name.length
  let content: string | undefined
  if (text.charAt(cursor) === '[') {
    const end = readDirectiveContent(text, cursor + 1, depth)
    if (end.fault !== undefined) return { fault: end.fault }
    content = text.slice(cursor + 1, end.value)
    cursor = end.value + 1
  }
  let attributes = noAttributes
  if (text.charAt(cursor) === '{') {
    const read = readAttributes(text, cursor, inlineDirectiveEscape)
    if (read.fault !== undefined) return { fault: read.fault }
    if (read.value.attributes.size === 0 && content !== undefined) return { fault: malformedDirective(emptyFault) }
    attributes = read.value.attributes
    cursor += read.value.length
  }
  return { value: { attributes, content, length: cursor - index, name } }
}

// A code span, an escape and a nested directive each bind before the content's own closing bracket.
function readDirectiveContent(text: string, start: number, depth: number): Read<number> {
  let brackets = 0
  let cursor = start
  while (cursor < text.length && text.charAt(cursor) !== '\n') {
    const character = text.charAt(cursor)
    if (character === '\\') {
      cursor += backslashEscape(text, cursor) === undefined ? 1 : 2
      continue
    }
    if (character === '`') {
      const span = readCodeSpanEnd(text, cursor)
      if (span === undefined) break
      cursor = span
      continue
    }
    const nested = character === ':' ? readNestedDirective(text, cursor, depth + 1) : undefined
    if (nested !== undefined) {
      if (nested.fault !== undefined) return { fault: nested.fault }
      cursor += nested.value.length
      continue
    }
    if (character === ']' && brackets === 0) return { value: cursor }
    if (character === '[') brackets += 1
    if (character === ']') brackets -= 1
    cursor += 1
  }
  return { fault: malformedDirective(`an inline directive [content] is unclosed; ${inlineDirectiveEscape}`) }
}

// `undefined` where the span crosses the line ending an inline directive may not cross.
function readCodeSpanEnd(text: string, index: number): number | undefined {
  const opener = backtickRun(text, index)
  const closer = closingBacktickRun(text, index + opener, opener)
  if (closer === undefined) return index + opener
  return text.slice(index, closer + opener).includes('\n') ? undefined : closer + opener
}

function readAttributes(text: string, index: number, escape: string): Read<Attributes> {
  const attributes = new Map<string, DirectiveValue>()
  let cursor = index + 1
  let previous = ''
  while (cursor < text.length && text.charAt(cursor) !== '}') {
    if (attributes.size > 0) {
      if (text.charAt(cursor) !== ' ') return { fault: attributePairFault(escape) }
      cursor += 1
    }
    const pair = readAttributePair(text, cursor, escape)
    if (pair.fault !== undefined) return { fault: pair.fault }
    const key = pair.value.key
    if (attributes.has(key)) return { fault: malformedDirective(`the attribute key ${key} is spelled twice`) }
    if (keyOrder(previous, key) > 0) return { fault: malformedDirective(`${orderFault}: ${key} before ${previous}`) }
    previous = key
    attributes.set(key, pair.value.value)
    cursor = pair.value.end
  }
  if (text.charAt(cursor) !== '}') return { fault: malformedDirective('the {attrs} closing brace is missing') }
  return { value: { attributes, length: cursor + 1 - index } }
}

function readAttributePair(text: string, index: number, escape: string): Read<AttributePair> {
  bareRun.lastIndex = index
  const key = bareRun.exec(text)?.[0]
  if (key === undefined || text.charAt(index + key.length) !== '=') return { fault: attributePairFault(escape) }
  const start = index + key.length + 1
  if (text.charAt(start) === '"') {
    const quoted = readQuotedValue(text, start)
    if (quoted.fault !== undefined) return { fault: quoted.fault }
    return { value: { end: quoted.value.end, key, value: quoted.value.value } }
  }
  bareRun.lastIndex = start
  const bare = bareRun.exec(text)?.[0]
  if (bare === undefined) return { fault: attributePairFault(escape) }
  return { value: { end: start + bare.length, key, value: { decoded: bare, spelling: bare } } }
}

function readQuotedValue(text: string, index: number): Read<{ end: number; value: DirectiveValue }> {
  let cursor = index + 1
  while (cursor < text.length && text.charAt(cursor) !== '"') cursor += text.charAt(cursor) === '\\' ? 2 : 1
  if (text.charAt(cursor) !== '"') return { fault: malformedDirective('the {attrs} quoted value is unclosed') }
  const spelling = text.slice(index, cursor + 1)
  const character = rawReserved.exec(spelling)?.[0]
  if (character !== undefined) {
    return { fault: malformedDirective(`a raw ${character} inside {attrs} breaks the directive: spell it \\u${escapeDigits(character)}`) }
  }
  const parsed = parseJson(spelling)
  if (typeof parsed !== 'string') return { fault: malformedDirective('the {attrs} quoted value is not a JSON string') }
  return { value: { end: cursor + 1, value: { decoded: parsed, spelling } } }
}

function parseJson(raw: string): JsonValue | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    return isJsonValue(value) ? value : undefined
  } catch {
    return undefined
  }
}

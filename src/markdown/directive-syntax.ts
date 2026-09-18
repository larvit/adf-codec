import type { AttributeKind, VocabularyPair, VocabularyValue } from '../adf/attribute-vocabulary.ts'
import type { ConvertFault } from '../result.ts'
import type { JsonValue } from '../json-value.ts'
import { backslashEscape } from './commonmark/grammar.ts'
import { backtickRun, closingBacktickRun } from './commonmark/backtick-runs.ts'
import { isJsonValue, overNested } from '../json-value.ts'
import { largestNesting } from '../nesting.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export type AttributeReading = { refusal: 'kind' | 'nesting'; value?: undefined } | { refusal?: undefined; value: VocabularyValue }

export type DirectiveValue = { decoded: string; spelling: string }

export type DirectiveAttributes = ReadonlyMap<string, DirectiveValue>

export type DirectiveLine =
  | { argument: string | undefined; attributes: DirectiveAttributes; kind: 'opener'; name: string }
  | { kind: 'closer'; name: string }

// spans keys index content, so the two travel together: separate them and every offset is wrong.
export type DirectiveSpan = { attributes: DirectiveAttributes; content: string | undefined; length: number; name: string; spans: NestedSpans }

export type NestedSpans = ReadonlyMap<number, DirectiveSpan>

export type Read<T> = { fault: ConvertFault; value?: undefined } | { fault?: undefined; value: T }

type Attributes = { attributes: DirectiveAttributes; end: number }

type AttributePair = { end: number; key: string; value: DirectiveValue }

type Content = { content: string | undefined; end: number; spans: NestedSpans }

type DirectiveContent = { end: number; spans: NestedSpans }

export const directivePrefix = '!adf:'

const bareTokenSource = '[A-Za-z0-9_-]+'
const bareRun = new RegExp(bareTokenSource, 'y')
const bareToken = new RegExp(`^${bareTokenSource}$`)
const directiveName = /[a-z][A-Za-z0-9]*/y
const inlineDirectiveOpener = new RegExp(`${directivePrefix}[a-z][A-Za-z0-9]*[[{]`, 'y')
const lineEnd = /^[ \t]*$/
// spec/flavour.md, Attributes.
const reservedSource = '[&<`|]'
const quotedEscapes = new RegExp(reservedSource, 'g')
const rawReserved = new RegExp(reservedSource)
const noAttributes: DirectiveAttributes = new Map()

export const noSpans: NestedSpans = new Map()

export const directiveEscape = `\\${directivePrefix} keeps the prefix literal`

const closerFault = `a closer carries nothing after its name: this one does; ${directiveEscape}`
const emptyFault = 'an empty {attrs} is omitted unless the { itself claims the directive: this one spells {}'
const openerFault = `a directive opener reads a name, one bare argument and {attrs}, one space apart: this one does not; ${directiveEscape}`
const orderFault = 'the {attrs} keys read in alphabetical order'
const pairFault = `an attribute reads key=value, the value bare or double-quoted: this one does not; ${directiveEscape}`
const prefixFault = `an unescaped ${directivePrefix} completes no directive; ${directiveEscape}`

export function attributeValue(text: string, kind: AttributeKind): AttributeReading {
  if (kind === 'string') return { value: { kind, value: text } }
  if (kind === 'boolean') return text === 'true' || text === 'false' ? { value: { kind, value: text === 'true' } } : { refusal: 'kind' }
  const parsed = parseJson(text)
  if (parsed === undefined) return { refusal: 'kind' }
  if (kind === 'number') return typeof parsed === 'number' ? { value: { kind, value: parsed } } : { refusal: 'kind' }
  return overNested(parsed) ? { refusal: 'nesting' } : { value: { kind, value: parsed } }
}

export function claimsDirectivePrefix(text: string, index: number): boolean {
  return text.startsWith(directivePrefix, index)
}

export function holdsDirectivePrefix(text: string): boolean {
  return text.includes(directivePrefix)
}

export function isBareToken(text: string): boolean {
  return bareToken.test(text)
}

export function malformedDirective(message: string): ConvertFault {
  return { code: 'malformed-directive', message }
}

export function readDirectiveLine(line: string): Read<DirectiveLine> | undefined {
  if (!claimsDirectivePrefix(line, 0)) return undefined
  return line.charAt(directivePrefix.length) === '/' ? readCloserLine(line) : readOpenerLine(line)
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

export function spellDirectiveCloser(name: string): string {
  return `${directivePrefix}/${name}`
}

export function spellDirectiveOpener(name: string, argument: string | undefined, attributes: string): string {
  return `${directivePrefix}${name}${argument === undefined ? '' : ` ${argument}`}${attributes === '' ? '' : ` ${attributes}`}`
}

export function spellJsonAttribute(value: JsonValue): string {
  return quote(serializeCanonicalJson(value, 'compact'))
}

export function spellInlineDirectiveOpener(name: string): string {
  return `${directivePrefix}${name}[`
}

export function spellInlineLeafDirective(name: string, attributes: string): string {
  return `${directivePrefix}${name}${attributes === '' ? '{}' : attributes}`
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

export function unknownDirectiveFault(name: string): ConvertFault {
  return { code: 'unknown-directive-name', message: `the directive name ${name} reads back to no node; ${directiveEscape}` }
}

export function unsupportedNodeShape(message: string): ConvertFault {
  return { code: 'unsupported-node-shape', message }
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
  return opened === undefined ? undefined : opened.slice(directivePrefix.length, -1)
}

function readCloserLine(line: string): Read<DirectiveLine> | undefined {
  const start = directivePrefix.length + 1
  const name = readDirectiveName(line, start)
  if (name === undefined) return undefined
  return lineEnd.test(line.slice(start + name.length)) ? { value: { kind: 'closer', name } } : { fault: malformedDirective(closerFault) }
}

function readOpenerLine(line: string): Read<DirectiveLine> | undefined {
  const name = readDirectiveName(line, directivePrefix.length)
  if (name === undefined) return undefined
  const rest = line.slice(directivePrefix.length + name.length)
  if (!rest.startsWith(' ') && !lineEnd.test(rest)) return undefined
  const opener = readOpenerRest(rest)
  if (opener.fault !== undefined) return { fault: opener.fault }
  return { value: { argument: opener.value.argument, attributes: opener.value.attributes, kind: 'opener', name } }
}

function readDirectiveName(text: string, index: number): string | undefined {
  directiveName.lastIndex = index
  return directiveName.exec(text)?.[0]
}

function readOpenerRest(rest: string): Read<{ argument: string | undefined; attributes: DirectiveAttributes }> {
  bareRun.lastIndex = 1
  const argument = bareRun.exec(rest)?.[0]
  const attributes = readOpenerAttributes(rest, argument === undefined ? 0 : 1 + argument.length)
  if (attributes.fault !== undefined) return { fault: attributes.fault }
  if (!lineEnd.test(rest.slice(attributes.value.end))) return { fault: malformedDirective(openerFault) }
  return { value: { argument, attributes: attributes.value.attributes } }
}

function readOpenerAttributes(rest: string, index: number): Read<Attributes> {
  return rest.charAt(index) === ' ' ? readAttributesAt(rest, index + 1, false) : { value: { attributes: noAttributes, end: index } }
}

function readNestedDirective(text: string, index: number, depth: number): Read<DirectiveSpan> | undefined {
  if (!claimsDirectivePrefix(text, index)) return undefined
  const name = inlineDirectiveName(text, index)
  if (name === undefined) return { fault: malformedDirective(prefixFault) }
  if (depth > largestNesting) {
    return { fault: { code: 'unsupported-nesting-depth', message: `the input nests inline directives deeper than the ${largestNesting} levels the parser carries` } }
  }
  const slot = readContentSlot(text, index + directivePrefix.length + name.length, depth)
  if (slot.fault !== undefined) return { fault: slot.fault }
  const attributes = readAttributesAt(text, slot.value.end, slot.value.content === undefined)
  if (attributes.fault !== undefined) return { fault: attributes.fault }
  return { value: { attributes: attributes.value.attributes, content: slot.value.content, length: attributes.value.end - index, name, spans: slot.value.spans } }
}

function readContentSlot(text: string, index: number, depth: number): Read<Content> {
  if (text.charAt(index) !== '[') return { value: { content: undefined, end: index, spans: noSpans } }
  const close = readDirectiveContent(text, index + 1, depth)
  if (close.fault !== undefined) return { fault: close.fault }
  return { value: { content: text.slice(index + 1, close.value.end), end: close.value.end + 1, spans: close.value.spans } }
}

function readAttributesAt(text: string, index: number, braceClaims: boolean): Read<Attributes> {
  if (text.charAt(index) !== '{') return { value: { attributes: noAttributes, end: index } }
  const read = readAttributes(text, index)
  if (read.fault !== undefined || braceClaims || read.value.attributes.size > 0) return read
  return { fault: malformedDirective(emptyFault) }
}

// A code span, an escape and a nested directive each bind before the content's own closing bracket.
function readDirectiveContent(text: string, start: number, depth: number): Read<DirectiveContent> {
  const spans = new Map<number, DirectiveSpan>()
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
    const nested = readNestedDirective(text, cursor, depth + 1)
    if (nested?.fault !== undefined) return { fault: nested.fault }
    if (nested !== undefined) {
      spans.set(cursor - start, nested.value)
      cursor += nested.value.length
      continue
    }
    if (character === ']' && brackets === 0) return { value: { end: cursor, spans } }
    if (character === '[') brackets += 1
    if (character === ']') brackets -= 1
    cursor += 1
  }
  return { fault: malformedDirective(`an inline directive [content] is unclosed; ${directiveEscape}`) }
}

// `undefined` where the span crosses the line ending an inline directive may not cross.
function readCodeSpanEnd(text: string, index: number): number | undefined {
  const opener = backtickRun(text, index)
  const closer = closingBacktickRun(text, index + opener, opener)
  if (closer === undefined) return index + opener
  return text.slice(index, closer + opener).includes('\n') ? undefined : closer + opener
}

function readAttributes(text: string, index: number): Read<Attributes> {
  const attributes = new Map<string, DirectiveValue>()
  let cursor = index + 1
  let previous = ''
  while (cursor < text.length && text.charAt(cursor) !== '}') {
    if (attributes.size > 0) {
      if (text.charAt(cursor) !== ' ') return { fault: malformedDirective(pairFault) }
      cursor += 1
    }
    const pair = readAttributePair(text, cursor)
    if (pair.fault !== undefined) return { fault: pair.fault }
    const key = pair.value.key
    if (attributes.has(key)) return { fault: malformedDirective(`the attribute key ${key} is spelled twice`) }
    if (keyOrder(previous, key) > 0) return { fault: malformedDirective(`${orderFault}: ${key} before ${previous}`) }
    previous = key
    attributes.set(key, pair.value.value)
    cursor = pair.value.end
  }
  if (text.charAt(cursor) !== '}') return { fault: malformedDirective('the {attrs} closing brace is missing') }
  return { value: { attributes, end: cursor + 1 } }
}

function readAttributePair(text: string, index: number): Read<AttributePair> {
  bareRun.lastIndex = index
  const key = bareRun.exec(text)?.[0]
  if (key === undefined || text.charAt(index + key.length) !== '=') return { fault: malformedDirective(pairFault) }
  const start = index + key.length + 1
  if (text.charAt(start) === '"') {
    const quoted = readQuotedValue(text, start)
    if (quoted.fault !== undefined) return { fault: quoted.fault }
    return { value: { end: quoted.value.end, key, value: quoted.value.value } }
  }
  bareRun.lastIndex = start
  const bare = bareRun.exec(text)?.[0]
  if (bare === undefined) return { fault: malformedDirective(pairFault) }
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

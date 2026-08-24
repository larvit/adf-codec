export type InlineSegment = {
  kind: 'emphasis-close' | 'emphasis-open' | 'link-text' | 'literal' | 'syntax'
  text: string
}

export type LineContainer = 'heading' | 'paragraph'

const asciiPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/
const entityReference = /^&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#[Xx][A-Fa-f0-9]{1,6});/
const htmlConstructs = [/^<[!?]/, /^<\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)/, /^<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*>/, /^<[^\s<>@]+@[^\s<>@]+>/]
const inlineDirective = /^:[a-z][A-Za-z0-9]*[[{]/
const linkOpener = /\](?=[([:])/
const orderedListMarker = /^\d{1,9}$/
const setextUnderline = /^=+$/
const thematicBreak = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const unicodePunctuation = /[\p{P}\p{S}]/u
const unicodeWhitespace = /[\t\n\f\r \p{Zs}]/u

const escapableOpeners = [/^#{1,6}(?:[ \t]|$)/, /^>/, /^[*+-](?:[ \t]|$)/, /^`{3,}/, /^~{3,}/, /^:{2,}/, /^\|/]
const blockOpeners = [...escapableOpeners, /^\d{1,9}[.)](?:[ \t]|$)/]

export function assembleInlineLine(segments: readonly InlineSegment[], container: LineContainer): string {
  return escape(resolveEmphasis(segments), container)
}

export function lineOpensBlock(line: string): boolean {
  return blockOpeners.some((opener) => opener.test(line)) || thematicBreak.test(line)
}

export function isWordCharacter(character: string): boolean {
  return character !== '' && !unicodeWhitespace.test(character) && !unicodePunctuation.test(character)
}

function resolveEmphasis(segments: readonly InlineSegment[]): InlineSegment[] {
  const resolved = segments.map((segment) => ({ ...segment }))
  const scan = resolved.map((segment) => segment.text).join('')
  const offsets: number[] = []
  let offset = 0
  for (const segment of resolved) {
    offsets.push(offset)
    offset += segment.text.length
  }
  const open: number[] = []
  for (let index = 0; index < resolved.length; index += 1) {
    const segment = resolved[index]
    if (segment === undefined) continue
    if (segment.kind === 'emphasis-open') open.push(index)
    if (segment.kind !== 'emphasis-close') continue
    const openerIndex = open.pop()
    const opener = openerIndex === undefined ? undefined : resolved[openerIndex]
    if (openerIndex === undefined || opener === undefined) continue
    const openOffset = offsets[openerIndex] ?? 0
    const closeOffset = offsets[index] ?? 0
    if (!isWordCharacter(charAt(scan, openOffset - 1)) && !isWordCharacter(charAt(scan, closeOffset + 1))) continue
    opener.text = '*'
    segment.text = '*'
  }
  return resolved
}

function escape(segments: readonly InlineSegment[], container: LineContainer): string {
  const scan = segments.map((segment) => segment.text).join('')
  const kinds: InlineSegment['kind'][] = []
  for (const segment of segments) for (let index = 0; index < segment.text.length; index += 1) kinds.push(segment.kind)
  const escaped = new Set<number>()
  let output = ''
  for (let index = 0; index < scan.length; index += 1) {
    const kind = kinds[index]
    const escapable = kind === 'literal' || kind === 'link-text'
    if (escapable && opensConstruct(scan, index, kind === 'link-text', container, escaped)) {
      output += '\\'
      escaped.add(index)
    }
    output += scan.charAt(index)
  }
  return output
}

function opensConstruct(scan: string, index: number, inLinkText: boolean, container: LineContainer, escaped: ReadonlySet<number>): boolean {
  const character = scan.charAt(index)
  const rest = scan.slice(index)
  const line = rest.split('\n')[0] ?? ''
  if (container === 'paragraph' && (index === 0 || scan.charAt(index - 1) === '\n')) {
    if (escapableOpeners.some((opener) => opener.test(rest))) return true
    if (thematicBreak.test(line)) return true
    if (index > 0 && setextUnderline.test(line)) return true
  }
  if (container === 'paragraph' && (character === '.' || character === ')') && closesOrderedListMarker(scan, index)) return true
  if (container === 'heading' && character === '#' && /^#+$/.test(rest) && (index === 0 || /[ \t]/.test(scan.charAt(index - 1)))) return true
  if (inLinkText && (character === '[' || character === ']')) return true
  if (character === '\\') return asciiPunctuation.test(scan.charAt(index + 1))
  if (character === '&') return entityReference.test(rest)
  if (character === '<') return htmlConstructs.some((construct) => construct.test(rest))
  if (character === ':') return inlineDirective.test(rest)
  if (character === '[') return linkOpener.test(rest)
  if (character === '`') return opensCodeSpan(scan, index, escaped)
  if (character === '*' || character === '_' || character === '~') return opensEmphasis(scan, index, escaped)
  return false
}

function closesOrderedListMarker(scan: string, index: number): boolean {
  const lineStart = scan.lastIndexOf('\n', index - 1) + 1
  if (!orderedListMarker.test(scan.slice(lineStart, index))) return false
  const following = scan.charAt(index + 1)
  return following === '' || following === ' ' || following === '\t' || following === '\n'
}

function opensCodeSpan(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const length = runLength(scan, index)
  return new RegExp('(?<!`)`{' + length + '}(?!`)').test(scan.slice(index + length))
}

function opensEmphasis(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (!startsRun(scan, index, escaped)) return false
  const character = scan.charAt(index)
  const length = runLength(scan, index)
  const before = index === 0 ? '' : scan.charAt(index - 1)
  const after = scan.charAt(index + length)
  if (character === '~') return length === 2 && isLeftFlanking(before, after)
  if (!isLeftFlanking(before, after)) return false
  if (character === '*') return true
  return !isRightFlanking(before, after) || isPunctuation(before)
}

function startsRun(scan: string, index: number, escaped: ReadonlySet<number>): boolean {
  if (index === 0 || escaped.has(index - 1)) return true
  return scan.charAt(index - 1) !== scan.charAt(index)
}

function runLength(scan: string, index: number): number {
  const character = scan.charAt(index)
  let length = 0
  while (scan.charAt(index + length) === character) length += 1
  return length
}

function isLeftFlanking(before: string, after: string): boolean {
  if (isWhitespace(after)) return false
  if (!isPunctuation(after)) return true
  return isWhitespace(before) || isPunctuation(before)
}

function isRightFlanking(before: string, after: string): boolean {
  if (isWhitespace(before)) return false
  if (!isPunctuation(before)) return true
  return isWhitespace(after) || isPunctuation(after)
}

function isPunctuation(character: string): boolean {
  return character !== '' && unicodePunctuation.test(character)
}

function isWhitespace(character: string): boolean {
  return character === '' || unicodeWhitespace.test(character)
}

function charAt(text: string, index: number): string {
  return index < 0 ? '' : text.charAt(index)
}

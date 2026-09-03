import { readEntityReference, replacementCharacter } from './entity-references.ts'

export type LinePosition = 'first' | 'later'

type OpenHtmlBlock = { closer: RegExp | undefined; construct: string }

type HtmlBlockCondition = { closer: RegExp | undefined; construct: string | undefined; interrupts: boolean; start: RegExp }

const htmlConstructNames = {
  cdata: 'a CDATA section',
  comment: 'an HTML comment',
  declaration: 'an HTML declaration',
  processingInstruction: 'an HTML processing instruction',
}

const controlCharacterRange = '\\u0000-\\u001f\\u007f'
const autolinkSource = `[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\\s<>${controlCharacterRange}]*`
const nullCharacterSource = '\\u0000'
const tagNameSource = '[A-Za-z][A-Za-z0-9-]*'
const htmlSpaceSource = '[ \\t\\n]'
const attributeSource = `(?:${htmlSpaceSource}+[A-Za-z_:][A-Za-z0-9_.:-]*(?:${htmlSpaceSource}*=${htmlSpaceSource}*(?:[^ \\t\\n"'=<>\`]+|'[^']*'|"[^"]*"))?)`

const htmlTagSource = `(?:<${tagNameSource}${attributeSource}*${htmlSpaceSource}*/?>|</${tagNameSource}${htmlSpaceSource}*>)`

const autolink = new RegExp(`^(?:${autolinkSource})$`)
const bracketedAutolink = new RegExp(`<(?:${autolinkSource})>`, 'y')
const controlCharacter = new RegExp(`[${controlCharacterRange}]`)
const htmlTag = new RegExp(htmlTagSource, 'y')
const nullCharacter = new RegExp(nullCharacterSource)
const nullCharacters = new RegExp(nullCharacterSource, 'g')
const tagName = new RegExp(`^</?(${tagNameSource})[\\s\\S]*$`)
// The opener's own match ends with the terminator where the construct is complete on its own (`<!-->`).
const inlineHtmlConstructs = [
  { name: htmlConstructNames.cdata, opener: /<!\[CDATA\[/y, terminator: ']]>' },
  { name: htmlConstructNames.comment, opener: /<!(?:--->|-->|--)/y, terminator: '-->' },
  { name: htmlConstructNames.declaration, opener: /<![A-Za-z]/y, terminator: '>' },
  { name: htmlConstructNames.processingInstruction, opener: /<\?/y, terminator: '?>' },
]
// CommonMark 0.31.2, HTML blocks: the tag names start condition 6 lists.
const blockTagNames =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul'
const completeTag = new RegExp(`^${htmlTagSource}[ \\t]*$`)
const htmlBlockConditions: HtmlBlockCondition[] = [
  { closer: /<\/(?:pre|script|style|textarea)>/i, construct: undefined, interrupts: true, start: /^<(?:pre|script|style|textarea)(?:[ \t>]|$)/i },
  { closer: /-->/, construct: htmlConstructNames.comment, interrupts: true, start: /^<!--/ },
  { closer: /\?>/, construct: htmlConstructNames.processingInstruction, interrupts: true, start: /^<\?/ },
  { closer: />/, construct: htmlConstructNames.declaration, interrupts: true, start: /^<![A-Za-z]/ },
  { closer: /\]\]>/, construct: htmlConstructNames.cdata, interrupts: true, start: /^<!\[CDATA\[/ },
  { closer: undefined, construct: undefined, interrupts: true, start: new RegExp(`^</?(?:${blockTagNames})(?:[ \\t>]|/>|$)`, 'i') },
  { closer: undefined, construct: undefined, interrupts: false, start: completeTag },
]
const asciiPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/
const atxHeadingOpener = /^(#{1,6})(?:[ \t]|$)/
const codeFenceOpener = /^(`{3,}|~{3,})/
const directiveClaim = /^:{2,}(?:[A-Za-z0-9]|[ \t]*$)/
const pipeClaim = /^\|/
const bulletListOpener = /^[*+-](?:[ \t]|$)/
// A superset of what the parser claims: over-escaping a line is safe, under-escaping one breaks the round-trip.
const firstCharacterOpeners = [atxHeadingOpener, /^>/, bulletListOpener, codeFenceOpener, /^:{2,}/, pipeClaim]
// CommonMark 0.31.2, Autolinks: the email production, whose label may not open or close with a hyphen.
const emailNameSource = "[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+"
const emailLabelSource = '[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?'
const emailAutolink = new RegExp(`<${emailNameSource}@${emailLabelSource}(?:\\.${emailLabelSource})*>`, 'y')
const orderedListOpener = /^(\d{1,9})(?:[.)])(?:[ \t]|$)/
const setextUnderline = /^(=+|-+)[ \t]*$/
const thematicBreak = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const unicodeWhitespace = /[\t\n\f\r \p{Zs}]/u

export function atxHeading(line: string): { level: number; text: string } | undefined {
  const hashes = atxHeadingOpener.exec(line)?.[1]
  if (hashes === undefined) return undefined
  const text = trimSpace(line.slice(hashes.length))
  return { level: hashes.length, text: trimSpace(text.replace(/(?:^|(?<=[ \t]))#+$/, '')) }
}

// The character a backslash escapes at `index`, `undefined` where the backslash is literal text.
export function backslashEscape(text: string, index: number): string | undefined {
  if (text.charAt(index) !== '\\') return undefined
  const escaped = text.charAt(index + 1)
  return isAsciiPunctuation(escaped) ? escaped : undefined
}

export function claimsDirectiveLine(line: string): boolean {
  return directiveClaim.test(line)
}

export function claimsLine(line: string, position: LinePosition): boolean {
  return escapesLineClaim(line, 0, position) || orderedListOpener.test(line)
}

export function claimsPipeLine(line: string): boolean {
  return pipeClaim.test(line)
}

export function closingCodeFence(line: string, marker: string): boolean {
  const closing = codeFenceOpener.exec(line)?.[1]
  if (closing === undefined || closing.charAt(0) !== marker.charAt(0) || closing.length < marker.length) return false
  return /^[ \t]*$/.test(line.slice(closing.length))
}

export function decodeTextEscapes(text: string): string {
  let decoded = ''
  let index = 0
  while (index < text.length) {
    const escaped = backslashEscape(text, index)
    if (escaped !== undefined) {
      decoded += escaped
      index += 2
      continue
    }
    const reference = readEntityReference(text, index)
    if (reference !== undefined) {
      decoded += reference.text
      index += reference.length
      continue
    }
    decoded += text.charAt(index)
    index += 1
  }
  return decoded
}

export function escapesLineClaim(line: string, offset: number, position: LinePosition): boolean {
  if (offset === 0) {
    if (firstCharacterOpeners.some((opener) => opener.test(line)) || thematicBreak.test(line)) return true
    if (openingHtmlBlock(line, position === 'later') !== undefined) return true
    return position === 'later' && setextUnderline.test(line)
  }
  const digits = orderedListOpener.exec(line)?.[1]
  return digits !== undefined && offset === digits.length
}

export function holdsControlCharacter(text: string): boolean {
  return controlCharacter.test(text)
}

export function holdsNullCharacter(text: string): boolean {
  return nullCharacter.test(text)
}

export function replaceNullCharacters(text: string): string {
  return text.replaceAll(nullCharacters, replacementCharacter)
}

function htmlTagName(text: string): string {
  return text.replace(tagName, '<$1>')
}

export function inlineHtmlConstruct(text: string, index: number): string | undefined {
  for (const construct of inlineHtmlConstructs) {
    construct.opener.lastIndex = index
    const opened = construct.opener.exec(text)?.[0]
    if (opened === undefined) continue
    if (opened.endsWith(construct.terminator)) return construct.name
    return text.includes(construct.terminator, index + opened.length) ? construct.name : undefined
  }
  htmlTag.lastIndex = index
  const tag = htmlTag.exec(text)?.[0]
  return tag === undefined ? undefined : htmlTagName(tag)
}

export function isAsciiPunctuation(character: string): boolean {
  return asciiPunctuation.test(character)
}

export function isAutolink(text: string): boolean {
  return autolink.test(text)
}

export function isThematicBreak(line: string): boolean {
  return thematicBreak.test(line)
}

export function isUnicodeWhitespace(character: string): boolean {
  return unicodeWhitespace.test(character)
}

// `start` is the list's first number, `undefined` for a bullet.
export function listMarker(line: string): { start: number | undefined; width: number } | undefined {
  const ordered = orderedListOpener.exec(line)
  if (ordered !== null) {
    const digits = ordered[1] ?? ''
    return { start: Number(digits), width: digits.length + 1 }
  }
  return bulletListOpener.test(line) ? { start: undefined, width: 1 } : undefined
}

export function markerInterruptsParagraph(start: number | undefined, empty: boolean): boolean {
  return !empty && (start === undefined || start === 1)
}

export function openingCodeFence(line: string): { info: string; marker: string } | undefined {
  const marker = codeFenceOpener.exec(line)?.[1]
  if (marker === undefined) return undefined
  const info = trimSpace(line.slice(marker.length))
  return marker.startsWith('`') && info.includes('`') ? undefined : { info, marker }
}

export function openingHtmlBlock(line: string, interrupting: boolean): OpenHtmlBlock | undefined {
  for (const condition of htmlBlockConditions) {
    if ((interrupting && !condition.interrupts) || !condition.start.test(line)) continue
    return { closer: condition.closer, construct: condition.construct ?? htmlTagName(line) }
  }
  return undefined
}

export function opensBracketedAutolink(text: string, index: number): boolean {
  return readBracketedAutolink(text, index) !== undefined
}

export function opensEmailAutolink(text: string, index: number): boolean {
  return readEmailAutolink(text, index) !== undefined
}

export function readBracketedAutolink(text: string, index: number): number | undefined {
  bracketedAutolink.lastIndex = index
  return bracketedAutolink.exec(text)?.[0].length
}

export function readEmailAutolink(text: string, index: number): number | undefined {
  emailAutolink.lastIndex = index
  return emailAutolink.exec(text)?.[0].length
}

export function setextHeadingLevel(line: string): number | undefined {
  const underline = setextUnderline.exec(line)?.[1]
  if (underline === undefined) return undefined
  return underline.startsWith('=') ? 1 : 2
}

function spaceOrTab(character: string): boolean {
  return character === ' ' || character === '\t'
}

export function trimSpace(text: string): string {
  let start = 0
  while (start < text.length && spaceOrTab(text.charAt(start))) start += 1
  return trimTrailingSpace(text.slice(start))
}

export function trimTrailingSpace(text: string): string {
  let end = text.length
  while (end > 0 && spaceOrTab(text.charAt(end - 1))) end -= 1
  return text.slice(0, end)
}

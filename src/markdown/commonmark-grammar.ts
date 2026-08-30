export type LinePosition = 'first' | 'later'

const controlCharacterRange = '\\u0000-\\u001f\\u007f'
const autolinkSource = `[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\\s<>${controlCharacterRange}]*`
const nullCharacterSource = '\\u0000'
const entityReferenceSource = '&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\\d{1,7}|#[Xx][A-Fa-f0-9]{1,6});'

const anchoredEntityReference = new RegExp(`^(?:${entityReferenceSource})`)
const autolink = new RegExp(`^(?:${autolinkSource})$`)
const bracketedAutolink = new RegExp(`^<(?:${autolinkSource})>`)
const controlCharacter = new RegExp(`[${controlCharacterRange}]`)
const entityReference = new RegExp(entityReferenceSource)
const nullCharacter = new RegExp(nullCharacterSource)
const asciiPunctuation = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/
const atxHeadingOpener = /^(#{1,6})(?:[ \t]|$)/
const codeFenceOpener = /^(`{3,}|~{3,})/
const directiveClaim = /^:{2,}(?:[A-Za-z0-9]|[ \t]*$)/
const pipeClaim = /^\|/
// A superset of what the parser claims: over-escaping a line is safe, under-escaping one breaks the round-trip.
const firstCharacterOpeners = [atxHeadingOpener, /^>/, /^[*+-](?:[ \t]|$)/, codeFenceOpener, /^:{2,}/, pipeClaim]
const htmlConstructs = [/^<[!?]/, /^<\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)/, /^<[^\s<>@]+@[^\s<>@]+>/]
const orderedListOpener = /^(\d{1,9})[.)](?:[ \t]|$)/
const setextUnderline = /^(=+|-+)[ \t]*$/
const thematicBreak = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const unicodeWhitespace = /[\t\n\f\r \p{Zs}]/u

export function atxHeading(line: string): { level: number; text: string } | undefined {
  const hashes = atxHeadingOpener.exec(line)?.[1]
  if (hashes === undefined) return undefined
  const text = trimSpace(line.slice(hashes.length))
  return { level: hashes.length, text: trimSpace(text.replace(/(?:^|(?<=[ \t]))#+$/, '')) }
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

export function escapesLineClaim(line: string, offset: number, position: LinePosition): boolean {
  if (offset === 0) {
    if (firstCharacterOpeners.some((opener) => opener.test(line)) || thematicBreak.test(line)) return true
    return position === 'later' && setextUnderline.test(line)
  }
  const digits = orderedListOpener.exec(line)?.[1]
  return digits !== undefined && offset === digits.length
}

export function holdsControlCharacter(text: string): boolean {
  return controlCharacter.test(text)
}

export function holdsEntityReference(text: string): boolean {
  return entityReference.test(text)
}

export function holdsNullCharacter(text: string): boolean {
  return nullCharacter.test(text)
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

// The first marker of a list, `undefined` for a bullet: one answer both directions read, or the emitter
// spells a list the parser folds into the paragraph above it.
export function markerInterruptsParagraph(start: number | undefined, empty: boolean): boolean {
  return !empty && (start === undefined || start === 1)
}

export function openingCodeFence(line: string): { info: string; marker: string } | undefined {
  const marker = codeFenceOpener.exec(line)?.[1]
  if (marker === undefined) return undefined
  const info = trimSpace(line.slice(marker.length))
  return marker.startsWith('`') && info.includes('`') ? undefined : { info, marker }
}

export function opensBracketedAutolink(text: string): boolean {
  return bracketedAutolink.test(text)
}

export function opensHtmlConstruct(text: string): boolean {
  return htmlConstructs.some((construct) => construct.test(text))
}

export function setextHeadingLevel(line: string): number | undefined {
  const underline = setextUnderline.exec(line)?.[1]
  if (underline === undefined) return undefined
  return underline.startsWith('=') ? 1 : 2
}

export function startsEntityReference(text: string): boolean {
  return anchoredEntityReference.test(text)
}

export function trimSpace(text: string): string {
  return text.replace(/^[ \t]+|[ \t]+$/g, '')
}

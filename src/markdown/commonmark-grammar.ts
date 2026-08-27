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
const firstCharacterOpeners = [/^#{1,6}(?:[ \t]|$)/, /^>/, /^[*+-](?:[ \t]|$)/, /^`{3,}/, /^~{3,}/, /^:{2,}/, /^\|/]
const htmlConstructs = [/^<[!?]/, /^<\/?[A-Za-z][A-Za-z0-9-]*(?:[\s/>]|$)/, /^<[^\s<>@]+@[^\s<>@]+>/]
const orderedListOpener = /^(\d{1,9})[.)](?:[ \t]|$)/
const setextUnderline = /^(?:=+|-+)$/
const thematicBreak = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/
const unicodeWhitespace = /[\t\n\f\r \p{Zs}]/u

export function claimsLine(line: string, position: LinePosition): boolean {
  return escapesLineClaim(line, 0, position) || orderedListOpener.test(line)
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

export function opensBracketedAutolink(text: string): boolean {
  return bracketedAutolink.test(text)
}

export function opensHtmlConstruct(text: string): boolean {
  return htmlConstructs.some((construct) => construct.test(text))
}

export function startsEntityReference(text: string): boolean {
  return anchoredEntityReference.test(text)
}

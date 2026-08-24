export type LinePosition = 'first' | 'later'

const entityReferenceSource = '&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\\d{1,7}|#[Xx][A-Fa-f0-9]{1,6});'

const anchoredEntityReference = new RegExp(`^(?:${entityReferenceSource})`)
const entityReference = new RegExp(entityReferenceSource)
const firstCharacterOpeners = [/^#{1,6}(?:[ \t]|$)/, /^>/, /^[*+-](?:[ \t]|$)/, /^`{3,}/, /^~{3,}/, /^:{2,}/, /^\|/]
const orderedListOpener = /^(\d{1,9})[.)](?:[ \t]|$)/
const setextUnderline = /^=+$/
const thematicBreak = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/

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

export function holdsEntityReference(text: string): boolean {
  return entityReference.test(text)
}

export function startsEntityReference(text: string): boolean {
  return anchoredEntityReference.test(text)
}

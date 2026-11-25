import type { ConvertErrorPath, Read, Result } from '../../result.ts'
import type { Claims } from '../flavour.ts'
import type { DirectiveAttributes } from './syntax.ts'
import { directivePrefix, malformedDirective, markerOpener, pairFault, readAttributes, spellAttributes, spellStringAttribute } from './syntax.ts'
import { failure, success } from '../../result.ts'
import { readLineBack } from '../inline-content.ts'

// spec/flavour.md, The CommonMark blocks: text is what the line keeps once the marker after it is read.
export type TrailingMarker = { attributes: Read<DirectiveAttributes>; text: string }

export const idKey = 'localId'

const blankToEnd = /[ \t]*$/y
const trailingOpener = ` ${markerOpener}`

export function spellIdAttributes(id: string | undefined): string {
  return spellAttributes(id === undefined ? [] : [[idKey, spellStringAttribute(id)]])
}

export function spellIdMarker(id: string): string {
  return `${directivePrefix}${spellIdAttributes(id)}`
}

// A quoted id may hold the opener, so the marker is the last opener whose attributes end the text; an opener at index 0 has no text before it, so it is no trailing marker. An opener inside a link destination, which the text before it does not read as a link, is no marker either.
export function readTrailingMarker(text: string, claims: Claims): TrailingMarker | undefined {
  for (let start = text.lastIndexOf(trailingOpener); start > 0; start = text.lastIndexOf(trailingOpener, start - 1)) {
    const read = readAttributes(text, start + trailingOpener.length - 1, pairFault)
    if (read.fault !== undefined) continue
    blankToEnd.lastIndex = read.value.end
    if (!blankToEnd.test(text)) continue
    const kept = text.slice(0, start)
    if (linksBefore(text, start, claims) !== linksBefore(kept, start, claims)) continue
    const parted = kept.endsWith(' ') || kept.endsWith('\t')
    return { attributes: parted ? { fault: malformedDirective(`one space parts an ${markerOpener}…} marker from the text before it: this one is parted by more`) } : { value: read.value.attributes }, text: kept }
  }
  return undefined
}

// Where the reader takes each link opening before `end`, as one string to compare.
function linksBefore(text: string, end: number, claims: Claims): string {
  // A link reads the same in a heading and a paragraph.
  return readLineBack(text, 'paragraph', claims).reading.links.filter((at) => at < end).join()
}

// The marker after a list item's marker, and the rest of the line after the one space following it; `undefined` where none stands there.
export function readItemMarker(text: string): { attributes: DirectiveAttributes; rest: number } | undefined {
  if (!text.startsWith(markerOpener)) return undefined
  const read = readAttributes(text, directivePrefix.length, pairFault)
  if (read.fault !== undefined || text.charAt(read.value.end) !== ' ') return undefined
  const next = text.charAt(read.value.end + 1)
  return next === '' || next === ' ' || next === '\t' ? undefined : { attributes: read.value.attributes, rest: read.value.end + 1 }
}

export function readMarkerId(attributes: DirectiveAttributes, type: string, path: ConvertErrorPath): Result<string> {
  const spelled = attributes.get(idKey)
  if (spelled === undefined || attributes.size !== 1) {
    const others = [...attributes.keys()].filter((key) => key !== idKey)
    return failure('unsupported-node-shape', `an ${markerOpener}…} marker holds ${idKey} alone: this one on a ${type} holds ${others.length === 0 ? 'no key' : others.join(', ')}; write the ${type} as its directive to carry more`, path)
  }
  const spelling = spellStringAttribute(spelled.decoded)
  if (spelling !== spelled.spelling) return failure('unsupported-node-shape', `${type} spells its ${idKey} attribute as ${idKey}=${spelling}`, path)
  return success(spelled.decoded)
}

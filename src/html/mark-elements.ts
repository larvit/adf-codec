import type { AdfMark } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import { nodeAttrs } from '../adf/document.ts'
import { optionalAttribute } from './escaping.ts'

type MarkTag = { closer: string; opener: string }

// The element each mark holding no attribute writes around text; a link writes `<a>`.
const markElements: ReadonlyMap<string, string> = new Map([
  ['code', 'code'],
  ['em', 'em'],
  ['strike', 'del'],
  ['strong', 'strong'],
  ['underline', 'u'],
])
// The element each colour mark writes around text, its colour in the attribute `colourAttributeOn` names.
const colourElements: ReadonlyMap<string, 'mark' | 'span'> = new Map<string, 'mark' | 'span'>([
  ['backgroundColor', 'mark'],
  ['textColor', 'span'],
])
const scripts: ReadonlyMap<JsonValue | undefined, 'sub' | 'sup'> = new Map<JsonValue | undefined, 'sub' | 'sup'>([
  ['sub', 'sub'],
  ['sup', 'sup'],
])

// The element a mark but a link writes around text; `undefined` where the mark holds what no element spells.
export function markTag(mark: AdfMark): MarkTag | undefined {
  const attrs = nodeAttrs(mark)
  const plain = markElements.get(mark.type)
  if (plain !== undefined) return mark.attrs === undefined ? tagOf(plain, '') : undefined
  if (mark.type === 'subsup') {
    const script = scripts.get(attrs['type'])
    return Object.keys(attrs).length === 1 && script !== undefined ? tagOf(script, '') : undefined
  }
  const colour = colourElements.get(mark.type)
  if (colour === undefined) return undefined
  const { color } = attrs
  const attribute = Object.keys(attrs).length === 1 && typeof color === 'string' ? optionalAttribute(colourAttributeOn(colour), color) : undefined
  return attribute === undefined ? undefined : tagOf(colour, attribute)
}

// The mark a start tag but an `<a>` opens, as `markTag` writes it; `undefined` where it opens none.
export function markOfTag(name: string, attributes: readonly (readonly [string, string])[]): AdfMark | undefined {
  const [colour, ...others] = attributes
  if (colour === undefined) return markOfElement(name)
  if (others.length > 0) return undefined
  for (const [type, element] of colourElements) if (element === name && colourAttributeOn(element) === colour[0]) return { attrs: { color: colour[1] }, type }
  return undefined
}

export function colourAttributeOn(element: 'mark' | 'span'): string {
  return element === 'mark' ? 'data-background-color' : 'data-text-color'
}

function markOfElement(name: string): AdfMark | undefined {
  for (const [type, element] of markElements) if (element === name) return { type }
  return scripts.has(name) ? { attrs: { type: name }, type: 'subsup' } : undefined
}

function tagOf(element: string, attributes: string): MarkTag {
  return { closer: `</${element}>`, opener: `<${element}${attributes}>` }
}

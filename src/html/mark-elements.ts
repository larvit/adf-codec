import type { AdfMark } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import { colourDeclaration, readColour } from './colour-style.ts'
import { nodeAttrs } from '../adf/document.ts'

type MarkTag = { closer: string; opener: string }

// The element each mark holding no attribute writes around text; a link writes `<a>`.
const markElements: ReadonlyMap<string, string> = new Map([
  ['code', 'code'],
  ['em', 'em'],
  ['strike', 'del'],
  ['strong', 'strong'],
  ['underline', 'u'],
])
// The element and CSS property each colour mark writes around text, its colour in a `style` attribute.
const colourElements: ReadonlyMap<string, { element: string; property: string }> = new Map([
  ['backgroundColor', { element: 'mark', property: 'background-color' }],
  ['textColor', { element: 'span', property: 'color' }],
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
  const declaration = Object.keys(attrs).length === 1 ? colourDeclaration(colour.property, attrs['color']) : undefined
  return declaration === undefined ? undefined : tagOf(colour.element, ` style="${declaration}"`)
}

// The mark a start tag but an `<a>` opens, as `markTag` writes it; `undefined` where it opens none.
export function markOfTag(name: string, attributes: readonly (readonly [string, string])[]): AdfMark | undefined {
  const [style, ...others] = attributes
  if (style === undefined) return markOfElement(name)
  if (style[0] !== 'style' || others.length > 0) return undefined
  for (const [type, { element, property }] of colourElements) {
    const color = element === name ? readColour(property, style[1]) : undefined
    if (color !== undefined) return { attrs: { color }, type }
  }
  return undefined
}

function markOfElement(name: string): AdfMark | undefined {
  for (const [type, element] of markElements) if (element === name) return { type }
  return scripts.has(name) ? { attrs: { type: name }, type: 'subsup' } : undefined
}

function tagOf(element: string, attributes: string): MarkTag {
  return { closer: `</${element}>`, opener: `<${element}${attributes}>` }
}

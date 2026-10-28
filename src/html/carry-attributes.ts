import { jsonValue } from './escaping.ts'

const carryClass = 'adf-carry'
const jsonAttribute = 'data-adf'

export function carryAttributes(json: string): string {
  return ` class="${carryClass}" ${jsonAttribute}="${jsonValue(json)}"`
}

// Where the JSON stands in the start tag of a carry element named `element`, counted from its `<`.
export function carryJsonOffset(element: string): number {
  return `<${element} class="${carryClass}" ${jsonAttribute}="`.length
}

// The JSON a carry element's attributes hold, as HTML can hold it; `undefined` where `carryAttributes` writes no such attributes.
export function readCarryAttributes(attributes: readonly (readonly [string, string])[]): string | undefined {
  const [kind, held, ...others] = attributes
  return kind?.[0] === 'class' && kind[1] === carryClass && held?.[0] === jsonAttribute && others.length === 0 ? held[1] : undefined
}

import type { JsonValue } from '../json-value.ts'

export type ContainerType = 'blockquote' | 'bulletList' | 'orderedList'

// The element of each node whose blocks, or list items, stand a line each inside it.
export const containerElements: Readonly<Record<ContainerType, string>> = { blockquote: 'blockquote', bulletList: 'ul', orderedList: 'ol' }
const headingLevels: readonly unknown[] = [1, 2, 3, 4, 5, 6]
export const headingElements: readonly string[] = headingLevels.map((level) => `h${level}`)

// `undefined` where the level is none of 1 to 6, so the heading rides the carry.
export function headingElement(level: JsonValue | undefined): string | undefined {
  return headingLevels.includes(level) ? `h${level}` : undefined
}

// The level of `<h1>` to `<h6>`, 0 for any other element.
export function headingLevel(name: string): number {
  return headingElements.indexOf(name) + 1
}

// An ordered list's ` start="…"`, `''` where it holds no order; `undefined` where `start` cannot spell the order: one that is no safe integer, or -0.
export function listStart(order: JsonValue | undefined): string | undefined {
  if (order === undefined) return ''
  return typeof order === 'number' && Number.isSafeInteger(order) && !Object.is(order, -0) ? ` start="${order}"` : undefined
}

// The order a `start` value spells; `undefined` where `listStart` writes no such value.
export function readListStart(value: string): number | undefined {
  const order = Number(value)
  return listStart(order) === ` start="${value}"` ? order : undefined
}

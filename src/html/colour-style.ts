import type { JsonValue } from '../json-value.ts'

// Letters and digits alone, after an optional `#`, so no value can end the declaration or call `url()`.
const colour = /^#?[0-9a-zA-Z]+$/

// `property:colour`, `undefined` where the value is no colour the declaration can hold.
export function colourDeclaration(property: string, value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && colour.test(value) ? `${property}:${value}` : undefined
}

// The colour a `property:colour` declaration holds, `undefined` where it holds another property or no such colour.
export function readColour(property: string, declaration: string): string | undefined {
  const prefix = `${property}:`
  const value = declaration.slice(prefix.length)
  return declaration.startsWith(prefix) && colour.test(value) ? value : undefined
}

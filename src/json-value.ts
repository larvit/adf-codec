import { largestNesting } from './nesting.ts'

export type JsonValue = JsonValue[] | boolean | null | number | string | { [key: string]: JsonValue }

export function isJsonValue(value: unknown): value is JsonValue {
  const pending: { depth: number; item: unknown }[] = [{ depth: 0, item: value }]
  while (pending.length > 0) {
    const entry = pending.pop()
    if (entry === undefined) continue
    const { depth, item } = entry
    if (depth > largestNesting) return false
    if (item === null || typeof item === 'boolean' || typeof item === 'string') continue
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) return false
      continue
    }
    // A hole is not a JSON value, and Array.prototype methods skip holes — spreading materialises them.
    if (Array.isArray(item)) for (const child of [...item]) pending.push({ depth: depth + 1, item: child })
    else if (typeof item === 'object') for (const child of Object.values(item)) pending.push({ depth: depth + 1, item: child })
    else return false
  }
  return true
}

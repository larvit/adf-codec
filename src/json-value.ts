import { largestNesting } from './nesting.ts'

export type JsonValue = JsonValue[] | boolean | null | number | string | { [key: string]: JsonValue }

export function isJsonValue(value: unknown): value is JsonValue {
  const pending: unknown[] = [value]
  while (pending.length > 0) {
    const item = pending.pop()
    if (item === null || typeof item === 'boolean' || typeof item === 'string') continue
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) return false
      continue
    }
    // A hole is not a JSON value, and Array.prototype methods skip holes — spreading materialises them.
    if (Array.isArray(item)) for (const child of [...item]) pending.push(child)
    else if (typeof item === 'object') for (const child of Object.values(item)) pending.push(child)
    else return false
  }
  return true
}

export function overNested(value: JsonValue, levels: number = largestNesting): boolean {
  const pending: { depth: number; item: JsonValue }[] = [{ depth: 0, item: value }]
  while (pending.length > 0) {
    const entry = pending.pop()
    if (entry === undefined) continue
    const { depth, item } = entry
    if (depth > levels) return true
    if (Array.isArray(item)) for (const child of item) pending.push({ depth: depth + 1, item: child })
    else if (item !== null && typeof item === 'object') for (const child of Object.values(item)) pending.push({ depth: depth + 1, item: child })
  }
  return false
}

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
    else if (isPlainObject(item)) for (const child of Object.values(item)) pending.push(child)
    else return false
  }
  return true
}

// A Date, Map or class instance passes typeof but JSON writes it as {} or a key per element.
function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

export function nestingDepth(value: unknown): number {
  const pending: { depth: number; item: unknown }[] = [{ depth: 0, item: value }]
  let deepest = 0
  while (pending.length > 0) {
    const entry = pending.pop()
    if (entry === undefined) continue
    const { depth, item } = entry
    deepest = Math.max(deepest, depth)
    if (Array.isArray(item)) for (const child of item) pending.push({ depth: depth + 1, item: child })
    else if (item !== null && typeof item === 'object') for (const child of Object.values(item)) pending.push({ depth: depth + 1, item: child })
  }
  return deepest
}

export function overNested(value: unknown, levels: number = largestNesting): boolean {
  return nestingDepth(value) > levels
}

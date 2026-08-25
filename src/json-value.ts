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
    if (Array.isArray(item)) pending.push(...item)
    else if (typeof item === 'object') pending.push(...Object.values(item))
    else return false
  }
  return true
}

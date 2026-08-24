export type JsonValue = JsonValue[] | boolean | null | number | string | { [key: string]: JsonValue }

export type JsonSpelling = 'compact' | 'two-space'

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true
  if (typeof value === 'boolean' || typeof value === 'string') return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (typeof value === 'object') return Object.values(value).every(isJsonValue)
  return false
}

export function serializeCanonicalJson(value: JsonValue, spelling: JsonSpelling): string {
  return serialize(value, spelling === 'compact' ? '' : '  ', 0)
}

function serialize(value: JsonValue, indent: string, depth: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((item) => serialize(item, indent, depth + 1))
    return `[${join(items, indent, depth)}]`
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    if (keys.length === 0) return '{}'
    const separator = indent === '' ? ':' : ': '
    const entries = keys.map((key) => `${JSON.stringify(key)}${separator}${serialize(value[key] ?? null, indent, depth + 1)}`)
    return `{${join(entries, indent, depth)}}`
  }
  return JSON.stringify(value)
}

function join(parts: readonly string[], indent: string, depth: number): string {
  if (indent === '') return parts.join(',')
  const inner = `\n${indent.repeat(depth + 1)}`
  return `${inner}${parts.join(`,${inner}`)}\n${indent.repeat(depth)}`
}

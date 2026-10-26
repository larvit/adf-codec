import { failure, type Result } from './result.ts'

// Each reader's refusal of input that is no string, `format` naming what it reads.
export function notAString<T>(value: unknown, format: string): Result<T> {
  return failure('not-a-string', `${format} is a string: found ${typeName(value)}`, [])
}

// `typeof` alone, since anything more throws on a revoked Proxy.
function typeName(value: unknown): string {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'undefined') return type
  return type === 'object' ? 'an object' : `a ${type}`
}

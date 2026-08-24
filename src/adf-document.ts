import { isJsonValue, type JsonValue } from './canonical-json.ts'

export type AdfAttributes = { [key: string]: JsonValue }

export type AdfMark = {
  attrs?: AdfAttributes
  type: string
}

export type AdfNode = {
  attrs?: AdfAttributes
  content?: AdfNode[]
  marks?: AdfMark[]
  text?: string
  type: string
}

export type AdfDocument = {
  content?: AdfNode[]
  type: 'doc'
  version: number
}

const documentKeys = ['content', 'type', 'version']
const markKeys = ['attrs', 'type']
const nodeKeys = ['attrs', 'content', 'marks', 'text', 'type']

export function isAdfDocument(value: unknown): value is AdfDocument {
  if (!isRecord(value) || !holdsOnly(value, documentKeys)) return false
  if (value['type'] !== 'doc') return false
  if (typeof value['version'] !== 'number' || !Number.isFinite(value['version'])) return false
  return !('content' in value) || isArrayOf(value['content'], isAdfNode)
}

function isAdfMark(value: unknown): value is AdfMark {
  if (!isRecord(value) || !holdsOnly(value, markKeys)) return false
  if (typeof value['type'] !== 'string') return false
  return !('attrs' in value) || isAttributes(value['attrs'])
}

function isAdfNode(value: unknown): value is AdfNode {
  if (!isRecord(value) || !holdsOnly(value, nodeKeys)) return false
  if (typeof value['type'] !== 'string') return false
  if ('attrs' in value && !isAttributes(value['attrs'])) return false
  if ('content' in value && !isArrayOf(value['content'], isAdfNode)) return false
  if ('marks' in value && !isArrayOf(value['marks'], isAdfMark)) return false
  return !('text' in value) || typeof value['text'] === 'string'
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard)
}

function isAttributes(value: unknown): value is AdfAttributes {
  return isRecord(value) && isJsonValue(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function holdsOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

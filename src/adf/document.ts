import { isJsonValue, type JsonValue } from '../json-value.ts'

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

export function carriesOnly(node: AdfNode, attributes: readonly string[]): boolean {
  if ((node.marks ?? []).length > 0 || node.text !== undefined) return false
  return holdsOnly(node.attrs ?? {}, attributes)
}

export function isAdfDocument(value: unknown): value is AdfDocument {
  if (!isRecord(value) || !holdsOnly(value, documentKeys)) return false
  if (value['type'] !== 'doc') return false
  if (typeof value['version'] !== 'number' || !Number.isFinite(value['version'])) return false
  return !('content' in value) || isNodeArray(value['content'])
}

export function isAdfMark(value: unknown): value is AdfMark {
  if (!isRecord(value) || !holdsOnly(value, markKeys)) return false
  if (typeof value['type'] !== 'string') return false
  return !('attrs' in value) || isAttributes(value['attrs'])
}

function isNodeArray(value: unknown): value is AdfNode[] {
  if (!Array.isArray(value)) return false
  const pending: unknown[] = [...value]
  while (pending.length > 0) {
    const node = pending.pop()
    if (!isRecord(node) || !holdsOnly(node, nodeKeys)) return false
    if (typeof node['type'] !== 'string') return false
    if ('attrs' in node && !isAttributes(node['attrs'])) return false
    if ('marks' in node && !isArrayOf(node['marks'], isAdfMark)) return false
    if ('text' in node && typeof node['text'] !== 'string') return false
    if ('content' in node) {
      const content = node['content']
      if (!Array.isArray(content)) return false
      pending.push(...content)
    }
  }
  return true
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && [...value].every(guard)
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

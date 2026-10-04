import type { ConvertFault } from '../result.ts'
import { everyInTree, isJsonValue, overNested, type JsonValue } from '../json-value.ts'
import { largestNesting } from '../nesting.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

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

export type EmptyKey = 'attrs' | 'content' | 'marks'

export type AdfDocument = {
  content?: AdfNode[]
  type: 'doc'
  version: number
}

const documentKeys = ['content', 'type', 'version']
const markKeys = ['attrs', 'type']
const nodeKeys = ['attrs', 'content', 'marks', 'text', 'type']

export function adfDocumentFault(value: unknown): ConvertFault | undefined {
  if (!isRecord(value)) return notADocument(`an ADF document is an object: found ${describe(value)}`)
  const extra = extraKey(value, documentKeys)
  if (extra !== undefined) return notADocument(`an ADF document holds content, type and version alone: found the key ${extra}`)
  if (!('type' in value)) return notADocument('an ADF document holds type "doc": found no type field')
  if (value['type'] !== 'doc') return notADocument(`an ADF document holds type "doc": found ${describe(value['type'])}`)
  if (!('version' in value)) return notADocument('an ADF document holds a version number: found no version field')
  const version = value['version']
  if (typeof version !== 'number' || !Number.isFinite(version)) return notADocument(`an ADF document holds a version number: found ${describe(version)}`)
  if (!('content' in value)) return undefined
  const held: unknown = value['content']
  if (!Array.isArray(held)) return notADocument(`an ADF document's content is an array: found ${describe(held)}`)
  const content: readonly unknown[] = held
  if (!isNodeArray(content)) return notADocument("an ADF document's content holds ADF nodes: one of them is not")
  return nestingFault(content)
}

export function attributeNestingMessage(key: string, type: string): string {
  return `the ${key} attribute of ${type} nests deeper than the ${largestNesting} levels an attribute carries`
}

export function holdsOnlyAttributes(node: AdfNode, attributes: readonly string[]): boolean {
  if (nodeMarks(node).length > 0 || node.text !== undefined || emptyKeys(node).length > 0) return false
  return holdsOnly(nodeAttrs(node), attributes)
}

export function emptyKeys(held: { attrs?: AdfAttributes; content?: AdfNode[]; marks?: AdfMark[] }): EmptyKey[] {
  const keys: EmptyKey[] = []
  if (held.attrs !== undefined && Object.keys(held.attrs).length === 0) keys.push('attrs')
  if (held.content?.length === 0) keys.push('content')
  if (held.marks?.length === 0) keys.push('marks')
  return keys
}

// A format spells this node as text; anything more rides a carry, save content, which is refused.
export function isBareText(node: AdfNode): boolean {
  return node.type === 'text' && node.attrs === undefined && node.content === undefined && node.marks?.length !== 0
}

export function isUnmarkedBareText(node: AdfNode): boolean {
  return isBareText(node) && node.marks === undefined
}

export function identicalMark(left: AdfMark, right: AdfMark): boolean {
  return marksKey([left]) === marksKey([right])
}

export function identicalMarks(left: readonly AdfMark[], right: readonly AdfMark[]): boolean {
  return marksKey(left) === marksKey(right)
}

export function mergeAdjacentText(nodes: readonly AdfNode[], joins: (previous: AdfNode, node: AdfNode) => boolean): AdfNode[] {
  const merged: AdfNode[] = []
  for (const node of nodes) {
    const previous = merged[merged.length - 1]
    if (previous !== undefined && joins(previous, node)) {
      merged[merged.length - 1] = { ...previous, text: `${previous.text ?? ''}${node.text ?? ''}` }
      continue
    }
    merged.push(node)
  }
  return merged
}

// Depth is the walks' business, not the shape's: the guard waves a deep document through as blocks and marks do.
export function isAdfDocument(value: unknown): value is AdfDocument {
  const fault = adfDocumentFault(value)
  return fault === undefined || fault.code === 'unsupported-nesting-depth'
}

export function isAdfNode(value: unknown): value is AdfNode {
  return isNodeArray([value])
}

export function isAdfMark(value: unknown): value is AdfMark {
  if (!isRecord(value) || !holdsOnly(value, markKeys)) return false
  if (typeof value['type'] !== 'string') return false
  return !('attrs' in value) || isAttributes(value['attrs'])
}

export function nodeAttrs(node: { attrs?: AdfAttributes }): Readonly<AdfAttributes> {
  return node.attrs ?? {}
}

export function nodeContent(node: { content?: AdfNode[] }): readonly AdfNode[] {
  return node.content ?? []
}

export function nodeMarks(node: { marks?: AdfMark[] }): readonly AdfMark[] {
  return node.marks ?? []
}

function isNodeArray(value: readonly unknown[]): value is readonly AdfNode[] {
  return everyInTree(value, (node) => {
    if (!isRecord(node) || !holdsOnly(node, nodeKeys)) return undefined
    if (typeof node['type'] !== 'string') return undefined
    if ('attrs' in node && !isAttributes(node['attrs'])) return undefined
    if ('marks' in node && !isArrayOf(node['marks'], isAdfMark)) return undefined
    if ('text' in node && typeof node['text'] !== 'string') return undefined
    if (!('content' in node)) return []
    const content = node['content']
    return Array.isArray(content) ? [...content] : undefined
  })
}

function marksKey(marks: readonly AdfMark[]): string {
  return serializeCanonicalJson(
    marks.map((mark) => (mark.attrs === undefined ? [mark.type] : [mark.type, mark.attrs])),
    'compact',
  )
}

function nestingFault(nodes: readonly AdfNode[]): ConvertFault | undefined {
  const pending: AdfNode[] = [...nodes]
  while (pending.length > 0) {
    const node = pending.pop()
    if (node === undefined) continue
    const fault = attributesFault(nodeAttrs(node), node.type) ?? marksFault(nodeMarks(node))
    if (fault !== undefined) return fault
    for (const child of nodeContent(node)) pending.push(child)
  }
  return undefined
}

function marksFault(marks: readonly AdfMark[]): ConvertFault | undefined {
  for (const mark of marks) {
    const fault = attributesFault(nodeAttrs(mark), mark.type)
    if (fault !== undefined) return fault
  }
  return undefined
}

function attributesFault(attrs: AdfAttributes, type: string): ConvertFault | undefined {
  for (const [key, value] of Object.entries(attrs)) {
    if (overNested(value)) return { code: 'unsupported-nesting-depth', message: attributeNestingMessage(key, type) }
  }
  return undefined
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

function notADocument(message: string): ConvertFault {
  return { code: 'not-an-adf-document', message }
}

function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value)
  if (typeof value === 'function') return 'a function'
  if (typeof value === 'object' && value !== null) return Array.isArray(value) ? 'an array' : 'an object'
  return String(value)
}

function extraKey(value: Record<string, unknown>, keys: readonly string[]): string | undefined {
  return Object.keys(value).find((key) => !keys.includes(key))
}

function holdsOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return extraKey(value, keys) === undefined
}

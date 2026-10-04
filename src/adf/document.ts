import type { ConvertFault } from '../result.ts'
import { isJsonValue, overNested, type JsonValue } from '../json-value.ts'
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
  if (holdsItself(content)) return notADocument('an ADF document is a tree: an object in it holds itself')
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
  if (!isRecord(value) || !holdsOnly(value, markKeys) || !ownsWhatItHolds(value, markKeys)) return false
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

// Tracks ancestors alone: a tree may share an object, but an object holding itself walks the guards forever.
function holdsItself(root: object): boolean {
  const pending = [{ depth: 0, item: root }]
  const ancestors: object[] = []
  const onPath = new Set<unknown>()
  while (pending.length > 0) {
    const entry = pending.pop()
    if (entry === undefined) continue
    while (ancestors.length > entry.depth) onPath.delete(ancestors.pop())
    if (onPath.has(entry.item)) return true
    ancestors.push(entry.item)
    onPath.add(entry.item)
    for (const child of Array.isArray(entry.item) ? [...entry.item] : Object.values(entry.item)) if (typeof child === 'object' && child !== null) pending.push({ depth: entry.depth + 1, item: child })
  }
  return false
}

function isNodeArray(value: readonly unknown[]): value is readonly AdfNode[] {
  const pending: unknown[] = [...value]
  while (pending.length > 0) {
    const node = pending.pop()
    if (!isRecord(node) || !holdsOnly(node, nodeKeys) || !ownsWhatItHolds(node, nodeKeys)) return false
    if (typeof node['type'] !== 'string') return false
    if ('attrs' in node && !isAttributes(node['attrs'])) return false
    if ('marks' in node && !isArrayOf(node['marks'], isAdfMark)) return false
    if ('text' in node && typeof node['text'] !== 'string') return false
    if ('content' in node) {
      const content = node['content']
      if (!Array.isArray(content)) return false
      for (const child of content) pending.push(child)
    }
  }
  return true
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

// holdsItself walks own enumerable keys alone, so a guard reading any other key could walk a cycle forever.
function ownsWhatItHolds(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => !(key in value) || Object.prototype.propertyIsEnumerable.call(value, key))
}

function holdsOnly(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return extraKey(value, keys) === undefined
}

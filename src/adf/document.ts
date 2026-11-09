import { blockNodeModel } from './block-nodes.ts'
import { failure, faulted, success, type ConvertError, type ConvertFault, type Read, type Result } from '../result.ts'
import { inlineNodeModel } from './inline-nodes.ts'
import { isJsonValue, overNested, type JsonValue } from '../json-value.ts'
import { largestNesting } from '../nesting.ts'
import { plainCopy } from './plain-copy.ts'
import { withinEngineLimits, withinLongest } from '../length-bound.ts'
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

// Reads a document nested past 500 levels too: the converters refuse that depth, as they do a block's or a mark's.
export function readAdfDocument(value: unknown): Result<AdfDocument> {
  return withinEngineLimits(() => {
    const copy = plainCopy(value)
    if (copy.fault !== undefined) return faulted(copy.fault, [])
    const shaped = shapedDocument(copy.value)
    return shaped.fault === undefined ? success(shaped.value) : faulted(shaped.fault, [])
  })
}

function shapedDocument(value: unknown): Read<AdfDocument> {
  if (!isRecord(value)) return notADocument(`an ADF document is an object: found ${describe(value)}`)
  const extra = extraKey(value, documentKeys)
  if (extra !== undefined) return notADocument(`an ADF document holds content, type and version alone: found the key ${extra}`)
  if (!('type' in value)) return notADocument('an ADF document holds type "doc": found no type field')
  const type: unknown = value['type']
  if (type !== 'doc') return notADocument(`an ADF document holds type "doc": found ${describe(type)}`)
  if (!('version' in value)) return notADocument('an ADF document holds a version number: found no version field')
  const version: unknown = value['version']
  if (typeof version !== 'number' || !Number.isFinite(version)) return notADocument(`an ADF document holds a version number: found ${describe(version)}`)
  if (!('content' in value)) return { value: { type, version } }
  const content: unknown = value['content']
  if (!Array.isArray(content)) return notADocument(`an ADF document's content is an array: found ${describe(content)}`)
  const nodes: readonly unknown[] = content
  if (!isNodeArray(nodes)) return notADocument("an ADF document's content holds ADF nodes: one of them is not")
  return { value: { content: nodes, type, version } }
}

// The checks every writer opens with; `undefined` where the document holds no `content` key, which each format spells its own way.
export function writableContent(document: AdfDocument): Result<readonly AdfNode[] | undefined> {
  const fault = nestingFault(document.content ?? [])
  if (fault !== undefined) return faulted(fault, [])
  if (document.version !== 1) return failure('unsupported-document-version', `no format this library writes carries ADF version ${document.version}`, [])
  if (document.content === undefined) return success(undefined)
  const refused = refusedShape(document.content)
  if (refused !== undefined) return { error: refused, ok: false }
  // Text alone past the bound is refused before anything is written (docs/decisions.md §Output past V8's longest string is refused on every engine).
  return withinLongest(heldTextLength(document.content), document.content)
}

export function attributeNestingMessage(key: string, type: string): string {
  return `the ${key} attribute of ${type} nests deeper than the ${largestNesting} levels an attribute carries`
}

export function holdsOnlyAttributes(node: AdfNode, attributes: readonly string[]): boolean {
  if (nodeMarks(node).length > 0 || emptyKeys(node).length > 0) return false
  return holdsOnly(nodeAttrs(node), attributes)
}

export function emptyKeys(held: { attrs?: AdfAttributes; content?: AdfNode[]; marks?: AdfMark[] }): EmptyKey[] {
  const keys: EmptyKey[] = []
  if (held.attrs !== undefined && Object.keys(held.attrs).length === 0) keys.push('attrs')
  if (held.content?.length === 0) keys.push('content')
  if (held.marks?.length === 0) keys.push('marks')
  return keys
}

// No attrs, content or empty marks; a format may spell this node as text, and anything more rides a carry.
export function isSpellableText(node: AdfNode): boolean {
  return node.type === 'text' && node.attrs === undefined && node.content === undefined && node.marks?.length !== 0
}

export function isUnmarkedSpellableText(node: AdfNode): boolean {
  return isSpellableText(node) && node.marks === undefined
}

export function identicalMark(left: AdfMark, right: AdfMark): boolean {
  return marksKey([left]) === marksKey([right])
}

export function identicalMarks(left: readonly AdfMark[], right: readonly AdfMark[]): boolean {
  return marksKey(left) === marksKey(right)
}

// The length of the text the nodes hold, the nodes below them included.
function heldTextLength(nodes: readonly AdfNode[]): number {
  let length = 0
  const pending = [...nodes]
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    length += node.text?.length ?? 0
    for (const child of nodeContent(node)) pending.push(child)
  }
  return length
}

export function mergeAdjacentText(nodes: readonly AdfNode[], joins: (previous: AdfNode, node: AdfNode) => boolean): AdfNode[] {
  return mergedTextRuns(nodes, joins).map(({ node }) => node)
}

// `first`: the index of the first of the nodes merged into `node`.
export function mergedTextRuns(nodes: readonly AdfNode[], joins: (previous: AdfNode, node: AdfNode) => boolean): { first: number; node: AdfNode }[] {
  const merged: { first: number; node: AdfNode }[] = []
  for (const [index, node] of nodes.entries()) {
    const previous = merged[merged.length - 1]
    if (previous !== undefined && joins(previous.node, node)) {
      previous.node = { ...previous.node, text: `${previous.node.text ?? ''}${node.text ?? ''}` }
      continue
    }
    merged.push({ first: index, node })
  }
  return merged
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

// Walks every node, carried or of an unknown type, so a shape is refused wherever it stands (docs/decisions.md §Schema refusals are made in the first step alone).
export function refusedShape(content: readonly AdfNode[]): ConvertError | undefined {
  type Step = { index: number; node: AdfNode; parent: Step | undefined }
  const pending: Step[] = content.map((node, index) => ({ index, node, parent: undefined })).reverse()
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    const message = shapeRefusal(step.node)
    if (message !== undefined) {
      const path: (number | string)[] = []
      for (let up: Step | undefined = step; up !== undefined; up = up.parent) path.push(up.index, 'content')
      path.reverse()
      return { code: 'unsupported-node-shape', message, path }
    }
    for (const child of nodeContent(step.node).map((node, index) => ({ index, node, parent: step })).reverse()) pending.push(child)
  }
  return undefined
}

function shapeRefusal(node: AdfNode): string | undefined {
  if (node.type === 'inlineCard' && nodeMarks(node).some(({ type }) => type === 'link')) return 'an inlineCard takes no link mark: this one holds one'
  const holdsContent = nodeContent(node).length > 0
  if (inlineNodeModel(node.type) !== undefined) {
    if (holdsContent) return `a node of type ${node.type} holds neither content nor text: this one holds content`
    return node.text === undefined ? undefined : `a node of type ${node.type} holds neither content nor text: this one holds text`
  }
  const model = blockNodeModel(node.type)
  if (model === undefined) return undefined
  if (node.text !== undefined) return `a node of type ${node.type} holds no text key: this one holds one`
  return model.contentModel === 'none' && holdsContent ? `a node of type ${node.type} holds no content: this one holds some` : undefined
}

function isNodeArray(value: readonly unknown[]): value is AdfNode[] {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function notADocument(message: string): { fault: ConvertFault } {
  return { fault: { code: 'not-an-adf-document', message } }
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

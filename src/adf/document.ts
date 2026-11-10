import { blockNodeModel } from './block-nodes.ts'
import { failure, faulted, success, type ConvertError, type ConvertErrorPath, type ConvertFault, type Result } from '../result.ts'
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
    return shapedDocument(copy.value)
  })
}

function shapedDocument(value: unknown): Result<AdfDocument> {
  if (!isRecord(value)) return notADocument(`an ADF document is an object: found ${describe(value)}`)
  const extra = extraKey(value, documentKeys)
  if (extra !== undefined) return notADocument(`an ADF document holds content, type and version alone: found the key ${extra}`)
  if (!('type' in value)) return notADocument('an ADF document holds type "doc": found no type field')
  const type: unknown = value['type']
  if (type !== 'doc') return notADocument(`an ADF document holds type "doc": found ${describe(type)}`)
  if (!('version' in value)) return notADocument('an ADF document holds a version number: found no version field')
  const version: unknown = value['version']
  if (typeof version !== 'number' || !Number.isFinite(version)) return notADocument(`an ADF document holds a version number: found ${describe(version)}`)
  if (!('content' in value)) return success({ type, version })
  const content: unknown = value['content']
  if (!Array.isArray(content)) return notADocument(`an ADF document's content is an array: found ${describe(content)}`)
  const nodes: readonly unknown[] = content
  if (isNodeArray(nodes)) return success({ content: nodes, type, version })
  const unreadable = unreadableNode(nodes)
  return unreadable === undefined ? notADocument('an ADF document holds ADF nodes: one is not') : faulted(unreadable.fault, unreadable.path)
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
  const refused = firstRefusal(content, nodeContent, shapeRefusal)
  return refused === undefined ? undefined : { code: 'unsupported-node-shape', message: refused.message, path: refused.path }
}

// The first node in document order that `refusal` names, with the path to it; the walk keeps its own stack, so no depth overflows it.
function firstRefusal<Node>(
  content: readonly Node[],
  childrenOf: (node: Node) => readonly Node[],
  refusal: (node: Node) => string | undefined,
): { message: string; path: ConvertErrorPath } | undefined {
  type Step = { index: number; node: Node; parent: Step | undefined }
  const pending: Step[] = content.map((node, index) => ({ index, node, parent: undefined })).reverse()
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    const message = refusal(step.node)
    if (message !== undefined) {
      const path: (number | string)[] = []
      for (let up: Step | undefined = step; up !== undefined; up = up.parent) path.push(up.index, 'content')
      return { message, path: path.reverse() }
    }
    for (const child of childrenOf(step.node).map((node, index) => ({ index, node, parent: step })).reverse()) pending.push(child)
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
  return unreadableNode(value) === undefined
}

function unreadableNode(content: readonly unknown[]): { fault: ConvertFault; path: ConvertErrorPath } | undefined {
  const refused = firstRefusal(content, unreadableChildren, nodeRefusal)
  return refused === undefined ? undefined : { fault: { code: 'not-an-adf-document', message: refused.message }, path: refused.path }
}

function unreadableChildren(node: unknown): readonly unknown[] {
  const content: unknown = isRecord(node) ? node['content'] : undefined
  return Array.isArray(content) ? content : []
}

function nodeRefusal(node: unknown): string | undefined {
  if (!isRecord(node)) return `an ADF node is an object: found ${describe(node)}`
  const extra = extraKey(node, nodeKeys)
  if (extra !== undefined) return `an ADF node holds attrs, content, marks, text and type alone: found the key ${extra}`
  const type: unknown = node['type']
  if (typeof type !== 'string') return `an ADF node holds a type string: found ${'type' in node ? describe(type) : 'no type field'}`
  const attrs = 'attrs' in node ? attrsRefusal(node['attrs'], type) : undefined
  if (attrs !== undefined) return attrs
  if ('marks' in node) {
    const marks = marksRefusal(node['marks'], type)
    if (marks !== undefined) return marks
  }
  if ('text' in node && typeof node['text'] !== 'string') return `the text of ${type} is a string: found ${describe(node['text'])}`
  if ('content' in node && !Array.isArray(node['content'])) return `the content of ${type} is an array: found ${describe(node['content'])}`
  return undefined
}

function attrsRefusal(attrs: unknown, type: string): string | undefined {
  if (!isRecord(attrs)) return `the attrs of ${type} is an object: found ${describe(attrs)}`
  if (isJsonValue(attrs)) return undefined
  const key = Object.keys(attrs).find((name) => !isJsonValue(attrs[name]))
  return key === undefined ? `the attrs of ${type} is a plain object: this one is not` : `the ${key} attribute of ${type} holds JSON alone: this one holds a value that is not JSON`
}

function marksRefusal(marks: unknown, type: string): string | undefined {
  if (!Array.isArray(marks)) return `the marks of ${type} is an array: found ${describe(marks)}`
  const index = [...marks].findIndex((mark) => !isAdfMark(mark))
  return index === -1 ? undefined : `the mark at index ${index} of ${type} is not a mark: a mark holds a string type and JSON attrs alone`
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

function isAttributes(value: unknown): value is AdfAttributes {
  return isRecord(value) && isJsonValue(value)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function notADocument(message: string): Result<never> {
  return failure('not-an-adf-document', message, [])
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

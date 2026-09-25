import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from './document.ts'
import type { JsonValue } from '../json-value.ts'
import { nodeAttrs, nodeContent, nodeMarks } from './document.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

type JsonContainer = JsonValue[] | { [key: string]: JsonValue }

type NodeHolder = { content?: AdfNode[] }

export function sameMark(candidate: AdfMark, mark: AdfMark): boolean {
  return markKey(candidate) === markKey(mark)
}

export function mergeAdjacentText(nodes: readonly AdfNode[]): AdfNode[] {
  const merged: AdfNode[] = []
  for (const node of nodes) {
    const previous = merged[merged.length - 1]
    if (previous !== undefined && mergesText(previous) && mergesText(node) && sameMarks(previous, node)) {
      merged[merged.length - 1] = { ...previous, text: `${previous.text ?? ''}${node.text ?? ''}` }
      continue
    }
    merged.push(node)
  }
  return merged
}

export function toEditorNormal(document: AdfDocument): AdfDocument {
  const normal: AdfDocument = { type: document.type, version: Object.is(document.version, -0) ? 0 : document.version }
  const pending: { holder: NodeHolder; source: NodeHolder }[] = [{ holder: normal, source: document }]
  for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
    const content = mergeAdjacentText(nodeContent(entry.source))
    if (content.length === 0) continue
    entry.holder.content = content.map((source) => {
      const holder = normalNode(source)
      pending.push({ holder, source })
      return holder
    })
  }
  return normal
}

function normalNode(node: AdfNode): AdfNode {
  const normal: AdfNode = { type: node.type }
  const attrs = normalAttributes(nodeAttrs(node))
  if (attrs !== undefined) normal.attrs = attrs
  const marks = nodeMarks(node).map(normalMark)
  if (marks.length > 0) normal.marks = marks
  if (node.text !== undefined) normal.text = node.text
  return normal
}

function normalMark(mark: AdfMark): AdfMark {
  const attrs = normalAttributes(nodeAttrs(mark))
  return attrs === undefined ? { type: mark.type } : { attrs, type: mark.type }
}

function normalAttributes(attrs: AdfAttributes): AdfAttributes | undefined {
  if (Object.keys(attrs).length === 0) return undefined
  const normal = { ...attrs }
  const pending: JsonContainer[] = [normal]
  for (let held = pending.pop(); held !== undefined; held = pending.pop()) {
    if (Array.isArray(held)) for (const [index, value] of held.entries()) held[index] = normalValue(value, pending)
    else for (const [key, value] of Object.entries(held)) held[key] = normalValue(value, pending)
  }
  return normal
}

function normalValue(value: JsonValue, pending: JsonContainer[]): JsonValue {
  if (Object.is(value, -0)) return 0
  if (value === null || typeof value !== 'object') return value
  const copy = Array.isArray(value) ? [...value] : { ...value }
  pending.push(copy)
  return copy
}

function mergesText(node: AdfNode): boolean {
  return node.type === 'text' && Object.keys(nodeAttrs(node)).length === 0
}

export function sameMarks(previous: AdfNode, node: AdfNode): boolean {
  return marksKey(nodeMarks(previous)) === marksKey(nodeMarks(node))
}

function marksKey(marks: readonly AdfMark[]): string {
  return marks.map(markKey).join('\n')
}

function markKey(mark: AdfMark): string {
  return `${mark.type} ${serializeCanonicalJson(nodeAttrs(mark), 'compact')}`
}

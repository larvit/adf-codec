import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import { mergedTextRuns, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { joinsWhenRead } from '../adjacent-text.ts'

type JsonContainer = JsonValue[] | { [key: string]: JsonValue }

type NodeHolder = { content?: AdfNode[] }

// Each editor-normal node's index among its siblings in the document it was normalized from.
export type SourceIndexes = ReadonlyMap<AdfNode, number>

// The editor joins two text nodes where the reader would join their editor-normal forms.
export function joinsWhenEditorNormal(previous: AdfNode, node: AdfNode): boolean {
  if (previous.type !== 'text' || node.type !== 'text') return false
  return joinsWhenRead(normalNode(previous), normalNode(node))
}

export function toEditorNormal(document: AdfDocument): AdfDocument {
  return editorNormalForm(document).normal
}

export function editorNormalForm(document: AdfDocument): { normal: AdfDocument; sources: SourceIndexes } {
  const normal: AdfDocument = { type: document.type, version: Object.is(document.version, -0) ? 0 : document.version }
  const sources = new Map<AdfNode, number>()
  const pending: { holder: NodeHolder; source: NodeHolder }[] = [{ holder: normal, source: document }]
  for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
    const content = mergedTextRuns(nodeContent(entry.source), joinsWhenEditorNormal)
    if (content.length === 0) continue
    entry.holder.content = content.map(({ first, node: source }) => {
      const holder = normalNode(source)
      sources.set(holder, first)
      // Atlassian's schema forbids content on a text node, so the editor drops it.
      if (source.type !== 'text') pending.push({ holder, source })
      return holder
    })
  }
  // ADF's schema requires content on doc, so an empty one stays.
  if (document.content !== undefined && normal.content === undefined) normal.content = []
  return { normal, sources }
}

// A node's index in a list of siblings, or in a list of one, counted in the document the siblings were normalized from.
export function sourceIndex(nodes: readonly AdfNode[], index: number, sources: SourceIndexes): number {
  const first = nodes[0]
  const node = nodes[index]
  const from = first === undefined ? undefined : sources.get(first)
  const at = node === undefined ? undefined : sources.get(node)
  return from === undefined || at === undefined ? index : at - from
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

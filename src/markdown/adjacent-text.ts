import type { AdfAttributes, AdfMark, AdfNode } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import { identicalMark, identicalMarks, isPlainText, nodeAttrs, nodeMarks } from '../adf/document.ts'
import { spellInlineLeafDirective } from './directive-syntax.ts'

type JsonContainer = JsonValue[] | { [key: string]: JsonValue }

export const textBreakName = 'textBreak'

export const textBreakSpelling = spellInlineLeafDirective(textBreakName, '')

// The lossless reader's rule: CommonMark reads the pair back as one text run (spec/flavour.md, Inline nodes).
export function joinsWhenRead(previous: AdfNode, node: AdfNode): boolean {
  return isPlainText(previous) && isPlainText(node) && identicalMarks(nodeMarks(previous), nodeMarks(node))
}

// The editor's rule, differing from the reader's only on shapes editor-normal ADF erases: an empty attrs, content or marks, and -0 in a mark.
export function joinsWhenEditorNormal(previous: AdfNode, node: AdfNode): boolean {
  if (!joinsAsEditorText(previous) || !joinsAsEditorText(node)) return false
  return identicalMarks(nodeMarks(previous).map(normalMark), nodeMarks(node).map(normalMark))
}

export function sameMarkWhenEditorNormal(left: AdfMark, right: AdfMark): boolean {
  return identicalMark(normalMark(left), normalMark(right))
}

export function normalMark(mark: AdfMark): AdfMark {
  const attrs = normalAttributes(nodeAttrs(mark))
  return attrs === undefined ? { type: mark.type } : { attrs, type: mark.type }
}

export function normalAttributes(attrs: AdfAttributes): AdfAttributes | undefined {
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

function joinsAsEditorText(node: AdfNode): boolean {
  return node.type === 'text' && Object.keys(nodeAttrs(node)).length === 0
}

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { joinsWhenEditorNormal, normalAttributes, normalMark } from '../adjacent-text.ts'
import { mergeAdjacentText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'

type NodeHolder = { content?: AdfNode[] }

export function toEditorNormal(document: AdfDocument): AdfDocument {
  const normal: AdfDocument = { type: document.type, version: Object.is(document.version, -0) ? 0 : document.version }
  const pending: { holder: NodeHolder; source: NodeHolder }[] = [{ holder: normal, source: document }]
  for (let entry = pending.pop(); entry !== undefined; entry = pending.pop()) {
    const content = mergeAdjacentText(nodeContent(entry.source), joinsWhenEditorNormal)
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

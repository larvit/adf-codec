import type { AdfMark, AdfNode } from './document.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export function sameMark(candidate: AdfMark, mark: AdfMark): boolean {
  return markKey(candidate) === markKey(mark)
}

// AGENTS.md §2: adjacent text nodes carrying identical marks and no attributes are one node.
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

function mergesText(node: AdfNode): boolean {
  return node.type === 'text' && Object.keys(node.attrs ?? {}).length === 0
}

function sameMarks(previous: AdfNode, node: AdfNode): boolean {
  return marksKey(previous.marks ?? []) === marksKey(node.marks ?? [])
}

function marksKey(marks: readonly AdfMark[]): string {
  return marks.map(markKey).join('\n')
}

function markKey(mark: AdfMark): string {
  return `${mark.type} ${serializeCanonicalJson(mark.attrs ?? {}, 'compact')}`
}

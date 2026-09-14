import type { AdfMark } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import { isAdfMark, nodeAttrs } from '../adf/document.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

export const marksAttribute = 'marks'

export function markValues(marks: readonly AdfMark[]): JsonValue {
  return marks.map((mark) => {
    const attrs = nodeAttrs(mark)
    return Object.keys(attrs).length === 0 ? { type: mark.type } : { attrs, type: mark.type }
  })
}

export function readMarkValues(value: JsonValue): AdfMark[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const marks: AdfMark[] = []
  for (const item of value) {
    if (!isAdfMark(item)) return undefined
    marks.push(item)
  }
  return serializeCanonicalJson(markValues(marks), 'compact') === serializeCanonicalJson(value, 'compact') ? marks : undefined
}

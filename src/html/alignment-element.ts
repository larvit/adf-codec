import type { AdfAttributes, AdfMark, AdfNode } from '../adf/document.ts'
import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { Read } from '../result.ts'
import { dataAttributes, readDataAttributes } from './data-attributes.ts'
import { nodeAttrs, nodeMarks } from '../adf/document.ts'

// The `text-align` value each alignment names.
function alignments(): ReadonlyMap<string, string> {
  return new Map([
    ['center', 'center'],
    ['end', 'right'],
  ])
}

// A paragraph's or heading's attributes: its alignment mark as a `style` attribute, then the rest as `dataAttributes` writes them; `undefined` where it holds a mark besides one alignment the style spells.
export function textBlockAttributes(node: AdfNode, vocabulary: AttributeVocabulary, written: readonly string[]): string | undefined {
  const [mark, ...others] = nodeMarks(node)
  if (mark === undefined) return dataAttributes(node, vocabulary, written)
  const attrs = nodeAttrs(mark)
  const textAlign = others.length === 0 && mark.type === 'alignment' && Object.keys(attrs).length === 1 ? alignments().get(String(attrs['align'])) : undefined
  const bare: AdfNode = { ...node }
  delete bare.marks
  const data = textAlign === undefined ? undefined : dataAttributes(bare, vocabulary, written)
  return data === undefined ? undefined : ` style="text-align:${textAlign}"${data}`
}

// The attributes and marks a paragraph's or heading's start tag holds, as `textBlockAttributes` writes them.
export function readTextBlockAttributes(pairs: readonly (readonly [string, string])[], element: string, vocabulary: AttributeVocabulary, written: readonly string[]): Read<{ attrs: AdfAttributes; marks: AdfMark[] }> {
  const [first] = pairs
  const align = first?.[0] === 'style' ? [...alignments()].find(([, textAlign]) => first[1] === `text-align:${textAlign}`)?.[0] : undefined
  if (first?.[0] === 'style' && align === undefined) return { fault: { code: 'unmappable-html', message: `style on <${element}> holds text-align:center or text-align:right` } }
  const data = readDataAttributes(align === undefined ? pairs : pairs.slice(1), element, vocabulary, written)
  if (data.fault !== undefined) return data
  return { value: { attrs: data.value, marks: align === undefined ? [] : [{ attrs: { align }, type: 'alignment' }] } }
}

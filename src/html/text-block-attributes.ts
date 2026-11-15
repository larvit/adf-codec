import type { AdfAttributes, AdfMark, AdfNode } from '../adf/document.ts'
import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { Read } from '../result.ts'
import { dataAttributes, readDataAttributes } from './data-attributes.ts'
import { nodeAttrs, nodeMarks } from '../adf/document.ts'

const alignAttribute = 'data-align'
const alignments = ['center', 'end']
const indentAttribute = 'data-indent-level'
const indentLevels = ['1', '2', '3', '4', '5', '6']

// A paragraph's or heading's attributes: its one alignment or indentation mark as the attribute that spells it, then the rest as `dataAttributes` writes them; `undefined` where it holds a second mark, or a mark that no such attribute spells.
export function textBlockAttributes(node: AdfNode, vocabulary: AttributeVocabulary, written: readonly string[]): string | undefined {
  const [mark, ...others] = nodeMarks(node)
  if (mark === undefined) return dataAttributes(node, vocabulary, written)
  const spelled = others.length === 0 ? markAttribute(mark) : undefined
  const bare: AdfNode = { ...node }
  delete bare.marks
  const data = spelled === undefined ? undefined : dataAttributes(bare, vocabulary, written)
  return data === undefined ? undefined : `${spelled}${data}`
}

function markAttribute(mark: AdfMark): string | undefined {
  const attrs = nodeAttrs(mark)
  if (Object.keys(attrs).length !== 1) return undefined
  const { align, level } = attrs
  if (mark.type === 'alignment') return typeof align === 'string' && alignments.includes(align) ? ` ${alignAttribute}="${align}"` : undefined
  return mark.type === 'indentation' && typeof level === 'number' && indentLevels.includes(String(level)) ? ` ${indentAttribute}="${level}"` : undefined
}

// The attributes and marks a paragraph's or heading's start tag holds, as `textBlockAttributes` writes them.
export function readTextBlockAttributes(pairs: readonly (readonly [string, string])[], element: string, vocabulary: AttributeVocabulary, written: readonly string[]): Read<{ attrs: AdfAttributes; marks: AdfMark[] }> {
  const [first] = pairs
  const mark = first === undefined ? undefined : readMark(first, element)
  if (mark?.fault !== undefined) return mark
  const rest = mark === undefined ? pairs : pairs.slice(1)
  if (rest.some(([name]) => name === alignAttribute || name === indentAttribute)) return { fault: { code: 'unmappable-html', message: `<${element}> takes one of ${alignAttribute} and ${indentAttribute}, first, before its data-* attributes` } }
  const data = readDataAttributes(rest, element, vocabulary, written)
  if (data.fault !== undefined) return data
  return { value: { attrs: data.value, marks: mark === undefined ? [] : [mark.value] } }
}

function readMark([name, spelled]: readonly [string, string], element: string): Read<AdfMark> | undefined {
  if (name === indentAttribute) {
    return indentLevels.includes(spelled) ? { value: { attrs: { level: Number(spelled) }, type: 'indentation' } } : { fault: { code: 'unmappable-html', message: `${indentAttribute} on <${element}> holds a whole number from 1 to 6` } }
  }
  if (name !== alignAttribute) return undefined
  return alignments.includes(spelled) ? { value: { attrs: { align: spelled }, type: 'alignment' } } : { fault: { code: 'unmappable-html', message: `${alignAttribute} on <${element}> holds center or end` } }
}

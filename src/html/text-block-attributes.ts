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

const indentAttribute = 'data-indent-level'
const indentLevels = ['1', '2', '3', '4', '5', '6']

// A paragraph's or heading's attributes: its one alignment or indentation mark as the attribute that spells it, then the rest as `dataAttributes` writes them; `undefined` where it holds a mark the attribute does not spell, or a second one.
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
  const textAlign = [...alignments()].find(([name]) => name === align)?.[1]
  if (mark.type === 'alignment') return textAlign === undefined ? undefined : ` style="text-align:${textAlign}"`
  return mark.type === 'indentation' && typeof level === 'number' && indentLevels.includes(String(level)) ? ` ${indentAttribute}="${level}"` : undefined
}

// The attributes and marks a paragraph's or heading's start tag holds, as `textBlockAttributes` writes them.
export function readTextBlockAttributes(pairs: readonly (readonly [string, string])[], element: string, vocabulary: AttributeVocabulary, written: readonly string[]): Read<{ attrs: AdfAttributes; marks: AdfMark[] }> {
  const [first] = pairs
  const mark = first === undefined ? undefined : readMark(first, element)
  if (mark?.fault !== undefined) return mark
  const data = readDataAttributes(mark === undefined ? pairs : pairs.slice(1), element, vocabulary, written)
  if (data.fault !== undefined) return data
  return { value: { attrs: data.value, marks: mark === undefined ? [] : [mark.value] } }
}

function readMark([name, spelled]: readonly [string, string], element: string): Read<AdfMark> | undefined {
  if (name === indentAttribute) {
    return indentLevels.includes(spelled) ? { value: { attrs: { level: Number(spelled) }, type: 'indentation' } } : { fault: { code: 'unmappable-html', message: `${indentAttribute} on <${element}> holds a whole number from 1 to 6` } }
  }
  if (name !== 'style') return undefined
  const align = [...alignments()].find(([, textAlign]) => spelled === `text-align:${textAlign}`)?.[0]
  return align === undefined ? { fault: { code: 'unmappable-html', message: `style on <${element}> holds text-align:center or text-align:right` } } : { value: { attrs: { align }, type: 'alignment' } }
}

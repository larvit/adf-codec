import type { AdfMark } from '../adf/document.ts'
import type { BlockType } from '../adf/block-nodes.ts'
import type { JsonValue } from '../json-value.ts'
import { blockNodeModel } from '../adf/block-nodes.ts'
import { isAdfMark } from '../adf/document.ts'
import { markVocabularies } from '../adf/mark-attributes.ts'
import { overNested } from '../json-value.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'
import { spellAttributes, spellDirectiveOpener, spellJsonAttribute, spellStringAttribute } from './directive-syntax.ts'
import { spellMarkVocabulary } from './mark-spellings.ts'

const argumentByType = new Map(
  Object.entries({
    blockTaskItem: 'state',
    panel: 'panelType',
    taskItem: 'state',
  } satisfies Partial<Record<BlockType, string>>),
)

export const documentName = 'doc'

// spec/flavour.md, Directives: a document holding no content key, which the empty string cannot spell.
export const documentAttribute = { key: 'content', value: 'none' }

export const documentSpelling = spellDirectiveOpener(documentName, undefined, spellAttributes([[documentAttribute.key, documentAttribute.value]]))

export const marksAttribute = 'marks'

export function blockArgument(type: string): string | undefined {
  return argumentByType.get(type)
}

export function blockDirectiveForm(name: string): 'container' | 'leaf' | undefined {
  if (name === documentName) return 'leaf'
  const model = blockNodeModel(name)
  if (model === undefined) return undefined
  return model.contentModel === 'none' ? 'leaf' : 'container'
}

export function markValues(marks: readonly AdfMark[]): JsonValue {
  return marks.map((mark) => (mark.attrs === undefined ? { type: mark.type } : { attrs: mark.attrs, type: mark.type }))
}

// `undefined` where the JSON array nests past largestNesting.
export function spellBlockMarks(marks: readonly AdfMark[]): string | undefined {
  const named: string[] = []
  for (const mark of marks) {
    const vocabulary = markVocabularies.get(mark.type)
    const attributes = vocabulary === undefined ? undefined : spellMarkVocabulary(mark, vocabulary)
    if (attributes === undefined) return overNested(markValues(marks)) ? undefined : spellJsonAttribute(markValues(marks))
    named.push(`${mark.type}${attributes}`)
  }
  return spellStringAttribute(named.join(' '))
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

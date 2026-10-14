import type { AdfMark } from '../adf/document.ts'
import type { BlockType } from '../adf/block-nodes.ts'
import type { JsonValue } from '../json-value.ts'
import { blockNodeModel } from '../adf/block-nodes.ts'
import { isAdfMark, nodeAttrs } from '../adf/document.ts'
import { markVocabulary } from '../adf/mark-attributes.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'
import { spellAttributes, spellDirectiveOpener, spellJsonAttribute, spellStringAttribute, spellVocabulary } from './directive-syntax.ts'
import { spellEmptyKeys } from './empty-keys.ts'
import { vocabularyPairs } from '../adf/attribute-vocabulary.ts'

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

// spec/flavour.md, Block nodes: each mark by name, else the whole array as JSON where one mark's type or attrs no table types.
export function spellBlockMarks(marks: readonly AdfMark[]): string {
  const named: string[] = []
  for (const mark of marks) {
    const vocabulary = markVocabulary(mark.type)
    const pairs = vocabulary === undefined ? undefined : vocabularyPairs(nodeAttrs(mark), vocabulary, [])
    if (pairs === undefined) return spellJsonAttribute(markValues(marks))
    named.push(`${mark.type}${spellAttributes([...spellVocabulary(pairs), ...spellEmptyKeys(mark)])}`)
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

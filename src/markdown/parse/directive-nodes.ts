import type { AdfAttributes, AdfMark, AdfNode, EmptyKey } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import type { ConvertFault } from '../../result.ts'
import type { DirectiveAttributes, DirectiveValue } from '../directive-syntax.ts'
import type { Elsewhere } from './directive-attributes.ts'
import { attributeNestingMessage, isUnmarkedSpellableText } from '../../adf/document.ts'
import { attributeValue, directiveEscape, directivePrefix, readAttributes, readDirectiveName, unknownDirectiveFault } from '../directive-syntax.ts'
import { blockArgument, blockDirectiveForm, marksAttribute, readMarkValues, spellBlockMarks } from '../block-directive.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { carryFencePrefix, carryName } from '../opaque-carry.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { inlineMarkSpellingFault, readMarkAttributes } from './directive-marks.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { markVocabularies } from '../../adf/mark-attributes.ts'
import { readEmptyKeys, spellsEmpty } from '../empty-keys.ts'
import { readVocabulary } from './directive-attributes.ts'
import { slotFault } from '../directive-syntax.ts'
import { textBreakName } from '../adjacent-text.ts'
import { textDirectiveName } from '../text-directive.ts'

export type BlockDirectiveNode = { contentModel: BlockNodeModel['contentModel']; node: AdfNode }

export function readBlockDirectiveNode(
  name: string,
  argument: string | undefined,
  attributes: DirectiveAttributes,
  path: ConvertErrorPath,
): Result<BlockDirectiveNode> {
  if (name === carryName) {
    return failure('malformed-directive', `the name ${carryName} is reserved for the opaque carry, whose block form is the ${carryFencePrefix} fence`, path)
  }
  const model = blockNodeModel(name)
  if (model === undefined) return faulted(inlineSpellingFault(name) ?? unknownDirectiveFault(name), path)
  const argumentKey = blockArgument(name)
  const spelled = attributes.get(marksAttribute)
  const empty = readEmptyKeys(name, attributes, spellsEmpty(spelled) ? ['attrs', 'content', 'marks'] : ['attrs', 'content'], argument !== undefined)
  if (empty.fault !== undefined) return faulted(empty.fault, path)
  const { rest } = empty.value
  rest.delete(marksAttribute)
  const elsewhere: Elsewhere | undefined = argumentKey === undefined ? undefined : { key: argumentKey, slot: 'argument' }
  const attrs = readVocabulary(name, rest, model.attributes, elsewhere, path)
  if (!attrs.ok) return attrs
  if (argument !== undefined) {
    if (argumentKey === undefined) return failure('unsupported-node-shape', `${name} takes no argument: this one spells one`, path)
    attrs.value[argumentKey] = argument
  }
  const marks: Result<AdfMark[] | undefined> = spelled === undefined || spellsEmpty(spelled) ? success(undefined) : readMarks(name, spelled, path)
  if (!marks.ok) return marks
  return success({ contentModel: model.contentModel, node: namedNode(name, attrs.value, marks.value, empty.value.empty) })
}

export function readInlineDirectiveNode(
  name: string,
  attributes: DirectiveAttributes,
  content: readonly AdfNode[] | undefined,
  path: ConvertErrorPath,
): Result<AdfNode> {
  const model = inlineNodeModel(name)
  if (model === undefined) return faulted(blockSpellingFault(name) ?? unknownDirectiveFault(name), path)
  const slot = model.textAttribute
  if (slot === undefined && content !== undefined) return failure('unsupported-node-shape', `${name} takes no content: this one holds some`, path)
  const elsewhere: Elsewhere | undefined = slot === undefined ? undefined : { key: slot, slot: 'content' }
  const empty = readEmptyKeys(name, attributes, ['attrs', 'content', 'marks'], slot !== undefined && content !== undefined)
  if (empty.fault !== undefined) return faulted(empty.fault, path)
  const attrs = readVocabulary(name, empty.value.rest, model.attributes, elsewhere, path)
  if (!attrs.ok) return attrs
  if (slot !== undefined && content !== undefined) {
    const text = slotText(content)
    if (text === undefined) {
      return failure('unsupported-node-shape', `the ${name} content slot holds one text node carrying neither marks, attributes nor content: this one holds something else`, path)
    }
    const fault = slotFault(name, text)
    if (fault !== undefined) return faulted(fault, path)
    attrs.value[slot] = text
  }
  return success(namedNode(name, attrs.value, undefined, empty.value.empty))
}

// A name the other position spells names that spelling, never the code a later MINOR may fill (docs/decisions.md §Which code a cause takes).
function inlineSpellingFault(name: string): ConvertFault | undefined {
  const mark = inlineMarkSpellingFault(name)
  if (mark !== undefined) return mark
  if (inlineNodeModel(name) === undefined && name !== textDirectiveName && name !== textBreakName) return undefined
  return { code: 'unsupported-node-shape', message: `${name} takes the inline form, ${directivePrefix}${name}{…}, never the block form` }
}

function blockSpellingFault(name: string): ConvertFault | undefined {
  if (blockDirectiveForm(name) === undefined) return undefined
  return { code: 'unsupported-node-shape', message: `${name} takes the block form, ${directivePrefix}${name}, never the inline form` }
}

// spec/flavour.md, Inline nodes: the slot is plain text, its adjacent nodes already merged.
function slotText(content: readonly AdfNode[]): string | undefined {
  if (content.length === 0) return ''
  const only = content.length === 1 ? content[0] : undefined
  if (only === undefined || !isUnmarkedSpellableText(only) || typeof only.text !== 'string') return undefined
  return only.text
}

function readMarks(type: string, spelled: DirectiveValue, path: ConvertErrorPath): Result<AdfMark[]> {
  const marks = spelled.decoded.startsWith('[') ? readMarkArray(type, spelled.decoded, path) : readNamedMarks(type, spelled.decoded, path)
  if (!marks.ok) return marks
  const spelling = spellBlockMarks(marks.value)
  return spelling === spelled.spelling ? marks : failure('unsupported-node-shape', `${type} spells its ${marksAttribute} attribute as ${marksAttribute}=${spelling}`, path)
}

function readMarkArray(type: string, text: string, path: ConvertErrorPath): Result<AdfMark[]> {
  const read = attributeValue(text, 'json')
  if (read.refusal === 'nesting') return failure('unsupported-nesting-depth', attributeNestingMessage(marksAttribute, type), path)
  const marks = read.value === undefined ? undefined : readMarkValues(read.value.value)
  if (marks === undefined) {
    return failure('unsupported-node-shape', `the ${marksAttribute} attribute of ${type} is its marks array in canonical JSON: this one is not`, path)
  }
  return success(marks)
}

function readNamedMarks(type: string, text: string, path: ConvertErrorPath): Result<AdfMark[]> {
  const marks: AdfMark[] = []
  let cursor = 0
  for (;;) {
    const mark = readNamedMark(type, text, cursor, path)
    if (!mark.ok) return mark
    marks.push(mark.value.mark)
    cursor = mark.value.end
    if (cursor === text.length) return success(marks)
    if (text.charAt(cursor) !== ' ') return failure('unsupported-node-shape', unnamedMarks(type), path)
    cursor += 1
  }
}

function readNamedMark(type: string, text: string, index: number, path: ConvertErrorPath): Result<{ end: number; mark: AdfMark }> {
  const name = readDirectiveName(text, index)
  if (name === undefined) return failure('unsupported-node-shape', unnamedMarks(type), path)
  const vocabulary = markVocabularies.get(name)
  if (vocabulary === undefined) return failure('unsupported-node-shape', `the ${marksAttribute} attribute of ${type} names ${name}, no mark the flavour lists: spell an unlisted mark in the JSON array`, path)
  const start = index + name.length
  const attributes = text.charAt(start) === '{' ? readAttributes(text, start) : { value: { attributes: new Map<string, DirectiveValue>(), end: start } }
  if (attributes.fault !== undefined) {
    // A quoted value holds no directive, so the fault's escape hint does not apply.
    const cause = attributes.fault.message.replace(`; ${directiveEscape}`, '')
    return failure('unsupported-node-shape', `the ${name} mark in the ${marksAttribute} attribute of ${type}: ${cause}`, path)
  }
  const mark = readMarkAttributes(name, attributes.value.attributes, vocabulary, path)
  return mark.ok ? success({ end: attributes.value.end, mark: mark.value }) : mark
}

function unnamedMarks(type: string): string {
  return `the ${marksAttribute} attribute of ${type} names each mark with its {attrs}, one space apart: this one does not`
}

function namedNode(type: string, attrs: AdfAttributes, marks: readonly AdfMark[] | undefined, empty: ReadonlySet<EmptyKey>): AdfNode {
  const node: AdfNode = Object.keys(attrs).length > 0 || empty.has('attrs') ? { attrs, type } : { type }
  if (empty.has('content')) node.content = []
  if (marks !== undefined || empty.has('marks')) node.marks = [...(marks ?? [])]
  return node
}

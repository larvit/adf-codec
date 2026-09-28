import type { AdfAttributes, AdfMark, AdfNode } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import type { ConvertFault } from '../../result.ts'
import type { DirectiveAttributes, DirectiveValue } from '../directive-syntax.ts'
import type { Elsewhere } from './directive-attributes.ts'
import { attributeNestingMessage, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { attributeValue, directivePrefix, spellAttributeValue, unknownDirectiveFault } from '../directive-syntax.ts'
import { blockArgument, blockDirectiveForm, marksAttribute, readMarkValues } from '../block-directive.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { carryName } from '../opaque-carry.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { inlineMarkSpellingFault } from './directive-marks.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { readVocabulary } from './directive-attributes.ts'
import { slotLineEndingFault } from '../directive-syntax.ts'
import { textDirectiveName } from '../text-directive.ts'

export type BlockDirectiveNode = { contentModel: BlockNodeModel['contentModel']; node: AdfNode }

export function readBlockDirectiveNode(
  name: string,
  argument: string | undefined,
  attributes: DirectiveAttributes,
  path: ConvertErrorPath,
): Result<BlockDirectiveNode> {
  if (name === carryName) {
    return failure('malformed-directive', `the name ${carryName} is reserved for the opaque carry, whose block form is the ${carryName} fence`, path)
  }
  const model = blockNodeModel(name)
  if (model === undefined) return faulted(inlineSpellingFault(name) ?? unknownDirectiveFault(name), path)
  const argumentKey = blockArgument(name)
  const rest = new Map(attributes)
  rest.delete(marksAttribute)
  const elsewhere: Elsewhere | undefined = argumentKey === undefined ? undefined : { key: argumentKey, slot: 'argument' }
  const attrs = readVocabulary(name, rest, model.attributes, elsewhere, path)
  if (!attrs.ok) return attrs
  if (argument !== undefined) {
    if (argumentKey === undefined) return failure('unsupported-node-shape', `${name} takes no argument: this one spells one`, path)
    attrs.value[argumentKey] = argument
  }
  const spelled = attributes.get(marksAttribute)
  const marks: Result<AdfMark[] | undefined> = spelled === undefined ? success(undefined) : readMarks(name, spelled, path)
  if (!marks.ok) return marks
  return success({ contentModel: model.contentModel, node: namedNode(name, attrs.value, marks.value) })
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
  const attrs = readVocabulary(name, attributes, model.attributes, elsewhere, path)
  if (!attrs.ok) return attrs
  if (slot !== undefined && content !== undefined) {
    const text = slotText(content)
    if (text === undefined) {
      return failure('unsupported-node-shape', `the ${name} content slot holds one text node carrying neither marks, attributes nor content: this one holds something else`, path)
    }
    const spans = slotLineEndingFault(name, text)
    if (spans !== undefined) return faulted(spans, path)
    attrs.value[slot] = text
  }
  return success(namedNode(name, attrs.value, undefined))
}

// A name the other position spells names that spelling, never the code a later MINOR may fill (docs/decisions.md §Which code a cause takes).
function inlineSpellingFault(name: string): ConvertFault | undefined {
  const mark = inlineMarkSpellingFault(name)
  if (mark !== undefined) return mark
  if (inlineNodeModel(name) === undefined && name !== textDirectiveName) return undefined
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
  if (only?.type !== 'text' || nodeMarks(only).length > 0 || Object.keys(nodeAttrs(only)).length > 0 || nodeContent(only).length > 0 || typeof only.text !== 'string') return undefined
  return only.text
}

function readMarks(type: string, spelled: DirectiveValue, path: ConvertErrorPath): Result<AdfMark[]> {
  const read = attributeValue(spelled.decoded, 'json')
  if (read.refusal === 'nesting') return failure('unsupported-nesting-depth', attributeNestingMessage(marksAttribute, type), path)
  const marks = read.value === undefined || spellAttributeValue(read.value) !== spelled.spelling ? undefined : readMarkValues(read.value.value)
  if (marks === undefined) {
    return failure('unsupported-node-shape', `the ${marksAttribute} attribute of ${type} is its marks array in canonical JSON: this one is not`, path)
  }
  return success(marks)
}

function namedNode(type: string, attrs: AdfAttributes, marks: readonly AdfMark[] | undefined): AdfNode {
  const named = Object.keys(attrs).length === 0 ? { type } : { attrs, type }
  return marks === undefined ? named : { ...named, marks: [...marks] }
}

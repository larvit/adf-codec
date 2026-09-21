import type { AdfNode } from '../../adf/document.ts'
import type { BlockNodeModel } from '../../adf/block-nodes.ts'
import { blockArgument } from '../block-directive-arguments.ts'
import { isBareToken, spellAttributes, spellDirectiveOpener, spellJsonAttribute, spellVocabulary } from '../directive-syntax.ts'
import { markValues, marksAttribute } from '../block-directive-marks.ts'
import { nodeAttrs, nodeMarks } from '../../adf/document.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

export function spellBlockDirectiveOpener(node: AdfNode, model: BlockNodeModel, spelledByBody: readonly string[] = []): string | undefined {
  const argumentAttribute = blockArgument(node.type)
  const slot = bareArgument(node, argumentAttribute)
  if (slot === undefined) return undefined
  const spelled = argumentAttribute === undefined ? spelledByBody : [argumentAttribute, ...spelledByBody]
  const pairs = vocabularyPairs(nodeAttrs(node), model.attributes, spelled)
  if (pairs === undefined) return undefined
  const spelledPairs = spellVocabulary(pairs)
  const marks = nodeMarks(node)
  if (marks.length > 0) spelledPairs.push([marksAttribute, spellJsonAttribute(markValues(marks))])
  return spellDirectiveOpener(node.type, slot.argument, spellAttributes(spelledPairs))
}

// `undefined` where the argument slot holds a value no bare token spells.
function bareArgument(node: AdfNode, argumentAttribute: string | undefined): { argument: string | undefined } | undefined {
  const value = argumentAttribute === undefined ? undefined : nodeAttrs(node)[argumentAttribute]
  if (value === undefined) return { argument: undefined }
  return typeof value === 'string' && isBareToken(value) ? { argument: value } : undefined
}

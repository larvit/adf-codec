import type { AdfNode } from '../../adf/document.ts'
import type { BlockDirective } from '../../adf/block-directives.ts'
import { blockArgument } from '../block-directive-arguments.ts'
import { isBareToken, spellAttributes, spellJsonAttribute, spellVocabulary } from '../directive-syntax.ts'
import { markValues, marksAttribute } from '../block-directive-marks.ts'
import { nodeAttrs, nodeMarks } from '../../adf/document.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

export function spellDirectiveHeader(node: AdfNode, directive: BlockDirective, spelledByBody: readonly string[] = []): string | undefined {
  const argumentAttribute = blockArgument(node.type)
  const argument = spellArgument(node, argumentAttribute)
  if (argument === undefined) return undefined
  const spelled = argumentAttribute === undefined ? spelledByBody : [argumentAttribute, ...spelledByBody]
  const pairs = vocabularyPairs(nodeAttrs(node), directive.attributes, spelled)
  if (pairs === undefined) return undefined
  const spelledPairs = spellVocabulary(pairs)
  const marks = nodeMarks(node)
  if (marks.length > 0) spelledPairs.push([marksAttribute, spellJsonAttribute(markValues(marks))])
  const attributes = spellAttributes(spelledPairs)
  return `${node.type}${argument}${attributes === '' ? '' : ` ${attributes}`}`
}

function spellArgument(node: AdfNode, argumentAttribute: string | undefined): string | undefined {
  const value = argumentAttribute === undefined ? undefined : nodeAttrs(node)[argumentAttribute]
  if (value === undefined) return ''
  if (typeof value !== 'string' || !isBareToken(value)) return undefined
  return ` ${value}`
}

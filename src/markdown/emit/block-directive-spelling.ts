import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { BlockDirective } from '../../adf/block-directives.ts'
import type { JsonValue } from '../../json-value.ts'
import { blockArgument } from '../block-directive-arguments.ts'
import { isBareToken, spellAttributes, spellJsonAttribute, spellVocabulary } from '../directive-attributes.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

export function spellDirectiveHeader(node: AdfNode, directive: BlockDirective, spelledByBody: readonly string[] = []): string | undefined {
  const argumentAttribute = blockArgument(node.type)
  const argument = spellArgument(node, argumentAttribute)
  if (argument === undefined) return undefined
  const spelled = argumentAttribute === undefined ? spelledByBody : [argumentAttribute, ...spelledByBody]
  const pairs = vocabularyPairs(node.attrs ?? {}, directive.attributes, spelled)
  if (pairs === undefined) return undefined
  const spelledPairs = spellVocabulary(pairs)
  const marks = node.marks ?? []
  if (marks.length > 0) spelledPairs.push(['marks', spellJsonAttribute(markValues(marks))])
  const attributes = spellAttributes(spelledPairs)
  return `${node.type}${argument}${attributes === '' ? '' : ` ${attributes}`}`
}

function spellArgument(node: AdfNode, argumentAttribute: string | undefined): string | undefined {
  const value = argumentAttribute === undefined ? undefined : node.attrs?.[argumentAttribute]
  if (value === undefined) return ''
  if (typeof value !== 'string' || !isBareToken(value)) return undefined
  return ` ${value}`
}

function markValues(marks: readonly AdfMark[]): JsonValue {
  return marks.map((mark) => {
    const attrs = mark.attrs ?? {}
    return Object.keys(attrs).length === 0 ? { type: mark.type } : { attrs, type: mark.type }
  })
}

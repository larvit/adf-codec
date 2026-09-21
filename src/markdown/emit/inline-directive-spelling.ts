import type { AdfNode } from '../../adf/document.ts'
import type { InlineNode } from '../../adf/inline-nodes.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { spellAttributes, spellVocabulary } from '../directive-syntax.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

export function spellInlineNodeAttributes(node: AdfNode, inlineNode: InlineNode): string | undefined {
  const pairs = vocabularyPairs(nodeAttrs(node), inlineNode.attributes, inlineNode.textAttribute === undefined ? [] : [inlineNode.textAttribute])
  return pairs === undefined ? undefined : spellAttributes(spellVocabulary(pairs))
}

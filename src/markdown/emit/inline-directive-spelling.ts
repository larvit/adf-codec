import type { AdfNode } from '../../adf/document.ts'
import type { InlineNodeModel } from '../../adf/inline-nodes.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { spellAttributes, spellVocabulary } from '../directive-syntax.ts'
import { spellEmptyKeys } from '../empty-keys.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

export function spellInlineNodeAttributes(node: AdfNode, model: InlineNodeModel): string | undefined {
  const pairs = vocabularyPairs(nodeAttrs(node), model.attributes, model.textAttribute === undefined ? [] : [model.textAttribute])
  return pairs === undefined ? undefined : spellAttributes([...spellVocabulary(pairs), ...spellEmptyKeys(node)])
}

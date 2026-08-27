import type { AdfNode } from '../../adf/document.ts'
import type { InlineDirective } from '../../adf/inline-directives.ts'
import { spellAttributes, spellVocabulary } from '../directive-attributes.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

export function spellInlineNodeAttributes(node: AdfNode, directive: InlineDirective): string | undefined {
  const pairs = vocabularyPairs(node.attrs ?? {}, directive.attributes, directive.textAttribute === undefined ? [] : [directive.textAttribute])
  return pairs === undefined ? undefined : spellAttributes(spellVocabulary(pairs))
}

import type { AdfNode } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import { holdsOnlyAttributes, nodeAttrs } from '../../adf/document.ts'
import { optionalAttribute } from './escaping.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { vocabularyPairs } from '../../adf/attribute-vocabulary.ts'

// The attributes a node holds besides those its element writes, as `data-*` attributes sorted by key, a value that is no string as JSON; `undefined` where the node holds what no attribute writes: a mark, text, an empty key, or an attribute the vocabulary does not hold as that kind (docs/decisions.md §The HTML dialect).
export function dataAttributes(node: AdfNode, vocabulary: AttributeVocabulary, written: readonly string[]): string | undefined {
  if (!holdsOnlyAttributes(node, Object.keys(vocabulary))) return undefined
  const pairs = vocabularyPairs(nodeAttrs(node), vocabulary, written)
  if (pairs === undefined) return undefined
  let attributes = ''
  for (const { key, kind, value } of pairs.sort((left, right) => (left.key < right.key ? -1 : 1))) {
    const attribute = optionalAttribute(`data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, kind === 'string' ? value : serializeCanonicalJson(value, 'compact'))
    if (attribute === undefined) return undefined
    attributes += attribute
  }
  return attributes
}

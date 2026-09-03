import type { AdfAttributes } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { DirectiveAttributes } from '../directive-syntax.ts'
import { attributeValue, spellAttributeValue } from '../directive-syntax.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'

export type Elsewhere = { key: string; slot: 'argument' | 'content' }

export function readVocabulary(
  type: string,
  attributes: DirectiveAttributes,
  vocabulary: AttributeVocabulary,
  elsewhere: Elsewhere | undefined,
  path: ConvertErrorPath,
): Result<AdfAttributes> {
  const attrs: AdfAttributes = {}
  for (const [key, spelled] of attributes) {
    if (key === elsewhere?.key) {
      const place = elsewhere.slot === 'argument' ? 'as the directive argument' : 'in the content slot'
      return failure('unsupported-node-shape', `${type} spells its ${key} attribute ${place}, never in {attrs}`, path)
    }
    const kind = Object.hasOwn(vocabulary, key) ? vocabulary[key] : undefined
    if (kind === undefined) return failure('unsupported-node-shape', `${type} holds no ${key} attribute: this one spells it`, path)
    const read = attributeValue(spelled.decoded, kind)
    if (read === undefined) return failure('unsupported-node-shape', `the ${key} attribute of ${type} is no ${kind}`, path)
    const spelling = spellAttributeValue(read)
    if (spelling !== spelled.spelling) return failure('unsupported-node-shape', `${type} spells its ${key} attribute as ${key}=${spelling}`, path)
    attrs[key] = read.value
  }
  return success(attrs)
}

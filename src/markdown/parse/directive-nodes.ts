import type { AdfAttributes, AdfMark, AdfNode } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { BlockDirective } from '../../adf/block-directives.ts'
import type { DirectiveAttributes, DirectiveSpan, DirectiveValue } from '../directive-syntax.ts'
import { attributeValue, spellAttributeValue, unknownDirectiveFault } from '../directive-syntax.ts'
import { blockArgument } from '../block-directive-arguments.ts'
import { blockDirective } from '../../adf/block-directives.ts'
import { carryName } from '../opaque-carry.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { inlineDirective } from '../../adf/inline-directives.ts'
import { marksAttribute, readMarkValues } from '../block-directive-marks.ts'

export type BlockDirectiveNode = { contentModel: BlockDirective['contentModel']; node: AdfNode }

type Elsewhere = { key: string; slot: 'argument' | 'content' }

export function readBlockDirectiveNode(
  name: string,
  argument: string | undefined,
  attributes: DirectiveAttributes,
  path: ConvertErrorPath,
): Result<BlockDirectiveNode> {
  if (name === carryName) {
    return failure('malformed-directive', `the name ${carryName} is reserved for the opaque carry, whose block form is the fence`, path)
  }
  const directive = blockDirective(name)
  if (directive === undefined) return faulted(unknownDirectiveFault(name), path)
  const argumentKey = blockArgument(name)
  const rest = new Map(attributes)
  rest.delete(marksAttribute)
  const elsewhere: Elsewhere | undefined = argumentKey === undefined ? undefined : { key: argumentKey, slot: 'argument' }
  const attrs = readVocabulary(name, rest, directive.attributes, elsewhere, path)
  if (!attrs.ok) return attrs
  if (argument !== undefined) {
    if (argumentKey === undefined) return failure('unsupported-node-shape', `${name} takes no argument`, path)
    attrs.value[argumentKey] = argument
  }
  const spelled = attributes.get(marksAttribute)
  const marks: Result<AdfMark[] | undefined> = spelled === undefined ? success(undefined) : readMarks(name, spelled, path)
  if (!marks.ok) return marks
  return success({ contentModel: directive.contentModel, node: namedNode(name, attrs.value, marks.value) })
}

export function readInlineDirectiveNode(span: DirectiveSpan, path: ConvertErrorPath): Result<AdfNode> {
  const directive = inlineDirective(span.name)
  if (directive === undefined) return faulted(unknownDirectiveFault(span.name), path)
  const slot = directive.textAttribute
  if (span.content !== undefined) {
    const message = slot === undefined ? `${span.name} takes no content` : `the content slot ${span.name} spells its ${slot} attribute in is unsupported`
    return failure('unsupported-node-shape', message, path)
  }
  const elsewhere: Elsewhere | undefined = slot === undefined ? undefined : { key: slot, slot: 'content' }
  const attrs = readVocabulary(span.name, span.attributes, directive.attributes, elsewhere, path)
  if (!attrs.ok) return attrs
  return success(namedNode(span.name, attrs.value, undefined))
}

function readVocabulary(
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
      return failure('unsupported-node-shape', `${type} spells its ${key} attribute ${place}`, path)
    }
    const kind = Object.hasOwn(vocabulary, key) ? vocabulary[key] : undefined
    if (kind === undefined) return failure('unsupported-node-shape', `${type} holds no ${key} attribute`, path)
    const read = attributeValue(spelled.decoded, kind)
    if (read === undefined) return failure('unsupported-node-shape', `the ${key} attribute of ${type} is no ${kind}`, path)
    const spelling = spellAttributeValue(read)
    if (spelling !== spelled.spelling) return failure('unsupported-node-shape', `${type} spells its ${key} attribute as ${key}=${spelling}`, path)
    attrs[key] = read.value
  }
  return success(attrs)
}

function readMarks(type: string, spelled: DirectiveValue, path: ConvertErrorPath): Result<AdfMark[]> {
  const read = attributeValue(spelled.decoded, 'json')
  const marks = read === undefined || spellAttributeValue(read) !== spelled.spelling ? undefined : readMarkValues(read.value)
  if (marks === undefined) {
    return failure('unsupported-node-shape', `the ${marksAttribute} attribute of ${type} is its marks array in canonical JSON`, path)
  }
  return success(marks)
}

function namedNode(type: string, attrs: AdfAttributes, marks: readonly AdfMark[] | undefined): AdfNode {
  const named = Object.keys(attrs).length === 0 ? { type } : { attrs, type }
  return marks === undefined ? named : { ...named, marks: [...marks] }
}

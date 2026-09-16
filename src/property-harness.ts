import fc from 'fast-check'
import assert from 'node:assert/strict'
import { env } from 'node:process'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from './adf/document.ts'
import type { Arbitrary } from 'fast-check'
import type { AttributeKind, AttributeVocabulary } from './adf/attribute-vocabulary.ts'
import type { JsonValue } from './json-value.ts'
import { blockArgument } from './markdown/block-directive-arguments.ts'
import { blockDirectives } from './adf/block-directives.ts'
import { directivePrefix } from './markdown/directive-syntax.ts'
import { inlineDirectives } from './adf/inline-directives.ts'
import { markAttributes } from './adf/mark-attributes.ts'
import { toEditorNormal } from './adf/editor-normal.ts'

type Positions = { block: AdfNode; inline: AdfNode }

const deepRunsVariable = 'PROPERTY_RUNS'
const gateSeed = 20260914
// Bun's test runner stops a test after five seconds unless the test sets its own timeout.
export const propertyTimeout = 600000

const depthIdentifier = fc.createDepthIdentifier()
const emptyCell: AdfNode = { content: [{ type: 'paragraph' }], type: 'tableCell' }
const flatCommonMarkShapeWeight = 4
export const markdownPieces = fc.constantFrom(...'aZ09 \t\n!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~é\xa0🎉', 'ab:', 'http://', directivePrefix, `${directivePrefix}a[`, `${directivePrefix}a{`)
const nestingCommonMarkShapeWeight = 21
const spelledTypes = new Set(['text', ...Object.keys(blockDirectives), ...Object.keys(inlineDirectives), ...Object.keys(markAttributes)])

export function textOf(minLength: number): Arbitrary<string> {
  return fc.oneof(
    { arbitrary: fc.string({ maxLength: 12, minLength, unit: markdownPieces }), weight: 4 },
    { arbitrary: fc.string({ maxLength: 6, minLength, unit: 'grapheme' }), weight: 1 },
  )
}

const text = textOf(1)
const unknownType = fc.oneof(fc.stringMatching(/^[a-z][A-Za-z0-9]{0,7}$/), text).filter((type) => !spelledTypes.has(type))
const numberValue = fc.oneof({ arbitrary: fc.integer({ max: 10, min: -1 }), weight: 3 }, { arbitrary: fc.double({ noDefaultInfinity: true, noNaN: true }), weight: 1 })

// V8's JSON.parse returns a wrong key after parsing a key holding an escaped backslash (https://issues.chromium.org/issues/521080746); Bun is unaffected.
const keyPiece = fc
  .oneof({ arbitrary: markdownPieces, weight: 4 }, { arbitrary: fc.string({ maxLength: 1, minLength: 1, unit: 'grapheme' }), weight: 1 })
  .filter((piece) => !/[\\"\x00-\x1f]/.test(piece))
export const jsonKey = fc.string({ maxLength: 8, unit: keyPiece })

export const { jsonValue } = fc.letrec<{ jsonValue: JsonValue }>((tie) => ({
  jsonValue: fc.oneof(
    { depthSize: 'small', maxDepth: 2 },
    fc.oneof(fc.constant(null), fc.boolean(), numberValue, textOf(0)),
    fc.array(tie('jsonValue'), { maxLength: 3 }),
    fc.dictionary(jsonKey, tie('jsonValue'), { maxKeys: 3, noNullPrototype: true }),
  ),
}))

const valueByKind: Readonly<Record<AttributeKind, Arbitrary<JsonValue>>> = {
  boolean: fc.boolean(),
  json: jsonValue,
  number: numberValue,
  string: textOf(0),
}

export function attributes(vocabulary: AttributeVocabulary): Arbitrary<AdfAttributes> {
  const model = Object.fromEntries(
    Object.entries(vocabulary).map(([key, kind]) => [key, fc.oneof({ arbitrary: fc.constant(undefined), weight: 2 }, { arbitrary: valueByKind[kind], weight: 1 })]),
  )
  return fc.record(model).map(heldAttributes)
}

function heldAttributes(held: Readonly<Record<string, JsonValue | undefined>>): AdfAttributes {
  const attrs: AdfAttributes = {}
  for (const [key, value] of Object.entries(held)) if (value !== undefined) attrs[key] = value
  return attrs
}

function pipeTable({ body, header }: { body: AdfNode[][]; header: AdfNode[] }): AdfNode {
  const rows = [header, ...body.map((cells) => header.map((_, index) => cells[index] ?? emptyCell))]
  return { content: rows.map((content): AdfNode => ({ content, type: 'tableRow' })), type: 'table' }
}

const mark: Arbitrary<AdfMark> = fc.oneof(
  { arbitrary: fc.oneof(...Object.entries(markAttributes).map(([type, vocabulary]) => attributes(vocabulary).map((attrs) => ({ attrs, type })))), weight: 9 },
  { arbitrary: fc.record({ attrs: fc.dictionary(jsonKey, jsonValue, { maxKeys: 2, noNullPrototype: true }), type: unknownType }), weight: 1 },
)
const marks = fc.uniqueArray(mark, { maxLength: 3, selector: (held) => held.type })

const textNode = fc.record({ marks, text }).map((held): AdfNode => ({ ...held, type: 'text' }))

const backtickRunNode = fc
  .record({ marks: fc.oneof(fc.constant<AdfMark[]>([]), fc.constant<AdfMark[]>([{ type: 'code' }]), marks), text: fc.string({ maxLength: 6, minLength: 1, unit: fc.constantFrom('`', '``', ' ', 'a') }) })
  .map((held): AdfNode => ({ ...held, type: 'text' }))

const autolinkTextNode = fc
  .record({ href: fc.tuple(fc.constantFrom('ab:', 'http://'), textOf(0)).map(([scheme, rest]) => `${scheme}${rest}`), marks })
  .map(({ href, marks: held }): AdfNode => ({ marks: [...held.filter((outer) => outer.type !== 'link'), { attrs: { href }, type: 'link' }], text: href, type: 'text' }))

const inlineNodes = Object.entries(inlineDirectives).map(([type, directive]) =>
  fc.record({ attrs: attributes(directive.attributes), marks }).map((held): AdfNode => ({ ...held, type })),
)

function weighted(arbitraries: readonly Arbitrary<AdfNode>[], weight: number): { arbitrary: Arbitrary<AdfNode>; weight: number }[] {
  return arbitraries.map((arbitrary) => ({ arbitrary, weight }))
}

const positions = fc.letrec<Positions>((tie) => {
  const blockContent = fc.array(tie('block'), { depthIdentifier, maxLength: 3 })
  const inlineContent = fc.array(tie('inline'), { depthIdentifier, maxLength: 4 })
  const contentByModel = {
    block: blockContent,
    code: fc.array(text.map((held): AdfNode => ({ text: held, type: 'text' })), { maxLength: 2 }),
    inline: inlineContent,
    none: fc.constant<AdfNode[]>([]),
  }
  const blockMarks = fc.oneof({ arbitrary: fc.constant<AdfMark[]>([]), weight: 4 }, { arbitrary: marks, weight: 1 })
  const blockNodes = Object.entries(blockDirectives).map(([type, directive]) => {
    const argument = blockArgument(type)
    const vocabulary: AttributeVocabulary = argument === undefined ? directive.attributes : { ...directive.attributes, [argument]: 'string' }
    const node = fc.record({ attrs: attributes(vocabulary), content: contentByModel[directive.contentModel], marks: blockMarks }).map((held): AdfNode => ({ ...held, type }))
    return { leaf: directive.contentModel === 'code' || directive.contentModel === 'none', node }
  })
  const unknownNode = fc
    .record({ attrs: fc.dictionary(jsonKey, jsonValue, { maxKeys: 2, noNullPrototype: true }), content: fc.array(tie('inline'), { depthIdentifier, maxLength: 2 }), marks, type: unknownType })
    .map((held): AdfNode => held)
  const leafBlocks = blockNodes.filter((entry) => entry.leaf).map((entry) => entry.node)
  const containerBlocks = blockNodes.filter((entry) => !entry.leaf).map((entry) => entry.node)
  const misplacedWeight = 7
  const paragraph = fc.oneof({ arbitrary: inlineContent, weight: 3 }, { arbitrary: fc.array(backtickRunNode, { maxLength: 4, minLength: 2 }), weight: 1 }).map((content): AdfNode => ({ content, type: 'paragraph' }))
  const cell = (type: string) => paragraph.map((held): AdfNode => ({ content: [held], type }))
  const listItems = fc.array(
    blockContent.map((content): AdfNode => ({ content, type: 'listItem' })),
    { depthIdentifier, maxLength: 3, minLength: 1 },
  )
  const flatCommonMarkShapes = [
    fc.record({ content: inlineContent, level: fc.integer({ max: 6, min: 1 }) }).map(({ content, level }): AdfNode => ({ attrs: { level }, content, type: 'heading' })),
    paragraph,
    fc.record({ body: fc.array(fc.array(cell('tableCell'), { maxLength: 3 }), { maxLength: 2 }), header: fc.array(cell('tableHeader'), { maxLength: 3, minLength: 1 }) }).map(pipeTable),
  ]
  const nestingCommonMarkShapes = [
    blockContent.map((content): AdfNode => ({ content, type: 'blockquote' })),
    listItems.map((content): AdfNode => ({ content, type: 'bulletList' })),
    fc
      .record({ content: listItems, order: fc.oneof({ arbitrary: fc.integer({ max: 3, min: 0 }), weight: 4 }, { arbitrary: fc.integer({ max: 999999999, min: 0 }), weight: 1 }) })
      .map(({ content, order }): AdfNode => ({ attrs: { order }, content, type: 'orderedList' })),
  ]
  const flatBlocks = [...weighted(leafBlocks, 2), ...weighted(flatCommonMarkShapes, flatCommonMarkShapeWeight)]
  return {
    block: fc.oneof(
      { depthIdentifier, depthSize: 'small', maxDepth: 4 },
      { arbitrary: fc.oneof(...flatBlocks), weight: flatBlocks.reduce((sum, entry) => sum + entry.weight, 0) },
      { arbitrary: fc.oneof(...containerBlocks), weight: containerBlocks.length * 2 },
      { arbitrary: fc.oneof(textNode, ...inlineNodes, unknownNode), weight: misplacedWeight },
      { arbitrary: fc.oneof(...nestingCommonMarkShapes), weight: nestingCommonMarkShapes.length * nestingCommonMarkShapeWeight },
    ),
    inline: fc.oneof(
      { depthIdentifier, depthSize: 'small', maxDepth: 4 },
      { arbitrary: textNode, weight: 12 },
      { arbitrary: autolinkTextNode, weight: 2 },
      { arbitrary: backtickRunNode, weight: 3 },
      { arbitrary: fc.oneof(...inlineNodes), weight: 7 },
      { arbitrary: fc.oneof(...blockNodes.map((entry) => entry.node), unknownNode), weight: 2 },
    ),
  }
})

export const adfDocument = fc.array(positions.block, { depthIdentifier, maxLength: 4, minLength: 1 }).map((content): AdfDocument => toEditorNormal({ content, type: 'doc', version: 1 }))

export function propertyRuns(gateRuns: number): { gate: boolean; numRuns: number; seed?: number } {
  const deepRuns = env[deepRunsVariable]
  if (deepRuns === undefined) return { gate: true, numRuns: gateRuns, seed: gateSeed }
  assert.ok(/^[1-9]\d*$/.test(deepRuns), `${deepRunsVariable} is a run count in digits, such as ${deepRunsVariable}=10000: found ${JSON.stringify(deepRuns)}`)
  return { gate: false, numRuns: Number(deepRuns) }
}

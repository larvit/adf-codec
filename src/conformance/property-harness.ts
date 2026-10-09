import assert from 'node:assert/strict'
import { env } from 'node:process'
import fc from 'fast-check'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode, EmptyKey } from '../adf/document.ts'
import type { Arbitrary } from 'fast-check'
import type { AttributeKind, AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { JsonValue } from '../json-value.ts'
import { blockArgument } from '../markdown/block-directive.ts'
import { blockNodes } from '../adf/block-nodes.ts'
import { directivePrefix } from '../markdown/directive-syntax.ts'
import { emptyKeys, mergeAdjacentText, nodeContent } from '../adf/document.ts'
import { inlineNodes } from '../adf/inline-nodes.ts'
import { joinsWhenRead } from '../markdown/adjacent-text.ts'
import { markAttributes } from '../adf/mark-attributes.ts'

type Positions = { block: AdfNode; inline: AdfNode }

const deepRunsVariable = 'PROPERTY_RUNS'
const gateSeed = 20260914
// Bun's test runner stops a test after five seconds unless the test sets its own timeout.
export const propertyTimeout = 600000

const depthIdentifier = fc.createDepthIdentifier()
const emptyCell: AdfNode = { content: [{ type: 'paragraph' }], type: 'tableCell' }
const flatCommonMarkShapeWeight = 4
export const markdownPieces = fc.constantFrom(...'aZ09 \t\n\r\0!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~é\xa0🎉日ー한𠀀', '==', '[!NOTE]', '[x]', 'ab:', 'http://', directivePrefix, `${directivePrefix}a[`, `${directivePrefix}a{`)
const nestingCommonMarkShapeWeight = 21
const spelledTypes = new Set(['text', ...Object.keys(blockNodes), ...Object.keys(inlineNodes), ...Object.keys(markAttributes)])

export function textOf(minLength: number): Arbitrary<string> {
  return fc.oneof(
    { arbitrary: fc.string({ maxLength: 12, minLength, unit: markdownPieces }), weight: 4 },
    { arbitrary: fc.string({ maxLength: 6, minLength, unit: 'grapheme' }), weight: 1 },
  )
}

const text = textOf(1)
const unknownType = fc.oneof(fc.stringMatching(/^[a-z][A-Za-z0-9]{0,7}$/), text).filter((type) => !spelledTypes.has(type))
const numberValue = fc.oneof(
  { arbitrary: fc.integer({ max: 10, min: -1 }), weight: 6 },
  { arbitrary: fc.double({ noDefaultInfinity: true, noNaN: true }), weight: 2 },
  { arbitrary: fc.constant(-0), weight: 1 },
)

const keyPiece = fc.oneof({ arbitrary: markdownPieces, weight: 4 }, { arbitrary: fc.string({ maxLength: 1, minLength: 1, unit: 'grapheme' }), weight: 1 })
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

// An empty attrs, content or marks key, and adjacent text CommonMark would read back as one, stay occasional: each takes a spelling outside CommonMark.
// The copy gives fast-check's null-prototype records the prototype a parsed node has.
function occasionallyEmpty<T extends AdfMark | AdfNode>(arbitrary: Arbitrary<T>): Arbitrary<T> {
  return fc.tuple(arbitrary, fc.nat({ max: 9 })).map(([held, roll]) => (roll === 0 ? { ...held } : withoutEmptyKeys(held)))
}

function withoutEmptyKeys<T extends AdfMark | AdfNode>(held: T): T {
  const kept: Partial<Record<EmptyKey, unknown>> & T = { ...held }
  for (const key of emptyKeys(held)) delete kept[key]
  return kept
}

function occasionallyApart(arbitrary: Arbitrary<AdfNode[]>): Arbitrary<AdfNode[]> {
  return fc.tuple(arbitrary, fc.nat({ max: 5 })).map(([nodes, roll]) => (roll === 0 ? nodes : mergeAdjacentText(nodes, joinsWhenRead)))
}

function pipeTable({ body, header }: { body: AdfNode[][]; header: AdfNode[] }): AdfNode {
  const rows = [header, ...body.map((cells) => header.map((_, index) => cells[index] ?? emptyCell))]
  return { content: rows.map((content): AdfNode => ({ content, type: 'tableRow' })), type: 'table' }
}

const mark: Arbitrary<AdfMark> = occasionallyEmpty(fc.oneof(
  { arbitrary: fc.oneof(...Object.entries(markAttributes).map(([type, vocabulary]) => attributes(vocabulary).map((attrs) => ({ attrs, type })))), weight: 9 },
  { arbitrary: attributes({ color: 'string' }).map((attrs) => ({ attrs, type: 'backgroundColor' })), weight: 2 },
  { arbitrary: fc.record({ attrs: fc.dictionary(jsonKey, jsonValue, { maxKeys: 2, noNullPrototype: true }), type: unknownType }), weight: 1 },
))
const marks = fc.uniqueArray(mark, { maxLength: 3, selector: (held) => held.type })

const textNode = occasionallyEmpty(fc.record({ marks, text: fc.oneof({ arbitrary: text, weight: 19 }, { arbitrary: fc.constant(''), weight: 1 }) }).map((held): AdfNode => ({ ...held, type: 'text' })))

const backtickRunNode = fc
  .record({ marks: fc.oneof(fc.constant<AdfMark[]>([]), fc.constant<AdfMark[]>([{ type: 'code' }]), marks), text: fc.string({ maxLength: 6, minLength: 1, unit: fc.constantFrom('`', '``', ' ', 'a') }) })
  .map((held): AdfNode => ({ ...held, type: 'text' }))

const autolinkTextNode = fc
  .record({ href: fc.tuple(fc.constantFrom('ab:', 'http://'), textOf(0)).map(([scheme, rest]) => `${scheme}${rest}`), marks })
  .map(({ href, marks: held }): AdfNode => ({ marks: [...held.filter((outer) => outer.type !== 'link'), { attrs: { href }, type: 'link' }], text: href, type: 'text' }))

const inlineArbitraries = Object.entries(inlineNodes).map(([type, model]) =>
  occasionallyEmpty(fc.record({ attrs: attributes(model.attributes), marks }).map((held): AdfNode => ({ ...held, type }))),
)

function weighted(arbitraries: readonly Arbitrary<AdfNode>[], weight: number): { arbitrary: Arbitrary<AdfNode>; weight: number }[] {
  return arbitraries.map((arbitrary) => ({ arbitrary, weight }))
}

const positions = fc.letrec<Positions>((tie) => {
  const blockContent = fc.array(tie('block'), { depthIdentifier, maxLength: 3 })
  const inlineContent = occasionallyApart(fc.array(tie('inline'), { depthIdentifier, maxLength: 4 }))
  const contentByModel = {
    block: blockContent,
    code: occasionallyApart(fc.array(text.map((held): AdfNode => ({ text: held, type: 'text' })), { maxLength: 2 })),
    inline: inlineContent,
    none: fc.constant<AdfNode[]>([]),
  }
  const blockMarks = fc.oneof({ arbitrary: fc.constant<AdfMark[]>([]), weight: 4 }, { arbitrary: marks, weight: 1 })
  const blockArbitraries = Object.entries(blockNodes).map(([type, model]) => {
    const argument = blockArgument(type)
    const vocabulary: AttributeVocabulary = argument === undefined ? model.attributes : { ...model.attributes, [argument]: 'string' }
    const node = occasionallyEmpty(fc.record({ attrs: attributes(vocabulary), content: contentByModel[model.contentModel], marks: blockMarks }).map((held): AdfNode => ({ ...held, type })))
    return { leaf: model.contentModel === 'code' || model.contentModel === 'none', node }
  })
  const unknownNode = occasionallyEmpty(
    fc.record({ attrs: fc.dictionary(jsonKey, jsonValue, { maxKeys: 2, noNullPrototype: true }), content: fc.array(tie('inline'), { depthIdentifier, maxLength: 2 }), marks, type: unknownType }),
  )
  const leafBlocks = blockArbitraries.filter((entry) => entry.leaf).map((entry) => entry.node)
  const containerBlocks = blockArbitraries.filter((entry) => !entry.leaf).map((entry) => entry.node)
  const misplacedWeight = 7
  const paragraph = occasionallyEmpty(
    fc.oneof({ arbitrary: inlineContent, weight: 3 }, { arbitrary: occasionallyApart(fc.array(backtickRunNode, { maxLength: 4, minLength: 2 })), weight: 1 }).map((content): AdfNode => ({ content, type: 'paragraph' })),
  )
  const cell = (type: string) => paragraph.map((held): AdfNode => ({ content: [held], type }))
  const listItems = fc.array(
    occasionallyEmpty(blockContent.map((content): AdfNode => ({ content, type: 'listItem' }))),
    { depthIdentifier, maxLength: 3, minLength: 1 },
  )
  const flatCommonMarkShapes = [
    occasionallyEmpty(fc.record({ content: inlineContent, level: fc.integer({ max: 6, min: 1 }) }).map(({ content, level }): AdfNode => ({ attrs: { level }, content, type: 'heading' }))),
    paragraph,
    fc.record({ body: fc.array(fc.array(cell('tableCell'), { maxLength: 3 }), { maxLength: 2 }), header: fc.array(cell('tableHeader'), { maxLength: 3, minLength: 1 }) }).map(pipeTable),
  ]
  const task = (type: string, content: Arbitrary<AdfNode[]>) =>
    occasionallyEmpty(fc.record({ content, state: fc.constantFrom('DONE', 'TODO') }).map(({ content: held, state }): AdfNode => ({ attrs: { state }, content: held, type })))
  const taskItem = fc.oneof({ arbitrary: task('taskItem', inlineContent), weight: 3 }, { arbitrary: task('blockTaskItem', blockContent), weight: 1 })
  const nestingCommonMarkShapes = [
    occasionallyEmpty(blockContent.map((content): AdfNode => ({ content, type: 'blockquote' }))),
    fc.array(fc.oneof({ arbitrary: taskItem, weight: 3 }, { arbitrary: tie('block'), weight: 1 }), { depthIdentifier, maxLength: 3, minLength: 1 }).map((content): AdfNode => ({ content, type: 'taskList' })),
    listItems.map((content): AdfNode => ({ content, type: 'bulletList' })),
    fc
      .record({
        content: listItems,
        order: fc.oneof({ arbitrary: fc.integer({ max: 3, min: 0 }), weight: 8 }, { arbitrary: fc.integer({ max: 999999999, min: 0 }), weight: 2 }, { arbitrary: fc.constant(-0), weight: 1 }),
      })
      .map(({ content, order }): AdfNode => ({ attrs: { order }, content, type: 'orderedList' })),
  ]
  const flatBlocks = [...weighted(leafBlocks, 2), ...weighted(flatCommonMarkShapes, flatCommonMarkShapeWeight)]
  return {
    block: fc.oneof(
      { depthIdentifier, depthSize: 'small', maxDepth: 4 },
      { arbitrary: fc.oneof(...flatBlocks), weight: flatBlocks.reduce((sum, entry) => sum + entry.weight, 0) },
      { arbitrary: fc.oneof(...containerBlocks), weight: containerBlocks.length * 2 },
      { arbitrary: fc.oneof(textNode, ...inlineArbitraries, unknownNode), weight: misplacedWeight },
      { arbitrary: fc.oneof(...nestingCommonMarkShapes), weight: nestingCommonMarkShapes.length * nestingCommonMarkShapeWeight },
    ),
    inline: fc.oneof(
      { depthIdentifier, depthSize: 'small', maxDepth: 4 },
      { arbitrary: textNode, weight: 12 },
      { arbitrary: autolinkTextNode, weight: 2 },
      { arbitrary: backtickRunNode, weight: 3 },
      { arbitrary: fc.oneof(...inlineArbitraries), weight: 7 },
      { arbitrary: fc.oneof(...blockArbitraries.map((entry) => entry.node), unknownNode), weight: 2 },
    ),
  }
})

export const adfDocument = fc.oneof(
  { arbitrary: fc.array(positions.block, { depthIdentifier, maxLength: 4, minLength: 1 }).map((content): AdfDocument => ({ content, type: 'doc', version: 1 })), weight: 30 },
  { arbitrary: fc.constant<AdfDocument>({ content: [], type: 'doc', version: 1 }), weight: 1 },
  { arbitrary: fc.constant<AdfDocument>({ type: 'doc', version: 1 }), weight: 1 },
)

export function propertyRuns(gateRuns: number): { gate: boolean; numRuns: number; seed?: number } {
  const deepRuns = env[deepRunsVariable]
  if (deepRuns === undefined) return { gate: true, numRuns: gateRuns, seed: gateSeed }
  assert.ok(/^[1-9]\d*$/.test(deepRuns), `${deepRunsVariable} is a run count in digits, such as ${deepRunsVariable}=10000: found ${JSON.stringify(deepRuns)}`)
  return { gate: false, numRuns: Number(deepRuns) }
}

export function blockTaskItemChildren(nodes: readonly AdfNode[]): string[] {
  const types: string[] = []
  const pending = [...nodes]
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.type === 'blockTaskItem') for (const child of nodeContent(node)) types.push(child.type)
    for (const child of nodeContent(node)) pending.push(child)
  }
  return types
}

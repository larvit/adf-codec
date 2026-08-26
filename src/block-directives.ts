import type { AdfMark, AdfNode, AttributeVocabulary } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { attributeFailure, isBareToken, spellAttributes, spellJsonAttribute, vocabularyPairs } from './directive-attributes.ts'

export type BlockDirective = {
  argument?: string
  attributes: AttributeVocabulary
  body: 'block' | 'inline' | 'none'
}

const cellAttributes: AttributeVocabulary = {
  background: 'string',
  colspan: 'number',
  colwidth: 'json',
  localId: 'string',
  rowspan: 'number',
  valign: 'string',
}

const expandAttributes: AttributeVocabulary = { localId: 'string', title: 'string' }

const extensionAttributes: AttributeVocabulary = {
  extensionKey: 'string',
  extensionType: 'string',
  layout: 'string',
  localId: 'string',
  parameters: 'json',
  text: 'string',
}

const itemAttributes: AttributeVocabulary = { localId: 'string' }

const mediaAttributes: AttributeVocabulary = {
  alt: 'string',
  collection: 'string',
  height: 'number',
  id: 'string',
  localId: 'string',
  occurrenceKey: 'string',
  type: 'string',
  url: 'string',
  width: 'number',
}

const syncBlockAttributes: AttributeVocabulary = { localId: 'string', resourceId: 'string' }

const blockDirectives: Readonly<Record<string, BlockDirective>> = {
  blockTaskItem: { argument: 'state', attributes: itemAttributes, body: 'block' },
  bodiedExtension: { attributes: extensionAttributes, body: 'block' },
  bodiedSyncBlock: { attributes: syncBlockAttributes, body: 'block' },
  caption: { attributes: itemAttributes, body: 'inline' },
  decisionItem: { attributes: { localId: 'string', state: 'string' }, body: 'inline' },
  decisionList: { attributes: itemAttributes, body: 'block' },
  expand: { attributes: expandAttributes, body: 'block' },
  extension: { attributes: extensionAttributes, body: 'none' },
  extensionFrame: { attributes: {}, body: 'block' },
  layoutColumn: { attributes: { localId: 'string', valign: 'string', width: 'number' }, body: 'block' },
  layoutSection: { attributes: itemAttributes, body: 'block' },
  media: { attributes: mediaAttributes, body: 'none' },
  mediaGroup: { attributes: {}, body: 'block' },
  mediaSingle: { attributes: { layout: 'string', localId: 'string', width: 'number', widthType: 'string' }, body: 'block' },
  multiBodiedExtension: { attributes: extensionAttributes, body: 'block' },
  nestedExpand: { attributes: expandAttributes, body: 'block' },
  panel: {
    argument: 'panelType',
    attributes: { localId: 'string', panelColor: 'string', panelIcon: 'string', panelIconId: 'string', panelIconText: 'string' },
    body: 'block',
  },
  syncBlock: { attributes: syncBlockAttributes, body: 'none' },
  table: { attributes: { displayMode: 'string', isNumberColumnEnabled: 'boolean', layout: 'string', localId: 'string', width: 'number' }, body: 'block' },
  tableCell: { attributes: cellAttributes, body: 'block' },
  tableHeader: { attributes: cellAttributes, body: 'block' },
  tableRow: { attributes: itemAttributes, body: 'block' },
  taskItem: { argument: 'state', attributes: itemAttributes, body: 'inline' },
  taskList: { attributes: itemAttributes, body: 'block' },
}

export function blockDirective(type: string): BlockDirective | undefined {
  return Object.hasOwn(blockDirectives, type) ? blockDirectives[type] : undefined
}

export function spellDirectiveHeader(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath): Result<string> {
  const argument = spellArgument(node, directive, path)
  if (!argument.ok) return argument
  const spelled = vocabularyPairs(node.attrs ?? {}, directive.attributes, directive.argument)
  if (spelled.fault !== undefined) return attributeFailure(node.type, spelled.fault, path)
  const marks = node.marks ?? []
  if (marks.length > 0) spelled.pairs.push(['marks', spellJsonAttribute(markValues(marks))])
  const attributes = spellAttributes(spelled.pairs)
  return success(`${node.type}${argument.value}${attributes === '' ? '' : ` ${attributes}`}`)
}

function spellArgument(node: AdfNode, directive: BlockDirective, path: ConvertErrorPath): Result<string> {
  const value = directive.argument === undefined ? undefined : node.attrs?.[directive.argument]
  if (value === undefined) return success('')
  if (typeof value !== 'string' || !isBareToken(value)) {
    return failure('unspelled-node-attribute', `the ${node.type} attribute ${directive.argument} holds no bare token the arg slot spells`, path)
  }
  return success(` ${value}`)
}

function markValues(marks: readonly AdfMark[]): JsonValue {
  return marks.map((mark) => {
    const attrs = mark.attrs ?? {}
    return Object.keys(attrs).length === 0 ? { type: mark.type } : { attrs, type: mark.type }
  })
}

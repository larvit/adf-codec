import type { AdfMark, AdfNode, AttributeVocabulary } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { isBareToken, spellAttributes, spellJsonAttribute, vocabularyPairs } from './directive-attributes.ts'

export type BlockDirective = {
  argument?: string
  attributes: AttributeVocabulary
  body: 'block' | 'code' | 'inline' | 'none'
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

const localIdAttributes: AttributeVocabulary = { localId: 'string' }

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
  blockTaskItem: { argument: 'state', attributes: localIdAttributes, body: 'block' },
  blockquote: { attributes: localIdAttributes, body: 'block' },
  bodiedExtension: { attributes: extensionAttributes, body: 'block' },
  bodiedSyncBlock: { attributes: syncBlockAttributes, body: 'block' },
  bulletList: { attributes: localIdAttributes, body: 'block' },
  caption: { attributes: localIdAttributes, body: 'inline' },
  codeBlock: {
    attributes: { hideLineNumbers: 'boolean', language: 'string', localId: 'string', uniqueId: 'string', wrap: 'boolean' },
    body: 'code',
  },
  decisionItem: { attributes: { localId: 'string', state: 'string' }, body: 'inline' },
  decisionList: { attributes: localIdAttributes, body: 'block' },
  expand: { attributes: expandAttributes, body: 'block' },
  extension: { attributes: extensionAttributes, body: 'none' },
  extensionFrame: { attributes: {}, body: 'block' },
  heading: { attributes: { level: 'number', localId: 'string' }, body: 'inline' },
  layoutColumn: { attributes: { localId: 'string', valign: 'string', width: 'number' }, body: 'block' },
  layoutSection: { attributes: localIdAttributes, body: 'block' },
  listItem: { attributes: localIdAttributes, body: 'block' },
  media: { attributes: mediaAttributes, body: 'none' },
  mediaGroup: { attributes: {}, body: 'block' },
  mediaSingle: { attributes: { layout: 'string', localId: 'string', width: 'number', widthType: 'string' }, body: 'block' },
  multiBodiedExtension: { attributes: extensionAttributes, body: 'block' },
  nestedExpand: { attributes: expandAttributes, body: 'block' },
  orderedList: { attributes: { localId: 'string', order: 'number' }, body: 'block' },
  panel: {
    argument: 'panelType',
    attributes: { localId: 'string', panelColor: 'string', panelIcon: 'string', panelIconId: 'string', panelIconText: 'string' },
    body: 'block',
  },
  paragraph: { attributes: localIdAttributes, body: 'inline' },
  rule: { attributes: localIdAttributes, body: 'none' },
  syncBlock: { attributes: syncBlockAttributes, body: 'none' },
  table: { attributes: { displayMode: 'string', isNumberColumnEnabled: 'boolean', layout: 'string', localId: 'string', width: 'number' }, body: 'block' },
  tableCell: { attributes: cellAttributes, body: 'block' },
  tableHeader: { attributes: cellAttributes, body: 'block' },
  tableRow: { attributes: localIdAttributes, body: 'block' },
  taskItem: { argument: 'state', attributes: localIdAttributes, body: 'inline' },
  taskList: { attributes: localIdAttributes, body: 'block' },
}

export function blockDirective(type: string): BlockDirective | undefined {
  return Object.hasOwn(blockDirectives, type) ? blockDirectives[type] : undefined
}

export function spellDirectiveHeader(node: AdfNode, directive: BlockDirective, spelledByBody: readonly string[] = []): string | undefined {
  const argument = spellArgument(node, directive)
  if (argument === undefined) return undefined
  const spelled = directive.argument === undefined ? spelledByBody : [directive.argument, ...spelledByBody]
  const pairs = vocabularyPairs(node.attrs ?? {}, directive.attributes, spelled)
  if (pairs === undefined) return undefined
  const marks = node.marks ?? []
  if (marks.length > 0) pairs.push(['marks', spellJsonAttribute(markValues(marks))])
  const attributes = spellAttributes(pairs)
  return `${node.type}${argument}${attributes === '' ? '' : ` ${attributes}`}`
}

function spellArgument(node: AdfNode, directive: BlockDirective): string | undefined {
  const value = directive.argument === undefined ? undefined : node.attrs?.[directive.argument]
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

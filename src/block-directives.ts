import type { AdfMark, AdfNode, AttributeKind } from './adf-document.ts'
import type { JsonValue } from './json-value.ts'
import { failure, success, type ConvertErrorPath, type Result } from './result.ts'
import { isBareToken, spellAttributeValue, spellAttributes, spellJsonAttribute } from './directive-attributes.ts'

export type BlockDirective = {
  argument?: string
  attributes: Readonly<Record<string, AttributeKind>>
  body: 'block' | 'inline' | 'none'
}

const cellAttributes: Readonly<Record<string, AttributeKind>> = {
  background: 'string',
  colspan: 'number',
  colwidth: 'json',
  localId: 'string',
  rowspan: 'number',
  valign: 'string',
}

const expandAttributes: Readonly<Record<string, AttributeKind>> = { localId: 'string', title: 'string' }

const extensionAttributes: Readonly<Record<string, AttributeKind>> = {
  extensionKey: 'string',
  extensionType: 'string',
  layout: 'string',
  localId: 'string',
  parameters: 'json',
  text: 'string',
}

const itemAttributes: Readonly<Record<string, AttributeKind>> = { localId: 'string' }

const mediaAttributes: Readonly<Record<string, AttributeKind>> = {
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

const syncBlockAttributes: Readonly<Record<string, AttributeKind>> = { localId: 'string', resourceId: 'string' }

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
  const pairs: [string, string][] = []
  let argument = ''
  for (const [key, value] of Object.entries(node.attrs ?? {})) {
    if (key === directive.argument) {
      if (typeof value !== 'string' || !isBareToken(value)) {
        return failure('unspelled-node-attribute', `the ${node.type} attribute ${key} holds no bare token the arg slot spells`, path)
      }
      argument = ` ${value}`
      continue
    }
    const kind = attributeKind(directive, key)
    if (kind === undefined) return failure('unspelled-node-attribute', `the ${node.type} attribute ${key} has no canonical markdown spelling`, path)
    const spelled = spellAttributeValue(value, kind)
    if (spelled === undefined) return failure('unsupported-node-shape', `the ${node.type} attribute ${key} holds no ${kind}`, path)
    pairs.push([key, spelled])
  }
  const marks = node.marks ?? []
  if (marks.length > 0) pairs.push(['marks', spellJsonAttribute(markValues(marks))])
  const attributes = spellAttributes(pairs)
  return success(`${node.type}${argument}${attributes === '' ? '' : ` ${attributes}`}`)
}

function attributeKind(directive: BlockDirective, key: string): AttributeKind | undefined {
  return Object.hasOwn(directive.attributes, key) ? directive.attributes[key] : undefined
}

function markValues(marks: readonly AdfMark[]): JsonValue {
  return marks.map((mark) => {
    const attrs = mark.attrs ?? {}
    return Object.keys(attrs).length === 0 ? { type: mark.type } : { attrs, type: mark.type }
  })
}

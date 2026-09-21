import type { AttributeVocabulary } from './attribute-vocabulary.ts'

export type BlockNode = {
  attributes: AttributeVocabulary
  contentModel: 'block' | 'code' | 'inline' | 'none'
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

export const blockNodes = {
  blockTaskItem: { attributes: localIdAttributes, contentModel: 'block' },
  blockquote: { attributes: localIdAttributes, contentModel: 'block' },
  bodiedExtension: { attributes: extensionAttributes, contentModel: 'block' },
  bodiedSyncBlock: { attributes: syncBlockAttributes, contentModel: 'block' },
  bulletList: { attributes: localIdAttributes, contentModel: 'block' },
  caption: { attributes: localIdAttributes, contentModel: 'inline' },
  codeBlock: {
    attributes: { hideLineNumbers: 'boolean', language: 'string', localId: 'string', uniqueId: 'string', wrap: 'boolean' },
    contentModel: 'code',
  },
  decisionItem: { attributes: { localId: 'string', state: 'string' }, contentModel: 'inline' },
  decisionList: { attributes: localIdAttributes, contentModel: 'block' },
  expand: { attributes: expandAttributes, contentModel: 'block' },
  extension: { attributes: extensionAttributes, contentModel: 'none' },
  extensionFrame: { attributes: {}, contentModel: 'block' },
  heading: { attributes: { level: 'number', localId: 'string' }, contentModel: 'inline' },
  layoutColumn: { attributes: { localId: 'string', valign: 'string', width: 'number' }, contentModel: 'block' },
  layoutSection: { attributes: { columnRuleStyle: 'string', localId: 'string' }, contentModel: 'block' },
  listItem: { attributes: localIdAttributes, contentModel: 'block' },
  media: { attributes: mediaAttributes, contentModel: 'none' },
  mediaGroup: { attributes: {}, contentModel: 'block' },
  mediaSingle: { attributes: { layout: 'string', localId: 'string', width: 'number', widthType: 'string' }, contentModel: 'block' },
  multiBodiedExtension: { attributes: extensionAttributes, contentModel: 'block' },
  nestedExpand: { attributes: expandAttributes, contentModel: 'block' },
  orderedList: { attributes: { localId: 'string', order: 'number' }, contentModel: 'block' },
  panel: {
    attributes: { localId: 'string', panelColor: 'string', panelIcon: 'string', panelIconId: 'string', panelIconText: 'string' },
    contentModel: 'block',
  },
  paragraph: { attributes: localIdAttributes, contentModel: 'inline' },
  rule: { attributes: { color: 'string', localId: 'string', style: 'string', weight: 'number' }, contentModel: 'none' },
  syncBlock: { attributes: syncBlockAttributes, contentModel: 'none' },
  table: { attributes: { displayMode: 'string', isNumberColumnEnabled: 'boolean', layout: 'string', localId: 'string', width: 'number' }, contentModel: 'block' },
  tableCell: { attributes: cellAttributes, contentModel: 'block' },
  tableHeader: { attributes: cellAttributes, contentModel: 'block' },
  tableRow: { attributes: localIdAttributes, contentModel: 'block' },
  taskItem: { attributes: localIdAttributes, contentModel: 'inline' },
  taskList: { attributes: localIdAttributes, contentModel: 'block' },
} satisfies Readonly<Record<string, BlockNode>>

export type BlockType = keyof typeof blockNodes

export function blockNodeNamed(type: string): BlockNode | undefined {
  return isBlockType(type) ? blockNodes[type] : undefined
}

function isBlockType(type: string): type is BlockType {
  return Object.hasOwn(blockNodes, type)
}

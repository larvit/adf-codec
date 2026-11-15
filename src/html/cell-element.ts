import type { AdfAttributes, AdfNode } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import type { Read } from '../result.ts'
import { blockNodes } from '../adf/block-nodes.ts'
import { dataAttributes, dataValue, readDataAttributes } from './data-attributes.ts'
import { isNumberList } from '../adf/attribute-vocabulary.ts'
import { nodeAttrs } from '../adf/document.ts'
import { optionalAttribute } from './escaping.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

const elementWritten = ['background', 'colspan', 'colwidth', 'rowspan']
const leading = ['colspan', 'rowspan', 'data-background-color', 'data-colwidth']
// `0.3.1` wrote a cell's background as this `style` in `data-background-color`'s place, and stored HTML still reads.
const releasedBackground = /^background-color:(#?[0-9a-zA-Z]+)$/
const span = /^[1-9][0-9]*$/

export function isHeaderRow(row: { content?: AdfNode[] }): boolean {
  const cells = row.content ?? []
  return cells.length > 0 && cells.every(({ type }) => type === 'tableHeader')
}

// A cell's attributes in the order `readCellAttributes` takes them; `undefined` where a value has no spelling on the element, so the whole table rides the carry.
export function cellAttributes(cell: AdfNode): string | undefined {
  const { background, colspan, colwidth, rowspan } = nodeAttrs(cell)
  const own = [spanAttribute('colspan', colspan), spanAttribute('rowspan', rowspan), backgroundAttribute(background), widthsAttribute(colwidth), dataAttributes(cell, blockNodes.tableCell.attributes, elementWritten)]
  return own.every((attribute) => attribute !== undefined) ? own.join('') : undefined
}

export function readCellAttributes(pairs: readonly (readonly [string, string])[], element: string): Read<AdfAttributes> {
  const attrs: AdfAttributes = {}
  let rest = pairs
  for (const name of leading) {
    const [first] = rest
    const released = name === 'data-background-color' && first?.[0] === 'style'
    if (first?.[0] !== name && !released) continue
    const value = released ? releasedBackground.exec(first[1])?.[1] : ownValue(name, first[1])
    if (value === undefined) return { fault: { code: name === 'data-colwidth' ? 'unsupported-node-shape' : 'unmappable-html', message: `${first[0]} on <${element}> spells no value adfToHtml writes there` } }
    attrs[ownKey(name)] = value
    rest = rest.slice(1)
  }
  const misplaced = rest.find(([name]) => leading.includes(name))
  if (misplaced !== undefined) return { fault: { code: 'unmappable-html', message: `<${element}> takes colspan, rowspan, data-background-color and data-colwidth first, each once and in that order: found ${misplaced[0]} out of place` } }
  const data = readDataAttributes(rest, element, blockNodes.tableCell.attributes, elementWritten)
  return data.fault === undefined ? { value: { ...attrs, ...data.value } } : data
}

function backgroundAttribute(background: JsonValue | undefined): string | undefined {
  if (background === undefined) return ''
  return typeof background === 'string' ? optionalAttribute('data-background-color', background) : undefined
}

function spanAttribute(name: string, value: JsonValue | undefined): string | undefined {
  if (value === undefined) return ''
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? ` ${name}="${value}"` : undefined
}

function widthsAttribute(colwidth: JsonValue | undefined): string | undefined {
  if (colwidth === undefined) return ''
  return isNumberList(colwidth) ? ` data-colwidth="${serializeCanonicalJson(colwidth, 'compact').slice(1, -1)}"` : undefined
}

function ownKey(name: string): string {
  if (name === 'data-background-color') return 'background'
  return name === 'data-colwidth' ? 'colwidth' : name
}

function ownValue(name: string, spelled: string): JsonValue | undefined {
  if (name === 'data-background-color') return spelled
  if (name === 'data-colwidth') return dataValue(`[${spelled}]`, 'numbers')
  const value = Number(spelled)
  return span.test(spelled) && Number.isSafeInteger(value) ? value : undefined
}

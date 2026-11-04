import type { AdfNode } from '../../adf/document.ts'
import { dataAttributes } from '../data-attributes.ts'
import { elementOfNodeType } from '../node-element.ts'
import { optionalAttribute, writableValue } from '../escaping.ts'

// `undefined` where the node is no emoji, mention, status, date or card, or holds what its element cannot write: it rides the carry.
export function nodeElement(node: AdfNode): string | undefined {
  const model = elementOfNodeType(node.type)
  if (model === undefined || node.content !== undefined) return undefined
  const held = model.shown(node)
  const leadingValue = model.leading?.value(node)
  if (held === undefined || (model.leading !== undefined && leadingValue === undefined)) return undefined
  const data = dataAttributes(node, model.vocabulary, model.written)
  const leading = model.leading === undefined ? '' : optionalAttribute(model.leading.name, leadingValue)
  const shown = writableValue(held)
  if (data === undefined || leading === undefined || shown === undefined) return undefined
  return `<${model.element} class="${model.class}"${leading}${data}>${shown}</${model.element}>`
}

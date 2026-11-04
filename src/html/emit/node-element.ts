import type { AdfNode } from '../../adf/document.ts'
import { dataAttributes } from '../data-attributes.ts'
import { elementOfNodeType, htmlDay } from '../node-element.ts'
import { nodeAttrs } from '../../adf/document.ts'
import { shownText } from '../../adf/shown-text.ts'
import { writableValue } from '../escaping.ts'

// `undefined` where the node is no emoji, status, date or card holding a URL, or holds what its element cannot write: it rides the carry.
export function nodeElement(node: AdfNode): string | undefined {
  const model = elementOfNodeType(node.type)
  if (model === undefined || node.content !== undefined) return undefined
  const data = dataAttributes(node, model.vocabulary, model.content === undefined ? [] : [model.content])
  const held = model.content === undefined ? htmlDay(shownText(node)) : nodeAttrs(node)[model.content]
  const shown = typeof held === 'string' && held !== '' ? writableValue(held) : undefined
  if (data === undefined || shown === undefined) return undefined
  const leading = model.leading === undefined ? '' : ` ${model.leading}="${shown}"`
  return `<${model.element} class="${model.class}"${leading}${data}>${shown}</${model.element}>`
}

import type { AdfNode } from '../../adf/document.ts'
import { foundAt, misspelledText, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { nodeTypeOfElement } from '../node-element.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { success } from '../../result.ts'
import { misspelledAt, unescapedValue } from '../escaping.ts'

// `undefined` where the tag opens no emoji, mention, status, date or card element; one that does reads as the node `nodeElement` wrote it from, or is refused.
export function readNodeElement(html: string, tag: StartTag, place: Place): ReadNode | undefined {
  const [kind, ...rest] = tag.attributes
  const found = kind?.[0] === 'class' ? nodeTypeOfElement(tag.name, kind[1]) : undefined
  if (found === undefined) return undefined
  const [type, model] = found
  const name = `<${tag.name} class="${model.class}">`
  if (model.leading !== undefined && rest[0]?.[0] !== model.leading.name) return refused('unmappable-html', `${name} holds ${model.leading.name} first, before its data-* attributes: ${foundAt(html, tag.start)}`, html, tag.start, place)
  const data = readDataAttributes(rest, `${tag.name} class="${model.class}"`, model.vocabulary, model.written, model.leading?.name)
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const closer = `</${tag.name}>`
  const stop = html.indexOf('<', tag.end)
  const end = stop < 0 ? html.length : stop
  const shown = unescapedValue(html.slice(tag.end, end), 'text')
  if (shown === undefined) return misspelledText(html, tag.end + misspelledAt(html.slice(tag.end, end), 'text'), place)
  if (!html.startsWith(closer, end)) return refused('unmappable-html', `${name} holds its text, then ${closer}: ${foundAt(html, end)}`, html, end, place)
  const node: AdfNode = { attrs: model.build(data.value, shown), type }
  if (model.shown(node) !== shown || (model.leading !== undefined && model.leading.value(node) !== rest[0]?.[1])) {
    return refused('unmappable-html', `${name} ${model.mismatch}: ${foundAt(html, tag.end)}`, html, tag.end, place)
  }
  return success({ end: end + closer.length, node })
}

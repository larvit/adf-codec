import type { AdfAttributes, AdfNode } from '../../adf/document.ts'
import { foundAt, misspelledText, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { htmlDay, nodeTypeOfElement, type NodeElement } from '../node-element.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { shownText } from '../../adf/shown-text.ts'
import { success } from '../../result.ts'
import { misspelledAt, unescapedValue } from '../escaping.ts'

// `undefined` where the tag opens no emoji, status, date or card element; one that does reads as the node `nodeElement` wrote it from, or is refused.
export function readNodeElement(html: string, tag: StartTag, place: Place): ReadNode | undefined {
  const [kind, ...rest] = tag.attributes
  const found = kind?.[0] === 'class' ? nodeTypeOfElement(tag.name, kind[1]) : undefined
  if (found === undefined) return undefined
  const [type, model] = found
  if (model.leading !== undefined && rest[0]?.[0] !== model.leading) return refused('unmappable-html', `<${tag.name} class="${model.class}"> holds ${model.leading} first, before its data-* attributes: ${foundAt(html, tag.start)}`, html, tag.start, place)
  const data = readDataAttributes(rest, `${tag.name} class="${model.class}"`, model.vocabulary, model.content === undefined ? [] : [model.content], model.leading)
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const closer = `</${tag.name}>`
  const stop = html.indexOf('<', tag.end)
  const end = stop < 0 ? html.length : stop
  const shown = unescapedValue(html.slice(tag.end, end), 'text')
  if (shown === undefined) return misspelledText(html, tag.end + misspelledAt(html.slice(tag.end, end), 'text'), place)
  if (!html.startsWith(closer, end)) return refused('unmappable-html', `<${tag.name} class="${model.class}"> holds its text, then ${closer}: ${foundAt(html, end)}`, html, end, place)
  const node = nodeOf(type, model, data.value, shown)
  const expected = model.content === undefined ? htmlDay(shownText(node)) : shown
  if (expected === undefined || expected === '' || shown !== expected || (model.leading !== undefined && rest[0]?.[1] !== expected)) {
    return refused('unmappable-html', `${mismatch(tag.name, model)}: ${foundAt(html, tag.end)}`, html, tag.end, place)
  }
  return success({ end: end + closer.length, node })
}

function nodeOf(type: string, model: NodeElement, data: AdfAttributes, shown: string): AdfNode {
  return { attrs: model.content === undefined ? data : { ...data, [model.content]: shown }, type }
}

function mismatch(name: string, model: NodeElement): string {
  const element = `<${name} class="${model.class}">`
  if (model.leading === 'datetime') return `${element} shows the day its data-timestamp names, in datetime and as its text; to change the date, change all three`
  if (model.leading === 'href') return `${element} holds one URL, as its href and as its text; to change the card, change both`
  return `${element} holds its text, which is not empty`
}

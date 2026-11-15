import type { AdfAttributes } from '../../adf/document.ts'
import { built } from './inline-block.ts'
import { foundAt, misread, readStartTag, refused, type Place, type ReadNode } from './source.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { readInline } from './inline.ts'
import { success, type Read } from '../../result.ts'
import { taskLists, type TaskListType } from '../block-classes.ts'
import { taskStates } from '../task-element.ts'

// An item of a task or decision list as `adfToHtml` writes it: its checkbox, if a task, a space, then its inline content.
export function readTaskItem(html: string, index: number, place: Place, list: TaskListType): ReadNode {
  const tag = readStartTag(html, index)
  if (tag?.name !== 'li') {
    const stop = misread(html, index, 'a list holds <li> items, one to a line', 'no list item of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  const found = readItemAttributes(list, tag.attributes)
  if (found.fault !== undefined) return refused(found.fault.code, found.fault.message, html, tag.start, place)
  const { attrs, done } = found.value
  let start = tag.end
  if (done !== undefined) {
    const box = checkbox(html, start, done)
    if (!box) return refused('unmappable-html', `a task item starts with <input type="checkbox"${done ? ' checked=""' : ''} disabled="">, checked where its data-state is DONE: ${foundAt(html, start)}`, html, start, place)
    start = box
  }
  const node = built(taskLists[list].item, attrs, [])
  if (html.startsWith('</li>', start)) return success({ end: start + '</li>'.length, node })
  if (done !== undefined) {
    if (!html.startsWith(' ', start)) return refused('unmappable-html', `a task item's text stands a space after its checkbox: ${foundAt(html, start)}`, html, start, place)
    start += 1
  }
  const inline = readInline(html, start, place)
  if (!inline.ok) return inline
  const { end, nodes } = inline.value
  if (nodes.length === 0 || !html.startsWith('</li>', end)) {
    const stop = nodes.length === 0 ? { at: end, message: `a task item holds text where a space follows its checkbox: ${foundAt(html, end)}` } : misread(html, end, 'an item holds inline content, then </li>, as one line', 'no inline element of the dialect')
    return refused('unmappable-html', stop.message, html, stop.at, place)
  }
  return success({ end: end + '</li>'.length, node: { ...node, content: nodes } })
}

// `done` is `undefined` for a decision item, which has no checkbox.
function readItemAttributes(list: TaskListType, pairs: readonly (readonly [string, string])[]): Read<{ attrs: AdfAttributes; done: boolean | undefined }> {
  const { itemAttributes, itemClass } = taskLists[list]
  const [first, ...rest] = pairs
  if (first?.[0] !== 'class' || first[1] !== itemClass) return { fault: { code: 'unmappable-html', message: `an <li> of this list has class="${itemClass}" first` } }
  const data = readDataAttributes(rest, 'li', itemAttributes, [])
  if (data.fault !== undefined) return { fault: data.fault }
  if (list === 'decisionList') return { value: { attrs: data.value, done: undefined } }
  const done = taskStates.get(data.value['state'])
  if (done === undefined) return { fault: { code: 'unmappable-html', message: 'an <li> of a task list has data-state="DONE" or data-state="TODO"' } }
  return { value: { attrs: data.value, done } }
}

// The end of the checkbox at `index`; `undefined` where the checkbox is not the one adfToHtml writes for `done`.
function checkbox(html: string, index: number, done: boolean): number | undefined {
  const input = readStartTag(html, index)
  const expected = [['type', 'checkbox'], ...(done ? [['checked', '']] : []), ['disabled', '']]
  const same = input?.name === 'input' && input.attributes.length === expected.length && input.attributes.every(([name, value], at) => name === expected[at]?.[0] && value === expected[at]?.[1])
  return same ? input.end : undefined
}

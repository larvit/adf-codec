import type { AdfNode } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import { dataAttributes } from './data-attributes.ts'
import { nodeAttrs } from '../adf/document.ts'
import { taskLists, type TaskListType } from './block-classes.ts'

// A task item's two states, and whether the checkbox before its text is checked.
export const taskStates: ReadonlyMap<JsonValue | undefined, boolean> = new Map<JsonValue | undefined, boolean>([
  ['DONE', true],
  ['TODO', false],
])

// The start tag's attributes of an item of a task or decision list, and what stands before its text: a checkbox in a task, checked where it is done; `undefined` where the item holds what its element cannot.
export function itemOpener(list: TaskListType, item: AdfNode): { attributes: string; lead: string } | undefined {
  const { item: type, itemAttributes, itemClass } = taskLists[list]
  const data = item.type === type ? dataAttributes(item, itemAttributes, []) : undefined
  if (data === undefined) return undefined
  const attributes = ` class="${itemClass}"${data}`
  if (list === 'decisionList') return { attributes, lead: '' }
  const done = taskStates.get(nodeAttrs(item)['state'])
  return done === undefined ? undefined : { attributes, lead: `<input type="checkbox"${done ? ' checked=""' : ''} disabled="">` }
}

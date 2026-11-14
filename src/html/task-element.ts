import type { AdfNode } from '../adf/document.ts'
import { dataAttributes } from './data-attributes.ts'
import { nodeAttrs } from '../adf/document.ts'
import { taskLists, type TaskListType } from './block-classes.ts'

// A task item's two states, and whether the checkbox before its text is checked.
export const taskStates: ReadonlyMap<string, boolean> = new Map([
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
  const state = nodeAttrs(item)['state']
  const done = typeof state === 'string' ? taskStates.get(state) : undefined
  return done === undefined ? undefined : { attributes, lead: `<input type="checkbox"${done ? ' checked=""' : ''} disabled="">` }
}

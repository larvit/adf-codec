import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import { blockNodes } from '../adf/block-nodes.ts'

export type ExpandType = 'expand' | 'nestedExpand'

export type TaskListType = 'decisionList' | 'taskList'

const expandTypes: readonly ExpandType[] = ['expand', 'nestedExpand']
const listTypes: readonly TaskListType[] = ['decisionList', 'taskList']

export const expandClasses: Readonly<Record<ExpandType, string>> = { expand: 'adf-expand', nestedExpand: 'adf-nested-expand' }
export const panelClass = 'adf-panel'
// A panel's type is no attribute of the vocabularies, since a directive spells it as its argument; here it is a data-* attribute like the rest.
export const panelAttributes: AttributeVocabulary = { ...blockNodes.panel.attributes, panelType: 'string' }

// A task or decision list, its items' type, class and attributes.
export const taskLists: Readonly<Record<TaskListType, { item: 'decisionItem' | 'taskItem'; itemAttributes: AttributeVocabulary; itemClass: string; listClass: string }>> = {
  decisionList: { item: 'decisionItem', itemAttributes: blockNodes.decisionItem.attributes, itemClass: 'adf-decision', listClass: 'adf-decision-list' },
  taskList: { item: 'taskItem', itemAttributes: { ...blockNodes.taskItem.attributes, state: 'string' }, itemClass: 'adf-task', listClass: 'adf-task-list' },
}

// The type of the task or decision list whose `<ul>` has the class; `undefined` for any other.
export function taskListOfClass(className: string | undefined): TaskListType | undefined {
  return listTypes.find((type) => taskLists[type].listClass === className)
}

// The task or decision list type `type` names; `undefined` for any other.
export function taskListOfType(type: string): TaskListType | undefined {
  return listTypes.find((candidate) => candidate === type)
}

// The expand type whose `<details>` has the class; `undefined` for any other.
export function expandOfClass(className: string | undefined): ExpandType | undefined {
  return expandTypes.find((type) => expandClasses[type] === className)
}

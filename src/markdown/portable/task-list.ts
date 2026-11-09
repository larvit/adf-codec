import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath } from '../../result.ts'
import { isTaskItem } from '../../adf/block-nodes.ts'
import { nodeContent } from '../../adf/document.ts'

// Atlassian's schema holds a blockTaskItem to paragraphs and extensions, and the portable flavour spells no extension: an item keeps its paragraphs, then the task lists nested in it, and the rest of it stands after the list, which resumes at the next task.
export function splitTaskList(items: readonly TaskListItem[]): AdfNode[] {
  const blocks: AdfNode[] = []
  let tasks: AdfNode[] = []
  for (const item of items) {
    const { kept, rest } = itemParts(item)
    for (const node of kept) tasks.push(node)
    if (rest.length === 0) continue
    if (tasks.length > 0) blocks.push({ content: tasks, type: 'taskList' })
    tasks = []
    for (const block of rest) blocks.push(block)
  }
  if (tasks.length > 0) blocks.push({ content: tasks, type: 'taskList' })
  return blocks
}

// A task and the children after it up to the next task, which nest in it.
export type TaskListItem = { after: AdfNode[]; task: AdfNode }

// The list's items, or undefined where a child other than a task opens it.
export function taskListItems(list: AdfNode): TaskListItem[] | undefined {
  const items: TaskListItem[] = []
  for (const child of nodeContent(list)) {
    const item = items.at(-1)
    if (isTaskItem(child)) items.push({ after: [], task: child })
    else if (item === undefined) return undefined
    else item.after.push(child)
  }
  return items
}

// Where `target` stands among `blocks`: its block's index, then the steps down to it. The split rebuilds lists and items but never an inline node, so an inline marker stays findable.
export function pathTo(blocks: readonly AdfNode[], target: AdfNode): [number, ...ConvertErrorPath] | undefined {
  const pending: Visit[] = blocks.map((node, step) => ({ node, parent: undefined, step }))
  for (let visit = pending.pop(); visit !== undefined; visit = pending.pop()) {
    if (visit.node === target) return stepsTo(visit)
    for (const [step, node] of nodeContent(visit.node).entries()) pending.push({ node, parent: visit, step })
  }
  return undefined
}

type Visit = { node: AdfNode; parent: Visit | undefined; step: number }

function stepsTo(visit: Visit): [number, ...ConvertErrorPath] {
  const steps: (number | string)[] = []
  let at = visit
  for (; at.parent !== undefined; at = at.parent) steps.push(at.step, 'content')
  return [at.step, ...steps.reverse()]
}

// The item reads as one run: the task's blocks, then the children after it.
function itemParts({ after, task }: TaskListItem): { kept: AdfNode[]; rest: AdfNode[] } {
  const content = task.type === 'blockTaskItem' ? nodeContent(task) : []
  const run = [...content, ...after]
  const paragraphs = runEnd(content, 0, 'paragraph')
  const nested = runEnd(run, paragraphs, 'taskList')
  const head = task.type === 'blockTaskItem' ? taskOfParagraphs(task, content.slice(0, paragraphs)) : task
  return { kept: [head, ...run.slice(paragraphs, nested)], rest: run.slice(nested) }
}

function runEnd(nodes: readonly AdfNode[], start: number, type: string): number {
  let end = start
  while (nodes[end]?.type === type) end += 1
  return end
}

// One paragraph or none reads as a taskItem.
function taskOfParagraphs(task: AdfNode, paragraphs: readonly AdfNode[]): AdfNode {
  const [only] = paragraphs
  if (paragraphs.length > 1) return { ...task, content: [...paragraphs] }
  return { ...task, content: nodeContent(only ?? {}).slice(), type: 'taskItem' }
}

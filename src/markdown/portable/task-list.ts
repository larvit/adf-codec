import type { AdfNode } from '../../adf/document.ts'
import { nodeContent } from '../../adf/document.ts'

// Atlassian's schema holds a blockTaskItem to paragraphs and extensions, and nests a task list beside its item.
export function splitTaskList(list: AdfNode): AdfNode[] {
  const blocks: AdfNode[] = []
  let tasks: AdfNode[] = []
  let standing = false
  for (const child of nodeContent(list)) {
    const isTask = child.type === 'taskItem' || child.type === 'blockTaskItem'
    if (isTask) standing = false
    let stands: readonly AdfNode[] = standing || !(isTask || child.type === 'taskList') ? [child] : []
    if (child.type === 'blockTaskItem') {
      const content = nodeContent(child)
      let held = 0
      while (content[held]?.type === 'paragraph') held += 1
      let nested = held
      while (content[nested]?.type === 'taskList') nested += 1
      tasks.push(heldTask(child, content.slice(0, held)))
      for (const taskList of content.slice(held, nested)) tasks.push(taskList)
      stands = content.slice(nested)
    } else if (stands.length === 0) tasks.push(child)
    if (stands.length === 0) continue
    if (tasks.length > 0) blocks.push({ ...list, content: tasks })
    tasks = []
    for (const block of stands) blocks.push(block)
    standing = true
  }
  if (tasks.length > 0) blocks.push({ ...list, content: tasks })
  return blocks
}

function heldTask(task: AdfNode, paragraphs: readonly AdfNode[]): AdfNode {
  const [only] = paragraphs
  if (paragraphs.length > 1) return { ...task, content: [...paragraphs] }
  return { ...task, content: nodeContent(only ?? {}).slice(), type: 'taskItem' }
}

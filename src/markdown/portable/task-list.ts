import type { AdfNode } from '../../adf/document.ts'
import { nodeContent } from '../../adf/document.ts'

// Atlassian's schema holds a block task item to paragraphs: from its first other block, the item's blocks and the lists beside it stand after the list, which resumes at the next task.
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
      const held = content.findIndex((block) => block.type !== 'paragraph')
      tasks.push(heldTask(child, held === -1 ? content : content.slice(0, held)))
      stands = held === -1 ? [] : content.slice(held)
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

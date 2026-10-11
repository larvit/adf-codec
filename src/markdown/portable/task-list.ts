import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath } from '../../result.ts'
import { isTaskItem } from '../../adf/block-nodes.ts'
import { nodeContent } from '../../adf/document.ts'

// Atlassian's schema holds a blockTaskItem to paragraphs and extensions, and the portable flavour spells no extension: an item keeps its paragraphs, then the task lists nested in it, and the rest of it stands after the list, which resumes at the next task.
export function splitTaskList(list: AdfNode): AdfNode[] {
  const blocks: AdfNode[] = []
  let tasks: AdfNode[] = []
  for (const item of itemsOf(nodeContent(list))) {
    const { kept, rest } = itemParts(item)
    for (const node of kept) tasks.push(node)
    if (rest.length === 0) continue
    if (tasks.length > 0) blocks.push({ ...list, content: tasks })
    tasks = []
    for (const block of rest) blocks.push(block)
  }
  if (tasks.length > 0) blocks.push({ ...list, content: tasks })
  return blocks
}

// Where `node`, a child of one of the list's tasks, stands among the blocks splitTaskList returns; a lone paragraph, holding its inline node, stands as its taskItem.
export function splitPlace(list: AdfNode, node: AdfNode & { content: [AdfNode] }): [number, ...ConvertErrorPath] | undefined {
  const [inline] = node.content
  const places = splitTaskList(list).flatMap((block, index): [number, ...ConvertErrorPath][] => {
    if (block === node) return [[index]]
    if (block.type !== 'taskList') return []
    return nodeContent(block).flatMap((item, child): [number, ...ConvertErrorPath][] => {
      if (item === node || nodeContent(item)[0] === inline) return [[index, 'content', child]]
      const at = nodeContent(item).indexOf(node)
      return at === -1 ? [] : [[index, 'content', child, 'content', at]]
    })
  })
  return places[0]
}

// An item is a task and the children up to the next one.
function itemsOf(children: readonly AdfNode[]): AdfNode[][] {
  const items: AdfNode[][] = []
  for (const child of children) {
    const item = items.at(-1)
    if (item === undefined || isTaskItem(child)) items.push([child])
    else item.push(child)
  }
  return items
}

// The item reads as one run: the task's blocks, then the children after it.
function itemParts(item: readonly AdfNode[]): { kept: AdfNode[]; rest: AdfNode[] } {
  const [task, ...after] = item
  if (task === undefined || !isTaskItem(task)) return { kept: [], rest: [...item] }
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

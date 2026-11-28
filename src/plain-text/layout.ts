import type { AdfNode } from '../adf/document.ts'
import { blockNodeModel } from '../adf/block-nodes.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'
import { nodeContent } from '../adf/document.ts'

// `lines`: the line feeds between a node's children; `level`: how much deeper they nest; `cells`: they are bar-separated cells on one line.
export type Layout = { cells?: true; level: number; lines: number }

export const bulletLists = ['bulletList', 'decisionList', 'taskList']
export const cellTypes = ['tableCell', 'tableHeader']
const itemTypes = ['blockTaskItem', 'listItem']

// Children stand on one line where they are inline, a line feed apart in a list, an item and a table, a blank line apart between other blocks. A list's items nest one level below it, an item's blocks at its own.
export function layoutOf(node: AdfNode): Layout {
	if (bulletLists.includes(node.type) || node.type === 'orderedList') return { level: 1, lines: 1 }
	if (itemTypes.includes(node.type)) return { level: 0, lines: 1 }
	if (node.type === 'table') return { level: 1, lines: 1 }
	if (node.type === 'tableRow') return { cells: true, level: 1, lines: 0 }
	if (cellTypes.includes(node.type)) return { level: 0, lines: 2 }
	const model = blockNodeModel(node.type)
	if (model !== undefined) return model.contentModel === 'block' ? { level: 1, lines: 2 } : { level: 0, lines: 0 }
	return nodeContent(node).every((child) => child.type === 'text' || inlineNodeModel(child.type) !== undefined) ? { level: 0, lines: 0 } : { level: 1, lines: 2 }
}

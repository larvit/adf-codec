import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'

const taskTypes = new Set(['blockTaskItem', 'taskItem', 'taskList'])

type Level = { minted: AdfNode[]; node?: AdfNode; source: Iterator<AdfNode> }

// A task node takes its number before the nodes it holds, so an id follows from the node's place in the document.
export function mintTaskIds(document: AdfDocument, markdown: string): AdfDocument {
	const seed = hash128(markdown).join(' ')
	const root: Level = { minted: [], source: (document.content ?? []).values() }
	const open = [root]
	let count = 0
	for (let level = open.at(-1); level !== undefined; level = open.at(-1)) {
		const step = level.source.next()
		if (step.done === true) {
			open.pop()
			if (level.node !== undefined) open.at(-1)?.minted.push({ ...level.node, content: level.minted })
			continue
		}
		const node = step.value
		if (taskTypes.has(node.type)) count += 1
		const minted = taskTypes.has(node.type) ? { ...node, attrs: { ...node.attrs, localId: uuidV4(hash128(`${seed} ${count}`)) } } : node
		if (node.content !== undefined && blockNodeModel(node.type)?.contentModel === 'block') open.push({ minted: [], node: minted, source: node.content.values() })
		else level.minted.push(minted)
	}
	return document.content === undefined ? document : { ...document, content: root.minted }
}

// cyrb128, public domain.
function hash128(text: string): number[] {
	let h1 = 1779033703
	let h2 = 3144134277
	let h3 = 1013904242
	let h4 = 2773480762
	for (let index = 0; index < text.length; index += 1) {
		const unit = text.charCodeAt(index)
		h1 = h2 ^ Math.imul(h1 ^ unit, 597399067)
		h2 = h3 ^ Math.imul(h2 ^ unit, 2869860233)
		h3 = h4 ^ Math.imul(h3 ^ unit, 951274213)
		h4 = h1 ^ Math.imul(h4 ^ unit, 2716044179)
	}
	h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
	h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
	h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
	h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
	h1 ^= h2 ^ h3 ^ h4
	h2 ^= h1
	h3 ^= h1
	h4 ^= h1
	return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

function uuidV4(lanes: readonly number[]): string {
	const hex = lanes.map((lane) => lane.toString(16).padStart(8, '0')).join('')
	const variant = ((Number.parseInt(hex.charAt(16), 16) & 3) | 8).toString(16)
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

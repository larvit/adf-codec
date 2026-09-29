import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { nodeAttrs, nodeContent } from '../../adf/document.ts'

const taskTypes = new Set(['blockTaskItem', 'taskItem', 'taskList'])

// docs/decisions.md, Plain task ids come from position.
export function mintTaskIds(document: AdfDocument, markdown: string): void {
  const taken = new Set<string>()
  for (const node of preorder(document, () => true)) {
    const localId = nodeAttrs(node)['localId']
    if (typeof localId === 'string') taken.add(localId)
  }
  const seed = hash128(markdown).join(' ')
  let count = 0
  for (const node of preorder(document, (held) => blockNodeModel(held.type) !== undefined)) {
    if (!taskTypes.has(node.type) || typeof nodeAttrs(node)['localId'] === 'string') continue
    let localId = ''
    do {
      count += 1
      localId = uuidV4(hash128(`${seed} ${count}`))
    } while (taken.has(localId))
    taken.add(localId)
    node.attrs = { ...node.attrs, localId }
  }
}

function* preorder(document: AdfDocument, entered: (node: AdfNode) => boolean): Generator<AdfNode> {
  const pending: AdfNode[] = []
  const pushReversed = (nodes: readonly AdfNode[]): void => {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index]
      if (node !== undefined) pending.push(node)
    }
  }
  pushReversed(document.content ?? [])
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    yield node
    if (entered(node)) pushReversed(nodeContent(node))
  }
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

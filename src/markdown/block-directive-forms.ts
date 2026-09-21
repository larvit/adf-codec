import { blockNodeNamed } from '../adf/block-nodes.ts'
import { listBreakName } from './list-break.ts'

export function blockDirectiveForm(name: string): 'container' | 'leaf' | undefined {
  if (name === listBreakName) return 'leaf'
  const blockNode = blockNodeNamed(name)
  if (blockNode === undefined) return undefined
  return blockNode.contentModel === 'none' ? 'leaf' : 'container'
}

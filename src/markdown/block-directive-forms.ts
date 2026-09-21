import { blockNodeModel } from '../adf/block-nodes.ts'
import { listBreakName } from './list-break.ts'

export function blockDirectiveForm(name: string): 'container' | 'leaf' | undefined {
  if (name === listBreakName) return 'leaf'
  const model = blockNodeModel(name)
  if (model === undefined) return undefined
  return model.contentModel === 'none' ? 'leaf' : 'container'
}

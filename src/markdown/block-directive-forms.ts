import { blockDirective } from '../adf/block-directives.ts'
import { listBreakName } from './list-break.ts'

export function blockDirectiveForm(name: string): 'container' | 'leaf' | undefined {
  if (name === listBreakName) return 'leaf'
  const directive = blockDirective(name)
  if (directive === undefined) return undefined
  return directive.contentModel === 'none' ? 'leaf' : 'container'
}

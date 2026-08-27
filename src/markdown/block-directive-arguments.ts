import type { BlockType } from '../adf/block-directives.ts'

const blockArguments: Readonly<Record<string, string>> = {
  blockTaskItem: 'state',
  panel: 'panelType',
  taskItem: 'state',
} satisfies Partial<Record<BlockType, string>>

export function blockArgument(type: string): string | undefined {
  return blockArguments[type]
}

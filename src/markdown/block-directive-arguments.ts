import type { BlockType } from '../adf/block-directives.ts'

const argumentByType = new Map(
  Object.entries({
    blockTaskItem: 'state',
    panel: 'panelType',
    taskItem: 'state',
  } satisfies Partial<Record<BlockType, string>>),
)

export function blockArgument(type: string): string | undefined {
  return argumentByType.get(type)
}

import type { AdfNode } from '../adf/document.ts'
import { blockNodes } from '../adf/block-nodes.ts'
import { dataAttributes } from './data-attributes.ts'
import { nodeContent } from '../adf/document.ts'

// Where a list item's first paragraph stands: `bare` on the item's line, its `element` there, or a `block` on a line of its own.
export type FirstParagraphForm = 'bare' | 'block' | 'element'

// As the writer panels picked (docs/decisions.md §The HTML dialect); a paragraph holding neither content nor an attribute, written bare, would read back as no paragraph.
export function firstParagraphForm(paragraph: AdfNode): FirstParagraphForm {
  const attributes = dataAttributes(paragraph, blockNodes.paragraph.attributes, [])
  if (attributes === undefined) return 'block'
  if (attributes !== '') return 'element'
  return nodeContent(paragraph).length === 0 ? 'block' : 'bare'
}

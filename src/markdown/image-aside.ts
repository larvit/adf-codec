import type { AdfNode } from '../adf/document.ts'

// The ` (image)` after a link for an image inside it, as the readers build it (spec/flavour.md, The CommonMark image) and `adfToPortableMarkdown` writes it; `link` builds the linked word `image`.
export function imageAside(link: (text: string) => AdfNode[]): AdfNode[] {
  return [{ text: ' (', type: 'text' }, ...link('image'), { text: ')', type: 'text' }]
}

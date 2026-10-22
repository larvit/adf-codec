import type { AdfNode } from '../adf/document.ts'
import type { LinkDefinition } from './commonmark/link-syntax.ts'
import { linkMark } from './mark-spellings.ts'

// spec/flavour.md, The CommonMark image: `![alt](url)` reads to `centeredImage([externalMedia(alt, url)])`, the only shape `adfToLosslessMarkdown` writes as `![alt](url)`.
export function centeredImage(content: AdfNode[]): AdfNode {
  return { attrs: { layout: 'center' }, content, type: 'mediaSingle' }
}

// `![](url)` builds no `alt`, so a media holding an empty one takes the directive form.
export function externalMedia(alt: string, url: string, link?: LinkDefinition): AdfNode {
  const media: AdfNode = { attrs: alt === '' ? { type: 'external', url } : { alt, type: 'external', url }, type: 'media' }
  return link === undefined ? media : { ...media, marks: [linkMark(link)] }
}

// The ` (image)` after a link for an image inside it, as the readers build it (spec/flavour.md, The CommonMark image) and `adfToPortableMarkdown` writes it; `link` builds `image`.
export function imageAside(link: (text: string) => AdfNode[]): AdfNode[] {
  return [{ text: ' (', type: 'text' }, ...link('image'), { text: ')', type: 'text' }]
}

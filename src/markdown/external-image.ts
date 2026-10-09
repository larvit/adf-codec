import type { AdfNode } from '../adf/document.ts'

// spec/flavour.md, The CommonMark image: `![alt](url)` reads to `centeredImage([externalMedia(alt, url)])`, the only shape written back as it.
export function centeredImage(content: AdfNode[]): AdfNode {
  return { attrs: { layout: 'center' }, content, type: 'mediaSingle' }
}

// `![](url)` builds no `alt`, so a media holding an empty one takes the directive form.
export function externalMedia(alt: string, url: string): AdfNode {
  return { attrs: alt === '' ? { type: 'external', url } : { alt, type: 'external', url }, type: 'media' }
}

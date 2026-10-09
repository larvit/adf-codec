import type { AdfNode } from '../adf/document.ts'

// spec/flavour.md, The CommonMark image: the shape `![alt](url)` reads to, and the only one written back as it.
export function centeredImage(content: AdfNode[]): AdfNode {
  return { attrs: { layout: 'center' }, content, type: 'mediaSingle' }
}

export function externalMedia(alt: string, url: string): AdfNode {
  return { attrs: alt === '' ? { type: 'external', url } : { alt, type: 'external', url }, type: 'media' }
}

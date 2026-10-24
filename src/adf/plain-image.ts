import type { AdfNode } from './document.ts'
import { linkAttrs, linkMarkFrom, type LinkAttrs } from './mark-attributes.ts'
import { nodeAttrs, nodeContent, nodeMarks } from './document.ts'
import { serializeCanonicalJson } from '../canonical-json.ts'

// `alt` undefined where the media holds none: an empty alt builds no `alt`, so a media holding an empty one is no plain image.
export type PlainImage = { alt: string | undefined; link: LinkAttrs | undefined; url: string }

export function centeredImage(content: AdfNode[]): AdfNode {
  return { attrs: { layout: 'center' }, content, type: 'mediaSingle' }
}

export function externalMedia(alt: string, url: string, link?: LinkAttrs): AdfNode {
  const media: AdfNode = { attrs: alt === '' ? { type: 'external', url } : { alt, type: 'external', url }, type: 'media' }
  return link === undefined ? media : { ...media, marks: [linkMarkFrom(link)] }
}

// The plain image, the one shape each format writes as its own image element: a centered `mediaSingle` holding one external `media`, which a link may mark. `undefined` unless the node is exactly the plain image its parts build.
export function plainImage(node: AdfNode): PlainImage | undefined {
  const [media] = nodeContent(node)
  if (media === undefined) return undefined
  const { alt, url } = nodeAttrs(media)
  if (typeof url !== 'string' || (alt !== undefined && typeof alt !== 'string')) return undefined
  const [mark] = nodeMarks(media)
  const link = mark === undefined ? undefined : linkAttrs(nodeAttrs(mark))
  const read = centeredImage([externalMedia(alt ?? '', url, link)])
  return serializeCanonicalJson(node, 'compact') === serializeCanonicalJson(read, 'compact') ? { alt, link, url } : undefined
}

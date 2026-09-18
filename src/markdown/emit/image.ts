import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath } from '../../result.ts'
import { carriesOnly, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { tryImageLine } from './inline-line.ts'

const centeredMediaSingle = '{"layout":"center"}'
const imageAttributes = ['alt', 'type', 'url']

export function tryImage(node: AdfNode, path: ConvertErrorPath): string | undefined {
  const image = imageShape(node)
  if (image === undefined) return undefined
  return tryImageLine(image.alt, image.url, [...path, 'content', 0])
}

function imageShape(node: AdfNode): { alt: string | undefined; url: string } | undefined {
  const content = nodeContent(node)
  const media = content[0]
  if (!carriesOnly(node, ['layout']) || serializeCanonicalJson(nodeAttrs(node), 'compact') !== centeredMediaSingle) return undefined
  if (media === undefined || content.length !== 1 || media.type !== 'media' || !carriesOnly(media, imageAttributes) || nodeContent(media).length > 0) return undefined
  const attrs = nodeAttrs(media)
  const alt = attrs['alt']
  const url = attrs['url']
  if (attrs['type'] !== 'external' || typeof url !== 'string') return undefined
  if (alt !== undefined && (typeof alt !== 'string' || alt === '')) return undefined
  return { alt, url }
}

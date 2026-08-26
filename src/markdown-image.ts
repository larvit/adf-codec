import type { AdfNode } from './adf-document.ts'
import type { ConvertErrorPath } from './result.ts'
import { serializeCanonicalJson } from './canonical-json.ts'
import { tryImageLine } from './markdown-inline.ts'

const centeredMediaSingle = '{"layout":"center"}'
const imageAttributes = ['alt', 'type', 'url']

export function tryImage(node: AdfNode, path: ConvertErrorPath): string | undefined {
  const image = imageShape(node)
  if (image === undefined) return undefined
  return tryImageLine(image.alt, image.url, [...path, 'content', 0])
}

function imageShape(node: AdfNode): { alt: string | undefined; url: string } | undefined {
  const content = node.content ?? []
  const media = content[0]
  if (serializeCanonicalJson(node.attrs ?? {}, 'compact') !== centeredMediaSingle || (node.marks ?? []).length > 0) return undefined
  if (media === undefined || content.length !== 1 || media.type !== 'media' || (media.marks ?? []).length > 0 || (media.content ?? []).length > 0) return undefined
  const attrs = media.attrs ?? {}
  const alt = attrs['alt']
  const url = attrs['url']
  if (Object.keys(attrs).some((key) => !imageAttributes.includes(key)) || attrs['type'] !== 'external' || typeof url !== 'string') return undefined
  if (alt !== undefined && (typeof alt !== 'string' || alt === '')) return undefined
  return { alt, url }
}

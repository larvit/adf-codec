import type { AdfNode } from './adf-document.ts'
import { emitImageLine } from './markdown-inline.ts'
import { failure, type ConvertErrorPath, type Result } from './result.ts'
import { serializeCanonicalJson } from './canonical-json.ts'

const centeredMediaSingle = '{"layout":"center"}'
const imageAttributes = ['alt', 'type', 'url']

export function emitImage(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  const image = imageShape(node)
  if (image === undefined) return undefined
  const mediaPath = [...path, 'content', 0]
  if (image.alt === '') return failure('ambiguous-attribute-spelling', 'an empty media alt and an absent one share one image spelling', mediaPath)
  return emitImageLine(image.alt, image.url, mediaPath)
}

function imageShape(node: AdfNode): { alt: string | undefined; url: string } | undefined {
  const content = node.content ?? []
  const media = content[0]
  if (serializeCanonicalJson(node.attrs ?? {}, 'compact') !== centeredMediaSingle || (node.marks ?? []).length > 0) return undefined
  if (media === undefined || content.length !== 1 || media.type !== 'media' || (media.marks ?? []).length > 0 || (media.content ?? []).length > 0) return undefined
  const attrs = media.attrs ?? {}
  const alt = attrs['alt']
  const url = attrs['url']
  if (Object.keys(attrs).some((key) => !imageAttributes.includes(key)) || attrs['type'] !== 'external') return undefined
  if (typeof url !== 'string' || (alt !== undefined && typeof alt !== 'string')) return undefined
  return { alt, url }
}

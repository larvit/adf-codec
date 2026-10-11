import type { AdfNode } from '../../adf/document.ts'
import type { LinkDefinition } from '../commonmark/link-syntax.ts'
import { centeredImage, externalMedia } from '../external-image.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { tryImageLine } from './inline-line.ts'

export function tryImage(node: AdfNode): string | undefined {
  const [media] = nodeContent(node)
  if (media === undefined) return undefined
  const { alt, url } = nodeAttrs(media)
  if (typeof url !== 'string' || (alt !== undefined && typeof alt !== 'string')) return undefined
  const [mark] = nodeMarks(media)
  const link = mark === undefined ? undefined : linkDefinition(nodeAttrs(mark))
  if (mark !== undefined && link === undefined) return undefined
  const read = centeredImage([externalMedia(alt ?? '', url, link)])
  return serializeCanonicalJson(node, 'compact') === serializeCanonicalJson(read, 'compact') ? tryImageLine(alt, url, link) : undefined
}

function linkDefinition({ href, title }: Readonly<Record<string, unknown>>): LinkDefinition | undefined {
  if (typeof href !== 'string') return undefined
  if (title === undefined) return { destination: href }
  return typeof title === 'string' ? { destination: href, title } : undefined
}

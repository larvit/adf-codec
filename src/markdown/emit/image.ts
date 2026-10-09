import type { AdfNode } from '../../adf/document.ts'
import { centeredImage, externalMedia } from '../external-image.ts'
import { nodeAttrs, nodeContent } from '../../adf/document.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { tryImageLine } from './inline-line.ts'

// An empty `alt` takes the directive form: `![](url)` reads back with no `alt`.
export function tryImage(node: AdfNode): string | undefined {
  const [media] = nodeContent(node)
  const { alt, url } = media === undefined ? {} : nodeAttrs(media)
  if (typeof url !== 'string' || (alt !== undefined && typeof alt !== 'string') || alt === '') return undefined
  const read = centeredImage([externalMedia(alt ?? '', url)])
  return serializeCanonicalJson(node, 'compact') === serializeCanonicalJson(read, 'compact') ? tryImageLine(alt, url) : undefined
}

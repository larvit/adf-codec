import type { AdfNode } from '../../adf/document.ts'
import type { WrittenFlavour } from '../flavour.ts'
import { centeredImage, externalMedia } from '../external-image.ts'
import { linkDefinition } from '../mark-spellings.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { serializeCanonicalJson } from '../../canonical-json.ts'
import { tryImageLine } from './inline-line.ts'

export function tryImage(node: AdfNode, flavour: WrittenFlavour): string | undefined {
  const [media] = nodeContent(node)
  if (media === undefined) return undefined
  const { alt, url } = nodeAttrs(media)
  if (typeof url !== 'string' || (alt !== undefined && typeof alt !== 'string')) return undefined
  const [mark] = nodeMarks(media)
  const link = mark === undefined ? undefined : linkDefinition(nodeAttrs(mark))
  const read = centeredImage([externalMedia(alt ?? '', url, link)])
  return serializeCanonicalJson(node, 'compact') === serializeCanonicalJson(read, 'compact') ? tryImageLine(alt, url, flavour, link) : undefined
}

import type { AdfNode } from '../../adf/document.ts'
import type { WrittenFlavour } from '../flavour.ts'
import { attrsDefinition } from '../mark-spellings.ts'
import { plainImage } from '../../adf/plain-image.ts'
import { tryImageLine } from './inline-line.ts'

export function tryImage(node: AdfNode, flavour: WrittenFlavour): string | undefined {
  const image = plainImage(node)
  if (image === undefined) return undefined
  const { alt, link, url } = image
  return tryImageLine(alt, url, flavour, link === undefined ? undefined : attrsDefinition(link))
}

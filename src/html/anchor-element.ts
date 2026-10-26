import type { LinkAttrs } from '../adf/mark-attributes.ts'
import { optionalAttribute, writableValue } from './escaping.ts'

export function anchorOpener({ href, title }: LinkAttrs): string | undefined {
  const url = writableValue(href)
  const titled = optionalAttribute('title', title)
  return url === undefined || titled === undefined ? undefined : `<a href="${url}"${titled}>`
}

// The link an `<a>`'s attributes hold, `undefined` where `anchorOpener` writes no such attributes.
export function readAnchorAttributes(attributes: readonly (readonly [string, string])[]): LinkAttrs | undefined {
  const [href, title, ...others] = attributes
  if (href?.[0] !== 'href' || (title !== undefined && title[0] !== 'title') || others.length > 0) return undefined
  return title === undefined ? { href: href[1] } : { href: href[1], title: title[1] }
}

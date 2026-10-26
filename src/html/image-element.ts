import type { PlainImage } from '../adf/plain-image.ts'
import { optionalAttribute, writableValue } from './escaping.ts'

// `undefined` where HTML cannot hold the image's url or alt.
export function imageElement({ alt, url }: PlainImage): string | undefined {
  const src = writableValue(url)
  const described = optionalAttribute('alt', alt)
  return src === undefined || described === undefined ? undefined : `<img src="${src}"${described}>`
}

// The `src` and `alt` an `<img>`'s attributes hold, `undefined` where `imageElement` writes no such attributes.
export function readImageAttributes(attributes: readonly (readonly [string, string])[]): { alt: string | undefined; src: string } | undefined {
  const [src, alt, ...others] = attributes
  if (src?.[0] !== 'src' || (alt !== undefined && alt[0] !== 'alt') || others.length > 0) return undefined
  return { alt: alt?.[1], src: src[1] }
}

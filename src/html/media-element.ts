import type { AdfAttributes, AdfNode } from '../adf/document.ts'
import type { JsonValue } from '../json-value.ts'
import type { Read } from '../result.ts'
import { anchorOpener } from './anchor-element.ts'
import { blockNodes } from '../adf/block-nodes.ts'
import { dataAttributes, readDataAttributes } from './data-attributes.ts'
import { linkAttrs } from '../adf/mark-attributes.ts'
import { nodeAttrs } from '../adf/document.ts'
import { optionalAttribute, writableValue } from './escaping.ts'

const count = /^[1-9][0-9]*$/
const imageClass = 'adf-media'
const imageWritten = ['alt', 'height', 'url', 'width']
const sizes = ['height', 'width']

// A media as an `<img>`, holding a url as `src` and leaving its type out where it is `external`, inside the `<a>` of the link that marks it; `undefined` where the element cannot hold it, so its `mediaSingle` rides the carry.
export function mediaImage(media: AdfNode): string | undefined {
  if (media.marks !== undefined && media.marks.length !== 1) return undefined
  const [mark] = media.marks ?? []
  const link = mark === undefined ? undefined : markedLink(mark)
  const anchor = link === undefined ? '' : anchorOpener(link)
  const bare: AdfNode = { ...media }
  delete bare.marks
  const attributes = imageAttributes(bare)
  if (attributes === undefined || anchor === undefined || (mark !== undefined && link === undefined)) return undefined
  return `${anchor}<img${attributes}>${link === undefined ? '' : '</a>'}`
}

// The attributes an `<img>` of the dialect holds, read as `readMediaImage` reads them; `fault` names no `src`, or a `class` besides one.
export function readMediaImage(pairs: readonly (readonly [string, string])[]): Read<AdfAttributes> {
  let rest = pairs
  const attrs: AdfAttributes = {}
  const [first] = rest
  const classed = first?.[0] === 'class' ? first : undefined
  if (classed !== undefined && classed[1] !== imageClass) return { fault: { code: 'unmappable-html', message: `an <img> in the dialect has class="${imageClass}" or none` } }
  if (classed !== undefined) rest = rest.slice(1)
  const src = rest[0]?.[0] === 'src' ? rest[0][1] : undefined
  if (src !== undefined) rest = rest.slice(1)
  if ((classed !== undefined) === (src !== undefined)) return { fault: { code: 'unmappable-html', message: `an <img> holds src, or class="${imageClass}" where its media holds no url, and never both` } }
  if (src !== undefined) attrs['url'] = src
  const alt = rest[0]?.[0] === 'alt' ? rest[0][1] : undefined
  if (alt !== undefined) {
    attrs['alt'] = alt
    rest = rest.slice(1)
  }
  for (const name of sizes) {
    const [first] = rest
    if (first?.[0] !== name) continue
    const size = Number(first[1])
    if (!count.test(first[1]) || !Number.isSafeInteger(size)) return { fault: { code: 'unmappable-html', message: `${name} on <img> holds a positive whole number written as JavaScript writes it` } }
    attrs[name] = size
    rest = rest.slice(1)
  }
  const data = readDataAttributes(rest, 'img', blockNodes.media.attributes, imageWritten)
  if (data.fault !== undefined) return data
  const { type } = data.value
  if (src !== undefined && type === 'external') return { fault: { code: 'unmappable-html', message: 'an <img> with src leaves out data-type where its media is external' } }
  return { value: { ...attrs, ...data.value, ...(src !== undefined && type === undefined ? { type: 'external' } : {}) } }
}

// The attributes of the `<img>` a media is, `undefined` where a value has no spelling there.
function imageAttributes(media: AdfNode): string | undefined {
  const { alt, height, type, url, width } = nodeAttrs(media)
  const src = url === undefined ? '' : typeof url === 'string' ? srcAttribute(url) : undefined
  const own = [url === undefined ? ` class="${imageClass}"` : src, altAttribute(alt), sizeAttribute('height', height), sizeAttribute('width', width)]
  // A url without a type reads back as external, so only an external media may leave its type out.
  const written = url !== undefined && type === 'external' ? [...imageWritten, 'type'] : imageWritten
  const data = url !== undefined && typeof type !== 'string' ? undefined : dataAttributes(media, blockNodes.media.attributes, written)
  const parts = [...own, data]
  return parts.every((part) => part !== undefined) ? parts.join('') : undefined
}

function srcAttribute(url: string): string | undefined {
  const written = writableValue(url)
  return written === undefined ? undefined : ` src="${written}"`
}

function altAttribute(alt: JsonValue | undefined): string | undefined {
  if (alt === undefined) return ''
  return typeof alt === 'string' ? optionalAttribute('alt', alt) : undefined
}

function sizeAttribute(name: string, value: JsonValue | undefined): string | undefined {
  if (value === undefined) return ''
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? ` ${name}="${value}"` : undefined
}

function markedLink(mark: { attrs?: AdfAttributes; type: string }): { href: string; title?: string } | undefined {
  const attrs = nodeAttrs(mark)
  const keys = Object.keys(attrs)
  if (mark.type !== 'link' || keys.length === 0 || keys.some((key) => key !== 'href' && key !== 'title')) return undefined
  return linkAttrs(attrs)
}

import type { AdfNode } from '../../adf/document.ts'
import { blockNodes } from '../../adf/block-nodes.ts'
import { built, readInlineBlock } from './inline-block.ts'
import { foundAt, readStartTag, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { linkMarkFrom } from '../../adf/mark-attributes.ts'
import { mediaGroupClass } from '../block-classes.ts'
import { readAnchorAttributes } from '../anchor-element.ts'
import { readDataAttributes } from '../data-attributes.ts'
import { readMediaImage } from '../media-element.ts'
import { success } from '../../result.ts'

const figureClass = 'adf-media-single'
const fileClass = 'adf-file'

// A `mediaSingle` as `adfToHtml` writes it: its media's image, then its caption, on one line.
export function readFigure(html: string, tag: StartTag, place: Place): ReadNode {
  const [leading, ...pairs] = tag.attributes
  if (leading?.[0] !== 'class' || leading[1] !== figureClass) return refused('unmappable-html', `<figure> starts with class="${figureClass}": ${foundAt(html, tag.start)}`, html, tag.start, place)
  const data = readDataAttributes(pairs, tag.name, blockNodes.mediaSingle.attributes, [])
  if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, tag.start, place)
  const media = readMedia(html, tag.end, { index: 0, parent: place })
  if (!media.ok) return media
  const content = [media.value.node]
  let { end } = media.value
  const figcaption = readStartTag(html, end)
  if (figcaption?.name === 'figcaption') {
    const caption = readInlineBlock(html, figcaption, 'caption', blockNodes.caption.attributes, {}, { index: 1, parent: place })
    if (!caption.ok) return caption
    content.push(caption.value.node)
    end = caption.value.end
  }
  return closed(html, end, '</figure>', 'its image, then its <figcaption>', built('mediaSingle', data.value, content), place)
}

// A `mediaGroup` as `adfToHtml` writes it: a span for each media, none between.
export function readMediaGroup(html: string, tag: StartTag, place: Place): ReadNode {
  if (tag.attributes.length !== 1) return refused('unmappable-html', `<div class="${mediaGroupClass}"> takes no other attribute: ${foundAt(html, tag.start)}`, html, tag.start, place)
  const content: AdfNode[] = []
  let at = tag.end
  for (let span = readStartTag(html, at); span?.name === 'span'; span = readStartTag(html, at)) {
    const [leading, ...pairs] = span.attributes
    const mediaPlace = { index: content.length, parent: place }
    if (leading?.[0] !== 'class' || leading[1] !== fileClass) return refused('unmappable-html', `a media group holds <span class="${fileClass}"> files: ${foundAt(html, span.start)}`, html, span.start, mediaPlace)
    const data = readDataAttributes(pairs, span.name, blockNodes.media.attributes, [])
    if (data.fault !== undefined) return refused(data.fault.code, data.fault.message, html, span.start, mediaPlace)
    if (!html.startsWith('</span>', span.end)) return refused('unmappable-html', `<span class="${fileClass}"> holds nothing, and ends at </span>: ${foundAt(html, span.end)}`, html, span.end, mediaPlace)
    content.push(built('media', data.value, []))
    at = span.end + '</span>'.length
  }
  return closed(html, at, '</div>', `its <span class="${fileClass}"> files`, built('mediaGroup', {}, content), place)
}

// The media an `<img>` reads as, and the `<a>` around it where a link marks it.
function readMedia(html: string, index: number, place: Place): ReadNode {
  const opener = readStartTag(html, index)
  const anchor = opener?.name === 'a' ? opener : undefined
  const image = anchor === undefined ? opener : readStartTag(html, anchor.end)
  const link = anchor === undefined ? undefined : readAnchorAttributes(anchor.attributes)
  if (image?.name !== 'img' || (anchor !== undefined && link === undefined)) return refused('unmappable-html', `a <figure> holds an <img>, inside <a href="…"> where a link marks it: ${foundAt(html, index)}`, html, index, place)
  const attrs = readMediaImage(image.attributes)
  if (attrs.fault !== undefined) return refused(attrs.fault.code, attrs.fault.message, html, image.start, place)
  const media = built('media', attrs.value, [])
  if (link === undefined) return success({ end: image.end, node: media })
  if (!html.startsWith('</a>', image.end)) return refused('unmappable-html', `<a> around an image ends at </a>: ${foundAt(html, image.end)}`, html, image.end, place)
  return success({ end: image.end + '</a>'.length, node: { ...media, marks: [linkMarkFrom(link)] } })
}

function closed(html: string, end: number, closer: string, held: string, node: AdfNode, place: Place): ReadNode {
  if (!html.startsWith(closer, end)) return refused('unmappable-html', `${closer.replace('/', '')} holds ${held}, then ${closer}: ${foundAt(html, end)}`, html, end, place)
  return success({ end: end + closer.length, node })
}

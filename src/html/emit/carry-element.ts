import type { AdfNode } from '../../adf/document.ts'
import type { LinkAttrs } from '../../adf/mark-attributes.ts'
import { anchorOpener, jsonValue, languageClass, shownValue } from '../escaping.ts'
import { carriedJson } from '../../adf/carried-json.ts'
import { largestNesting } from '../../nesting.ts'
import { nodeAttrs, nodeContent } from '../../adf/document.ts'
import { partsShownText, referenceName, shownImage, shownLink, shownText, shownUrl } from '../../adf/shown-text.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

// The content a carry element shows of one block; `code` the code block holding it, if any.
type ShownBlock = { code: AdfNode | undefined; html: string }

export function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting - depth)
  if (!json.ok) return json
  const shown = shownBlocks(node, '\n').map(({ code, html }) => (code === undefined ? `<p>${html}</p>` : `<pre><code${languageClass(nodeAttrs(code)['language']) ?? ''}>${html}</code></pre>`))
  return success(carryElement('div', json.value.json, shown.join('')))
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  return json.ok ? success(carryElement('span', json.value.json, shownBlocks(node, '<br>').map(({ html }) => html).join('<br>'))) : json
}

export function carryElement(tag: string, json: string, content: string): string {
  return `<${tag} class="adf-carry" data-adf="${jsonValue(json)}">${content}</${tag}>`
}

// What a carry element shows, block by block, as the writer panels picked it (docs/decisions.md §The HTML dialect); a reader of the element reads its JSON alone.
function shownBlocks(root: AdfNode, codeLineFeed: string): ShownBlock[] {
  const shown: ShownBlock[] = []
  let current: ShownBlock = { code: undefined, html: '' }
  // Each entry holds the code block it stands in, none where another block stands between them; a `null` node ends a block, and what follows stands in that entry's `code`, the code block around the block that ended.
  const pending: { code: AdfNode | undefined; node: AdfNode | null }[] = [{ code: undefined, node: root }]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { node } = next
    const code = node?.type === 'codeBlock' ? node : node !== null && partsShownText(node.type) ? undefined : next.code
    if (node === null || partsShownText(node.type)) {
      if (current.html !== '') shown.push(current)
      current = { code, html: '' }
    }
    if (node === null) continue
    current = { ...current, html: current.html + shownPiece(node, current.code === undefined ? '<br>' : codeLineFeed) }
    if (partsShownText(node.type)) pending.push({ code: next.code, node: null })
    for (const child of [...nodeContent(node)].reverse()) pending.push({ code, node: child })
  }
  if (current.html !== '') shown.push(current)
  return shown
}

// The node's own part of what its carry element shows.
function shownPiece(node: AdfNode, lineFeed: string): string {
  if (node.type === 'hardBreak') return '<br>'
  if (['media', 'mediaInline'].includes(node.type)) return linkedImage(node, lineFeed)
  return linkedText(node, shownText(node), shownUrl(node), lineFeed)
}

// As portable markdown writes it inline, except that a link around a note stays and an image's own `text`, outside ADF's schema, shows first (docs/decisions.md §The HTML dialect).
function linkedImage(media: AdfNode, lineFeed: string): string {
  const image = shownImage(media, shownLink(media)?.href)
  const shown = linkedText(media, image?.text, image?.link, lineFeed)
  return image?.after === undefined ? shown : `${shown} (${linked('image', { href: image.after })})`
}

function linkedText(node: AdfNode, standIn: string | undefined, url: string | undefined, lineFeed: string): string {
  const link = shownLink(node) ?? (url === undefined ? undefined : { href: url })
  const text = node.text ?? standIn
  if (text !== undefined) return linked(shownValue(text, lineFeed), link)
  const name = referenceName(node)
  return name === undefined ? '' : linked(`<em>(${shownValue(name, lineFeed)})</em>`, link)
}

// The shown HTML inside an `<a>` where it links and HTML can hold the link.
function linked(shown: string, link: LinkAttrs | undefined): string {
  const anchor = link === undefined ? undefined : anchorOpener(link)
  return anchor === undefined ? shown : `${anchor}${shown}</a>`
}

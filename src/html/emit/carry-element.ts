import type { AdfNode } from '../../adf/document.ts'
import { anchorOpener, jsonValue, languageClass, shownValue } from './escaping.ts'
import { carriedJson } from '../../adf/carried-json.ts'
import { largestNesting } from '../../nesting.ts'
import { linkAttrs, type LinkAttrs } from '../../adf/mark-attributes.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { partsShownText, referenceName, shownText, shownUrl, visibleText } from '../../adf/shown-text.ts'
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
  // Each entry holds the code block it stands in, none where another block stands between them; a `null` node ends a block, after which the content stands in `code` again.
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

// The node's own part of what its carry element shows: its text, what it shows in its place, or a note naming what it references, linked to its link mark's target, else to the URL a card or an image links to; an image a link to another target marks is followed by a link to it.
function shownPiece(node: AdfNode, lineFeed: string): string {
  if (node.type === 'hardBreak') return '<br>'
  const mark = nodeMarks(node).find((held) => held.type === 'link')
  const target = mark === undefined ? undefined : linkAttrs(nodeAttrs(mark))
  const url = shownUrl(node)
  if (['media', 'mediaInline'].includes(node.type) && target !== undefined && url !== undefined && target.href !== url) return linkedImage(node, target, url, lineFeed)
  const link = target ?? (url === undefined ? undefined : { href: url })
  const text = node.text ?? shownText(node)
  if (text !== undefined) return linked(shownValue(text, lineFeed), link)
  const name = referenceName(node)
  return name === undefined ? '' : linked(`<em>(${shownValue(name, lineFeed)})</em>`, link)
}

// The image's alt, else the link's target, else its URL, linked to the target, then a link to the image, as portable markdown writes it inline.
function linkedImage(media: AdfNode, target: LinkAttrs, url: string, lineFeed: string): string {
  const text = visibleText(nodeAttrs(media)['alt']) ?? visibleText(target.href) ?? url
  return `${linked(shownValue(text, lineFeed), target)} (${linked('image', { href: url })})`
}

// The shown HTML inside an `<a>` where it links and HTML can hold the link.
function linked(shown: string, link: LinkAttrs | undefined): string {
  const anchor = link === undefined ? undefined : anchorOpener(link)
  return anchor === undefined ? shown : `${anchor}${shown}</a>`
}

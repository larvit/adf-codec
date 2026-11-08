import type { AdfNode } from '../adf/document.ts'
import type { LinkAttrs } from '../adf/mark-attributes.ts'
import { anchorOpener } from './anchor-element.ts'
import { languageClass } from './language-class.ts'
import { nodeAttrs, nodeContent } from '../adf/document.ts'
import { partsShownText, referenceName, shownImage, shownLink, shownText, shownUrl } from '../adf/shown-text.ts'
import { shownValue } from './escaping.ts'

// One object per block a node stands in, so a block's content after a nested block parts from its content before; `code` the code block it is, if any.
type BlockPart = { code: AdfNode | undefined }

type ShownBlock = { html: string; part: BlockPart }

// What a carry element shows of the node it holds, and all `htmlToAdf` accepts there, so a change here breaks reading stored HTML (docs/decisions.md §The formats are API).
export function carryContent(node: AdfNode, tag: 'div' | 'span'): string {
  if (tag === 'span') return shownBlocks(node, '<br>').map(({ html }) => html).join('<br>')
  return shownBlocks(node, '\n').map(({ html, part: { code } }) => (code === undefined ? `<p>${html}</p>` : `<pre><code${languageClass(nodeAttrs(code)['language']) ?? ''}>${html}</code></pre>`)).join('')
}

// What a carry element shows, block by block, as the writer panels picked it (docs/decisions.md §The HTML dialect).
function shownBlocks(root: AdfNode, codeLineFeed: string): ShownBlock[] {
  const shown: ShownBlock[] = []
  const pending: { node: AdfNode; part: BlockPart }[] = [{ node: root, part: { code: undefined } }]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { node } = next
    const part = partsShownText(node.type) ? { code: node.type === 'codeBlock' ? node : undefined } : next.part
    const piece = shownPiece(node, part.code === undefined ? '<br>' : codeLineFeed)
    const last = shown.at(-1)
    if (last?.part === part) last.html += piece
    else shown.push({ html: piece, part })
    for (const child of [...nodeContent(node)].reverse()) pending.push({ node: child, part })
  }
  return shown.filter(({ html }) => html !== '')
}

// The node's own part of what its carry element shows.
function shownPiece(node: AdfNode, lineFeed: string): string {
  if (node.type === 'hardBreak') return '<br>'
  if (['media', 'mediaInline'].includes(node.type)) return linkedImage(node, lineFeed)
  return linkedText(node, shownText(node), shownUrl(node), lineFeed)
}

// As portable markdown writes it inline, except that a link around a note stays (docs/decisions.md §The HTML dialect).
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

import type { AdfNode } from '../../adf/document.ts'
import { anchorOpener, jsonValue, shownValue } from './escaping.ts'
import { carriedJson } from '../../adf/carried-json.ts'
import { largestNesting } from '../../nesting.ts'
import { linkAttrs, type LinkAttrs } from '../../adf/mark-attributes.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { partsShownText, referenceName, shownText, shownUrl } from '../../adf/shown-text.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

// Where the carry element stands: a `<div>` shows each block as a paragraph, a `<span>` parts them with line breaks.
type Position = 'block' | 'inline'

export function carriedBlock(node: AdfNode, path: ConvertErrorPath, depth: number): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting - depth)
  return json.ok ? success(carryElement('div', json.value.json, shownContent(node, 'block'))) : json
}

export function carriedInline(node: AdfNode, path: ConvertErrorPath): Result<string> {
  const json = carriedJson(node, node, 'compact', path, largestNesting)
  return json.ok ? success(carryElement('span', json.value.json, shownContent(node, 'inline'))) : json
}

export function carryElement(tag: string, json: string, content: string): string {
  return `<${tag} class="adf-carry" data-adf="${jsonValue(json)}">${content}</${tag}>`
}

// What a carry element shows, its links and its notes as the writer panel picked them (docs/decisions.md §The HTML dialect); a reader of the element reads its JSON alone.
function shownContent(root: AdfNode, position: Position): string {
  const groups: string[] = []
  let group = ''
  const pending: (AdfNode | 'end of block')[] = [root]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const parts = next === 'end of block' || partsShownText(next.type)
    if (parts && group !== '') groups.push(group)
    if (parts) group = ''
    if (next === 'end of block') continue
    group += shownPiece(next)
    if (partsShownText(next.type)) pending.push('end of block')
    for (const child of [...nodeContent(next)].reverse()) pending.push(child)
  }
  if (group !== '') groups.push(group)
  return position === 'block' ? groups.map((shown) => `<p>${shown}</p>`).join('') : groups.join('<br>')
}

// The node's own part of what its carry element shows: its text or what it shows in its place, linked where it links; a note where it references what it cannot show.
function shownPiece(node: AdfNode): string {
  if (node.type === 'hardBreak') return '<br>'
  const text = node.text ?? shownText(node)
  if (text === undefined) {
    const name = referenceName(node)
    return name === undefined ? '' : `<em>(${shownValue(name)})</em>`
  }
  const link = shownLink(node)
  const anchor = link === undefined ? undefined : anchorOpener(link)
  return anchor === undefined ? shownValue(text) : `${anchor}${shownValue(text)}</a>`
}

// What a reader of the carry element follows from the node: its link mark's target, or the URL a card or an image links to.
function shownLink(node: AdfNode): LinkAttrs | undefined {
  const mark = nodeMarks(node).find((held) => held.type === 'link')
  if (mark !== undefined) return linkAttrs(nodeAttrs(mark))
  const href = shownUrl(node)
  return href === undefined ? undefined : { href }
}

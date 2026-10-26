import type { AdfMark, AdfNode } from '../../adf/document.ts'
import type { ParseError, Result } from '../../result.ts'
import { heldNode, readCarry } from './carry-element.ts'
import { largestNesting } from '../../nesting.ts'
import { linkMarkFrom } from '../../adf/mark-attributes.ts'
import { markOfElement } from '../mark-elements.ts'
import { readAnchorAttributes } from '../anchor-element.ts'
import { readStartTag, refused, type Place, type ReadNode, type StartTag } from './source.ts'
import { success } from '../../result.ts'
import { unescapedValue } from '../escaping.ts'

// The inline nodes from `index` up to the first tag opening none, which the caller reads.
export function readInline(html: string, index: number, place: Place): Result<{ end: number; nodes: AdfNode[] }, ParseError> {
  const nodes: AdfNode[] = []
  let at = index
  while (at < html.length) {
    const nodePlace = { index: nodes.length, parent: place }
    const read = html.startsWith('<', at) ? readTagged(html, at, nodePlace) : readText(html, at, [], nodePlace)
    if (read === undefined) break
    if (!read.ok) return read
    nodes.push(read.value.node)
    at = read.value.end
  }
  return success({ end: at, nodes })
}

// `undefined` where the tag at `index` opens no inline node.
function readTagged(html: string, index: number, place: Place): ReadNode | undefined {
  const tag = readStartTag(html, index)
  if (tag?.name === 'br' && tag.attributes.length === 0) return success({ end: tag.end, node: { type: 'hardBreak' } })
  if (tag?.name !== 'span') return tag !== undefined && markOf(tag) !== undefined ? readMarked(html, index, place) : undefined
  const carry = readCarry(html, tag, largestNesting, place)
  if (!carry.ok) return carry
  const node = heldNode(carry.value.held, html, index, place)
  return node.ok ? success({ end: carry.value.end, node: node.value }) : node
}

// Each text node writes its own elements, one inside the other around its text, the first mark outermost.
function readMarked(html: string, index: number, place: Place): ReadNode {
  const marks: AdfMark[] = []
  const closers: string[] = []
  let at = index
  for (;;) {
    const tag = readStartTag(html, at)
    const mark = tag === undefined ? undefined : markOf(tag)
    if (tag === undefined || mark === undefined) break
    if (marks.some(({ type }) => type === mark.type)) return refused('unmappable-html', `text holds each mark once: found a second <${tag.name}> inside one`, html, at, place)
    marks.push(mark)
    closers.unshift(`</${tag.name}>`)
    at = tag.end
  }
  if (at === html.length || html.startsWith('<', at)) return refused('unmappable-html', 'a mark element holds one text, or one mark element holding it', html, at, place)
  const text = readText(html, at, marks, place)
  if (!text.ok) return text
  at = text.value.end
  for (const closer of closers) {
    if (!html.startsWith(closer, at)) return refused('unmappable-html', `marked text ends at ${closer}: found something else`, html, at, place)
    at += closer.length
  }
  return success({ end: at, node: text.value.node })
}

function readText(html: string, index: number, marks: AdfMark[], place: Place): ReadNode {
  const next = html.indexOf('<', index)
  const end = next < 0 ? html.length : next
  const text = unescapedValue(html.slice(index, end))
  if (text === undefined) return refused('unmappable-html', 'text escapes &, <, > and " as &amp;, &lt;, &gt; and &quot;, and holds no character HTML cannot hold', html, index, place)
  return success({ end, node: marks.length === 0 ? { text, type: 'text' } : { marks, text, type: 'text' } })
}

function markOf(tag: StartTag): AdfMark | undefined {
  if (tag.name === 'a') {
    const link = readAnchorAttributes(tag.attributes)
    return link === undefined ? undefined : linkMarkFrom(link)
  }
  const type = tag.attributes.length === 0 ? markOfElement(tag.name) : undefined
  return type === undefined ? undefined : { type }
}

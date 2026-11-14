import type { AdfDocument, AdfNode } from '../adf/document.ts'
import { blockNodeModel } from '../adf/block-nodes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'
import { linkAttrs, type LinkAttrs } from '../adf/mark-attributes.ts'
import { largestNesting } from '../nesting.ts'
import { longestOutput, tooLong, withinEngineLimits } from '../length-bound.ts'
import { nodeAttrs, nodeContent, nodeMarks, readAdfDocument, writableContent } from '../adf/document.ts'
import { shownText } from '../adf/shown-text.ts'

// `gap`: the line feeds the next text needs before it at least; `leave`: the state to restore after a list item, and its `length` at the start, which shows whether it wrote anything; `marker`: the marker this node has in its list; `suffix`: text written right after this node; `depth`: the nesting level as `largestNesting` counts it; `parent`: the node holding this one, from which a refusal's path is built.
type Place = { index: number; parent: Place | undefined }
type Step =
  | { kind: 'gap'; lines: number }
  | { kind: 'leave'; indent: string; lead: string | undefined; length: number }
  | { depth: number; kind: 'node'; marker: string | undefined; node: AdfNode; place: Place | undefined; suffix: string | undefined }

// `lines`: the line feeds between a node's children; `level`: how much deeper they nest.
type Layout = { level: number; lines: number }

const bulletLists = ['bulletList', 'decisionList', 'taskList']
const itemTypes = ['blockTaskItem', 'listItem']
const markedItems = ['blockTaskItem', 'decisionItem', 'listItem', 'taskItem']
const shownTextTypes = ['date', 'emoji', 'mention', 'status']

export function adfToPlainText(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => {
    const read = readAdfDocument(document)
    if (!read.ok) return read
    const content = writableContent(read.value)
    return content.ok ? writeText(content.value ?? []) : content
  })
}

// A stack rather than recursion (docs/decisions.md §Nothing recurses unbounded). Text is written the moment it is met: `gap` holds the line feeds the layout owes first and `literal` those the text before ended in, of which the larger is written, `lead` the marker of the item it opens, `indent` the margin of every line after that.
function writeText(content: readonly AdfNode[]): Result<string> {
  const pieces: string[] = []
  let length = 0
  let gap = 0
  let indent = ''
  let lead: string | undefined
  let literal = 0

  function emit(text: string): void {
    let end = text.length
    while (end > 0 && text[end - 1] === '\n') end -= 1
    if (end > 0) {
      const owed = Math.max(gap, literal)
      const head = length === 0 || owed > 0 ? `${length === 0 ? '' : '\n'.repeat(owed)}${lead ?? indent}` : ''
      const body = text.slice(0, end).replaceAll(/\n(?=[^\n])/g, `\n${indent}`)
      pieces.push(head, body)
      length += head.length + body.length
      gap = 0
      lead = undefined
      literal = 0
    }
    literal += text.length - end
  }

  const pending: Step[] = childSteps(content, { level: 1, lines: 2 }, 0, undefined, () => undefined).reverse()
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    if (step.kind === 'gap') {
      gap = Math.max(gap, step.lines)
      continue
    }
    if (step.kind === 'leave') {
      indent = step.indent
      lead = step.length === length ? step.lead : undefined
      continue
    }
    const { depth, marker, node, place, suffix } = step
    if (depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, pathTo(place))
    if (marker !== undefined) {
      pending.push({ indent, kind: 'leave', lead, length })
      lead = lead === undefined ? `${indent}${marker}` : `${lead}${marker}`
      indent = `${indent}${' '.repeat(marker.length)}`
    }
    if (node.type === 'hardBreak') gap += 1
    else if (shownTextTypes.includes(node.type)) emit(shownText(node) ?? '')
    else {
      if (typeof node.text === 'string') emit(node.text)
      if (suffix !== undefined) emit(suffix)
      const layout = layoutOf(node)
      for (const child of childSteps(nodeContent(node), layout, depth + layout.level, place, markerFor(node)).reverse()) pending.push(child)
    }
    if (length > longestOutput) return tooLong()
  }
  return success(pieces.join(''))
}

// The steps for `nodes` in document order, `layout.lines` line feeds apart.
function childSteps(nodes: readonly AdfNode[], layout: Layout, depth: number, parent: Place | undefined, markerFor: (index: number, node: AdfNode) => string | undefined): Step[] {
  const steps: Step[] = []
  const links = nodes.map(linkOf)
  let run = ''
  for (const [index, node] of nodes.entries()) {
    if (index > 0) steps.push({ kind: 'gap', lines: layout.lines })
    const link = links[index]
    const before = links[index - 1]
    run = link !== undefined && before !== undefined && sameLink(link, before) ? `${run}${node.text ?? ''}` : node.text ?? ''
    const after = links[index + 1]
    const ends = link !== undefined && !(after !== undefined && sameLink(link, after))
    steps.push({ depth, kind: 'node', marker: markerFor(index, node), node, place: { index, parent }, suffix: ends && run !== '' ? linkSuffix(link, run) : undefined })
  }
  return steps
}

function linkOf(node: AdfNode): LinkAttrs | undefined {
  const mark = nodeMarks(node).find((held) => held.type === 'link')
  return node.type === 'text' && mark !== undefined ? linkAttrs(nodeAttrs(mark)) : undefined
}

function sameLink(left: LinkAttrs, right: LinkAttrs): boolean {
  return left.href === right.href && left.title === right.title
}

function linkSuffix(link: LinkAttrs, text: string): string | undefined {
  if (link.title === undefined) return text === link.href ? undefined : ` (${link.href})`
  return ` (${link.href}, "${link.title}")`
}

// Children stand on one line where they are inline, a line feed apart in a list and an item, a blank line apart between blocks. A list's items nest one level below it, an item's blocks at its own.
function layoutOf(node: AdfNode): Layout {
  if (bulletLists.includes(node.type) || node.type === 'orderedList') return { level: 1, lines: 1 }
  if (itemTypes.includes(node.type)) return { level: 0, lines: 1 }
  if (node.type === 'tableCell' || node.type === 'tableHeader') return { level: 0, lines: 2 }
  const model = blockNodeModel(node.type)
  if (model !== undefined) return model.contentModel === 'block' ? { level: 1, lines: 2 } : { level: 0, lines: 0 }
  return nodeContent(node).every((child) => child.type === 'text' || inlineNodeModel(child.type) !== undefined) ? { level: 0, lines: 0 } : { level: 1, lines: 2 }
}

// A child of a list that is no item, such as a task list nested in one, gets blank margin so it stands under the item before it.
function markerFor(node: AdfNode): (index: number, child: AdfNode) => string | undefined {
  if (bulletLists.includes(node.type)) return (_index, child) => (markedItems.includes(child.type) ? bulletOf(child) : '  ')
  if (node.type !== 'orderedList') return () => undefined
  const order = nodeAttrs(node)['order']
  const first = typeof order === 'number' && Number.isSafeInteger(order) ? order : 1
  return (index, child) => {
    const number = `${first + index}. `
    return markedItems.includes(child.type) ? number : ' '.repeat(number.length)
  }
}

function bulletOf(item: AdfNode): string {
  if (item.type !== 'blockTaskItem' && item.type !== 'taskItem') return '• '
  return nodeAttrs(item)['state'] === 'DONE' ? '☑ ' : '☐ '
}

function pathTo(place: Place | undefined): ConvertErrorPath {
  const indexes: number[] = []
  for (let held = place; held !== undefined; held = held.parent) indexes.push(held.index)
  return indexes.reverse().flatMap((index) => ['content', index])
}

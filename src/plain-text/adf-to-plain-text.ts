import type { AdfDocument, AdfNode } from '../adf/document.ts'
import { blockNodeModel } from '../adf/block-nodes.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../result.ts'
import { inlineNodeModel } from '../adf/inline-nodes.ts'
import { largestNesting } from '../nesting.ts'
import { longestOutput, tooLong, withinEngineLimits } from '../length-bound.ts'
import { nodeAttrs, nodeContent, readAdfDocument, writableContent } from '../adf/document.ts'
import { shownText } from '../adf/shown-text.ts'

// `gap`: the line feeds the next text needs before it, at least; `leave`: the state a list item restores; `marker`: the list marker of the item a node is; `depth`: the nesting level, as `largestNesting` counts it; `parent`: the node holding this one, from which its path is built when a refusal needs it.
type Place = { index: number; parent: Place | undefined }
type Step =
  | { kind: 'gap'; lines: number }
  | { kind: 'leave'; indent: string; lead: string | undefined; written: number }
  | { depth: number; kind: 'node'; marker: string | undefined; node: AdfNode; place: Place | undefined }

// `lines`: the line feeds between a node's children; `level`: how much deeper they nest.
type Layout = { level: number; lines: number }

const bulletLists = ['bulletList', 'decisionList', 'taskList']
const itemTypes = ['blockTaskItem', 'listItem']
const shownTextTypes = ['date', 'emoji', 'mention', 'status']

export function adfToPlainText(document: AdfDocument): Result<string> {
  return withinEngineLimits(() => {
    const read = readAdfDocument(document)
    if (!read.ok) return read
    const content = writableContent(read.value)
    return content.ok ? writeText(content.value ?? []) : content
  })
}

// A stack rather than recursion (docs/decisions.md §Nothing recurses unbounded). Text is written the moment it is met: `gap` holds the line feeds it owes first, `lead` the marker of the item it opens, `indent` the margin of every line after that.
function writeText(content: readonly AdfNode[]): Result<string> {
  const pieces: string[] = []
  let length = 0
  let gap = 0
  let indent = ''
  let lead: string | undefined
  let written = 0

  function emit(text: string): void {
    if (text === '') return
    if (lead !== undefined && gap === 0) gap = 1
    const atLineStart = written === 0 || gap > 0
    const head = atLineStart ? `${written === 0 ? '' : '\n'.repeat(gap)}${lead ?? indent}` : ''
    const body = indent === '' ? text : text.replaceAll(/\n(?=[^\n])/g, `\n${indent}`)
    pieces.push(head, body)
    length += head.length + body.length
    gap = 0
    lead = undefined
    written += 1
  }

  const pending: Step[] = childSteps(content, { level: 1, lines: 2 }, 0, undefined, () => undefined).reverse()
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    if (step.kind === 'gap') {
      gap = Math.max(gap, step.lines)
      continue
    }
    if (step.kind === 'leave') {
      indent = step.indent
      lead = step.written === written ? step.lead : undefined
      continue
    }
    const { depth, marker, node, place } = step
    if (depth > largestNesting) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, pathTo(place))
    if (marker !== undefined) {
      pending.push({ indent, kind: 'leave', lead, written })
      lead = lead === undefined ? `${indent}${marker}` : `${lead}${marker}`
      indent = `${indent}${' '.repeat(marker.length)}`
    }
    if (node.type === 'hardBreak') gap = Math.max(gap, 1)
    else if (node.type === 'text') emit(node.text ?? '')
    else if (shownTextTypes.includes(node.type)) emit(shownText(node) ?? '')
    else {
      if (typeof node.text === 'string') emit(node.text)
      const layout = layoutOf(node)
      for (const child of childSteps(nodeContent(node), layout, depth + layout.level, place, markerFor(node)).reverse()) pending.push(child)
    }
    if (length > longestOutput) return tooLong()
  }
  return success(pieces.join(''))
}

// The steps for `nodes` in document order, `layout.lines` line feeds apart.
function childSteps(nodes: readonly AdfNode[], layout: Layout, depth: number, parent: Place | undefined, markerFor: (index: number) => string | undefined): Step[] {
  const steps: Step[] = []
  for (const [index, node] of nodes.entries()) {
    if (index > 0 && layout.lines > 0) steps.push({ kind: 'gap', lines: layout.lines })
    steps.push({ depth, kind: 'node', marker: markerFor(index), node, place: { index, parent } })
  }
  return steps
}

// Children are written in a line where they are inline, a line apart inside a list and an item, a blank line apart between blocks. A list's items nest one level below it, an item's blocks at its own.
function layoutOf(node: AdfNode): Layout {
  if (bulletLists.includes(node.type) || node.type === 'orderedList') return { level: 1, lines: 1 }
  if (itemTypes.includes(node.type)) return { level: 0, lines: 1 }
  if (node.type === 'tableCell' || node.type === 'tableHeader') return { level: 0, lines: 2 }
  const model = blockNodeModel(node.type)
  if (model !== undefined) return model.contentModel === 'block' ? { level: 1, lines: 2 } : { level: 0, lines: 0 }
  return nodeContent(node).every((child) => child.type === 'text' || inlineNodeModel(child.type) !== undefined) ? { level: 0, lines: 0 } : { level: 1, lines: 2 }
}

function markerFor(node: AdfNode): (index: number) => string | undefined {
  if (bulletLists.includes(node.type)) return () => '• '
  if (node.type !== 'orderedList') return () => undefined
  const order = nodeAttrs(node)['order']
  const first = typeof order === 'number' && Number.isSafeInteger(order) ? order : 1
  return (index) => `${first + index}. `
}

function pathTo(place: Place | undefined): ConvertErrorPath {
  const indexes: number[] = []
  for (let held = place; held !== undefined; held = held.parent) indexes.push(held.index)
  return indexes.reverse().flatMap((index) => ['content', index])
}

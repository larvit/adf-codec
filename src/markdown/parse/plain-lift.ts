import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import { blockNodeModel } from '../../adf/block-nodes.ts'
import { isWordCharacter } from '../commonmark/emphasis-matching.ts'
import { highlightDelimiter, readAlertMarker, readTaskMarker } from '../plain-conventions.ts'
import { mergeAdjacentText, sameMarks } from '../../adf/editor-normal.ts'
import { nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'

type Delimiter = { closes: boolean; holder: AdfNode; line: number; node: number; offset: number; opens: boolean; position: number }

type MarkerLed<T> = { marker: T; rest: AdfNode[] }

const editorHighlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }

export function liftFromPlain(document: AdfDocument): AdfDocument {
  return { ...document, content: liftBlocks(nodeContent(document), false) }
}

function liftBlocks(blocks: readonly AdfNode[], inExpand: boolean): AdfNode[] {
  return blocks.map((block) => liftBlock(block, inExpand))
}

function liftBlock(block: AdfNode, inExpand: boolean): AdfNode {
  const model = blockNodeModel(block.type)?.contentModel
  if (model === 'inline') return { ...block, content: highlighted(nodeContent(block)) }
  if (model !== 'block') return block
  if (block.type === 'blockquote') return liftQuote(block, inExpand)
  const tasks = block.type === 'bulletList' ? taskItems(nodeContent(block), inExpand) : undefined
  if (tasks !== undefined) return { content: tasks, type: 'taskList' }
  return { ...block, content: liftBlocks(nodeContent(block), inExpand || block.type === 'expand' || block.type === 'nestedExpand') }
}

function paragraphOf(content: readonly AdfNode[]): AdfNode[] {
  return content.length === 0 ? [] : [{ content: [...content], type: 'paragraph' }]
}

// The marker opens the block's unmarked text and whitespace or the line's end follows it.
function markerLed<T extends { length: number }>(block: AdfNode | undefined, read: (text: string) => T | undefined): MarkerLed<T> | undefined {
  if (block?.type !== 'paragraph') return undefined
  const [first, ...others] = nodeContent(block)
  if (first?.type !== 'text' || first.text === undefined || nodeMarks(first).length > 0) return undefined
  const marker = read(first.text)
  if (marker === undefined) return undefined
  const tail = first.text.slice(marker.length)
  const lineEnds = tail === '' && (others[0] === undefined || others[0].type === 'hardBreak')
  if (!lineEnds && !/^[ \t]/.test(tail)) return undefined
  const trimmed = tail.replace(/^[ \t]+/, '')
  const rest = trimmed === '' ? others : [{ text: trimmed, type: 'text' }, ...others]
  let from = 0
  while (rest[from]?.type === 'hardBreak') from += 1
  return { marker, rest: rest.slice(from) }
}

function liftQuote(quote: AdfNode, inExpand: boolean): AdfNode {
  const [first, ...body] = nodeContent(quote)
  const led = markerLed(first, readAlertMarker)
  if (led === undefined) return { ...quote, content: liftBlocks(nodeContent(quote), inExpand) }
  if (!led.marker.folded) return { attrs: { panelType: led.marker.panelType }, content: filled(liftBlocks([...paragraphOf(led.rest), ...body], inExpand)), type: 'panel' }
  const title = led.rest.map((node) => node.text ?? (node.type === 'hardBreak' ? '\n' : '')).join('')
  const content = filled(liftBlocks(body, true))
  const type = inExpand ? 'nestedExpand' : 'expand'
  return title === '' ? { content, type } : { attrs: { title }, content, type }
}

// Atlassian's schema requires a panel and an expand to hold a block.
function filled(blocks: AdfNode[]): AdfNode[] {
  return blocks.length === 0 ? [{ type: 'paragraph' }] : blocks
}

// A task list trailing an item's blocks stands beside it, as ADF nests one.
function taskItems(items: readonly AdfNode[], inExpand: boolean): AdfNode[] | undefined {
  if (items.length === 0) return undefined
  const tasks: AdfNode[] = []
  for (const item of items) {
    const led = item.type === 'listItem' ? markerLed(nodeContent(item)[0], readTaskMarker) : undefined
    if (led === undefined) return undefined
    const blocks = liftBlocks([...paragraphOf(led.rest), ...nodeContent(item).slice(1)], inExpand)
    let beside = blocks.length
    while (blocks[beside - 1]?.type === 'taskList') beside -= 1
    const kept = blocks.slice(0, beside)
    const [only] = kept
    const attrs = { state: led.marker.state }
    const inline = kept.length <= 1 && (only === undefined || only.type === 'paragraph')
    tasks.push(inline ? { attrs, content: [...nodeContent(only ?? {})], type: 'taskItem' } : { attrs, content: kept, type: 'blockTaskItem' })
    for (const nested of blocks.slice(beside)) tasks.push(nested)
  }
  return tasks
}

function highlighted(inline: readonly AdfNode[]): AdfNode[] {
  const pairs = pairedDelimiters(inline)
  return pairs.length === 0 ? [...inline] : mergeAdjacentText(split(inline, pairs))
}

function textOf(node: AdfNode | undefined): string | undefined {
  return node?.type === 'text' ? node.text : undefined
}

// Atlassian's schema refuses a highlight on code, a node holds one highlight, and a rebuilt node would lose its attributes.
function heldWhole(node: AdfNode): boolean {
  return Object.keys(nodeAttrs(node)).length > 0 || nodeMarks(node).some((mark) => mark.type === 'code' || mark.type === 'backgroundColor')
}

function delimiters(inline: readonly AdfNode[]): Delimiter[] {
  const found: Delimiter[] = []
  let line = 0
  let position = 0
  for (const [index, node] of inline.entries()) {
    const text = textOf(node)
    if (text === undefined) line += 1
    if (text === undefined || heldWhole(node)) {
      position += text?.length ?? 0
      continue
    }
    for (let offset = text.indexOf(highlightDelimiter); offset !== -1; offset = text.indexOf(highlightDelimiter, offset + highlightDelimiter.length)) {
      const end = offset + highlightDelimiter.length
      const before = offset > 0 ? text[offset - 1] : textOf(inline[index - 1])?.at(-1)
      const after = text[end] ?? textOf(inline[index + 1])?.[0]
      // Outside a delimiter a node's edge bounds it, standing where the source spelled a mark's punctuation.
      const outsideBefore = Array.from(text.slice(Math.max(0, offset - 2), offset)).at(-1) ?? ''
      const outsideAfter = Array.from(text.slice(end, end + 2))[0] ?? ''
      const closes = flanks(before) && !isWordCharacter(outsideAfter)
      found.push({ closes, holder: node, line, node: index, offset, opens: flanks(after) && !isWordCharacter(outsideBefore), position: position + offset })
    }
    position += text.length
  }
  return found
}

function flanks(character: string | undefined): boolean {
  return character !== undefined && !/\s/.test(character)
}

// Each opener takes the next closer holding at least one character after it, both in one line and under the same marks.
function pairedDelimiters(inline: readonly AdfNode[]): Delimiter[] {
  const found = delimiters(inline)
  const paired: Delimiter[] = []
  let closer = 0
  let resume = 0
  for (const opener of found) {
    if (!opener.opens || opener.position < resume) continue
    const earliest = opener.position + highlightDelimiter.length + 1
    let candidate = found[closer]
    while (candidate !== undefined && (!candidate.closes || candidate.position < earliest)) candidate = found[(closer += 1)]
    if (candidate === undefined) break
    if (candidate.line !== opener.line || !sameMarks(opener.holder, candidate.holder)) continue
    paired.push(opener, candidate)
    resume = candidate.position + highlightDelimiter.length
  }
  return paired
}

function split(inline: readonly AdfNode[], paired: readonly Delimiter[]): AdfNode[] {
  const lifted: AdfNode[] = []
  let next = 0
  for (const [index, node] of inline.entries()) {
    const text = textOf(node)
    if (text === undefined || heldWhole(node)) {
      lifted.push(node)
      continue
    }
    let from = 0
    for (let delimiter = paired[next]; delimiter?.node === index; delimiter = paired[next]) {
      pushPiece(lifted, node, text.slice(from, delimiter.offset), next % 2 === 1)
      from = delimiter.offset + highlightDelimiter.length
      next += 1
    }
    pushPiece(lifted, node, text.slice(from), next % 2 === 1)
  }
  return lifted
}

function pushPiece(lifted: AdfNode[], node: AdfNode, text: string, inPair: boolean): void {
  const marks = inPair ? [editorHighlight, ...nodeMarks(node)] : [...nodeMarks(node)]
  if (text !== '') lifted.push(marks.length === 0 ? { text, type: 'text' } : { marks, text, type: 'text' })
}

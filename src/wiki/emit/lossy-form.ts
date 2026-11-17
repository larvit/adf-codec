import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { blockNodeModel, isHeadingLevel } from '../../adf/block-nodes.ts'
import { codeLanguages, panelColours, spellableAlt, spellableLinkTitle, spellableUrl } from '../spellings.ts'
import { identicalMark, identicalMarks, mergeAdjacentText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { inlineNodeModel } from '../../adf/inline-nodes.ts'
import { largestNesting } from '../../nesting.ts'
import { oneLine, shownText, visibleText } from '../../adf/shown-text.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'

const panelMacro = 2
const quoteMacro = 1
const checkedMarkTypes = ['code', 'em', 'strike', 'strong', 'subsup', 'underline']
const hardBreak: AdfNode = { type: 'hardBreak' }
const listTypes = ['bulletList', 'orderedList']
const plainTable = { isNumberColumnEnabled: false, layout: 'default' }
const taskTypes = ['blockTaskItem', 'taskItem']

// spec/wiki.md, The lossy writer: the document's blocks as the nodes the lossless writer spells, each keeping the content of what it replaces. It recurses a few frames per level, so it refuses a document past 500 levels first (docs/decisions.md §Nothing recurses unbounded).
export function lossyForm(content: readonly AdfNode[]): Result<AdfNode[]> {
  const deep = nodeTooDeep(content)
  if (deep !== undefined) return failure('unsupported-nesting-depth', `the document nests deeper than the ${largestNesting} levels the writer carries`, deep)
  return success(unnested(withoutBlank(blocks(content)), 0))
}

// The path of the first node nested past `largestNesting` levels, every node counting one.
function nodeTooDeep(content: readonly AdfNode[]): ConvertErrorPath | undefined {
  const pending: { depth: number; node: AdfNode; path: ConvertErrorPath }[] = content.map((node, index) => ({ depth: 1, node, path: ['content', index] })).reverse()
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    if (step.depth > largestNesting) return step.path
    const { depth, node, path } = step
    for (const [index, child] of nodeContent(node).entries()) pending.push({ depth: depth + 1, node: child, path: [...path, 'content', index] })
  }
  return undefined
}

// A `{quote}` or a `{panel}` can't hold its own kind, so one inside another of its kind stands as its blocks.
function unnested(nodes: readonly AdfNode[], held: number): AdfNode[] {
  const kept: AdfNode[] = []
  for (const node of nodes) {
    const macro = macroOf(node)
    if (macro === 0) kept.push(node)
    else {
      const inner = unnested(nodeContent(node), held | macro)
      if ((held & macro) === 0) kept.push({ ...node, content: inner })
      else kept.push(...inner)
    }
  }
  return kept
}

// A blockquote of one paragraph is written `bq. `, no macro.
function macroOf(node: AdfNode): number {
  if (node.type === 'panel') return panelMacro
  const content = nodeContent(node)
  return node.type === 'blockquote' && !(content.length === 1 && content[0]?.type === 'paragraph') ? quoteMacro : 0
}

function blocks(nodes: readonly AdfNode[]): AdfNode[] {
  const reduced: AdfNode[] = []
  let loose: AdfNode[] = []
  const closeLoose = (): void => {
    if (loose.length > 0) reduced.push(paragraph(inlines(loose)))
    loose = []
  }
  for (const node of nodes) {
    if (node.type === 'text' || inlineNodeModel(node.type) !== undefined) loose.push(node)
    else {
      closeLoose()
      reduced.push(...block(node))
    }
  }
  closeLoose()
  return reduced
}

function block(node: AdfNode): AdfNode[] {
  const content = nodeContent(node)
  switch (node.type) {
    case 'blockquote':
      return container('blockquote', withoutBlank(blocks(content)))
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return list(node.type === 'orderedList' ? 'orderedList' : 'bulletList', content)
    case 'codeBlock':
      return codeBlock(node)
    case 'expand':
    case 'nestedExpand':
      return [...titleParagraph(shownText(node)), ...blocks(content)]
    case 'heading':
      return heading(node)
    case 'media':
      return [imageBlock(node)]
    case 'panel':
      return panel(node)
    case 'rule':
      return [{ type: 'rule' }]
    case 'table':
      return table(content)
    default:
      return otherBlock(node)
  }
}

// A node of a type with no spelling is its text, or its blocks where it holds some.
function otherBlock(node: AdfNode): AdfNode[] {
  const content = nodeContent(node)
  if (blockNodeModel(node.type)?.contentModel === 'inline') return [paragraph(inlines(content))]
  if (content.length > 0) return blocks(content)
  const shown = shownText(node) ?? node.text
  return shown === undefined ? [] : [paragraph(inlines([textNode(shown, [])]))]
}

function container(type: string, content: AdfNode[]): AdfNode[] {
  return content.length === 0 ? [] : [{ content, type }]
}

function paragraph(content: readonly AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : { content: [...content], type: 'paragraph' }
}

function withoutBlank(nodes: readonly AdfNode[]): AdfNode[] {
  return nodes.filter((node) => node.type !== 'paragraph' || node.content !== undefined)
}

function titleParagraph(title: string | undefined): AdfNode[] {
  const shown = visibleText(title)
  return shown === undefined ? [] : [paragraph(inlines([textNode(shown, [{ type: 'strong' }])]))]
}

function heading(node: AdfNode): AdfNode[] {
  const { level } = nodeAttrs(node)
  const content = inlines(nodeContent(node))
  if (!isHeadingLevel(level)) return [paragraph(content)]
  return content.length === 0 ? [] : [{ attrs: { level }, content, type: 'heading' }]
}

function panel(node: AdfNode): AdfNode[] {
  const { panelType } = nodeAttrs(node)
  const known = typeof panelType === 'string' && Object.hasOwn(panelColours, panelType)
  const content = withoutBlank(blocks(nodeContent(node)))
  return content.length === 0 ? [] : [{ attrs: { panelType: known ? panelType : 'info' }, content, type: 'panel' }]
}

function codeBlock(node: AdfNode): AdfNode[] {
  const code = nodeContent(node).map((child) => child.text ?? '').join('')
  if (code === '') return []
  if (code.includes('{code}') || code.includes('{noformat}')) return [paragraph(inlines(textNodes(code, [])))]
  const { language } = nodeAttrs(node)
  const lower = typeof language === 'string' ? language.toLowerCase() : ''
  return [{ attrs: { language: codeLanguages.includes(lower) ? lower : '' }, content: [{ text: code, type: 'text' }], type: 'codeBlock' }]
}

// An external image of an address wiki markup can spell stays an image block; any other is its alt, else `[image]`.
function imageBlock(media: AdfNode): AdfNode {
  const { alt, type, url } = nodeAttrs(media)
  const shownAlt = visibleText(alt)
  const address = visibleText(url)
  if (type !== 'external' || address === undefined) return paragraph(inlines(textNodes(shownAlt ?? '[image]', [])))
  const spelledAlt = shownAlt === undefined ? undefined : oneLine(shownAlt).trim()
  const attrs = spelledAlt !== undefined && spellableAlt.test(spelledAlt) ? { alt: spelledAlt, type, url: urlEncoded(address).replaceAll('!', '%21') } : { type, url: urlEncoded(address).replaceAll('!', '%21') }
  return { attrs: { layout: 'center' }, content: [{ attrs, type: 'media' }], type: 'mediaSingle' }
}

function urlEncoded(url: string): string {
  return url.trim().replace(/[\s[\]{}|\\]/gu, (character) => encodeURIComponent(character))
}

function list(type: string, children: readonly AdfNode[]): AdfNode[] {
  const items: AdfNode[] = []
  for (const child of children) {
    const last = items.at(-1)
    if (last !== undefined && (listTypes.includes(child.type) || child.type === 'taskList')) items.splice(-1, 1, ...listItems([...nodeContent(last), ...block(child)]))
    else items.push(...listItems(itemBlocks(child)))
  }
  return items.length === 0 ? [] : [type === 'orderedList' ? { attrs: { order: 1 }, content: items, type } : { content: items, type }]
}

// A task item keeps its state as a marker leading its text.
function itemBlocks(item: AdfNode): AdfNode[] {
  if (!taskTypes.includes(item.type)) return blocks([item])
  const content = nodeContent(item)
  const inner = item.type === 'taskItem' ? [paragraph(inlines(content))] : blocks(content)
  const marker = textNode(nodeAttrs(item)['state'] === 'DONE' ? '☑ ' : '☐ ', [])
  const [first, ...rest] = inner
  return first?.type === 'paragraph' ? [paragraph(inlines([marker, ...nodeContent(first)])), ...rest] : [paragraph([marker]), ...inner]
}

// An item's text stands on its marker's line, the blocks after the first that aren't lists parted by line breaks, and each list it holds follows, two lists of one kind in a row as one. A block after a list starts an item of its own, so the document's order stands.
function listItems(parts: readonly AdfNode[]): AdfNode[] {
  const items: AdfNode[] = []
  let texts: (readonly AdfNode[])[] = []
  let lists: AdfNode[] = []
  const closeItem = (): void => {
    if (texts.length > 0 || lists.length > 0) items.push({ content: [paragraph(joinedLines(texts)), ...lists], type: 'listItem' })
    texts = []
    lists = []
  }
  const [first, ...rest] = parts
  const others = first?.type === 'paragraph' ? rest : parts
  if (first?.type === 'paragraph') texts.push(nodeContent(first))
  for (const part of others) {
    const previous = lists.at(-1)
    if (!listTypes.includes(part.type)) {
      if (lists.length > 0) closeItem()
      texts.push(...lines(part))
    } else if (previous?.type === part.type) lists.splice(-1, 1, { ...previous, content: [...nodeContent(previous), ...nodeContent(part)] })
    else lists.push(part)
  }
  closeItem()
  return items.length === 0 ? [{ content: [paragraph([])], type: 'listItem' }] : items
}

// A table holds rows of cells; what else it holds stands after it, as its blocks.
function table(rows: readonly AdfNode[]): AdfNode[] {
  const spelled: AdfNode[] = []
  const after: AdfNode[] = []
  for (const row of rows) {
    if (row.type === 'tableRow') spelled.push(...tableRow(row, after))
    else after.push(...block(row))
  }
  return [...(spelled.length === 0 ? [] : [{ attrs: plainTable, content: spelled, type: 'table' }]), ...after]
}

function tableRow(row: AdfNode, after: AdfNode[]): AdfNode[] {
  const cells: AdfNode[] = []
  for (const cell of nodeContent(row)) {
    if (cell.type === 'tableCell' || cell.type === 'tableHeader') cells.push({ content: [paragraph(joinedLines(blocks(nodeContent(cell)).flatMap(lines)))], type: cell.type })
    else after.push(...block(cell))
  }
  return cells.length === 0 ? [] : [{ content: cells, type: 'tableRow' }]
}

// The inline content of each line a reduced block shows, as it would stand in a table cell or a list item.
function lines(node: AdfNode): AdfNode[][] {
  const content = nodeContent(node)
  switch (node.type) {
    case 'codeBlock':
      return content.flatMap((child) => (child.text ?? '').split('\n').map((line) => (line === '' ? [] : [textNode(line, [])])))
    case 'heading':
    case 'paragraph':
      return content.length === 0 ? [] : [[...content]]
    case 'media':
      return [[textNode(String(nodeAttrs(node)['alt'] ?? nodeAttrs(node)['url']), [])]]
    default:
      return content.flatMap(lines)
  }
}

function joinedLines(parts: readonly (readonly AdfNode[])[]): AdfNode[] {
  return parts.flatMap((part, index) => (index === 0 ? part : [hardBreak, ...part]))
}

// The inline nodes of a line: text, hard breaks and mentions, each with the marks wiki markup spells.
function inlines(nodes: readonly AdfNode[]): AdfNode[] {
  const spelled = mergedText(nodes.flatMap(inlineNodes)).flatMap(partedEdges)
  return trimmed(mergedText(withLinkTitles(mergedText(spelled))))
}

function inlineNodes(node: AdfNode): AdfNode[] {
  const marks = cleanMarks(nodeMarks(node))
  if (node.type === 'hardBreak') return [hardBreak]
  const { alt, id } = nodeAttrs(node)
  if (node.type === 'mention' && typeof id === 'string' && spellableUrl.test(id)) return [{ attrs: { accessLevel: '', id }, type: 'mention' }]
  if (node.type === 'mediaInline') return textNodes(visibleText(alt) ?? '[image]', marks)
  return [...textNodes(shownText(node) ?? node.text ?? '', marks), ...nodeContent(node).flatMap(inlineNodes)]
}

function textNode(text: string, marks: readonly AdfMark[]): AdfNode {
  return marks.length === 0 ? { text, type: 'text' } : { marks: [...marks], text, type: 'text' }
}

// A line feed in a text is a hard break, as the reader reads it.
function textNodes(text: string, marks: readonly AdfMark[]): AdfNode[] {
  return text
    .replaceAll('\r', '')
    .split('\n')
    .flatMap((line, index) => [...(index > 0 ? [hardBreak] : []), ...(line === '' ? [] : [textNode(line, marks)])])
}

function cleanMarks(marks: readonly AdfMark[]): AdfMark[] {
  const clean: AdfMark[] = []
  for (const mark of marks) {
    const spelled = cleanMark(mark)
    if (spelled !== undefined && !clean.some(({ type }) => type === spelled.type)) clean.push(spelled)
  }
  return clean
}

function cleanMark(mark: AdfMark): AdfMark | undefined {
  const attrs = nodeAttrs(mark)
  if (['em', 'strike', 'strong', 'underline', 'code'].includes(mark.type)) return { type: mark.type }
  if (mark.type === 'subsup') return attrs['type'] === 'sub' || attrs['type'] === 'sup' ? { attrs: { type: attrs['type'] }, type: 'subsup' } : undefined
  if (mark.type === 'textColor') return typeof attrs['color'] === 'string' ? colourMark(attrs['color']) : undefined
  if (mark.type !== 'link') return undefined
  const { href, title } = attrs
  const address = visibleText(href)
  const caption = typeof title === 'string' ? oneLine(title).trim() : ''
  if (address === undefined) return undefined
  return caption === '' ? { attrs: { href: urlEncoded(address) }, type: 'link' } : { attrs: { href: urlEncoded(address), title: caption }, type: 'link' }
}

function colourMark(colour: string): AdfMark | undefined {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(colour)
  if (short !== null) return { attrs: { color: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` }, type: 'textColor' }
  return /^#[0-9a-f]{6}$/i.test(colour) ? { attrs: { color: colour }, type: 'textColor' } : undefined
}

function mergedText(nodes: readonly AdfNode[]): AdfNode[] {
  return mergeAdjacentText(nodes, (previous, node) => previous.type === 'text' && node.type === 'text' && identicalMarks(nodeMarks(previous), nodeMarks(node)))
}

// A delimiter reads beside no whitespace inside it, so whitespace at the edge of a text it marks stands outside.
function partedEdges(node: AdfNode): AdfNode[] {
  const { text } = node
  if (text === undefined || !nodeMarks(node).some(({ type }) => checkedMarkTypes.includes(type))) return [node]
  const body = text.trim()
  if (body === '') return [textNode(text, [])]
  const before = text.slice(0, text.length - text.trimStart().length)
  const after = text.slice(text.trimEnd().length)
  return [...(before === '' ? [] : [textNode(before, [])]), { ...node, text: body }, ...(after === '' ? [] : [textNode(after, [])])]
}

// A link title wiki markup can't spell follows the link's text in parentheses.
function withLinkTitles(nodes: readonly AdfNode[]): AdfNode[] {
  const titled: AdfNode[] = []
  let open: AdfMark | undefined
  for (const node of nodes) {
    const marks = nodeMarks(node)
    const held = open
    if (held !== undefined && !marks.some((mark) => identicalMark(mark, held))) {
      titled.push(titleSuffix(held))
      open = undefined
    }
    open = open ?? marks.find(hasUnspellableTitle)
    const link = open
    titled.push(link === undefined ? node : { ...node, marks: marks.map((mark) => (identicalMark(mark, link) ? { attrs: { href: nodeAttrs(link)['href'] ?? '' }, type: 'link' } : mark)) })
  }
  return open === undefined ? titled : [...titled, titleSuffix(open)]
}

function hasUnspellableTitle(mark: AdfMark): boolean {
  const { title } = nodeAttrs(mark)
  return mark.type === 'link' && typeof title === 'string' && !spellableLinkTitle.test(title)
}

function titleSuffix(link: AdfMark): AdfNode {
  return textNode(` (${String(nodeAttrs(link)['title'])})`, [])
}

// A line starts and ends at text that isn't whitespace.
function trimmed(nodes: readonly AdfNode[]): AdfNode[] {
  const blank = nodes.map((node) => node.text !== undefined && node.text.trim() === '')
  const start = blank.indexOf(false)
  if (start === -1) return []
  const kept = nodes.slice(start, blank.lastIndexOf(false) + 1)
  return kept.map((node, index) => {
    if (node.text === undefined) return node
    const text = index === 0 ? node.text.trimStart() : node.text
    return { ...node, text: index === kept.length - 1 ? text.trimEnd() : text }
  })
}

import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { anchorOpener, writableValue } from '../escaping.ts'
import { carriedInline } from './carry-element.ts'
import { holdsOnlyAttributes, isSpellableText, isUnmarkedSpellableText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { linkAttrs } from '../../adf/mark-attributes.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

const markElements: ReadonlyMap<string, string> = new Map([
  ['code', 'code'],
  ['em', 'em'],
  ['strong', 'strong'],
])

export function inlineHtml(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<string> {
  let html = ''
  let afterPlainText = false
  for (const [index, node] of nodes.entries()) {
    // Two unmarked text nodes side by side read back as one, so the second rides the carry.
    const written: string | undefined = afterPlainText && isUnmarkedSpellableText(node) ? undefined : tryInlineNode(node)
    if (written === undefined) {
      const carried = carriedInline(node, [...path, 'content', index])
      if (!carried.ok) return carried
      html += carried.value
    } else html += written
    afterPlainText = written !== undefined && isUnmarkedSpellableText(node)
  }
  return success(html)
}

function tryInlineNode(node: AdfNode): string | undefined {
  if (node.type === 'hardBreak') return holdsOnlyAttributes(node, []) && nodeContent(node).length === 0 ? '<br>' : undefined
  const text = isSpellableText(node) ? writableText(node.text) : undefined
  if (text === undefined) return undefined
  const marks = nodeMarks(node)
  const openers: string[] = []
  const closers: string[] = []
  for (const mark of marks) {
    if (marks.filter(({ type }) => type === mark.type).length > 1) return undefined
    const element = markElement(mark)
    if (element === undefined) return undefined
    openers.push(element.opener)
    closers.unshift(element.closer)
  }
  return `${openers.join('')}${text}${closers.join('')}`
}

// Empty text reads back as no text node, so it rides the carry.
export function writableText(text: string | undefined): string | undefined {
  return text === undefined || text === '' ? undefined : writableValue(text)
}

function markElement(mark: AdfMark): { closer: string; opener: string } | undefined {
  const { type } = mark
  const element = markElements.get(type)
  if (element !== undefined) return mark.attrs === undefined ? { closer: `</${element}>`, opener: `<${element}>` } : undefined
  if (type !== 'link' || Object.keys(nodeAttrs(mark)).some((key) => key !== 'href' && key !== 'title')) return undefined
  const link = linkAttrs(nodeAttrs(mark))
  const opener = link === undefined ? undefined : anchorOpener(link)
  return opener === undefined ? undefined : { closer: '</a>', opener }
}

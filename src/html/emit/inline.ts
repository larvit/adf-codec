import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { carriedInline } from './carry-element.ts'
import { holdsOnlyAttributes, isSpellableText, isUnmarkedSpellableText, nodeAttrs, nodeContent, nodeMarks } from '../../adf/document.ts'
import { htmlValue, optionalAttribute } from './escaping.ts'
import { linkAttrs, type LinkAttrs } from '../../adf/mark-attributes.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

// Each names its element.
const elementMarks: readonly string[] = ['code', 'em', 'strong']

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

// No element holds empty text apart from no text.
export function writableText(text: string | undefined): string | undefined {
  return text === undefined || text === '' ? undefined : htmlValue(text)
}

function markElement(mark: AdfMark): { closer: string; opener: string } | undefined {
  const { type } = mark
  if (elementMarks.includes(type)) return mark.attrs === undefined ? { closer: `</${type}>`, opener: `<${type}>` } : undefined
  if (type !== 'link' || Object.keys(nodeAttrs(mark)).some((key) => key !== 'href' && key !== 'title')) return undefined
  const link = linkAttrs(nodeAttrs(mark))
  const opener = link === undefined ? undefined : anchorOpener(link)
  return opener === undefined ? undefined : { closer: '</a>', opener }
}

export function anchorOpener({ href, title }: LinkAttrs): string | undefined {
  const url = htmlValue(href)
  const titled = optionalAttribute('title', title)
  return url === undefined || titled === undefined ? undefined : `<a href="${url}"${titled}>`
}

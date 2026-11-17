import type { AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import { codeLanguages, panelColours } from '../spellings.ts'
import { holdsOnlyAttributes, isUnmarkedSpellableText, nodeAttrs, nodeContent } from '../../adf/document.ts'
import { inlineLine } from './inline-line.ts'
import { isHeadingLevel } from '../../adf/block-nodes.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

// `blank`: a paragraph holding no content or only whitespace, which only a table cell holds; `macros`: the `{quote}` and `{panel}` the block writes, which can't nest in their own kind; `text`: the block's spelling, where no container composes it.
export type Spelling = { blank: boolean; macros: number; text: string | undefined }

type Step = { exit: boolean; inCell: boolean; node: AdfNode; path: ConvertErrorPath }

const quoteMacro = 1
const panelMacro = 2

const lists = ['bulletList', 'orderedList']
const spellableAlt = /^[^\s!|,\\[\]{}](?:[^!|,\\[\]{}\r\n]*[^\s!|,\\[\]{}])?$/
const spellableImageUrl = /^[^\s!|\\[\]{}]+$/

// spec/wiki.md, Blocks: each block wiki markup spells, found after its children, since a block rides where one it holds does. A stack rather than recursion (docs/decisions.md §Nothing recurses unbounded).
export function spelledBlocks(content: readonly AdfNode[]): Result<Map<AdfNode, Spelling>> {
  const spelled = new Map<AdfNode, Spelling>()
  const pending: Step[] = content.map((node, index) => ({ exit: false, inCell: false, node, path: ['content', index] })).reverse()
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    const { exit, inCell, node, path } = step
    if (exit) {
      const spelling = containerSpelling(node, spelled)
      if (spelling !== undefined) spelled.set(node, spelling)
    } else if (containerHolds(node)) {
      pending.push({ exit: true, inCell, node, path })
      const children = nodeContent(node).map((child, index): Step => ({ exit: false, inCell: node.type === 'tableCell' || node.type === 'tableHeader', node: child, path: [...path, 'content', index] }))
      for (const child of children.reverse()) pending.push(child)
    } else {
      const spelling = leafSpelling(node, path, inCell)
      if (!spelling.ok) return spelling
      if (spelling.value !== undefined) spelled.set(node, spelling.value)
    }
  }
  return success(spelled)
}

// Whether a container's own attributes and the types of its children have a spelling.
function containerHolds(node: AdfNode): boolean {
  const content = nodeContent(node)
  if (content.length === 0) return false
  switch (node.type) {
    case 'blockquote':
      return holdsExactly(node, {})
    case 'bulletList':
    case 'orderedList':
      return holdsExactly(node, node.type === 'orderedList' ? { order: 1 } : {}) && content.every((child) => child.type === 'listItem')
    case 'listItem':
      return holdsExactly(node, {}) && content[0]?.type === 'paragraph' && content.slice(1).every((child, index) => lists.includes(child.type) && child.type !== content[index]?.type)
    case 'panel': {
      const { panelType } = nodeAttrs(node)
      return holdsOnlyAttributes(node, ['panelType']) && typeof panelType === 'string' && Object.hasOwn(panelColours, panelType)
    }
    case 'table':
      return holdsExactly(node, { isNumberColumnEnabled: false, layout: 'default' }) && content.every((child) => child.type === 'tableRow')
    case 'tableCell':
    case 'tableHeader':
      return holdsExactly(node, {}) && content.length === 1 && content[0]?.type === 'paragraph'
    case 'tableRow':
      return holdsExactly(node, {}) && content.every((child) => child.type === 'tableCell' || child.type === 'tableHeader')
    default:
      return false
  }
}

// Called once the children are found: `undefined` where one rides.
function containerSpelling(node: AdfNode, spelled: ReadonlyMap<AdfNode, Spelling>): Spelling | undefined {
  const content = nodeContent(node)
  const cell = node.type === 'tableCell' || node.type === 'tableHeader'
  const children = content.map((child) => spelled.get(child)).filter((child): child is Spelling => child !== undefined && (cell || !child.blank))
  if (children.length < content.length) return undefined
  const macros = children.reduce((held, child) => held | child.macros, 0)
  if (node.type === 'blockquote') {
    // A blockquote of one paragraph is written `bq. `, no macro.
    if (content.length === 1 && content[0]?.type === 'paragraph') return { blank: false, macros, text: undefined }
    return (macros & quoteMacro) === 0 ? { blank: false, macros: macros | quoteMacro, text: undefined } : undefined
  }
  if (node.type === 'panel') return (macros & panelMacro) === 0 ? { blank: false, macros: macros | panelMacro, text: undefined } : undefined
  return { blank: false, macros, text: undefined }
}

function leafSpelling(node: AdfNode, path: ConvertErrorPath, inCell: boolean): Result<Spelling | undefined> {
  if (node.type === 'paragraph') return paragraphSpelling(node, path, inCell)
  if (node.type === 'heading') return headingSpelling(node, path)
  return success(spelledText(simpleLeafText(node)))
}

function paragraphSpelling(node: AdfNode, path: ConvertErrorPath, inCell: boolean): Result<Spelling | undefined> {
  if (!holdsExactly(node, {})) return success(undefined)
  if (node.content === undefined) return success({ blank: true, macros: 0, text: ' ' })
  const line = inlineLine(node.content, path, inCell)
  if (!line.ok) return line
  return success({ blank: node.content.every((child) => child.type === 'text') && /^\s*$/u.test(node.content.map(({ text }) => text).join('')), macros: 0, text: line.value.line })
}

function headingSpelling(node: AdfNode, path: ConvertErrorPath): Result<Spelling | undefined> {
  const { level } = nodeAttrs(node)
  if (!holdsOnlyAttributes(node, ['level']) || !isHeadingLevel(level) || node.content === undefined) return success(undefined)
  const line = inlineLine(node.content, path, false)
  if (!line.ok) return line
  return success(line.value.carried ? undefined : spelledText(`h${level}. ${line.value.line}`))
}

function simpleLeafText(node: AdfNode): string | undefined {
  if (node.type === 'rule') return holdsExactly(node, {}) ? '----' : undefined
  if (node.type === 'codeBlock') return codeText(node)
  return node.type === 'mediaSingle' && holdsExactly(node, { layout: 'center' }) ? imageText(nodeContent(node)) : undefined
}

function codeText(node: AdfNode): string | undefined {
  const { language } = nodeAttrs(node)
  const [text, ...others] = nodeContent(node)
  const code = text?.text
  if (!holdsOnlyAttributes(node, ['language']) || typeof language !== 'string' || text === undefined || code === undefined || others.length > 0 || !isUnmarkedSpellableText(text)) return undefined
  if (code.includes('{code}') || code.includes('{noformat}')) return undefined
  if (language === '') return `{noformat}\n${code}\n{noformat}`
  return codeLanguages.includes(language) ? `{code:${language}}\n${code}\n{code}` : undefined
}

function imageText(content: readonly AdfNode[]): string | undefined {
  const [media, ...others] = content
  if (media?.type !== 'media' || others.length > 0 || !holdsOnlyAttributes(media, ['alt', 'type', 'url'])) return undefined
  const { alt, type, url } = nodeAttrs(media)
  if (type !== 'external' || typeof url !== 'string' || !spellableImageUrl.test(url)) return undefined
  if (alt === undefined) return `!${url}!`
  return typeof alt === 'string' && spellableAlt.test(alt) ? `!${url}|alt=${alt}!` : undefined
}

function spelledText(text: string | undefined): Spelling | undefined {
  return text === undefined ? undefined : { blank: false, macros: 0, text }
}

// The node holds exactly these attributes with these values, and no marks.
function holdsExactly(node: AdfNode, values: Readonly<Record<string, JsonValue>>): boolean {
  const attrs = nodeAttrs(node)
  return holdsOnlyAttributes(node, Object.keys(values)) && Object.entries(values).every(([key, value]) => attrs[key] === value)
}

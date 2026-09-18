import type { AdfAttributes, AdfMark, AdfNode } from '../adf/document.ts'
import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { MarkType } from '../adf/mark-attributes.ts'
import { escapeUnbalanced, spellLinkTarget } from './commonmark/link-syntax.ts'
import { holdsDirectivePrefix, spellAttributes, spellVocabulary } from './directive-syntax.ts'
import { holdsEntityReference } from './commonmark/entity-references.ts'
import { isAutolink } from './commonmark/grammar.ts'
import { isMarkType, markAttributes } from '../adf/mark-attributes.ts'
import { nodeAttrs, nodeMarks } from '../adf/document.ts'
import { vocabularyPairs } from '../adf/attribute-vocabulary.ts'

type Spelling = { kind: 'code' | 'directive' | 'link'; spelling?: undefined } | { kind: 'emphasis'; spelling: string }

export type MarkSpelling = Spelling & { attributes: AttributeVocabulary }

export type CommonMarkLink = { form: 'autolink'; target?: undefined } | { form: 'inline'; target: string }

const markSpellings: Readonly<Record<MarkType, Spelling>> = {
  border: { kind: 'directive' },
  code: { kind: 'code' },
  em: { kind: 'emphasis', spelling: '_' },
  link: { kind: 'link' },
  strike: { kind: 'emphasis', spelling: '~~' },
  strong: { kind: 'emphasis', spelling: '**' },
  subsup: { kind: 'directive' },
  textColor: { kind: 'directive' },
  underline: { kind: 'directive' },
}

export function markSpelling(type: string): MarkSpelling | undefined {
  if (!isMarkType(type)) return undefined
  const spelling = markSpellings[type]
  const attributes = markAttributes[type]
  if (spelling.kind === 'emphasis') return { attributes, kind: spelling.kind, spelling: spelling.spelling }
  return { attributes, kind: spelling.kind }
}

// spec/flavour.md, Marks. `marksInside` counts the marks the link's nodes carry within it: the emitter's depth + 1, the parser's 0.
export function commonMarkLink(attrs: AdfAttributes, href: string, nodes: readonly AdfNode[], marksInside: number, bracketed: boolean): CommonMarkLink | undefined {
  if (Object.keys(attrs).some((key) => key !== 'href' && key !== 'title')) return undefined
  const title = attrs['title']
  const autolinkHolds = !bracketed || (!href.includes('`') && !holdsDirectivePrefix(href) && escapeUnbalanced(href, '[', ']') === href)
  if (isBareLink(nodes, href, marksInside) && autolinkHolds && title === undefined && isAutolink(href) && !holdsEntityReference(href)) return { form: 'autolink' }
  const target = spellLinkTarget(href, typeof title === 'string' ? title : undefined)
  return target === undefined ? undefined : { form: 'inline', target }
}

function isBareLink(nodes: readonly AdfNode[], href: string, marksInside: number): boolean {
  const node = nodes[0]
  return nodes.length === 1 && node !== undefined && node.type === 'text' && node.text === href && nodeMarks(node).length === marksInside
}

export function spellMarkAttributes(mark: AdfMark, vocabulary: AttributeVocabulary): string | undefined {
  const pairs = vocabularyPairs(nodeAttrs(mark), vocabulary, [])
  return pairs === undefined ? undefined : spellAttributes(spellVocabulary(pairs))
}

import type { AdfAttributes, AdfMark, AdfNode } from '../adf/document.ts'
import type { AttributeVocabulary } from '../adf/attribute-vocabulary.ts'
import type { LinkDefinition, TitleEscapes } from './commonmark/link-syntax.ts'
import type { MarkType } from '../adf/mark-attributes.ts'
import { emptyKeys, nodeAttrs, nodeMarks } from '../adf/document.ts'
import { escapeUnbalanced, spellLinkTarget } from './commonmark/link-syntax.ts'
import { holdsDirectivePrefix, spellAttributes, spellVocabulary } from './directive/syntax.ts'
import { holdsEntityReference } from './commonmark/entity-references.ts'
import { isAutolink } from './commonmark/grammar.ts'
import { isMarkType, linkAttrs, linkMarkFrom, markAttributes, type LinkAttrs } from '../adf/mark-attributes.ts'
import { spellEmptyKeys } from './directive/empty-keys.ts'
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

export function isEmphasis(mark: AdfMark): boolean {
  return markSpelling(mark.type)?.kind === 'emphasis'
}

export function linkMark(definition: LinkDefinition): AdfMark {
  return linkMarkFrom(toLinkAttrs(definition))
}

export function toLinkAttrs({ destination, title }: LinkDefinition): LinkAttrs {
  return title === undefined ? { href: destination } : { href: destination, title }
}

export function linkDefinition(attrs: AdfAttributes): LinkDefinition | undefined {
  const target = linkAttrs(attrs)
  return target === undefined ? undefined : toLinkDefinition(target)
}

export function toLinkDefinition({ href, title }: LinkAttrs): LinkDefinition {
  return title === undefined ? { destination: href } : { destination: href, title }
}

export function linkHref(attrs: AdfAttributes): string | undefined {
  const href = attrs['href']
  return typeof href === 'string' ? href : undefined
}

// spec/flavour.md, Marks. `marksInside` counts the marks the link's nodes carry within it: the emitter's depth + 1, the parser's 0.
export function commonMarkLink(attrs: AdfAttributes, href: string, nodes: readonly AdfNode[], marksInside: number, bracketed: boolean, escapes: TitleEscapes): CommonMarkLink | undefined {
  if (Object.keys(attrs).some((key) => key !== 'href' && key !== 'title')) return undefined
  const title = attrs['title']
  const autolinkHolds = !bracketed || (!href.includes('`') && !holdsDirectivePrefix(href) && escapeUnbalanced(href, '[', ']') === href)
  if (isBareLink(nodes, href, marksInside) && autolinkHolds && title === undefined && isAutolink(href) && !holdsEntityReference(href)) return { form: 'autolink' }
  const target = spellLinkTarget(href, typeof title === 'string' ? title : undefined, escapes)
  return target === undefined ? undefined : { form: 'inline', target }
}

function isBareLink(nodes: readonly AdfNode[], href: string, marksInside: number): boolean {
  const node = nodes[0]
  return nodes.length === 1 && node !== undefined && node.type === 'text' && node.text === href && nodeMarks(node).length === marksInside
}

// `undefined` where the spelling holds no such attrs: only a directive spells attrs=empty.
export function spellMarkAttributes(mark: AdfMark, spelling: MarkSpelling): string | undefined {
  return emptyKeys(mark).length > 0 && spelling.kind !== 'directive' ? undefined : spellMarkVocabulary(mark, spelling.attributes)
}

// `undefined` where the vocabulary lacks an attribute or types its value otherwise.
export function spellMarkVocabulary(mark: AdfMark, vocabulary: AttributeVocabulary): string | undefined {
  const pairs = vocabularyPairs(nodeAttrs(mark), vocabulary, [])
  return pairs === undefined ? undefined : spellAttributes([...spellVocabulary(pairs), ...spellEmptyKeys(mark)])
}

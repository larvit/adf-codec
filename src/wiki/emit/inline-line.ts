import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { escapedText } from './text-escaping.ts'
import { holdsOnlyAttributes, identicalMark, identicalMarks, isSpellableText, nodeAttrs, nodeMarks } from '../../adf/document.ts'
import { inlineCarry } from '../carry.ts'
import { success, type ConvertErrorPath, type Result } from '../../result.ts'

// `carried`: whether any node of the line rides the carry.
export type Line = { carried: boolean; line: string }

// `checked`: a delimiter that reads only beside whitespace, punctuation or the line's edge.
type Delimiters = { checked: boolean; close: string; open: string }

// `marks`: those that group the node with its neighbours; `spelled`: the node's spelling and the delimiters of those marks, `undefined` where it rides.
type Atom = { marks: readonly AdfMark[]; spelled: { marks: readonly SpelledMark[]; text: string } | undefined }

type SpelledMark = { delimiters: Delimiters; mark: AdfMark }

type Token = { checked: boolean; kind: 'atom' | 'close' | 'open'; text: string }

const characterDelimiters: Readonly<Record<string, string>> = { em: '_', strike: '-', strong: '*', underline: '+' }
const spellableUrl = /^[^\s[\]{}|\\]+$/
const spellableColour = /^#[0-9a-f]{6}$/i

// spec/wiki.md, Inline and Marks: the nodes, each run of marked nodes, and the carry around what wiki markup cannot spell.
export function inlineLine(nodes: readonly AdfNode[], path: ConvertErrorPath): Result<Line> {
  const atoms = nodes.map((node, index) => atom(node, nodes, index))
  const groups = markedGroups(atoms)
  let line = ''
  let carried = false
  for (const [position, { first, last }] of groups.entries()) {
    const next = groups[position + 1]
    const following = next === undefined ? undefined : atoms[next.first]
    const after = following === undefined ? undefined : following.marks.length > 0 ? '{' : (following.spelled?.text ?? '{')
    const written = groupSpelling(atoms.slice(first, last + 1), line.at(-1), after?.[0])
    if (written === undefined) {
      const carry = inlineCarry(nodes.slice(first, last + 1), [...path, 'content', first])
      if (!carry.ok) return carry
      line += carry.value
      carried = true
    } else line += written
  }
  return success({ carried, line })
}

function atom(node: AdfNode, nodes: readonly AdfNode[], index: number): Atom {
  const { text } = node
  if (node.type !== 'text' || text === undefined) {
    const leaf = leafSpelling(node)
    return { marks: [], spelled: leaf === undefined ? undefined : { marks: [], text: leaf } }
  }
  const marks = nodeMarks(node)
  const spelled = spelledMarks(marks)
  const previous = nodes[index - 1]
  const joinsPrevious = previous?.type === 'text' && identicalMarks(nodeMarks(previous), marks)
  if (!isSpellableText(node) || joinsPrevious || spelled === undefined) return { marks, spelled: undefined }
  const href = hrefSpelling(node, nodes, index)
  if (href !== undefined) return { marks: marks.slice(0, -1), spelled: { marks: spelled.slice(0, -1), text: href } }
  const escaped = escapedText(text, index === 0, index === nodes.length - 1)
  return { marks, spelled: escaped === undefined ? undefined : { marks: spelled, text: escaped } }
}

// `undefined` where a mark has no spelling, or two marks share a type.
function spelledMarks(marks: readonly AdfMark[]): SpelledMark[] | undefined {
  const spelled: SpelledMark[] = []
  for (const [position, mark] of marks.entries()) {
    const delimiters = markDelimiters(mark)
    if (delimiters === undefined || marks.findIndex((other) => other.type === mark.type) !== position) return undefined
    spelled.push({ delimiters, mark })
  }
  return spelled
}

function leafSpelling(node: AdfNode): string | undefined {
  if (node.type === 'hardBreak') return holdsOnlyAttributes(node, []) && node.content === undefined ? '\\\\' : undefined
  if (node.type !== 'mention' || !holdsOnlyAttributes(node, ['accessLevel', 'id'])) return undefined
  const { accessLevel, id } = nodeAttrs(node)
  return accessLevel === '' && typeof id === 'string' && spellableUrl.test(id) ? `[~accountid:${id}]` : undefined
}

// `[<href>]`: the text is the href of the link that is its innermost mark, a link marking no node beside it.
function hrefSpelling(node: AdfNode, nodes: readonly AdfNode[], index: number): string | undefined {
  const link = nodeMarks(node).at(-1)
  if (link?.type !== 'link') return undefined
  const { href, ...others } = nodeAttrs(link)
  if (typeof href !== 'string' || href !== node.text || Object.keys(others).length > 0 || href.startsWith('~') || !spellableUrl.test(href)) return undefined
  const sharesLink = (neighbour: AdfNode | undefined): boolean => neighbour !== undefined && nodeMarks(neighbour).some((mark) => identicalMark(mark, link))
  return sharesLink(nodes[index - 1]) || sharesLink(nodes[index + 1]) ? undefined : `[${href}]`
}

// `undefined` where wiki markup has no spelling for the mark.
function markDelimiters(mark: AdfMark): Delimiters | undefined {
  const attrs = nodeAttrs(mark)
  const character = characterDelimiters[mark.type]
  if (character !== undefined) return mark.attrs === undefined ? { checked: true, close: character, open: character } : undefined
  if (mark.type === 'code') return mark.attrs === undefined ? { checked: true, close: '}}', open: '{{' } : undefined
  if (mark.type === 'subsup') {
    const delimiter = attrs['type'] === 'sub' ? '~' : attrs['type'] === 'sup' ? '^' : undefined
    return delimiter !== undefined && Object.keys(attrs).length === 1 ? { checked: true, close: delimiter, open: delimiter } : undefined
  }
  if (mark.type === 'textColor') {
    const { color } = attrs
    return typeof color === 'string' && spellableColour.test(color) && Object.keys(attrs).length === 1 ? { checked: false, close: '{color}', open: `{color:${color}}` } : undefined
  }
  return mark.type === 'link' ? linkDelimiters(attrs) : undefined
}

function linkDelimiters(attrs: Readonly<Record<string, unknown>>): Delimiters | undefined {
  const { href, title, ...others } = attrs
  if (Object.keys(others).length > 0 || typeof href !== 'string' || !spellableUrl.test(href)) return undefined
  if (title === undefined) return { checked: false, close: `|${href}]`, open: '[' }
  return typeof title === 'string' && /^[^\s[\]{}|\\](?:[^[\]{}|\\\r\n]*[^\s[\]{}|\\])?$/.test(title) ? { checked: false, close: `|${href}|${title}]`, open: '[' } : undefined
}

// Runs of nodes sharing at least their outermost mark, each spelled or carried as a whole.
function markedGroups(atoms: readonly Atom[]): { first: number; last: number }[] {
  const groups: { first: number; last: number }[] = []
  for (const [index, current] of atoms.entries()) {
    const group = groups.at(-1)
    const previous = atoms[index - 1]
    if (group !== undefined && previous !== undefined && sharedMarks(previous.marks, current.marks) > 0) group.last = index
    else groups.push({ first: index, last: index })
  }
  return groups
}

function sharedMarks(left: readonly AdfMark[], right: readonly AdfMark[]): number {
  const shared = left.findIndex((mark, index) => {
    const other = right[index]
    return other === undefined || !identicalMark(mark, other)
  })
  return shared === -1 ? left.length : shared
}

// Marks nest in the order the array holds, outermost first; `undefined` where a node or a delimiter fails.
function groupSpelling(atoms: readonly Atom[], before: string | undefined, after: string | undefined): string | undefined {
  const tokens: Token[] = []
  let open: readonly SpelledMark[] = []
  for (const { spelled } of atoms) {
    if (spelled === undefined) return undefined
    const { marks, text } = spelled
    const shared = sharedMarks(open.map(({ mark }) => mark), marks.map(({ mark }) => mark))
    for (const mark of open.slice(shared).reverse()) tokens.push(delimiterToken(mark, 'close'))
    for (const mark of marks.slice(shared)) tokens.push(delimiterToken(mark, 'open'))
    tokens.push({ checked: false, kind: 'atom', text })
    open = marks
  }
  for (const mark of open.slice().reverse()) tokens.push(delimiterToken(mark, 'close'))
  return tokens.every((token, index) => delimiterReads(token, tokens[index - 1]?.text.at(-1) ?? before, tokens[index + 1]?.text[0] ?? after)) ? tokens.map(({ text }) => text).join('') : undefined
}

function delimiterToken({ delimiters: { checked, close, open } }: SpelledMark, kind: 'close' | 'open'): Token {
  return { checked, kind, text: kind === 'open' ? open : close }
}

// spec/wiki.md, Marks: a delimiter sits beside whitespace, punctuation or the line's edge, and its run neither starts nor ends with whitespace.
function delimiterReads({ checked, kind }: Token, before: string | undefined, after: string | undefined): boolean {
  if (!checked) return true
  const outside = kind === 'open' ? before : after
  const inside = kind === 'open' ? after : before
  return (outside === undefined || !/[\p{L}\p{N}]/u.test(outside)) && inside !== undefined && !/\s/u.test(inside)
}

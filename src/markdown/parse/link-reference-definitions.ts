import { holdsControlCharacter, isAsciiPunctuation } from '../commonmark-grammar.ts'

export type LinkDefinition = { destination: string; title?: string }

type ReadDefinition = { definition: LinkDefinition; label: string; length: number }
type ReadValue = { length: number; value: string }

const bracketedDestination = /^<((?:[^\n<>\\]|\\[^\n])*)>/
const label = /^\[((?:[^[\]\\]|\\[\s\S]){1,999})\]:/
const restOfLine = /^[ \t]*(?:\n|$)/
const titleClosers: Readonly<Record<string, string>> = { '"': '"', "'": "'", '(': ')' }

export function readLinkDefinitions(definitions: Map<string, LinkDefinition>, text: string): string {
  let rest = text
  let read = readDefinition(rest)
  while (read !== undefined) {
    if (!definitions.has(read.label)) definitions.set(read.label, read.definition)
    rest = rest.slice(read.length)
    read = readDefinition(rest)
  }
  return rest
}

function readDefinition(text: string): ReadDefinition | undefined {
  const matched = label.exec(text)
  if (matched === null) return undefined
  const name = normalizeLabel(matched[1] ?? '')
  if (name === '') return undefined
  const afterLabel = skipSpace(text, matched[0].length)
  const destination = readDestination(text, afterLabel)
  if (destination === undefined) return undefined
  const afterDestination = afterLabel + destination.length
  const titled = readTitledEnd(text, afterDestination)
  if (titled !== undefined) return { definition: { destination: destination.value, title: titled.value }, label: name, length: titled.length }
  const plain = endOfLine(text, afterDestination)
  if (plain === undefined) return undefined
  return { definition: { destination: destination.value }, label: name, length: plain }
}

function normalizeLabel(raw: string): string {
  return raw
    .replace(/^[ \t\n]+|[ \t\n]+$/g, '')
    .replace(/[ \t\n]+/g, ' ')
    .toLowerCase()
}

function readTitledEnd(text: string, offset: number): ReadValue | undefined {
  const afterSpace = skipSpace(text, offset)
  if (afterSpace === offset) return undefined
  const title = readTitle(text, afterSpace)
  if (title === undefined) return undefined
  const end = endOfLine(text, afterSpace + title.length)
  return end === undefined ? undefined : { length: end, value: title.value }
}

function readDestination(text: string, offset: number): ReadValue | undefined {
  const bracketed = bracketedDestination.exec(text.slice(offset))
  if (bracketed !== null) return { length: bracketed[0].length, value: bracketed[0].slice(1, -1) }
  if (text.charAt(offset) === '<') return undefined
  let depth = 0
  let index = offset
  while (index < text.length) {
    const character = text.charAt(index)
    if (character === ' ' || holdsControlCharacter(character)) break
    if (escapesNext(text, index)) {
      index += 2
      continue
    }
    if (character === '(') depth += 1
    if (character === ')') {
      depth -= 1
      if (depth < 0) break
    }
    index += 1
  }
  return index <= offset ? undefined : { length: index - offset, value: text.slice(offset, index) }
}

function readTitle(text: string, offset: number): ReadValue | undefined {
  const opener = text.charAt(offset)
  const closer = titleClosers[opener]
  if (closer === undefined) return undefined
  let index = offset + 1
  while (index < text.length) {
    const character = text.charAt(index)
    if (escapesNext(text, index)) {
      index += 2
      continue
    }
    if (character === closer) return { length: index + 1 - offset, value: text.slice(offset + 1, index) }
    if (character === opener) return undefined
    index += 1
  }
  return undefined
}

// A backslash escapes ASCII punctuation only, so a line ending always ends the destination it follows.
function escapesNext(text: string, index: number): boolean {
  return text.charAt(index) === '\\' && isAsciiPunctuation(text.charAt(index + 1))
}

// The label, the destination and the title each take at most one line ending with them.
function skipSpace(text: string, offset: number): number {
  const rest = text.slice(offset)
  return offset + rest.length - rest.replace(/^[ \t]*\n?[ \t]*/, '').length
}

function endOfLine(text: string, offset: number): number | undefined {
  const rest = restOfLine.exec(text.slice(offset))?.[0]
  return rest === undefined ? undefined : offset + rest.length
}

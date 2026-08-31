import type { LinkDefinition, LinkPart } from '../link-syntax.ts'
import { normalizeLabel, readDestination, readLabel, readTitle, skipLinkWhitespace } from '../link-syntax.ts'

type ReadDefinition = { definition: LinkDefinition; label: string; length: number }

const restOfLine = /^[ \t]*(?:\n|$)/

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
  const label = readLabel(text, 0)
  if (label === undefined || text.charAt(label.length) !== ':') return undefined
  const name = normalizeLabel(label.value)
  if (name === '') return undefined
  const afterLabel = skipLinkWhitespace(text, label.length + 1)
  const destination = readDestination(text, afterLabel)
  if (destination === undefined) return undefined
  const afterDestination = afterLabel + destination.length
  const titled = readTitledEnd(text, afterDestination)
  if (titled !== undefined) return { definition: { destination: destination.value, title: titled.value }, label: name, length: titled.length }
  const plain = endOfLine(text, afterDestination)
  if (plain === undefined) return undefined
  return { definition: { destination: destination.value }, label: name, length: plain }
}

function readTitledEnd(text: string, offset: number): LinkPart | undefined {
  const afterSpace = skipLinkWhitespace(text, offset)
  if (afterSpace === offset) return undefined
  const title = readTitle(text, afterSpace)
  if (title === undefined) return undefined
  const end = endOfLine(text, afterSpace + title.length)
  return end === undefined ? undefined : { length: end, value: title.value }
}

function endOfLine(text: string, offset: number): number | undefined {
  const rest = restOfLine.exec(text.slice(offset))?.[0]
  return rest === undefined ? undefined : offset + rest.length
}

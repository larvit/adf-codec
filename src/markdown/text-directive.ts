import type { ConvertFault } from '../result.ts'
import type { DirectiveSpan, Read } from './directive-syntax.ts'
import { spellAttributes, spellLeafDirective, spellStringAttribute } from './directive-syntax.ts'

const name = 'text'
const whitespaceRun = /^(?:[ \t]+|\n+)$/

export const textDirectiveName = name

export function spellTextDirective(text: string): string {
  return spellLeafDirective(name, spellAttributes([[name, spellStringAttribute(text)]]))
}

export function readTextDirective(span: DirectiveSpan): Read<string> | undefined {
  if (span.name !== name) return undefined
  if (span.content !== undefined) return { fault: unsupported(`${name} takes no content`) }
  const spelled = span.attributes.get(name)
  if (spelled === undefined || span.attributes.size !== 1) return { fault: unsupported(`${name} holds one ${name} attribute alone`) }
  const spelling = spellStringAttribute(spelled.decoded)
  if (spelling !== spelled.spelling) return { fault: unsupported(`${name} spells its ${name} attribute as ${name}=${spelling}`) }
  if (!whitespaceRun.test(spelled.decoded)) return { fault: unsupported(`${name} spells one run of spaces and tabs, or one run of newlines`) }
  return { value: spelled.decoded }
}

function unsupported(message: string): ConvertFault {
  return { code: 'unsupported-node-shape', message }
}

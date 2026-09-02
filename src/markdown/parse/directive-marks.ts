import type { AdfMark } from '../../adf/document.ts'
import type { ConvertFault } from '../../result.ts'
import type { DirectiveAttributes } from '../directive-syntax.ts'
import type { MarkSpelling } from '../mark-spellings.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { markSpelling } from '../mark-spellings.ts'
import { readVocabulary } from './directive-attributes.ts'

export function readDirectiveMark(name: string, attributes: DirectiveAttributes, path: ConvertErrorPath): Result<AdfMark> | undefined {
  const spelling = markSpelling(name)
  if (spelling === undefined) return undefined
  const markdown = markdownForm(spelling)
  if (markdown !== undefined) return failure('unsupported-node-shape', `${name} is spelled ${markdown}, never as a directive`, path)
  const attrs = readVocabulary(name, attributes, spelling.attributes, undefined, path)
  if (!attrs.ok) return attrs
  return success(Object.keys(attrs.value).length === 0 ? { type: name } : { attrs: attrs.value, type: name })
}

export function inlineMarkSpellingFault(name: string): ConvertFault | undefined {
  const spelling = markSpelling(name)
  if (spelling === undefined) return undefined
  return { code: 'unsupported-node-shape', message: `${name} is spelled ${markdownForm(spelling) ?? `:${name}[…]`}, never as a block directive` }
}

function markdownForm(spelling: MarkSpelling): string | undefined {
  switch (spelling.kind) {
    case 'code':
      return '`x`'
    case 'directive':
      return undefined
    case 'emphasis':
      return `${spelling.spelling}x${spelling.spelling}`
    case 'link':
      return '[x](url)'
  }
}

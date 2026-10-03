import type { AdfMark } from '../../adf/document.ts'
import type { ConvertFault } from '../../result.ts'
import type { DirectiveAttributes } from '../directive-syntax.ts'
import type { MarkSpelling } from '../mark-spellings.ts'
import { directivePrefix } from '../directive-syntax.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { markSpelling } from '../mark-spellings.ts'
import { readEmptyKeys } from '../empty-keys.ts'
import { readVocabulary } from './directive-attributes.ts'

export function readDirectiveMark(name: string, attributes: DirectiveAttributes, path: ConvertErrorPath): Result<AdfMark> | undefined {
  const spelling = markSpelling(name)
  if (spelling === undefined) return undefined
  const markdown = markdownForm(spelling)
  if (markdown !== undefined) return failure('unsupported-node-shape', `${name} is spelled ${markdown}, never as a directive`, path)
  const empty = readEmptyKeys(attributes, ['attrs'])
  if (empty.fault !== undefined) return faulted(empty.fault, path)
  const attrs = readVocabulary(name, empty.value.rest, spelling.attributes, undefined, path)
  if (!attrs.ok) return attrs
  if (empty.value.empty.has('attrs')) return Object.keys(attrs.value).length === 0 ? success({ attrs: {}, type: name }) : failure('unsupported-node-shape', `${name} spells attrs=empty beside an attribute it holds`, path)
  return success(Object.keys(attrs.value).length === 0 ? { type: name } : { attrs: attrs.value, type: name })
}

export function inlineMarkSpellingFault(name: string): ConvertFault | undefined {
  const spelling = markSpelling(name)
  if (spelling === undefined) return undefined
  const directive = `${directivePrefix}${name}[…]`
  const forms = spelling.kind === 'link' ? `[x](url) or ${directive}` : (markdownForm(spelling) ?? directive)
  return { code: 'unsupported-node-shape', message: `${name} is spelled ${forms}, never as a block directive` }
}

function markdownForm(spelling: MarkSpelling): string | undefined {
  switch (spelling.kind) {
    case 'code':
      return '`x`'
    case 'directive':
    case 'link':
      return undefined
    case 'emphasis':
      return `${spelling.spelling}x${spelling.spelling}`
  }
}

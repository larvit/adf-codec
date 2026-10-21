import type { AdfMark } from '../../adf/document.ts'
import type { AttributeVocabulary } from '../../adf/attribute-vocabulary.ts'
import type { ConvertFault } from '../../result.ts'
import type { DirectiveAttributes } from './syntax.ts'
import type { MarkSpelling } from '../mark-spellings.ts'
import { directivePrefix } from './syntax.ts'
import { failure, faulted, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { markSpelling } from '../mark-spellings.ts'
import { readEmptyKeys } from './empty-keys.ts'
import { readVocabulary } from './attribute-reading.ts'

export function readDirectiveMark(name: string, attributes: DirectiveAttributes, path: ConvertErrorPath): Result<AdfMark> | undefined {
  const spelling = markSpelling(name)
  if (spelling === undefined) return undefined
  const markdown = markdownForm(spelling)
  if (markdown !== undefined) return failure('unsupported-node-shape', `${name} is spelled ${markdown}, never as a directive`, path)
  return readMarkAttributes(name, attributes, spelling.attributes, path)
}

export function readMarkAttributes(type: string, attributes: DirectiveAttributes, vocabulary: AttributeVocabulary, path: ConvertErrorPath): Result<AdfMark> {
  const empty = readEmptyKeys(type, attributes, ['attrs'], false)
  if (empty.fault !== undefined) return faulted(empty.fault, path)
  const attrs = readVocabulary(type, empty.value.rest, vocabulary, undefined, path)
  if (!attrs.ok) return attrs
  if (empty.value.empty.has('attrs')) return success({ attrs: {}, type })
  return success(Object.keys(attrs.value).length === 0 ? { type } : { attrs: attrs.value, type })
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

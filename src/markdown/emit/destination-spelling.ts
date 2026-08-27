import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'
import { holdsControlCharacter, holdsEntityReference } from '../commonmark-grammar.ts'

export function spellDestination(href: string, path: ConvertErrorPath): Result<string> {
  if (holdsControlCharacter(href)) return failure('unspellable-link-destination', 'a link destination holds a control character', path)
  if (href.includes('\\')) return failure('unspellable-link-destination', 'no canonical escape spells a backslash in a link destination', path)
  if (holdsEntityReference(href)) {
    return failure('unspellable-link-destination', 'a link destination shaped like an entity reference decodes on the way back', path)
  }
  if (href.includes(' ')) {
    if (/[<>]/.test(href)) {
      return failure('unspellable-link-destination', 'no canonical escape spells an angle bracket beside a space in a link destination', path)
    }
    return success(`<${href}>`)
  }
  if (href.startsWith('<')) return failure('unspellable-link-destination', 'a bare link destination cannot begin with an angle bracket', path)
  if (!balanced(href)) return failure('unspellable-link-destination', 'no canonical escape spells an unbalanced parenthesis in a link destination', path)
  return success(href)
}

export function spellTitle(title: string, path: ConvertErrorPath): Result<string> {
  if (/["\n\r\\]/.test(title)) {
    return failure('unspellable-link-title', 'no canonical escape spells a quote, backslash or newline in a link title', path)
  }
  if (holdsEntityReference(title)) return failure('unspellable-link-title', 'a link title shaped like an entity reference decodes on the way back', path)
  return success(` "${title}"`)
}

function balanced(href: string): boolean {
  let depth = 0
  for (const character of href) {
    if (character === '(') depth += 1
    if (character === ')') depth -= 1
    if (depth < 0) return false
  }
  return depth === 0
}

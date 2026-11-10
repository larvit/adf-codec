import type { ConvertErrorPath, Result } from '../../result.ts'
import type { Flavour } from '../flavour.ts'
import type { InlineContent, LinkDefinitions } from '../inline-content.ts'
import type { LineContainer } from '../line-container.ts'
import { failure, success } from '../../result.ts'
import { openingLinkTakesDirective } from '../emit/spelling-questions.ts'
import { parseInlineContent, spellableLink } from '../inline-content.ts'

// The only place a reader asks the writer whether the link opening a paragraph still needs its directive (spec/flavour.md, Marks).
export function readInlineContent(source: string, definitions: LinkDefinitions, path: ConvertErrorPath, container: LineContainer, flavour: Flavour): Result<InlineContent> {
  const content = parseInlineContent(source, definitions, path, container, flavour)
  if (!content.ok || !content.value.openingSpellableLink) return content
  const takesDirective = openingLinkTakesDirective(content.value.nodes, path)
  if (!takesDirective.ok) return takesDirective
  if (!takesDirective.value) return failure('unsupported-node-shape', spellableLink, path)
  return success(content.value)
}

import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { blockText, joinedText, prefixedText, quotedText, writtenText, type BlockText } from './block-text.ts'
import { holdsOnlyRuleCharacters, isBlankLine } from '../commonmark/grammar.ts'
import { propertyRuns } from '../../conformance/property-harness.ts'

const { tree } = fc.letrec<{ tree: BlockText }>((tie) => ({
  tree: fc.oneof(
    { depthSize: 'small', maxDepth: 5 },
    fc.string({ maxLength: 6, unit: fc.constantFrom('a', ' ', '\t', '\n', '-', '*', '_', '>') }).map(blockText),
    fc.array(tie('tree'), { maxLength: 3 }).map(joinedText),
    fc.tuple(fc.constantFrom('- ', '1. ', '*', '\\', '[ ] ', '-'), fc.constantFrom('', ' ', '   '), tie('tree')).map(([head, indent, body]) => prefixedText(head, indent, body)),
    tie('tree').map(quotedText),
  ),
}))

test('measures a block text as the text it writes', () => {
  fc.assert(
    fc.property(tree, (text) => {
      const written = writtenText(text)
      const [first = '', ...rest] = written.split('\n')
      assert.equal(text.length, written.length)
      assert.equal(text.lineCount, rest.length + 1)
      assert.equal(text.first, first)
      assert.equal(text.firstCharacter, first.charAt(0))
      assert.equal(text.firstBlank, first !== '' && isBlankLine(first))
      assert.equal(text.firstRuleCharacters, holdsOnlyRuleCharacters(first))
      assert.equal(text.blankRest, rest.filter((line) => line !== '' && isBlankLine(line)).length)
      assert.equal(text.emptyRest, rest.filter((line) => line === '').length)
    }),
    propertyRuns(2000),
  )
})

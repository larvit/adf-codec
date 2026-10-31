import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { blockText, holdsBlankLine, joinedText, opensWithThematicBreak, prefixedText, quotedText, writtenText, type BlockText } from './block-text.ts'
import { holdsOnlyRuleCharacters, isBlankLine, isThematicBreak } from '../commonmark/grammar.ts'
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
      const [first = '', ...later] = written.split('\n')
      const blank = (line: string): boolean => line !== '' && isBlankLine(line)
      assert.equal(text.length, written.length)
      assert.deepEqual(text.first, { blank: blank(first), character: first.charAt(0), ruleCharacters: holdsOnlyRuleCharacters(first), text: first })
      assert.deepEqual(text.later, { blank: later.filter(blank).length, empty: later.filter((line) => line === '').length, written: later.filter((line) => line !== '').length })
      assert.equal(holdsBlankLine(text), [first, ...later].some(blank))
      assert.equal(opensWithThematicBreak(text), isThematicBreak(first))
    }),
    propertyRuns(2000),
  )
})

test('writes an empty line without reading the started prefixes inside its innermost quote', () => {
  const reads = (emptyLines: number): number => {
    let count = 0
    let body = blockText(`a${'\n'.repeat(emptyLines)}`)
    for (let depth = 0; depth < 3; depth += 1) {
      body = new Proxy(prefixedText('- ', '  ', body), {
        get(target, key, receiver) {
          count += 1
          return Reflect.get(target, key, receiver)
        },
      })
    }
    const text = quotedText(body)
    count = 0
    writtenText(text)
    return count
  }
  assert.equal(reads(1000), reads(1))
})

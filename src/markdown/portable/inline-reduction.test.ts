import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import type { PortableLineFallback } from '../emit/inline-line.ts'
import { lineContainer, markedLine, propertyRuns } from '../../conformance/property-harness.ts'
import { judgedLine, portableLeaves, reduceInline, trimmedEdges, withoutFallback } from './inline-reduction.ts'
import { spannedLine } from '../emit/inline-runs.ts'
import { success, type Result } from '../../result.ts'

test('reduces a line alike dropping every run a pass may or the first alone', () => {
  fc.assert(
    fc.property(markedLine, lineContainer, (nodes, container) => {
      assert.deepEqual(reduceInline(nodes, container, [], 0), firstRunLine(nodes, container))
    }),
    // Lines the fixed seed rarely generates: a later run must not drop with the first, or one pass drops every copy of a repeated mark run.
    {
      ...propertyRuns(3000),
      examples: [
        [[{ attrs: { id: 'a' }, type: 'mention' }, { marks: [{ type: 'strike' }, { type: 'strong' }], text: 'un*', type: 'text' }, { marks: [{ type: 'strong' }], text: '[', type: 'text' }, { text: 'a ', type: 'text' }, { text: ' ', type: 'text' }], 'heading'],
        [[{ marks: [{ type: 'strong' }], text: '-', type: 'text' }, { text: '0', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: 'un ', type: 'text' }, { text: ' ', type: 'text' }], 'heading'],
        [[{ marks: [{ type: 'em' }, { type: 'strike' }], text: '`', type: 'text' }, { text: 'a ', type: 'text' }, { marks: [{ type: 'strike' }], text: 'un', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }, { marks: [{ type: 'underline' }], text: 'z', type: 'text' }], 'heading'],
        [[1, 2, 3].flatMap(() => [{ text: 'un', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strong' }], text: '-r', type: 'text' }]), 'paragraph'],
        [[1, 2, 3].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strike' }, { type: 'strong' }], text: '(', type: 'text' }, { attrs: { id: 'a' }, type: 'mention' }]), 'paragraph'],
        [[{ text: 'z', type: 'text' }, ...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'strike' }], text: '(b', type: 'text' }, { marks: [{ type: 'em' }], text: '(b', type: 'text' }])], 'paragraph'],
        [[...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'strike' }], text: 'b(', type: 'text' }, { marks: [{ type: 'em' }], text: 'b(', type: 'text' }]), { text: 'z', type: 'text' }], 'paragraph'],
        [[...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strong' }], text: '(', type: 'text' }, { marks: [{ type: 'em' }], text: '(', type: 'text' }]), { text: 'a', type: 'text' }], 'paragraph'],
        [[...[1, 2, 3, 4, 5].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strong' }], text: '~** ', type: 'text' }, { marks: [{ type: 'em' }], text: '- _', type: 'text' }]), { text: 'r', type: 'text' }], 'table-cell'],
        [[{ marks: [{ type: 'em' }, { type: 'strike' }], text: '-', type: 'text' }, { text: 'a(.', type: 'text' }, ...[1, 2, 3, 4, 5].flatMap(() => [{ marks: [{ type: 'strong' }, { type: 'strike' }, { type: 'em' }], text: '0.-', type: 'text' }, { marks: [{ type: 'link' }], text: 'un', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'em' }, { type: 'strong' }], text: '=', type: 'text' }]), { marks: [{ type: 'strong' }, { type: 'em' }], text: '[', type: 'text' }, { text: '`=', type: 'text' }], 'table-cell'],
        [[...[1, 2, 3].flatMap(() => [{ marks: [{ type: 'em' }, { type: 'strong' }], text: ' ~~ ', type: 'text' }, { marks: [{ type: 'em' }, { type: 'strike' }, { type: 'strong' }], text: ')', type: 'text' }]), { text: 'a', type: 'text' }, { marks: [{ type: 'strike' }, { type: 'strong' }], text: '.unun', type: 'text' }], 'heading'],
      ],
    },
  )
})

test('refuses an opening-link fallback whose link run holds no code span', () => {
  const link = { attrs: { href: 'u' }, type: 'link' }
  const lines: AdfNode[][] = [
    [{ marks: [link], text: 'a', type: 'text' }],
    [{ marks: [link, { type: 'em' }], text: 'a', type: 'text' }],
    [{ marks: [link], text: 'a', type: 'text' }, { marks: [{ type: 'code' }], text: 'c', type: 'text' }],
  ]
  for (const line of lines) {
    const refused = withoutFallback(line, { kind: 'opening-link' }, [])
    assert.equal(refused.ok ? 'kept' : refused.error.code, 'unsupported-node-shape')
  }
})

test('takes code off every node of an opening link\'s run that an opening-link fallback names', () => {
  const link = { attrs: { href: 'u' }, type: 'link' }
  const line: AdfNode[] = [{ marks: [link, { type: 'code' }], text: 'a', type: 'text' }, { marks: [link], text: 'b', type: 'text' }]
  assert.deepEqual(withoutFallback(line, { kind: 'opening-link' }, []), success([{ marks: [link], text: 'a', type: 'text' }, { marks: [link], text: 'b', type: 'text' }]))
})

test('refuses an unspellable-run fallback that takes no mark', () => {
  const refused = withoutFallback([{ marks: [{ type: 'em' }], text: 'a', type: 'text' }], { kind: 'unspellable-run', runs: [{ first: 0, last: 0, mark: { type: 'strike' } }] }, [])
  assert.equal(refused.ok ? 'kept' : refused.error.code, 'unsupported-node-shape')
})

// Drops only the first run each pass finds, with every misflanked highlight, and takes no cap.
function firstRunLine(nodes: readonly AdfNode[], container: LineContainer): Result<AdfNode[]> {
  const leaves = portableLeaves(nodes, container, [], 0)
  if (!leaves.ok) return leaves
  for (let current = leaves.value; ; ) {
    const judged = judgedLine(current, container, [])
    if (!judged.ok) return judged
    const { fallback, leaves: line } = judged.value
    if (fallback === undefined) return success(line)
    const fixed = withoutFallback(line, firstRun(fallback), [])
    if (!fixed.ok) return fixed
    current = trimmedEdges(fixed.value, spannedLine)
  }
}

function firstRun(fallback: PortableLineFallback): PortableLineFallback {
  if (fallback.kind === 'opening-link') return fallback
  const [first, ...others] = fallback.runs
  return { kind: 'unspellable-run', runs: [first, ...others.filter((run) => run.mark.type === 'backgroundColor')] }
}

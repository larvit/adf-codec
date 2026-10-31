import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfNode } from '../../adf/document.ts'
import type { LineContainer } from '../line-container.ts'
import type { PortableLineFallback } from '../emit/inline-line.ts'
import { lineContainer, markedLine, propertyRuns } from '../../conformance/property-harness.ts'
import { nodeMarks } from '../../adf/document.ts'
import { portableLeaves, reduceInline, trimmedEdges, withoutFallback } from './inline-reduction.ts'
import { portableLineFallback } from '../emit/inline-line.ts'
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

// Drops only the first run each pass finds, with every misflanked highlight, and takes no cap.
function firstRunLine(nodes: readonly AdfNode[], container: LineContainer): Result<AdfNode[]> {
  const leaves = portableLeaves(nodes, container, [], 0)
  if (!leaves.ok) return leaves
  for (let current = leaves.value; ; ) {
    const fallback = portableLineFallback(current, container, [])
    if (!fallback.ok) return fallback
    if (fallback.value === undefined) return success(current)
    const fixed = withoutFallback(current, firstRun(current, fallback.value), [])
    if (!fixed.ok) return fixed
    current = trimmedEdges(fixed.value)
  }
}

function firstRun(leaves: readonly AdfNode[], fallback: PortableLineFallback): PortableLineFallback {
  if (fallback.kind === 'opening-link') return fallback
  const [first, ...others] = fallback.runs
  return { kind: 'unspellable-run', runs: [first, ...others.filter((run) => nodeMarks(leaves[run.first] ?? {})[run.depth]?.type === 'backgroundColor')] }
}

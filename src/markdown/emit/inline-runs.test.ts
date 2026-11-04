import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfMark, AdfNode } from '../../adf/document.ts'
import { runsSharedWithNext } from './inline-runs.ts'

const em: AdfMark = { type: 'em' }
const strong: AdfMark = { type: 'strong' }
const marked = (text: string, ...marks: AdfMark[]): AdfNode => ({ marks, text, type: 'text' })

test('counts a run crossing a code span to its next holder where the line is spanned, and none where it is parted', () => {
  const line = [marked('Run ', strong), marked('npm ci', { type: 'code' }), marked(' first', strong)]
  assert.deepEqual(runsSharedWithNext(line, 'spanned'), [1, 1, 0])
  assert.deepEqual(runsSharedWithNext(line, 'parted'), [0, 0, 0])
})

test('counts every nested run crossing a hard break, and none crossing a hard break holding an empty marks', () => {
  assert.deepEqual(runsSharedWithNext([marked('a', em, strong), { type: 'hardBreak' }, marked('b', em, strong)], 'spanned'), [2, 2, 0])
  assert.deepEqual(runsSharedWithNext([marked('a', em), { marks: [], type: 'hardBreak' }, marked('b', em)], 'spanned'), [0, 0, 0])
})

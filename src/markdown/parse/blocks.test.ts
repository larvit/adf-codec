import assert from 'node:assert/strict'
import test from 'node:test'

import type { LinkDefinition } from '../link-syntax.ts'
import { parseBlocks } from './blocks.ts'

function definitions(markdown: string): [string, LinkDefinition][] {
  return [...parseBlocks(markdown).definitions]
}

function kinds(markdown: string): string[] {
  return parseBlocks(markdown).blocks.map((block) => block.kind)
}

test('keeps the link reference definitions a paragraph gives up, the first of a label winning', () => {
  assert.deepEqual(definitions('[a]: /url\n'), [['a', { destination: '/url' }]])
  assert.deepEqual(definitions('[Foo  Bar]:\n<the url>\n"Title"\n'), [['foo bar', { destination: 'the url', title: 'Title' }]])
  assert.deepEqual(definitions("[a]: /url 'One'\n[a]: /other (Two)\n[b]: /b\n"), [
    ['a', { destination: '/url', title: 'One' }],
    ['b', { destination: '/b' }],
  ])
  assert.deepEqual(definitions('[a\\]b]: /url\n'), [['a\\]b', { destination: '/url' }]])
  assert.deepEqual(definitions('[a]: /url(x)y\n'), [['a', { destination: '/url(x)y' }]])
  assert.deepEqual(definitions('[a]: /url\\(x\n'), [['a', { destination: '/url(x' }]])
  assert.deepEqual(definitions('[a]: /url&amp;x\n'), [['a', { destination: '/url&x' }]])
  assert.deepEqual(definitions('[a]: <>\n'), [['a', { destination: '' }]])
  assert.deepEqual(definitions('[a]: /url "He said \\"hi\\""\n'), [['a', { destination: '/url', title: 'He said "hi"' }]])
  assert.deepEqual(definitions('[a]: /url\\\n[b]: /b\n'), [
    ['a', { destination: '/url\\' }],
    ['b', { destination: '/b' }],
  ])
  assert.deepEqual(definitions('> [a]: /url\n\n- [b]: /other\n'), [
    ['a', { destination: '/url' }],
    ['b', { destination: '/other' }],
  ])
  assert.deepEqual(definitions('[\u00a0a]: /one\n[a]: /two\n'), [
    ['\u00a0a', { destination: '/one' }],
    ['a', { destination: '/two' }],
  ])
})

test('leaves the paragraph a line no definition spells', () => {
  assert.deepEqual(definitions('[]: /url\n'), [])
  assert.deepEqual(definitions('[ ]: /url\n'), [])
  assert.deepEqual(definitions('[a]: <un>closed>\n'), [])
  assert.deepEqual(definitions('[a]: <unclosed\n'), [])
  assert.deepEqual(definitions('[a]: /url)x\n'), [])
  assert.deepEqual(definitions('[a]: /url "One" and more\n'), [])
  assert.deepEqual(definitions('[a]:\n'), [])
  assert.deepEqual(definitions('[a]: /url "unclosed\n'), [])
  assert.deepEqual(definitions('[a]: /url (a(b)\n'), [])
  assert.deepEqual(kinds('[a]: /url\nPart.\n'), ['paragraph'])
})

test('swallows an HTML block to the end condition its start sets', () => {
  assert.deepEqual(kinds('<div>\nx\n\nPart.\n'), ['html', 'paragraph'])
  assert.deepEqual(kinds('<!--\n:::\n-->\nPart.\n'), ['html', 'paragraph'])
  assert.deepEqual(kinds('<pre>x</pre>\nPart.\n'), ['html', 'paragraph'])
  assert.deepEqual(kinds('<div>\nx\n'), ['html'])
  assert.deepEqual(kinds('Part.\n<div>\n'), ['paragraph', 'html'])
})

test('carries a claimed line as the block it opens, the refusal the node layer builds', () => {
  assert.deepEqual(kinds(':::\nPart.\n'), ['claim', 'paragraph'])
  assert.deepEqual(kinds('Part.\n| x |\n'), ['paragraph', 'claim'])
})

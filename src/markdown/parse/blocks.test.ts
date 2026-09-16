import assert from 'node:assert/strict'
import test from 'node:test'

import type { Block } from './blocks.ts'
import type { LinkDefinition } from '../link-syntax.ts'
import { parseBlocks } from './blocks.ts'

function definitions(markdown: string): [string, LinkDefinition][] {
  return [...parseBlocks(markdown).definitions]
}

function kinds(markdown: string): string[] {
  return parseBlocks(markdown).blocks.map((block) => block.kind)
}

function faults(markdown: string): string[] {
  const messages: string[] = []
  const walk = (blocks: readonly Block[]): void => {
    for (const block of blocks) {
      if (block.kind === 'fault') messages.push(block.fault.message)
      if (block.kind === 'blockquote') walk(block.blocks)
      if (block.kind === 'directive' && block.blocks !== undefined) walk(block.blocks)
      if (block.kind === 'bulletList' || block.kind === 'orderedList') for (const item of block.items) walk(item)
    }
  }
  walk(parseBlocks(markdown).blocks)
  return messages
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
  assert.deepEqual(kinds('<!--\n!adf:/panel\n-->\nPart.\n'), ['html', 'paragraph'])
  assert.deepEqual(kinds('<pre>x</pre>\nPart.\n'), ['html', 'paragraph'])
  assert.deepEqual(kinds('<div>\nx\n'), ['html'])
  assert.deepEqual(kinds('Part.\n<div>\n'), ['paragraph', 'html'])
})

test('carries a claimed line as the block it opens, the refusal the node layer builds', () => {
  assert.deepEqual(kinds('!adf:/panel\nPart.\n'), ['fault', 'paragraph'])
  assert.deepEqual(kinds('Part.\n| x |\n'), ['paragraph', 'fault'])
})

test('opens a container where the content model takes content, and holds it open until the closer naming it', () => {
  assert.deepEqual(kinds('!adf:panel info\nPart.\n!adf:/panel\nMore.\n'), ['directive', 'paragraph'])
  assert.deepEqual(kinds('!adf:rule\nPart.\n'), ['directive', 'paragraph'])
  assert.deepEqual(kinds('!adf:listBreak\nPart.\n'), ['directive', 'paragraph'])
  assert.deepEqual(kinds('!adf:widget\nPart.\n'), ['directive', 'paragraph'])
  assert.deepEqual(kinds('!adf:mention\nPart.\n'), ['directive', 'paragraph'])
  assert.deepEqual(faults('!adf:panel info\n\nPart.\n\n!adf:/panel\n'), [])
  assert.deepEqual(faults('!adf:panel info\n> Part.\n!adf:/panel\n'), [])
  assert.deepEqual(faults('!adf:panel info\n- !adf:panel warning\n  Part.\n  !adf:/panel\n!adf:/panel\n'), [])
  assert.deepEqual(faults('!adf:panel info\n```\n!adf:/panel\n```\n!adf:/panel\n'), [])
  assert.deepEqual(parseBlocks('!adf:panel info {panelColor="#ff0000"}\nPart.\n!adf:/panel\n').blocks, [
    {
      argument: 'info',
      attributes: new Map([['panelColor', { decoded: '#ff0000', spelling: '"#ff0000"' }]]),
      blocks: [{ kind: 'paragraph', position: { line: 2, offset: 39 }, text: 'Part.' }],
      kind: 'directive',
      name: 'panel',
      position: { line: 1, offset: 0 },
    },
  ])
  assert.deepEqual(parseBlocks('!adf:rule\n').blocks, [
    { argument: undefined, attributes: new Map(), blocks: undefined, kind: 'directive', name: 'rule', position: { line: 1, offset: 0 } },
  ])
})

test('closes the containers a closer names past as unclosed, and crosses no list item or blockquote edge', () => {
  const unclosed = (name: string): string => `the ${name} container is unclosed: no !adf:/${name} follows inside the block holding it`
  const unopened = (name: string): string => `the closer !adf:/${name} closes no ${name} container open where it stands; \\!adf: keeps the prefix literal`
  assert.deepEqual(faults('!adf:panel info\n!adf:expand\nPart.\n!adf:/expand\n!adf:/panel\n'), [])
  assert.deepEqual(faults('!adf:panel info\n!adf:expand\n!adf:layoutSection\nPart.\n!adf:/panel\n'), [unclosed('expand')])
  assert.deepEqual(faults('!adf:panel info\nPart.\n'), [unclosed('panel')])
  assert.deepEqual(faults('- !adf:panel info\n\nPart.\n'), [unclosed('panel')])
  assert.deepEqual(faults('> !adf:panel info\n> Part.\n!adf:/panel\n'), [unclosed('panel'), unopened('panel')])
  assert.deepEqual(faults('!adf:panel info\n> !adf:/panel\n!adf:/panel\n'), [unopened('panel')])
  assert.deepEqual(faults('Part.\n\n!adf:/panel\n'), [unopened('panel')])
  assert.deepEqual(kinds('!adf:rule {localId=a-1}\nPart.\n!adf:/rule\n'), ['fault', 'paragraph'])
  assert.deepEqual(kinds('!adf:rule {localId=a-1}\n!adf:/rule\n!adf:/rule\n'), ['fault', 'fault'])
})

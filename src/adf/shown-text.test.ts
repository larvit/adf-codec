import assert from 'node:assert/strict'
import test from 'node:test'

import { isBlockNodeType, shownText, shownUrl } from './shown-text.ts'

test('shows a date as its UTC day, one before 1970 included', () => {
  assert.equal(shownText({ attrs: { timestamp: '1700000000000' }, type: 'date' }), '2023-11-14')
  assert.equal(shownText({ attrs: { timestamp: '-86400000' }, type: 'date' }), '1969-12-31')
})

test('shows an emoji by its text, else by its short name where the text is blank', () => {
  assert.equal(shownText({ attrs: { shortName: ':smile:', text: '😄' }, type: 'emoji' }), '😄')
  assert.equal(shownText({ attrs: { shortName: ':smile:', text: ' ' }, type: 'emoji' }), ':smile:')
})

test('shows a mention by its text, else by its id, and nothing for an empty id', () => {
  assert.equal(shownText({ attrs: { id: '5b10a2' }, type: 'mention' }), '@5b10a2')
  assert.equal(shownText({ attrs: { id: '' }, type: 'mention' }), undefined)
})

test('shows an expand or a nested expand by its title', () => {
  assert.equal(shownText({ attrs: { title: 'Details' }, type: 'expand' }), 'Details')
  assert.equal(shownText({ attrs: { title: 'Details' }, type: 'nestedExpand' }), 'Details')
})

test('links an external image to its URL, and a stored one to nothing', () => {
  assert.equal(shownUrl({ attrs: { type: 'external', url: 'https://example.com/a.png' }, type: 'media' }), 'https://example.com/a.png')
  assert.equal(shownUrl({ attrs: { type: 'file', url: 'https://example.com/a.png' }, type: 'mediaInline' }), undefined)
})

test('counts a card standing apart as a block, as a block node is', () => {
  assert.equal(isBlockNodeType('blockCard'), true)
  assert.equal(isBlockNodeType('embedCard'), true)
  assert.equal(isBlockNodeType('paragraph'), true)
  assert.equal(isBlockNodeType('inlineCard'), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfNode } from './document.ts'
import { isBlockNodeType, shownImage, shownLink, shownText, shownUrl } from './shown-text.ts'

const moon = 'https://example.com/moon.png'
const target = 'https://example.com/'

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

test('shows an image no link marks by its alt, else its URL, linked to its URL', () => {
  assert.deepEqual(shownImage({ attrs: { alt: 'The moon', type: 'external', url: moon }, type: 'media' }, undefined), { after: undefined, link: moon, text: 'The moon' })
  assert.deepEqual(shownImage({ attrs: { alt: ' ', type: 'external', url: moon }, type: 'mediaInline' }, undefined), { after: undefined, link: moon, text: moon })
})

test('shows an image a link to its own URL marks by the same text, under that link', () => {
  assert.deepEqual(shownImage({ attrs: { alt: 'The moon', type: 'external', url: moon }, type: 'media' }, moon), { after: undefined, link: undefined, text: 'The moon' })
  assert.deepEqual(shownImage({ attrs: { type: 'external', url: moon }, type: 'mediaInline' }, moon), { after: undefined, link: undefined, text: moon })
})

test('shows an image a link to another target marks by its alt, else the target, else its URL, under the link, its URL after it', () => {
  assert.deepEqual(shownImage({ attrs: { alt: 'The moon', type: 'external', url: moon }, type: 'media' }, target), { after: moon, link: undefined, text: 'The moon' })
  assert.deepEqual(shownImage({ attrs: { type: 'external', url: moon }, type: 'mediaInline' }, target), { after: moon, link: undefined, text: target })
  assert.deepEqual(shownImage({ attrs: { type: 'external', url: moon }, type: 'media' }, ' '), { after: moon, link: undefined, text: moon })
})

test('shows an image with no URL by its alt, else nothing, a note standing in its place', () => {
  assert.deepEqual(shownImage({ attrs: { alt: 'The moon', type: 'file' }, type: 'media' }, target), { after: undefined, link: undefined, text: 'The moon' })
  assert.equal(shownImage({ attrs: { type: 'file' }, type: 'mediaInline' }, undefined), undefined)
  assert.deepEqual(shownImage({ attrs: { alt: 'The moon', type: 'external', url: ' ' }, type: 'media' }, undefined), { after: undefined, link: undefined, text: 'The moon' })
})

test('follows a link mark holding a string href, keeping its title only where that is a string', () => {
  const linked = (attrs: AdfAttributes): AdfNode => ({ marks: [{ type: 'strong' }, { attrs, type: 'link' }], text: 'x', type: 'text' })
  assert.deepEqual(shownLink(linked({ href: target, title: 'Home' })), { href: target, title: 'Home' })
  assert.deepEqual(shownLink(linked({ href: target, title: 5 })), { href: target })
  assert.equal(shownLink(linked({ title: 'Home' })), undefined)
  assert.equal(shownLink({ text: 'x', type: 'text' }), undefined)
})

test('counts a card standing apart as a block, as a block node is', () => {
  assert.equal(isBlockNodeType('blockCard'), true)
  assert.equal(isBlockNodeType('embedCard'), true)
  assert.equal(isBlockNodeType('paragraph'), true)
  assert.equal(isBlockNodeType('inlineCard'), false)
})

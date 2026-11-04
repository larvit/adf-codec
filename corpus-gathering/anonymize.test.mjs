import assert from 'node:assert/strict'
import { test } from 'node:test'

import { anonymize, anonymizeChecked, leakedTokens, shapeDifferences } from './anonymize.mjs'

const draws = {
  digits: ['7391', '2846'],
  hex: ['9f3ac07be1d4'],
  letters: ['qkxwzj'],
  uuids: ['0190a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b', '0190a1b2-c3d4-4e5f-8a9b-1c1d2e3f4a5c'],
  words: ['amber', 'clever', 'cobalt', 'merry', 'otter', 'cliff', 'tundra', 'pumice', 'lantern', 'harbour'],
}

function paragraph(...content) {
  return { attrs: {}, content: [{ content, type: 'paragraph' }], type: 'doc', version: 1 }
}

function textOf(document) {
  return document.content[0].content[0].text
}

test('replaces each word and keeps the whitespace and punctuation around it', () => {
  const written = textOf(anonymize(paragraph({ text: '  Deploy *the* secret-name, now!\n', type: 'text' }), draws))
  assert.match(written, /^ {2}[A-Z][a-z]+ \*[a-z]+\* [a-z]+-[a-z]+, [a-z]+!\n$/)
  assert.doesNotMatch(written, /Deploy|the|secret|name|now/)
})

test('keeps a word in capitals in capitals', () => {
  assert.match(textOf(anonymize(paragraph({ text: 'NOTE', type: 'text' }), draws)), /^[A-Z]+$/)
})

test('keeps the length of a number and of a mixed token', () => {
  assert.match(textOf(anonymize(paragraph({ text: '2024-12 v2Beta', type: 'text' }), draws)), /^[1-9]\d{3}-[1-9]\d [a-z]\d[A-Z][a-z]{3}$/)
})

test('spells a repeated word the same way everywhere in a document', () => {
  const written = anonymize(paragraph({ text: 'alpha beta alpha', type: 'text' }, { text: 'alpha', type: 'text' }), draws).content[0].content
  const [first, , third] = written[0].text.split(' ')
  assert.equal(first, third)
  assert.equal(written[1].text, first)
})

test('keeps a link text equal to its href, and the scheme of both', () => {
  const href = 'https://wiki.example.org/display/page?id=12'
  const [node] = anonymize(paragraph({ marks: [{ attrs: { href }, type: 'link' }], text: href, type: 'text' }), draws).content[0].content
  assert.equal(node.text, node.marks[0].attrs.href)
  assert.match(node.text, /^https:\/\/[a-z]+\.[a-z]+\.[a-z]+\/[a-z]+\/[a-z]+\?[a-z]{1,3}=[1-9]\d$/)
  assert.ok(!node.text.includes('example'))
})

test('keeps node types, mark types and attribute keys', () => {
  const document = paragraph({ marks: [{ type: 'strong' }, { attrs: { color: '#ff0000' }, type: 'textColor' }], text: 'word', type: 'text' }, { type: 'hardBreak' }, { attrs: { custom: 'value' }, type: 'someFutureNode' })
  const [text, hardBreak, future] = anonymize(document, draws).content[0].content
  assert.deepEqual(text.marks, [{ type: 'strong' }, { attrs: { color: '#ff0000' }, type: 'textColor' }])
  assert.deepEqual(hardBreak, { type: 'hardBreak' })
  assert.equal(future.type, 'someFutureNode')
  assert.deepEqual(Object.keys(future.attrs), ['custom'])
  assert.notEqual(future.attrs.custom, 'value')
})

test('keeps an attribute naming a format, and a layout number', () => {
  const panel = { attrs: { panelType: 'info' }, content: [], type: 'panel' }
  const code = { attrs: { language: 'python' }, content: [], type: 'codeBlock' }
  const table = { attrs: { isNumberColumnEnabled: false, layout: 'center', width: 760 }, content: [], type: 'table' }
  const [kept, keptCode, keptTable] = anonymize({ content: [panel, code, table], type: 'doc', version: 1 }, draws).content
  assert.deepEqual(kept.attrs, { panelType: 'info' })
  assert.deepEqual(keptCode.attrs, { language: 'python' })
  assert.deepEqual(keptTable.attrs, { isNumberColumnEnabled: false, layout: 'center', width: 760 })
})

test('replaces a person, an account id and a uuid, keeping each shape', () => {
  const uuid = '3f2b8c1e-9d4a-4c7b-8e21-5a6f7b8c9d0e'
  const accountId = '60f1c2d3e4a5b6c7d8e9f012'
  const [mention] = anonymize(paragraph({ attrs: { accessLevel: 'CONTAINER', id: accountId, localId: uuid, text: '@Real Person' }, type: 'mention' }), draws).content[0].content
  assert.equal(mention.attrs.accessLevel, 'CONTAINER')
  assert.match(mention.attrs.id, /^[0-9a-f]{24}$/)
  assert.notEqual(mention.attrs.id, accountId)
  assert.match(mention.attrs.localId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.notEqual(mention.attrs.localId, uuid)
  assert.match(mention.attrs.text, /^@[A-Z][a-z]+ [A-Z][a-z]+$/)
  assert.ok(!mention.attrs.text.includes('Person'))
})

for (const [version, original] of [['1', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'], ['3', '6fa459ea-ee8a-3ca4-894e-db77e160355e'], ['4', '3f2b8c1e-9d4a-4c7b-8e21-5a6f7b8c9d0e']]) {
  test(`keeps the version of a v${version} uuid it replaces`, () => {
    const [mention] = anonymize(paragraph({ attrs: { localId: original }, type: 'mention' }), draws).content[0].content
    assert.match(mention.attrs.localId, new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$`))
    assert.notEqual(mention.attrs.localId, original)
  })
}

test('keeps a uuid in capitals in capitals', () => {
  const [mention] = anonymize(paragraph({ attrs: { localId: '6FA459EA-EE8A-3CA4-894E-DB77E160355E' }, type: 'mention' }), draws).content[0].content
  assert.match(mention.attrs.localId, /^[0-9A-F]{8}-[0-9A-F]{4}-3[0-9A-F]{3}-[0-9A-F]{4}-[0-9A-F]{12}$/)
  assert.ok(/[A-F]/.test(mention.attrs.localId))
})

test('keeps the version of a uuid inside a longer value', () => {
  const inside = '[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}'
  const accountId = '712020:abcdabcd-ebfa-3cde-8abc-abcdefabcdef'
  const href = 'https://wiki.example.org/page?id=abcdabcd-ebfa-3cde-8abc-abcdefabcdef'
  const [mention] = anonymize(paragraph({ attrs: { id: accountId }, type: 'mention' }), draws).content[0].content
  const [link] = anonymize(paragraph({ marks: [{ attrs: { href }, type: 'link' }], text: 'x', type: 'text' }), draws).content[0].content
  assert.match(mention.attrs.id, new RegExp(`^[1-9]\\d{5}:${inside}$`))
  assert.match(link.marks[0].attrs.href, new RegExp(`^https://[a-z]+\\.[a-z]+\\.[a-z]+/[a-z]+\\?[a-z]{2}=${inside}$`))
})

test('reports a uuid whose version changed', () => {
  const before = paragraph({ attrs: { id: '712020:6fa459ea-ee8a-3ca4-894e-db77e160355e' }, type: 'mention' })
  const after = paragraph({ attrs: { id: '712020:6fa459ea-ee8a-4ca4-894e-db77e160355e' }, type: 'mention' })
  assert.deepEqual(shapeDifferences(before, after), ['/content/0/content/0/attrs/id'])
})

test('replaces a date timestamp with a number of the same length', () => {
  const [date] = anonymize(paragraph({ attrs: { timestamp: '1700000000000' }, type: 'date' }), draws).content[0].content
  assert.match(date.attrs.timestamp, /^[1-9]\d{12}$/)
  assert.notEqual(date.attrs.timestamp, '1700000000000')
})

test('replaces everything inside a free-form attribute, whatever its keys', () => {
  const extension = { attrs: { extensionKey: 'toc', extensionType: 'com.example.macro', parameters: { layout: 'secret', pageId: 42871, type: 'hidden' } }, type: 'extension' }
  const [written] = anonymize({ content: [extension], type: 'doc', version: 1 }, draws).content
  assert.equal(written.attrs.extensionKey, 'toc')
  assert.equal(written.attrs.extensionType, 'com.example.macro')
  assert.deepEqual(Object.keys(written.attrs.parameters), ['layout', 'pageId', 'type'])
  assert.notEqual(written.attrs.parameters.layout, 'secret')
  assert.notEqual(written.attrs.parameters.type, 'hidden')
  assert.notEqual(written.attrs.parameters.pageId, 42871)
  assert.match(String(written.attrs.parameters.pageId), /^[1-9]\d{4}$/)
})

test('replaces a Forge extension key, which opens with its app and environment ids', () => {
  const extensionKey = '6ba7b810-9dad-11d1-80b4-00c04fd430c8/6fa459ea-ee8a-3ca4-894e-db77e160355e/static/report-macro'
  const document = { content: [{ attrs: { extensionKey, extensionType: 'com.atlassian.ecosystem' }, type: 'extension' }], type: 'doc', version: 1 }
  const written = anonymize(document, draws)
  const [app, environment, ...module] = written.content[0].attrs.extensionKey.split('/')
  assert.match(app, /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.match(environment, /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.ok(!extensionKey.startsWith(app))
  assert.ok(!module.join('/').includes('report'))
  assert.equal(written.content[0].attrs.extensionType, 'com.atlassian.ecosystem')
  assert.deepEqual(shapeDifferences(document, written), [])
  assert.deepEqual(leakedTokens(document, written), [])
})

test('replaces a digit of any script', () => {
  const written = textOf(anonymize(paragraph({ text: '電話１３８００１３ ٣٤٥', type: 'text' }), draws))
  assert.match(written, /^[a-z0-9]+ [0-9]+$/)
})

test('never draws a word the document already holds', () => {
  const written = textOf(anonymize(paragraph({ text: 'amber clever', type: 'text' }), draws))
  assert.ok(!written.includes('amber'))
  assert.ok(!written.includes('clever'))
})

test('never draws a uuid holding a part of an original one', () => {
  const original = '1c5f0e3a-7958-4eb4-b3d1-2d9b6e417c80'
  const [mention] = anonymize(paragraph({ attrs: { localId: original }, type: 'mention' }), { ...draws, uuids: ['7baa5903-7958-4d2a-ac4d-6f3ee1010175', draws.uuids[0]] }).content[0].content
  assert.equal(mention.attrs.localId, draws.uuids[0])
})

test('never runs out of draws when a document holds every word of the pool', () => {
  const document = paragraph({ text: draws.words.join(' '), type: 'text' })
  assert.deepEqual(leakedTokens(document, anonymize(document, draws)), [])
})

test('ends and reports the leak when every draw holds the original', () => {
  const document = paragraph({ text: '123', type: 'text' })
  assert.deepEqual(leakedTokens(document, anonymize(document, { ...draws, digits: ['123'] })), ['123'])
})

test('replaces a one-word mention with one word', () => {
  const [mention] = anonymize(paragraph({ attrs: { id: 'x', text: '@Cher' }, type: 'mention' }), draws).content[0].content
  assert.match(mention.attrs.text, /^@[A-Z][a-z]+$/)
})

test('spells a name the same way in a mention and in text', () => {
  const [mention, text] = anonymize(paragraph({ attrs: { text: '@Bob' }, type: 'mention' }, { text: 'Bob said', type: 'text' }), draws).content[0].content
  assert.equal(mention.attrs.text.slice(1), text.text.split(' ')[0])
})

test('keeps every attribute naming a format, and the version', () => {
  const attrs = Object.fromEntries(['__autoSize', 'accessLevel', 'align', 'annotationType', 'background', 'breakoutWidth', 'color', 'colspan', 'columnRuleStyle', 'colwidth', 'displayMode', 'extensionKey', 'extensionType', 'height', 'isNumberColumnEnabled', 'layout', 'level', 'mode', 'order', 'originalHeight', 'originalWidth', 'panelColor', 'panelType', 'rowspan', 'shadowColor', 'size', 'state', 'style', 'type', 'userType', 'valign', 'width', 'widthType'].map((key) => [key, 'zebra']))
  const [written] = anonymize({ content: [{ attrs: { ...attrs, language: 'c/c++' }, type: 'someNode' }], type: 'doc', version: 1 }, draws).content
  assert.deepEqual(written.attrs, { ...attrs, language: 'c/c++' })
  assert.equal(anonymize(paragraph(), draws).version, 1)
})

test('spells a word with the nearest length the pool holds, in its case', () => {
  const pool = { ...draws, words: ['amber', 'clever', 'lantern'] }
  assert.equal(textOf(anonymize(paragraph({ text: 'Alpha', type: 'text' }), pool)), 'Amber')
  assert.equal(textOf(anonymize(paragraph({ text: 'channel', type: 'text' }), pool)), 'lantern')
  assert.equal(textOf(anonymize(paragraph({ text: 'NINELONGS', type: 'text' }), pool)), 'LANTERN')
  assert.equal(textOf(anonymize(paragraph({ text: 'tiny', type: 'text' }), pool)), 'amber')
  assert.equal(textOf(anonymize(paragraph({ text: 'Bob', type: 'text' }), pool)), 'Amber')
})

test('spells a short word from the letters, keeping its case', () => {
  assert.equal(textOf(anonymize(paragraph({ text: 'Al', type: 'text' }), draws)), 'Qk')
})

test('reads a word with an accent as a word', () => {
  assert.equal(textOf(anonymize(paragraph({ text: 'caf\u00e9', type: 'text' }), { ...draws, words: ['amber'] })), 'amber')
})

test('spells a word of a caseless script in small letters', () => {
  assert.match(textOf(anonymize(paragraph({ text: '\u6f22\u5b57 \u6f22\u5b57\u6f22', type: 'text' }), draws)), /^[a-z]+ [a-z]+$/)
})

test('keeps letters and digits in their places in a mixed token', () => {
  assert.match(textOf(anonymize(paragraph({ text: 'beta2 2beta a1x xa1', type: 'text' }), draws)), /^[a-z]{4}\d \d[a-z]{4} [a-z]\d[a-z] [a-z]{2}\d$/)
})

test('spells a hex token from the hex draws', () => {
  assert.equal(textOf(anonymize(paragraph({ text: '3f2a', type: 'text' }), draws)), '9f3a')
})

test('keeps a combining mark in a mixed token', () => {
  assert.match(textOf(anonymize(paragraph({ text: 'a1e\u0301', type: 'text' }), draws)), /^[a-z]\d[a-z]\u0301$/)
})

test('keeps a scheme only before its colon', () => {
  assert.match(textOf(anonymize(paragraph({ text: 'file:///x ftp://x http://x https://x mailto:x tel:x', type: 'text' }), draws)), /^file:\/\/\/[a-z] ftp:\/\/[a-z] http:\/\/[a-z] https:\/\/[a-z] mailto:[a-z] tel:[a-z]$/)
  assert.doesNotMatch(textOf(anonymize(paragraph({ text: 'secret: value', type: 'text' }), draws)), /secret/)
  assert.doesNotMatch(textOf(anonymize(paragraph({ text: 'file https', type: 'text' }), draws)), /file|https/)
})

test('does not call a kept scheme a leak', () => {
  const document = paragraph({ marks: [{ attrs: { href: 'https://example.org' }, type: 'link' }], text: 'x', type: 'text' })
  assert.deepEqual(leakedTokens(document, anonymize(document, draws)), [])
})

test('keeps a boolean and a null, and replaces the strings beside them', () => {
  const [node] = anonymize(paragraph({ attrs: { flag: true, list: [false, 'secret'], none: null }, type: 'someNode' }), draws).content[0].content
  assert.equal(node.attrs.flag, true)
  assert.equal(node.attrs.list[0], false)
  assert.notEqual(node.attrs.list[1], 'secret')
  assert.equal(node.attrs.none, null)
})

test('replaces a string among a content array, and keeps a null there', () => {
  const [held] = anonymize({ content: [{ content: ['secret', null], type: 'someNode' }], type: 'doc', version: 1 }, draws).content
  assert.notEqual(held.content[0], 'secret')
  assert.equal(held.content[1], null)
})

test('replaces a value whose key holds a slash, and the value beside it', () => {
  const [node] = anonymize(paragraph({ attrs: { a: { b: 4242 }, 'a/b': 4243 }, type: 'someNode' }), draws).content[0].content
  assert.notEqual(node.attrs['a/b'], 4243)
  assert.notEqual(node.attrs.a.b, 4242)
  assert.deepEqual(Object.keys(node.attrs), ['a', 'a/b'])
})

test('gives a number no leading zero, so it keeps its length', () => {
  assert.equal(textOf(anonymize(paragraph({ text: '2024 0123', type: 'text' }), { ...draws, digits: ['00000000'] })), '1000 0000')
})

test('moves on through the digits between numbers', () => {
  assert.equal(textOf(anonymize(paragraph({ text: '1234 5678', type: 'text' }), draws)), '7391 2846')
})

test('finds no difference between a document and its anonymized form', () => {
  const document = paragraph({ marks: [{ type: 'em' }], text: 'Some text, 12', type: 'text' }, { attrs: { width: 3 }, type: 'media' })
  assert.deepEqual(shapeDifferences(document, anonymize(document, draws)), [])
  assert.deepEqual(leakedTokens(document, anonymize(document, draws)), [])
})

test('finds no difference in a kept array or a replaced number', () => {
  const document = paragraph({ attrs: { colwidth: [100, 200], pageId: 42871 }, type: 'tableCell' })
  assert.deepEqual(shapeDifferences(document, anonymize(document, draws)), [])
})

test('reports a number turned into a string, an added key and a removed key', () => {
  const before = paragraph({ attrs: { kept: 12, removed: 1 }, type: 'someNode' })
  const after = paragraph({ attrs: { added: 1, kept: '12' }, type: 'someNode' })
  assert.deepEqual(shapeDifferences(before, after).sort(), ['/content/0/content/0/attrs/added', '/content/0/content/0/attrs/kept', '/content/0/content/0/attrs/removed'])
})

test('reports a changed structure with its path', () => {
  const before = paragraph({ marks: [{ type: 'em' }], text: 'a b', type: 'text' })
  const after = paragraph({ marks: [{ type: 'strong' }], text: 'c-d', type: 'text' })
  assert.deepEqual(shapeDifferences(before, after), ['/content/0/content/0/marks/0/type', '/content/0/content/0/text'])
})

test('reports a word the output still holds', () => {
  const before = paragraph({ text: 'private word', type: 'text' })
  const after = paragraph({ text: 'private other', type: 'text' })
  assert.deepEqual(leakedTokens(before, after), ['private'])
})

test('counts a token of three letters as a leak, and a shorter one not', () => {
  const document = paragraph({ text: 'Bob Al', type: 'text' })
  assert.deepEqual(leakedTokens(document, document), ['bob'])
})

test('gives the anonymized document when it holds the shape and no original token', () => {
  const document = paragraph({ text: 'private word', type: 'text' })
  assert.deepEqual(anonymizeChecked(document, draws), { ok: true, written: anonymize(document, draws) })
})

test('keeps out a document whose output still holds an original token', () => {
  const document = paragraph({ text: '123', type: 'text' })
  assert.deepEqual(anonymizeChecked(document, { ...draws, digits: ['123'] }), { differences: [], leaks: ['123'], ok: false })
})

test('does not call a kept attribute value a leak', () => {
  const document = { attrs: {}, content: [{ attrs: { language: 'python' }, content: [{ text: 'python', type: 'text' }], type: 'codeBlock' }], type: 'doc', version: 1 }
  assert.deepEqual(leakedTokens(document, anonymize(document, draws)), [])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { JsonValue } from '../../json-value.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessMarkdown } from '../../index.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : { content, type: 'paragraph' }
}

function markdown(result: Result<string>): string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

test('carries a text node attribute no spelling holds', () => {
  assert.equal(
    markdown(adfToLosslessMarkdown(document(paragraph({ attrs: { localId: 'a' }, text: 'x', type: 'text' })))),
    '!adf:carry{json="{\\"attrs\\":{\\"localId\\":\\"a\\"},\\"text\\":\\"x\\",\\"type\\":\\"text\\"}"}\n',
  )
})

test('spells a CommonMark block as a directive where its own spelling holds neither attribute nor mark', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { localId: 'a' }, type: 'paragraph' }))), '!adf:paragraph {localId=a}\n!adf:/paragraph\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { wrap: true }, type: 'codeBlock' }))), '!adf:codeBlock {wrap=true}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ attrs: { localId: 'a' }, type: 'hardBreak' }, { text: 'x', type: 'text' })))), '!adf:hardBreak{localId=a}x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ marks: [{ type: 'border' }], type: 'blockquote' }))), '!adf:blockquote {marks=border}\n!adf:/blockquote\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'listItem' }))), '!adf:listItem\n!adf:/listItem\n')
})

test('spells an ordered list from the order attribute its first marker is', () => {
  const items: AdfNode[] = [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }]
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: items, type: 'orderedList' }))), '!adf:orderedList\n!adf:listItem\nx\n!adf:/listItem\n!adf:/orderedList\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { order: 1 }, content: items, type: 'orderedList' }))), '1. x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { order: 2 }, content: items, type: 'orderedList' }))), '2. x\n')
})

test('spells a code block language no info string holds as an attribute', () => {
  const language = (value: string): string => markdown(adfToLosslessMarkdown(document({ attrs: { language: value }, type: 'codeBlock' })))
  assert.equal(language(''), '!adf:codeBlock {language=""}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('a`b'), '!adf:codeBlock {language="a\\u0060b"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language(' sql'), '!adf:codeBlock {language=" sql"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('&#97;df'), '!adf:codeBlock {language="\\u0026#97;df"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('foo\\+bar'), '!adf:codeBlock {language="foo\\\\+bar"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('a\u0000b'), '!adf:codeBlock {language="a\\u0000b"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(language('a\tb'), '!adf:codeBlock {language="a\\tb"}\n```\n```\n!adf:/codeBlock\n')
})

test('alternates the marker between adjacent lists of a kind, the marker change being what parts them', () => {
  const list: AdfNode = { content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(list, list, list))), '- x\n\n* x\n\n- x\n')
  const ordered: AdfNode = { attrs: { order: 9 }, content: [{ content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }, { content: [paragraph({ text: 'y', type: 'text' }), paragraph({ text: 'z', type: 'text' })], type: 'listItem' }], type: 'orderedList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(ordered, ordered))), '9. x\n10. y\n\n    z\n\n9) x\n10) y\n\n    z\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(list, ordered, list))), '- x\n\n9. x\n10. y\n\n    z\n\n- x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(list, paragraph({ text: 'y', type: 'text' }), list))), '- x\n\ny\n\n- x\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { panelType: 'info' }, content: [list, list], type: 'panel' }))), '!adf:panel info\n- x\n\n* x\n!adf:/panel\n')
  const nested: AdfNode = { content: [{ content: [list, list], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(nested))), '- - x\n  * x\n')
  const stars: AdfNode = { content: [{ content: [paragraph({ text: '* *', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(list, stars))), '- x\n\n* \\* *\n')
  const strong: AdfNode = { content: [{ content: [paragraph({ text: '**', type: 'text' }), paragraph({ text: 'y', type: 'text' })], type: 'listItem' }], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(strong))), '- **\n\n  y\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(list, strong))), '- x\n\n* \\**\n\n  y\n')
  const carried: AdfNode = { ...list, attrs: { unknown: 'x' } }
  assert.ok(markdown(adfToLosslessMarkdown(document(carried, carried))).includes('```\n\n```adf:bulletList\n'))
  assert.ok(markdown(adfToLosslessMarkdown(document(carried, list))).endsWith('```\n\n- x\n'))
  assert.ok(markdown(adfToLosslessMarkdown(document(list, carried))).startsWith('- x\n\n```adf:bulletList\n'))
})

test('carries a node type no section spells, the fence naming the type wherever an info string carries it', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'blockCard' }))), '```adf:blockCard\n{}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'toString' }))), '```adf:toString\n{}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document(paragraph({ type: 'blockCard' })))), '!adf:carry{json="{\\"type\\":\\"blockCard\\"}"}\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ text: 'x', type: 'text' }))), '```adf:text\n{\n  "text": "x"\n}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'hardBreak' }))), '```adf:hardBreak\n{}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'a&amp;b' }))), '```adf:\n{\n  "type": "a&amp;b"\n}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'a\\b' }))), '```adf:\n{\n  "type": "a\\\\b"\n}\n```\n')
})

test('spells the code block whose language opens with the reserved info string prefix', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { language: 'adf:x' }, type: 'codeBlock' }))), '!adf:codeBlock {language="adf:x"}\n```\n```\n!adf:/codeBlock\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { language: 'carry' }, type: 'codeBlock' }))), '```carry\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { language: 'adf' }, type: 'codeBlock' }))), '```adf\n```\n')
})

test('carries a code block holding a node no fence holds', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph()], type: 'codeBlock' }))), '```adf:codeBlock\n{\n  "content": [\n    {\n      "type": "paragraph"\n    }\n  ]\n}\n```\n')
  for (const child of [{ attrs: {}, text: 'x', type: 'text' }, { content: [], text: 'x', type: 'text' }, { marks: [], text: 'x', type: 'text' }, { content: [{ text: 'lost', type: 'text' }], text: 'x', type: 'text' }]) {
    assert.ok(markdown(adfToLosslessMarkdown(document({ content: [child], type: 'codeBlock' }))).startsWith('```adf:codeBlock\n'), JSON.stringify(child))
  }
})

test('spells a list its own content shape cannot hold as a directive', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph()], type: 'bulletList' }))), '!adf:bulletList\n!adf:paragraph\n!adf:/paragraph\n!adf:/bulletList\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'bulletList' }))), '!adf:bulletList\n!adf:/bulletList\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { order: 2 }, content: [], type: 'orderedList' }))), '!adf:orderedList {content=empty order=2}\n!adf:/orderedList\n')
})

test('spells an ordered list no marker fits as a directive', () => {
  const item: AdfNode = { content: [paragraph({ text: 'x', type: 'text' })], type: 'listItem' }
  const list = (order: number, items: number): AdfDocument =>
    document({ attrs: { order }, content: Array.from({ length: items }, () => item), type: 'orderedList' })
  assert.equal(markdown(adfToLosslessMarkdown(list(1.5, 1))), '!adf:orderedList {order="1.5"}\n!adf:listItem\nx\n!adf:/listItem\n!adf:/orderedList\n')
  assert.equal(markdown(adfToLosslessMarkdown(list(999999999, 1))), '999999999. x\n')
  assert.equal(markdown(adfToLosslessMarkdown(list(999999999, 2))), '!adf:orderedList {order=999999999}\n!adf:listItem\nx\n!adf:/listItem\n!adf:listItem\nx\n!adf:/listItem\n!adf:/orderedList\n')
})

test('spells a heading level no ATX heading fits as a directive', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { level: 7 }, content: [{ text: 'x', type: 'text' }], type: 'heading' }))), '!adf:heading {level=7}\nx\n!adf:/heading\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [{ text: 'x', type: 'text' }], type: 'heading' }))), '!adf:heading\nx\n!adf:/heading\n')
})

test('parts a nested list the tight spelling would swallow from the block above it', () => {
  const item = (...content: AdfNode[]): AdfNode => (content.length === 0 ? { type: 'listItem' } : { content, type: 'listItem' })
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const outer = (...content: AdfNode[]): AdfDocument => document({ content: [item(...content)], type: 'bulletList' })
  const ordered: AdfNode = { attrs: { order: 2 }, content: [item(text('b'))], type: 'orderedList' }
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), ordered))), '- a\n\n  2. b\n')
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), { ...ordered, attrs: { order: 1 } }))), '- a\n  1. b\n')
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), { content: [item()], type: 'bulletList' }))), '- a\n\n  -\n')
  assert.equal(markdown(adfToLosslessMarkdown(outer(text('a'), { content: [item(text('b'))], type: 'bulletList' }))), '- a\n  - b\n')
  const list: AdfNode = { content: [item(text('b'))], type: 'bulletList' }
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [text('p')], type: 'panel' }
  assert.equal(markdown(adfToLosslessMarkdown(outer(panel, list))), '- !adf:panel info\n  p\n  !adf:/panel\n\n  - b\n')
  assert.ok(markdown(adfToLosslessMarkdown(outer(text('a'), { ...list, attrs: { unknown: 'x' } }))).startsWith('- a\n\n  ```adf:bulletList\n'))
})

test('spells a list item whose marker completes a thematic break as a directive', () => {
  const item = (...content: AdfNode[]): AdfNode => (content.length === 0 ? { type: 'listItem' } : { content, type: 'listItem' })
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [item({ type: 'rule' })], type: 'bulletList' }))), '!adf:bulletList\n!adf:listItem\n---\n!adf:/listItem\n!adf:/bulletList\n')
  const nested: AdfNode = { content: [item({ content: [item()], type: 'bulletList' })], type: 'bulletList' }
  assert.equal(markdown(adfToLosslessMarkdown(document(nested))), '- -\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [item(nested)], type: 'bulletList' }))), '!adf:bulletList\n!adf:listItem\n- -\n!adf:/listItem\n!adf:/bulletList\n')
  assert.equal(
    markdown(adfToLosslessMarkdown(document({ content: [item(paragraph({ text: 'a', type: 'text' }), nested), item({ type: 'rule' })], type: 'bulletList' }))),
    '!adf:bulletList\n!adf:listItem\na\n\n- -\n!adf:/listItem\n!adf:listItem\n---\n!adf:/listItem\n!adf:/bulletList\n',
  )
  const spaced: AdfNode = { content: [{ text: 'a\n \nb', type: 'text' }], type: 'codeBlock' }
  assert.equal(
    markdown(adfToLosslessMarkdown(document({ attrs: { order: 3 }, content: [item(spaced)], type: 'orderedList' }))),
    '!adf:orderedList {order=3}\n!adf:listItem\n```\na\n \nb\n```\n!adf:/listItem\n!adf:/orderedList\n',
  )
})

test('emits an empty list item without trailing whitespace', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [{ type: 'listItem' }], type: 'bulletList' }))), '-\n')
})

test('spells a block directive as its node type, arg and attributes', () => {
  const panel = (attrs: AdfAttributes): AdfDocument => document({ attrs, content: [paragraph({ text: 'x', type: 'text' })], type: 'panel' })
  assert.equal(markdown(adfToLosslessMarkdown(panel({ panelType: 'warning' }))), '!adf:panel warning\nx\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel({}))), '!adf:panel {attrs=empty}\nx\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [{ text: 'x', type: 'text' }], type: 'caption' }))), '!adf:caption\nx\n!adf:/caption\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ type: 'caption' }))), '!adf:caption\n!adf:/caption\n')
  assert.equal(markdown(adfToLosslessMarkdown(document({ attrs: { localId: 'a' }, type: 'syncBlock' }))), '!adf:syncBlock {localId=a}\n')
})

test('carries a directive attribute no section spells', () => {
  const carried = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(node)))
  assert.equal(carried({ attrs: { rounded: true }, type: 'panel' }), '```adf:panel\n{\n  "attrs": {\n    "rounded": true\n  }\n}\n```\n')
  assert.equal(carried({ attrs: { toString: 'x' }, type: 'panel' }), '```adf:panel\n{\n  "attrs": {\n    "toString": "x"\n  }\n}\n```\n')
  assert.equal(carried({ attrs: { localId: 4 }, type: 'panel' }), '```adf:panel\n{\n  "attrs": {\n    "localId": 4\n  }\n}\n```\n')
  assert.equal(
    carried({ attrs: { width: '50' }, type: 'layoutColumn' }),
    '```adf:layoutColumn\n{\n  "attrs": {\n    "width": "50"\n  }\n}\n```\n',
  )
  assert.equal(
    carried({ attrs: { isNumberColumnEnabled: 'true' }, type: 'table' }),
    '```adf:table\n{\n  "attrs": {\n    "isNumberColumnEnabled": "true"\n  }\n}\n```\n',
  )
  assert.equal(
    carried({ content: [{ attrs: { alt: 4 }, type: 'media' }], type: 'mediaGroup' }),
    '!adf:mediaGroup\n```adf:media\n{\n  "attrs": {\n    "alt": 4\n  }\n}\n```\n!adf:/mediaGroup\n',
  )
})

test('carries an arg slot value no bare token spells', () => {
  const carried = (node: AdfNode): string => markdown(adfToLosslessMarkdown(document(node)))
  assert.equal(
    carried({ attrs: { panelType: 'extra info' }, type: 'panel' }),
    '```adf:panel\n{\n  "attrs": {\n    "panelType": "extra info"\n  }\n}\n```\n',
  )
  assert.equal(carried({ attrs: { state: 2 }, type: 'taskItem' }), '```adf:taskItem\n{\n  "attrs": {\n    "state": 2\n  }\n}\n```\n')
})

test('carries a block node mark in the reserved attribute', () => {
  const section = (...marks: AdfMark[]): AdfDocument => document({ marks, type: 'layoutSection' })
  assert.equal(markdown(adfToLosslessMarkdown(section({ type: 'breakout' }))), '!adf:layoutSection {marks=breakout}\n!adf:/layoutSection\n')
  assert.equal(markdown(adfToLosslessMarkdown(section({ attrs: {}, type: 'breakout' }))), '!adf:layoutSection {marks="breakout{attrs=empty}"}\n!adf:/layoutSection\n')
  assert.equal(markdown(adfToLosslessMarkdown(section())), '!adf:layoutSection {marks=empty}\n!adf:/layoutSection\n')
})

test('spells each block mark by name and attrs, in order, where every mark is one the tables type', () => {
  const section = (...marks: AdfMark[]): AdfDocument => document({ marks, type: 'layoutSection' })
  assert.equal(markdown(adfToLosslessMarkdown(section({ attrs: { mode: 'wide' }, type: 'breakout' }))), '!adf:layoutSection {marks="breakout{mode=wide}"}\n!adf:/layoutSection\n')
  assert.equal(
    markdown(adfToLosslessMarkdown(section({ attrs: { level: 2 }, type: 'indentation' }, { attrs: { localId: 'f1', name: 'Price list' }, type: 'fragment' }))),
    '!adf:layoutSection {marks="indentation{level=2} fragment{localId=f1 name=\\"Price list\\"}"}\n!adf:/layoutSection\n',
  )
  assert.equal(
    markdown(adfToLosslessMarkdown(section({ type: 'em' }, { attrs: { color: '#fff' }, type: 'backgroundColor' }))),
    '!adf:layoutSection {marks="[{\\"type\\":\\"em\\"},{\\"attrs\\":{\\"color\\":\\"#fff\\"},\\"type\\":\\"backgroundColor\\"}]"}\n!adf:/layoutSection\n',
  )
  assert.equal(
    markdown(adfToLosslessMarkdown(section({ attrs: { level: '2' }, type: 'indentation' }))),
    '!adf:layoutSection {marks="[{\\"attrs\\":{\\"level\\":\\"2\\"},\\"type\\":\\"indentation\\"}]"}\n!adf:/layoutSection\n',
  )
})

test('spells colwidth as its widths, comma-separated, and carries a cell whose colwidth no list of numbers spells', () => {
  const cell = (colwidth: JsonValue): AdfDocument => document({ attrs: { colwidth }, type: 'tableCell' })
  assert.equal(markdown(adfToLosslessMarkdown(cell([340, 420.5]))), '!adf:tableCell {colwidth="340,420.5"}\n!adf:/tableCell\n')
  assert.equal(markdown(adfToLosslessMarkdown(cell([340]))), '!adf:tableCell {colwidth=340}\n!adf:/tableCell\n')
  assert.equal(markdown(adfToLosslessMarkdown(cell([]))), '```adf:tableCell\n{\n  "attrs": {\n    "colwidth": []\n  }\n}\n```\n')
  assert.equal(markdown(adfToLosslessMarkdown(cell(['340']))), '```adf:tableCell\n{\n  "attrs": {\n    "colwidth": [\n      "340"\n    ]\n  }\n}\n```\n')
})

test('refuses the content a directive body has no room for', () => {
  assert.equal(markdown(adfToLosslessMarkdown(document({ content: [paragraph()], type: 'media' }))), 'unsupported-node-shape: a node of type media holds no content: this one holds some')
  assert.equal(markdown(adfToLosslessMarkdown(document({ text: 'x', type: 'panel' }))), 'unsupported-node-shape: a node of type panel holds no text key: this one holds one')
})

test('separates blocks in a container body by a blank line only where a directive line is not separation already', () => {
  const text = (value: string): AdfNode => ({ content: [{ text: value, type: 'text' }], type: 'paragraph' })
  const panel = (...content: AdfNode[]): AdfDocument => document({ attrs: { panelType: 'info' }, content, type: 'panel' })
  assert.equal(markdown(adfToLosslessMarkdown(panel(text('a'), text('b')))), '!adf:panel info\na\n\nb\n!adf:/panel\n')
  const caption: AdfNode = { content: [{ text: 'c', type: 'text' }], type: 'caption' }
  assert.equal(markdown(adfToLosslessMarkdown(panel(caption, caption))), '!adf:panel info\n!adf:caption\nc\n!adf:/caption\n!adf:caption\nc\n!adf:/caption\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel(text('a'), caption))), '!adf:panel info\na\n!adf:caption\nc\n!adf:/caption\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel(caption, text('a')))), '!adf:panel info\n!adf:caption\nc\n!adf:/caption\na\n!adf:/panel\n')
  assert.equal(markdown(adfToLosslessMarkdown(panel(paragraph(), text('a')))), '!adf:panel info\n!adf:paragraph\n!adf:/paragraph\na\n!adf:/panel\n')
})

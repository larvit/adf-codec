import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { markdownToAdf } from './markdown-to-adf.ts'

const em: AdfMark = { type: 'em' }
const strike: AdfMark = { type: 'strike' }
const strong: AdfMark = { type: 'strong' }

function code(result: Result<AdfDocument>): string {
  return result.ok ? `built ${JSON.stringify(result.value)}` : result.error.code
}

function content(result: Result<AdfDocument>): AdfNode[] | string {
  return result.ok ? (result.value.content ?? []) : `${result.error.code}: ${result.error.message}`
}

function path(result: Result<AdfDocument>): readonly (number | string)[] {
  return result.ok ? ['built'] : result.error.path
}

function text(value: string): AdfNode {
  return { text: value, type: 'text' }
}

function paragraph(value: string): AdfNode {
  return { content: [text(value)], type: 'paragraph' }
}

function codeSpan(value: string): AdfNode {
  return { marks: [{ type: 'code' }], text: value, type: 'text' }
}

function hardBreak(): AdfNode {
  return { type: 'hardBreak' }
}

function item(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'listItem' } : { content, type: 'listItem' }
}

function bulletList(...content: AdfNode[]): AdfNode {
  return { content, type: 'bulletList' }
}

function orderedList(order: number, ...content: AdfNode[]): AdfNode {
  return { attrs: { order }, content, type: 'orderedList' }
}

function quote(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'blockquote' } : { content, type: 'blockquote' }
}

function marked(value: string, ...marks: AdfMark[]): AdfNode {
  return { marks, text: value, type: 'text' }
}

function link(href: string, title?: string): AdfMark {
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
}

function image(url: string, alt?: string): AdfNode {
  const media: AdfNode = { attrs: alt === undefined ? { type: 'external', url } : { alt, type: 'external', url }, type: 'media' }
  return { attrs: { layout: 'center' }, content: [media], type: 'mediaSingle' }
}

test('builds an empty document from input holding no block', () => {
  assert.deepEqual(markdownToAdf(''), { ok: true, value: { type: 'doc', version: 1 } })
  assert.deepEqual(content(markdownToAdf('\n \n\t\n')), [])
})

test('builds one paragraph from the lines a blank line does not part', () => {
  assert.deepEqual(content(markdownToAdf('One\ntwo.\n\nThree.\n')), [paragraph('One two.'), paragraph('Three.')])
})

test('reads an ATX heading and its level', () => {
  assert.deepEqual(content(markdownToAdf('# Assembly\n')), [{ attrs: { level: 1 }, content: [text('Assembly')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('###### M8\n')), [{ attrs: { level: 6 }, content: [text('M8')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('  ## Parts ##\n')), [{ attrs: { level: 2 }, content: [text('Parts')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('#\n')), [{ attrs: { level: 1 }, type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('####### Seven\n')), [paragraph('####### Seven')])
  assert.deepEqual(content(markdownToAdf('#hashtag\n')), [paragraph('#hashtag')])
})

test('reads a setext underline as the heading level it spells', () => {
  assert.deepEqual(content(markdownToAdf('Assembly\n===\n')), [{ attrs: { level: 1 }, content: [text('Assembly')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('One\ntwo\n-\n')), [{ attrs: { level: 2 }, content: [text('One two')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('===\n')), [paragraph('===')])
})

test('reads a thematic break, the dashed one only where no paragraph is open', () => {
  assert.deepEqual(content(markdownToAdf('---\n')), [{ type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('Part.\n\n * * *\n')), [paragraph('Part.'), { type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('___\n')), [{ type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('Part.\n***\n')), [paragraph('Part.'), { type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('Part.\n---\n')), [{ attrs: { level: 2 }, content: [text('Part.')], type: 'heading' }])
})

test('reads a fenced code block, its info string the language', () => {
  assert.deepEqual(content(markdownToAdf('```sql\nSELECT id\nFROM part\n```\n')), [
    { attrs: { language: 'sql' }, content: [text('SELECT id\nFROM part')], type: 'codeBlock' },
  ])
  assert.deepEqual(content(markdownToAdf('```\nx\n```\n')), [{ content: [text('x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('```   rust  \nx\n```\n')), [{ attrs: { language: 'rust' }, content: [text('x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('```\n```\n')), [{ type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('```\nx\n')), [{ content: [text('x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('````\n```\n````\n')), [{ content: [text('```')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('~~~ a`b\n```\n~~~\n')), [{ attrs: { language: 'a`b' }, content: [text('```')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('``` a`b\n')), [paragraph('``` a`b')])
  assert.deepEqual(content(markdownToAdf('```\n``` x\n```\n')), [{ content: [text('``` x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('```\n- x\n> y\n```\n')), [{ content: [text('- x\n> y')], type: 'codeBlock' }])
})

test('strips the opening fence indentation from the content lines it holds', () => {
  assert.deepEqual(content(markdownToAdf('   ```\n    x\n  y\n   ```\n')), [{ content: [text(' x\ny')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('  ```\n\tx\n  ```\n')), [{ content: [text('  x')], type: 'codeBlock' }])
})

test('reads an indented code block where no paragraph is open', () => {
  assert.deepEqual(content(markdownToAdf('    SELECT id\n')), [{ content: [text('SELECT id')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('\tSELECT id\n')), [{ content: [text('SELECT id')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('      x\n')), [{ content: [text('  x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('    a\n\n    b\n\nPart.\n')), [{ content: [text('a\n\nb')], type: 'codeBlock' }, paragraph('Part.')])
  assert.deepEqual(content(markdownToAdf('Part.\n    more\n')), [paragraph('Part. more')])
})

test('claims a block-level colon run with no directive to parse it', () => {
  assert.equal(code(markdownToAdf(':::\n')), 'malformed-directive')
  assert.equal(code(markdownToAdf('::Panel\n')), 'malformed-directive')
  assert.equal(code(markdownToAdf('::panel {a=1 a=2}\n')), 'malformed-directive')
  assert.deepEqual(content(markdownToAdf(':10:30\n')), [paragraph(':10:30')])
  assert.deepEqual(content(markdownToAdf(':: two\n')), [paragraph(':: two')])
})

test('reads the three directive forms into the nodes the tables name', () => {
  assert.deepEqual(content(markdownToAdf('::rule {localId=a-1}\n')), [{ attrs: { localId: 'a-1' }, type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('::paragraph\n')), [{ type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('   :::panel info\nPart.\n:::\n')), [
    { attrs: { panelType: 'info' }, content: [paragraph('Part.')], type: 'panel' },
  ])
  assert.deepEqual(content(markdownToAdf(':::blockquote {localId=a-1}\n:::\n')), [{ attrs: { localId: 'a-1' }, type: 'blockquote' }])
  assert.deepEqual(content(markdownToAdf(':::heading {level=2 localId=a-1}\nPart.\n:::\n')), [
    { attrs: { level: 2, localId: 'a-1' }, content: [text('Part.')], type: 'heading' },
  ])
  assert.deepEqual(content(markdownToAdf('Part:hardBreak{}.\n')), [{ content: [text('Part'), hardBreak(), text('.')], type: 'paragraph' }])
})

test('names the directive form a node CommonMark spells refuses', () => {
  const named = (type: string): string => `unsupported-node-shape: ${type} takes the CommonMark spelling, not the directive form`
  assert.equal(content(markdownToAdf('::rule\n')), named('rule'))
  assert.equal(content(markdownToAdf(':::blockquote\nPart.\n:::\n')), named('blockquote'))
  assert.equal(content(markdownToAdf(':::heading {level=2}\nPart.\n:::\n')), named('heading'))
  assert.equal(content(markdownToAdf(':::paragraph\nPart.\n:::\n')), named('paragraph'))
  assert.equal(content(markdownToAdf('::::bulletList\n:::listItem\nPart.\n:::\n::::\n')), named('bulletList'))
  // The item whose first line reads back as a thematic break keeps the directive form the emitter falls back to.
  assert.deepEqual(content(markdownToAdf('::::bulletList\n:::listItem\n---\n:::\n::::\n')), [bulletList(item({ type: 'rule' }))])
})

// The spelling the emitter refuses gives the emitter's own error, never a second name for it.
test('gives back the refusal the CommonMark spelling itself raises', () => {
  const nested = '::::::::bulletList\n:::::::listItem\n---\n\n::::::bulletList\n:::::listItem\n---\n\n::::bulletList\n:::listItem\n---\n:::\n::::\n:::::\n::::::\n:::::::\n::::::::\n'
  assert.equal(code(markdownToAdf(nested)), 'unspelled-block-separation')
})

test('names the directive name no node reads back to', () => {
  assert.equal(code(markdownToAdf(':::widget info\nx\n:::\n')), 'unknown-directive-name')
  assert.equal(content(markdownToAdf('::widget\n')), 'unknown-directive-name: the directive name widget reads back to no node')
  assert.equal(code(markdownToAdf(':widget[x]\n')), 'unknown-directive-name')
  assert.deepEqual(path(markdownToAdf('Part.\n\n::widget\n')), ['content', 1])
  assert.equal(content(markdownToAdf('Part.\n:::x\n')), 'malformed-directive: a container fenced with 3 colons is unclosed')
  assert.deepEqual(path(markdownToAdf('Part.\n:::x\n')), ['content', 1])
})

test('names the reserved carry name a block directive spells', () => {
  const reserved = 'malformed-directive: the name adf is reserved for the opaque carry, whose block form is the fence'
  assert.equal(content(markdownToAdf('::adf\n')), reserved)
  assert.equal(content(markdownToAdf(':::adf\nx\n:::\n')), reserved)
  assert.equal(content(markdownToAdf('```adf\nx\n```\n')), 'malformed-directive: the info string adf is reserved for the opaque carry')
  assert.deepEqual(content(markdownToAdf('```adfx\nx\n```\n')), [{ attrs: { language: 'adfx' }, content: [text('x')], type: 'codeBlock' }])
})

test('reads each attribute value as the type its section assigns', () => {
  assert.deepEqual(content(markdownToAdf('::media {height=10 id=a-1 type=file url="/x y" width="20.5"}\n')), [
    { attrs: { height: 10, id: 'a-1', type: 'file', url: '/x y', width: 20.5 }, type: 'media' },
  ])
  assert.deepEqual(content(markdownToAdf(':::table {isNumberColumnEnabled=true}\n:::\n')), [{ attrs: { isNumberColumnEnabled: true }, type: 'table' }])
  assert.deepEqual(content(markdownToAdf(':::tableCell {colwidth="[340,420]"}\n:::\n')), [{ attrs: { colwidth: [340, 420] }, type: 'tableCell' }])
  assert.deepEqual(content(markdownToAdf('::rule {localId=a-1}\n')), [{ attrs: { localId: 'a-1' }, type: 'rule' }])
})

test('reads the reserved marks key as the node array it spells', () => {
  assert.deepEqual(content(markdownToAdf('::rule {marks="[{\\"type\\":\\"em\\"}]"}\n')), [{ marks: [em], type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('::rule {localId=a-1 marks="[{\\"attrs\\":{\\"mode\\":\\"wide\\"},\\"type\\":\\"breakout\\"}]"}\n')), [
    { attrs: { localId: 'a-1' }, marks: [{ attrs: { mode: 'wide' }, type: 'breakout' }], type: 'rule' },
  ])
})

test('names the marks key no marks array reads back from', () => {
  const named = 'unsupported-node-shape: the marks attribute of rule is its marks array in canonical JSON'
  assert.equal(content(markdownToAdf('::rule {marks="[]"}\n')), named)
  assert.equal(content(markdownToAdf('::rule {marks="[1]"}\n')), named)
  assert.equal(content(markdownToAdf('::rule {marks="{}"}\n')), named)
  assert.equal(content(markdownToAdf('::rule {marks=x}\n')), named)
  assert.equal(content(markdownToAdf('::rule {marks="[{\\"attrs\\":{},\\"type\\":\\"em\\"}]"}\n')), named)
})

test('names the attribute a node holds no reading for', () => {
  assert.equal(content(markdownToAdf('::rule {bogus=1}\n')), 'unsupported-node-shape: rule holds no bogus attribute')
  assert.equal(content(markdownToAdf('::media {width=wide}\n')), 'unsupported-node-shape: the width attribute of media is no number')
  assert.equal(content(markdownToAdf(':::table {isNumberColumnEnabled=yes}\n:::\n')), 'unsupported-node-shape: the isNumberColumnEnabled attribute of table is no boolean')
  assert.equal(content(markdownToAdf('::media {width=true}\n')), 'unsupported-node-shape: the width attribute of media is no number')
  assert.equal(content(markdownToAdf(':::tableCell {colwidth="[340,"}\n:::\n')), 'unsupported-node-shape: the colwidth attribute of tableCell is no json')
  const deep = `${'['.repeat(largestNesting + 2)}${']'.repeat(largestNesting + 2)}`
  assert.equal(content(markdownToAdf(`:::tableCell {colwidth="${deep}"}\n:::\n`)), 'unsupported-node-shape: the colwidth attribute of tableCell is no json')
  assert.equal(content(markdownToAdf(':::panel info {panelType=note}\nx\n:::\n')), 'unsupported-node-shape: panel spells its panelType attribute as the directive argument')
  assert.equal(content(markdownToAdf('Part :mention{id=b1c2 text=A}.\n')), 'unsupported-node-shape: mention spells its text attribute in the content slot')
})

test('names the attribute value spelled outside the canonical form', () => {
  assert.equal(content(markdownToAdf('::rule {localId="a-1"}\n')), 'unsupported-node-shape: rule spells its localId attribute as localId=a-1')
  assert.equal(content(markdownToAdf('::media {width="20.0"}\n')), 'unsupported-node-shape: media spells its width attribute as width=20')
  assert.equal(content(markdownToAdf(':::tableCell {colwidth="[340, 420]"}\n:::\n')), 'unsupported-node-shape: tableCell spells its colwidth attribute as colwidth="[340,420]"')
})

test('names the argument and the body a node takes no reading for', () => {
  assert.equal(content(markdownToAdf('::rule x\n')), 'unsupported-node-shape: rule takes no argument')
  assert.equal(content(markdownToAdf(':::rule\nPart.\n:::\n')), 'unsupported-node-shape: rule holds no content')
  assert.equal(content(markdownToAdf('::bulletList\n')), 'unsupported-node-shape: bulletList spells its body in the container form, :::')
  assert.equal(content(markdownToAdf(':::paragraph\n:::\n')), 'unsupported-node-shape: an empty paragraph takes the leaf form, ::')
  assert.equal(content(markdownToAdf(':::paragraph\nOne.\n\nTwo.\n:::\n')), 'unsupported-node-shape: paragraph takes one paragraph as its body')
  assert.equal(content(markdownToAdf(':::paragraph\n---\n:::\n')), 'unsupported-node-shape: paragraph takes one paragraph as its body')
  assert.equal(content(markdownToAdf(':::codeBlock\n```\nx\n```\n:::\n')), 'unsupported-node-shape: the fenced body of codeBlock is unsupported')
  assert.equal(content(markdownToAdf(':::paragraph\n![a](/u)\n:::\n')), 'unmappable-image: no ADF node carries an image inside a paragraph')
  assert.equal(content(markdownToAdf('Part :date[now]{timestamp=1}.\n')), 'unsupported-node-shape: date takes no content')
  assert.equal(
    content(markdownToAdf('Part :emoji[x]{shortName=":x:"}.\n')),
    'unsupported-node-shape: the content slot emoji spells its text attribute in is unsupported',
  )
})

test('leaves the colon that opens no directive the text it is', () => {
  assert.deepEqual(content(markdownToAdf('At 10:30 :smile: today.\n')), [paragraph('At 10:30 :smile: today.')])
  assert.deepEqual(content(markdownToAdf('\\:mention[@A]\n')), [paragraph(':mention[@A]')])
  assert.deepEqual(content(markdownToAdf('`:mention[@A]`\n')), [{ content: [codeSpan(':mention[@A]')], type: 'paragraph' }])
})

test('names the inline directive left unclosed at the end of its line', () => {
  assert.equal(code(markdownToAdf('Part :mention[@A\n')), 'malformed-directive')
  assert.equal(code(markdownToAdf('Part :mention[@A]{id=\n')), 'malformed-directive')
  assert.deepEqual(path(markdownToAdf('> Part :mention[@A\n')), ['content', 0, 'content', 0])
})

test('claims a block-level pipe with no table to parse it', () => {
  assert.equal(code(markdownToAdf('| Part | Qty |\n')), 'malformed-pipe-table')
  assert.deepEqual(content(markdownToAdf('\\| Part\n')), [paragraph('| Part')])
})

test('refuses the raw HTML no element mapping carries', () => {
  assert.equal(code(markdownToAdf('<!-- note -->\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\nx\n</div>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<?php ?>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<!DOCTYPE html>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<![CDATA[x]]>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<pre>\nx\n</pre>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<span foo="bar">\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<?php\n')), 'unmappable-html')
  assert.deepEqual(path(markdownToAdf('Part.\n\n<div>\n')), ['content', 1])
  assert.equal(code(markdownToAdf('<div>\nx\n\n:::\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\n- x\n</div>\n')), 'unmappable-html')
})

test('swallows an HTML block ahead of the claim a line inside it would make', () => {
  assert.equal(code(markdownToAdf('<!--\n:::\n-->\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\n| x |\n</div>\n')), 'unmappable-html')
})

test('gives up the link reference definitions a paragraph opens with', () => {
  assert.deepEqual(content(markdownToAdf('[a]: /url\n')), [])
  assert.deepEqual(content(markdownToAdf('[a]: /url\n[b]: /other\nPart.\n')), [paragraph('Part.')])
  assert.deepEqual(content(markdownToAdf('[a]: /url\n"Title"\n\nPart.\n')), [paragraph('Part.')])
  assert.deepEqual(content(markdownToAdf('[a]: /url and more\n')), [paragraph('[a]: /url and more')])
  assert.deepEqual(content(markdownToAdf('Part.\n[a]: /url\n')), [paragraph('Part. [a]: /url')])
  assert.deepEqual(content(markdownToAdf('[a]: /url\n===\n')), [paragraph('===')])
})

test('keeps the whitespace CommonMark strips no more of than a space or a tab', () => {
  assert.deepEqual(content(markdownToAdf('\u00a0Part.\u00a0\n')), [paragraph('\u00a0Part.\u00a0')])
  assert.deepEqual(content(markdownToAdf('  \u3000Part.\t\n')), [paragraph('\u3000Part.')])
})

test('normalizes the line endings and the null character CommonMark replaces', () => {
  assert.deepEqual(content(markdownToAdf('One\r\ntwo.\r\n')), [paragraph('One two.')])
  assert.deepEqual(content(markdownToAdf('One\rtwo.\r')), [paragraph('One two.')])
  assert.deepEqual(content(markdownToAdf('```\r\nx\r\n```\r\n')), [{ content: [text('x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('a\u0000b\n')), [paragraph('a\ufffdb')])
})

test('reads a blockquote and the blocks its prefix carries', () => {
  assert.deepEqual(content(markdownToAdf('> Ship it.\n>\n> Then tell them.\n')), [quote(paragraph('Ship it.'), paragraph('Then tell them.'))])
  assert.deepEqual(content(markdownToAdf('>Ship it.\n')), [quote(paragraph('Ship it.'))])
  assert.deepEqual(content(markdownToAdf('   > > Deep.\n')), [quote(quote(paragraph('Deep.')))])
  assert.deepEqual(content(markdownToAdf('>\n')), [quote()])
  assert.deepEqual(content(markdownToAdf('> One.\n\n> Two.\n')), [quote(paragraph('One.')), quote(paragraph('Two.'))])
  assert.deepEqual(content(markdownToAdf('Part.\n> Ship it.\n')), [paragraph('Part.'), quote(paragraph('Ship it.'))])
  assert.deepEqual(content(markdownToAdf('    > Code.\n')), [{ content: [text('> Code.')], type: 'codeBlock' }])
})

test('reads a bullet list, the marker width setting the continuation', () => {
  assert.deepEqual(content(markdownToAdf('- Bolt M8\n- Nut M8\n')), [bulletList(item(paragraph('Bolt M8')), item(paragraph('Nut M8')))])
  assert.deepEqual(content(markdownToAdf('- Washer M8\n  - Fibre\n')), [bulletList(item(paragraph('Washer M8'), bulletList(item(paragraph('Fibre')))))])
  assert.deepEqual(content(markdownToAdf('-\n')), [bulletList(item())])
  assert.deepEqual(content(markdownToAdf('- One\n\n  Two.\n')), [bulletList(item(paragraph('One'), paragraph('Two.')))])
  assert.deepEqual(content(markdownToAdf('-     Code.\n')), [bulletList(item({ content: [text('Code.')], type: 'codeBlock' }))])
  assert.deepEqual(content(markdownToAdf('- a\n* b\n')), [bulletList(item(paragraph('a'))), bulletList(item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('-\n\n  Part.\n')), [bulletList(item()), paragraph('Part.')])
})

test('reads an ordered list, its first marker the order attribute', () => {
  assert.deepEqual(content(markdownToAdf('9. Bolt M8\n10. Nut M8\n')), [orderedList(9, item(paragraph('Bolt M8')), item(paragraph('Nut M8')))])
  assert.deepEqual(content(markdownToAdf('1) Loosen the clamp\n')), [orderedList(1, item(paragraph('Loosen the clamp')))])
  assert.deepEqual(content(markdownToAdf('1. a\n1) b\n')), [orderedList(1, item(paragraph('a'))), orderedList(1, item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('0. Zero\n')), [orderedList(0, item(paragraph('Zero')))])
})

test('measures a tab from the column the containers cut it to', () => {
  assert.deepEqual(content(markdownToAdf('>\t\tfoo\n')), [quote({ content: [text('  foo')], type: 'codeBlock' })])
  assert.deepEqual(content(markdownToAdf('-\t\tfoo\n')), [bulletList(item({ content: [text('  foo')], type: 'codeBlock' }))])
  assert.deepEqual(content(markdownToAdf('- foo\n\n\t\tbar\n')), [bulletList(item(paragraph('foo'), { content: [text('  bar')], type: 'codeBlock' }))])
  assert.deepEqual(content(markdownToAdf('-\t foo\n')), [bulletList(item(paragraph('foo')))])
  assert.deepEqual(content(markdownToAdf(' - foo\n   - bar\n\t - baz\n')), [
    bulletList(item(paragraph('foo'), bulletList(item(paragraph('bar'), bulletList(item(paragraph('baz'))))))),
  ])
})

test('drops the tightness ADF does not record', () => {
  assert.deepEqual(content(markdownToAdf('- a\n\n- b\n')), [bulletList(item(paragraph('a')), item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('- a\n\n  2. b\n')), [bulletList(item(paragraph('a'), orderedList(2, item(paragraph('b')))))])
  assert.deepEqual(content(markdownToAdf('- a\n\n  -\n')), [bulletList(item(paragraph('a'), bulletList(item())))])
})

test('opens a list beside a paragraph only where the marker interrupts it', () => {
  assert.deepEqual(content(markdownToAdf('Part.\n- a\n')), [paragraph('Part.'), bulletList(item(paragraph('a')))])
  assert.deepEqual(content(markdownToAdf('Part.\n1. a\n')), [paragraph('Part.'), orderedList(1, item(paragraph('a')))])
  assert.deepEqual(content(markdownToAdf('Part.\n2. a\n')), [paragraph('Part. 2. a')])
  assert.deepEqual(content(markdownToAdf('Part.\n*\n')), [paragraph('Part. *')])
  assert.deepEqual(content(markdownToAdf('Part.\n- - -\n')), [paragraph('Part.'), { type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('Part.\n-\n')), [{ attrs: { level: 2 }, content: [text('Part.')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('- a\n  2. b\n')), [bulletList(item(paragraph('a 2. b')))])
  assert.deepEqual(content(markdownToAdf('- a\n  1. b\n')), [bulletList(item(paragraph('a'), orderedList(1, item(paragraph('b')))))])
})

test('folds a lazy continuation into the paragraph the container holds', () => {
  assert.deepEqual(content(markdownToAdf('> One\ntwo.\n')), [quote(paragraph('One two.'))])
  assert.deepEqual(content(markdownToAdf('- One\ntwo.\n')), [bulletList(item(paragraph('One two.')))])
  assert.deepEqual(content(markdownToAdf('> One\n    two.\n')), [quote(paragraph('One two.'))])
  assert.deepEqual(content(markdownToAdf('> One\n\ntwo.\n')), [quote(paragraph('One')), paragraph('two.')])
  assert.deepEqual(content(markdownToAdf('> One\n# Two\n')), [quote(paragraph('One')), { attrs: { level: 1 }, content: [text('Two')], type: 'heading' }])
  assert.deepEqual(content(markdownToAdf('> One\n---\n')), [quote(paragraph('One')), { type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('> One\n```\n')), [quote(paragraph('One')), { type: 'codeBlock' }])
  assert.equal(code(markdownToAdf('> One\n<div>\n')), 'unmappable-html')
  assert.deepEqual(path(markdownToAdf('> One\n<div>\n')), ['content', 1])
  assert.deepEqual(path(markdownToAdf('> One\n<span>\n')), ['content', 0, 'content', 0])
})

test('ends a lazy continuation at a claimed line', () => {
  assert.equal(code(markdownToAdf('> Part.\n:::\n')), 'malformed-directive')
  assert.deepEqual(path(markdownToAdf('> Part.\n:::\n')), ['content', 1])
  assert.equal(code(markdownToAdf('- Part.\n| x |\n')), 'malformed-pipe-table')
})

test('names the block the claim inside a container opens', () => {
  assert.deepEqual(path(markdownToAdf('> Part.\n>\n> :::x\n')), ['content', 0, 'content', 1])
  assert.deepEqual(path(markdownToAdf('- Part.\n- | x |\n')), ['content', 0, 'content', 1, 'content', 0])
})

test('refuses input nested deeper than the parser carries', () => {
  assert.equal(code(markdownToAdf('> '.repeat(501))), 'unsupported-nesting-depth')
  assert.ok(markdownToAdf('> '.repeat(500)).ok)
})

test('decodes the backslash escapes CommonMark spells, and keeps the rest literal', () => {
  assert.deepEqual(content(markdownToAdf('\\*not emphasis\\*\n')), [paragraph('*not emphasis*')])
  assert.deepEqual(content(markdownToAdf('\\\\\n')), [paragraph('\\')])
  assert.deepEqual(content(markdownToAdf('\\a \\\u00a0\n')), [paragraph('\\a \\\u00a0')])
  assert.deepEqual(content(markdownToAdf('Part\\\n')), [paragraph('Part\\')])
  assert.deepEqual(content(markdownToAdf('a\\`b`\n')), [paragraph('a`b`')])
})

test('decodes the entity references HTML5 names, and the numeric ones', () => {
  assert.deepEqual(content(markdownToAdf('&amp; &copy; &ngE; &zwnj; &AElig;\n')), [paragraph('& \u00a9 \u2267\u0338 \u200c \u00c6')])
  assert.deepEqual(content(markdownToAdf('&#35; &#X22; &#x2665;\n')), [paragraph('# " \u2665')])
  assert.deepEqual(content(markdownToAdf('&#0; &#xd800; &#9999999;\n')), [paragraph('\ufffd \ufffd \ufffd')])
  assert.deepEqual(content(markdownToAdf('&zzz; &amp &#; &\n')), [paragraph('&zzz; &amp &#; &')])
  assert.deepEqual(content(markdownToAdf('&#96;not code&#96;\n')), [paragraph('`not code`')])
  assert.deepEqual(content(markdownToAdf('a&Tab;b&NewLine;c&nbsp;d&Aopf;e&verbar;f\n')), [paragraph('a\tb\nc d\u{1d538}e|f')])
})

test('reads a code span, its content literal', () => {
  assert.deepEqual(content(markdownToAdf('Run `npm test` now.\n')), [
    { content: [text('Run '), codeSpan('npm test'), text(' now.')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('``a`b``\n')), [{ content: [codeSpan('a`b')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('` `` `\n')), [{ content: [codeSpan('``')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('`  `\n')), [{ content: [codeSpan('  ')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('`a\nb`\n')), [{ content: [codeSpan('a b')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('`foo``bar`\n')), [{ content: [codeSpan('foo``bar')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('`:::panel` `~~x~~` `\\*` `&amp;`\n')), [
    {
      content: [codeSpan(':::panel'), text(' '), codeSpan('~~x~~'), text(' '), codeSpan('\\*'), text(' '), codeSpan('&amp;')],
      type: 'paragraph',
    },
  ])
  assert.deepEqual(content(markdownToAdf('`foo\n')), [paragraph('`foo')])
  assert.deepEqual(content(markdownToAdf('``foo`\n')), [paragraph('``foo`')])
})

test('reads a hard break from a trailing backslash and from two trailing spaces alike', () => {
  assert.deepEqual(content(markdownToAdf('One\\\ntwo.\n')), [{ content: [text('One'), hardBreak(), text('two.')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('One  \ntwo.\n')), [{ content: [text('One'), hardBreak(), text('two.')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('One\\  \ntwo.\n')), [{ content: [text('One\\'), hardBreak(), text('two.')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('One \\\ntwo.\n')), [{ content: [text('One '), hardBreak(), text('two.')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('One \ntwo.\n')), [paragraph('One two.')])
  assert.deepEqual(content(markdownToAdf('One \t\ntwo.\n')), [paragraph('One two.')])
  assert.deepEqual(content(markdownToAdf('One  \n')), [paragraph('One')])
  assert.deepEqual(content(markdownToAdf('> One\\\n> two.\n')), [quote({ content: [text('One'), hardBreak(), text('two.')], type: 'paragraph' })])
})

test('decodes the fenced info string the block walk leaves raw', () => {
  assert.deepEqual(content(markdownToAdf('```java&#8203;script\nx\n```\n')), [
    { attrs: { language: 'java\u200bscript' }, content: [text('x')], type: 'codeBlock' },
  ])
  assert.deepEqual(content(markdownToAdf('```\\#c\nx\n```\n')), [{ attrs: { language: '#c' }, content: [text('x')], type: 'codeBlock' }])
})

test('refuses the raw inline HTML no element mapping carries, naming it', () => {
  assert.equal(content(markdownToAdf('Part <span> here.\n')), 'unmappable-html: no ADF node carries <span>')
  assert.equal(content(markdownToAdf('Part </div> here.\n')), 'unmappable-html: no ADF node carries <div>')
  assert.equal(content(markdownToAdf('Part <!-- note --> here.\n')), 'unmappable-html: no ADF node carries an HTML comment')
  assert.equal(content(markdownToAdf('Part <?php ?> here.\n')), 'unmappable-html: no ADF node carries an HTML processing instruction')
  assert.equal(content(markdownToAdf('Part <!DOCTYPE html> here.\n')), 'unmappable-html: no ADF node carries an HTML declaration')
  assert.equal(content(markdownToAdf('Part <![CDATA[x]]> here.\n')), 'unmappable-html: no ADF node carries a CDATA section')
  assert.equal(content(markdownToAdf('Part <!--> here.\n')), 'unmappable-html: no ADF node carries an HTML comment')
  assert.equal(content(markdownToAdf('Part <!---> here.\n')), 'unmappable-html: no ADF node carries an HTML comment')
  assert.equal(code(markdownToAdf('A <a href="/x" disabled\nid=y> b\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('Part.\n<span>\n')), 'unmappable-html')
  assert.deepEqual(path(markdownToAdf('Part.\n\nA <b>b</b>.\n')), ['content', 1])
})

test('leaves the angle bracket that opens no HTML construct to the text it sits in', () => {
  assert.deepEqual(content(markdownToAdf('3 < 4 and 5 <b 6\n')), [paragraph('3 < 4 and 5 <b 6')])
  assert.deepEqual(content(markdownToAdf('a <b"c> d\n')), [paragraph('a <b"c> d')])
  assert.deepEqual(content(markdownToAdf('a <!-- b\n')), [paragraph('a <!-- b')])
  assert.deepEqual(content(markdownToAdf('a </b c> d\n')), [paragraph('a </b c> d')])
  assert.deepEqual(content(markdownToAdf('`<span>`\n')), [{ content: [codeSpan('<span>')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('\\<span>\n')), [paragraph('<span>')])
})

test('reads the emphasis CommonMark matches, the marks nesting outermost first', () => {
  assert.deepEqual(content(markdownToAdf('*a*\n')), [{ content: [marked('a', em)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('_a_\n')), [{ content: [marked('a', em)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('**a**\n')), [{ content: [marked('a', strong)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('__a__\n')), [{ content: [marked('a', strong)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('***a***\n')), [{ content: [marked('a', em, strong)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('*a **b** c*\n')), [
    { content: [marked('a ', em), marked('b', em, strong), marked(' c', em)], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('a*b*c\n')), [{ content: [text('a'), marked('b', em), text('c')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('# *a*\n')), [{ attrs: { level: 1 }, content: [marked('a', em)], type: 'heading' }])
})

test('leaves a delimiter run CommonMark pairs with nothing in the text it sits in', () => {
  assert.deepEqual(content(markdownToAdf('a_b_c\n')), [paragraph('a_b_c')])
  assert.deepEqual(content(markdownToAdf('*a\n')), [paragraph('*a')])
  assert.deepEqual(content(markdownToAdf('a * b\n')), [paragraph('a * b')])
  assert.deepEqual(content(markdownToAdf('**a*\n')), [{ content: [text('*'), marked('a', em)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('*a**\n')), [{ content: [marked('a', em), text('*')], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('\\*a\\*\n')), [paragraph('*a*')])
  assert.deepEqual(content(markdownToAdf('`*a*`\n')), [{ content: [codeSpan('*a*')], type: 'paragraph' }])
})

test('reads two tildes as strike, a single tilde and a longer run literal', () => {
  assert.deepEqual(content(markdownToAdf('~~a~~\n')), [{ content: [marked('a', strike)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('a ~b~ c\n')), [paragraph('a ~b~ c')])
  assert.deepEqual(content(markdownToAdf('a ~~~b~~~ c\n')), [paragraph('a ~~~b~~~ c')])
  assert.deepEqual(content(markdownToAdf('~~a **b**~~\n')), [{ content: [marked('a ', strike), marked('b', strike, strong)], type: 'paragraph' }])
})

test('reads an inline link, its destination and title', () => {
  assert.deepEqual(content(markdownToAdf('[a](/url)\n')), [{ content: [marked('a', link('/url'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a](/url "t")\n')), [{ content: [marked('a', link('/url', 't'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a](\n/url\n"t" )\n')), [{ content: [marked('a', link('/url', 't'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a](<u v>)\n')), [{ content: [marked('a', link('u v'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a]()\n')), [{ content: [marked('a', link(''))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a](/x(y))\n')), [{ content: [marked('a', link('/x(y)'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[**a**](/u)\n')), [{ content: [marked('a', link('/u'), strong)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a `b`](/u)\n')), [
    { content: [marked('a ', link('/u')), { marks: [link('/u'), { type: 'code' }], text: 'b', type: 'text' }], type: 'paragraph' },
  ])
})

test('decodes the escapes and the references a destination and a title hold', () => {
  assert.deepEqual(content(markdownToAdf('[a](/x\\)y)\n')), [{ content: [marked('a', link('/x)y'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a](/u "He said \\"hi\\"")\n')), [{ content: [marked('a', link('/u', 'He said "hi"'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a](/x&amp;y)\n')), [{ content: [marked('a', link('/x&y'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a][r]\n\n[r]: /x\\)y "He said \\"hi\\""\n')), [
    { content: [marked('a', link('/x)y', 'He said "hi"'))], type: 'paragraph' },
  ])
})

test('leaves the bracket pair no link parses as the text it holds', () => {
  assert.deepEqual(content(markdownToAdf('[a\n')), [paragraph('[a')])
  assert.deepEqual(content(markdownToAdf('[a] (/u)\n')), [paragraph('[a] (/u)')])
  assert.deepEqual(content(markdownToAdf('a ] b\n')), [paragraph('a ] b')])
  assert.deepEqual(content(markdownToAdf('[a](/u\n')), [paragraph('[a](/u')])
  assert.deepEqual(content(markdownToAdf('[a](/u x)\n')), [paragraph('[a](/u x)')])
  assert.deepEqual(content(markdownToAdf('[a](<u\n')), [paragraph('[a](<u')])
  assert.deepEqual(content(markdownToAdf('![a\n')), [paragraph('![a')])
  assert.deepEqual(content(markdownToAdf('[a [b](/u) c](/v)\n')), [
    { content: [text('[a '), marked('b', link('/u')), text(' c](/v)')], type: 'paragraph' },
  ])
})

test('reads the reference links a definition resolves, and leaves the rest literal', () => {
  assert.deepEqual(content(markdownToAdf('[a][r]\n\n[r]: /url\n')), [{ content: [marked('a', link('/url'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a][]\n\n[a]: /url\n')), [{ content: [marked('a', link('/url'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a]\n\n[a]: /url\n')), [{ content: [marked('a', link('/url'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[Foo\nBar][]\n\n[foo   bar]: /url\n')), [{ content: [marked('Foo Bar', link('/url'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('[a][z]\n\n[a]: /url\n')), [paragraph('[a][z]')])
  assert.deepEqual(content(markdownToAdf('[a]\n')), [paragraph('[a]')])
  assert.deepEqual(content(markdownToAdf('[][]\n')), [paragraph('[][]')])
})

test('reads an autolink, the email form as the mailto link it means', () => {
  assert.deepEqual(content(markdownToAdf('<https://example.com/>\n')), [
    { content: [marked('https://example.com/', link('https://example.com/'))], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('a <a@b.example.com> c\n')), [
    { content: [text('a '), marked('a@b.example.com', link('mailto:a@b.example.com')), text(' c')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('a <a@b-c.example.com> d\n')), [
    { content: [text('a '), marked('a@b-c.example.com', link('mailto:a@b-c.example.com')), text(' d')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('a <b@-c.example.com> d\n')), [paragraph('a <b@-c.example.com> d')])
  assert.deepEqual(content(markdownToAdf('a <b[c@example.com> d\n')), [paragraph('a <b[c@example.com> d')])
  assert.deepEqual(content(markdownToAdf('<https://example.com/?a=\\*>\n')), [
    { content: [marked('https://example.com/?a=\\*', link('https://example.com/?a=\\*'))], type: 'paragraph' },
  ])
  assert.equal(code(markdownToAdf('<https://example.com/> <span>\n')), 'unmappable-html')
})

test('reads a lone image as the media the flavour spells for it', () => {
  assert.deepEqual(content(markdownToAdf('![The moon](https://example.com/moon.png)\n')), [
    image('https://example.com/moon.png', 'The moon'),
  ])
  assert.deepEqual(content(markdownToAdf('![](/u)\n')), [image('/u')])
  assert.deepEqual(content(markdownToAdf('![*a*](/u)\n')), [image('/u', 'a')])
  assert.deepEqual(content(markdownToAdf('- ![a](/u)\n')), [bulletList(item(image('/u', 'a')))])
})

test('flattens the description of a lone image to the plain text alt holds', () => {
  assert.deepEqual(content(markdownToAdf('![a [b](/u) c](/v)\n')), [image('/v', 'a b c')])
  assert.deepEqual(content(markdownToAdf('![a ![b](/c) d](/e)\n')), [image('/e', 'a b d')])
  assert.deepEqual(content(markdownToAdf('![a\nb](/u)\n')), [image('/u', 'a b')])
  assert.deepEqual(content(markdownToAdf('![a  \nb](/u)\n')), [image('/u', 'a b')])
  assert.deepEqual(content(markdownToAdf('![a `b`](/u)\n')), [image('/u', 'a b')])
})

test('leaves the brackets of an empty link text the text they are', () => {
  assert.deepEqual(content(markdownToAdf('[](/u)\n')), [paragraph('[](/u)')])
  assert.deepEqual(content(markdownToAdf('a [](/u) b\n')), [paragraph('a [](/u) b')])
  // The pair gives the label back the way an unresolved one does, so the shortcut behind it still reads.
  assert.deepEqual(content(markdownToAdf('[][r]\n\n[r]: /u\n')), [{ content: [text('[]'), marked('r', link('/u'))], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('![](/u)\n')), [image('/u')])
})

test('refuses the image no ADF node carries where it sits', () => {
  assert.equal(content(markdownToAdf('![a](/u "t")\n')), 'unmappable-image: no media node carries a link title')
  assert.equal(content(markdownToAdf('See ![a](/u).\n')), 'unmappable-image: an image fits only as a paragraph of its own')
  assert.equal(code(markdownToAdf('# ![a](/u)\n')), 'unmappable-image')
  assert.equal(code(markdownToAdf('*![a](/u)*\n')), 'unmappable-image')
  assert.equal(code(markdownToAdf('[![a](/u)](/v)\n')), 'unmappable-image')
  assert.equal(code(markdownToAdf('![a](/u)![b](/v)\n')), 'unmappable-image')
  assert.equal(code(markdownToAdf('![a ![b](/c) d\n')), 'unmappable-image')
  assert.deepEqual(path(markdownToAdf('Part.\n\nSee ![a](/u).\n')), ['content', 1])
  assert.deepEqual(content(markdownToAdf('![a]\n')), [paragraph('![a]')])
  assert.deepEqual(content(markdownToAdf('a ! b\n')), [paragraph('a ! b')])
})

test('carries the mark a spelling nested inside its own kind names once', () => {
  assert.deepEqual(content(markdownToAdf('*(*a*)*\n')), [{ content: [marked('(a)', em)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf(`${'*'.repeat(600)}a${'*'.repeat(600)}\n`)), [{ content: [marked('a', strong)], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('*a **b** c*\n')), [
    { content: [marked('a ', em), marked('b', em, strong), marked(' c', em)], type: 'paragraph' },
  ])
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { markdownToAdf } from './markdown-to-adf.ts'

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
  assert.equal(code(markdownToAdf('::panel\n')), 'malformed-directive')
  assert.equal(code(markdownToAdf('   :::panel info\nx\n:::\n')), 'malformed-directive')
  assert.deepEqual(path(markdownToAdf('Part.\n:::x\n')), ['content', 1])
  assert.deepEqual(content(markdownToAdf(':10:30\n')), [paragraph(':10:30')])
  assert.deepEqual(content(markdownToAdf(':: two\n')), [paragraph(':: two')])
})

test('claims a block-level pipe with no table to parse it', () => {
  assert.equal(code(markdownToAdf('| Part | Qty |\n')), 'malformed-pipe-table')
  assert.deepEqual(content(markdownToAdf('\\| Part\n')), [paragraph('\\| Part')])
})

test('refuses the raw HTML no element mapping carries', () => {
  assert.equal(code(markdownToAdf('<!-- note -->\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\nx\n</div>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<?php ?>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<!DOCTYPE html>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<![CDATA[x]]>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<pre>\nx\n</pre>\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<span foo="bar">\n')), 'unmappable-html')
  assert.deepEqual(path(markdownToAdf('Part.\n\n<div>\n')), ['content', 1])
  assert.equal(code(markdownToAdf('<div>\nx\n\n:::\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\n- x\n</div>\n')), 'unmappable-html')
})

test('swallows an HTML block ahead of the claim a line inside it would make', () => {
  assert.equal(code(markdownToAdf('<!--\n:::\n-->\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\n| x |\n</div>\n')), 'unmappable-html')
})

test('leaves a tag that opens no HTML block to the paragraph it sits in', () => {
  assert.deepEqual(content(markdownToAdf('Part.\n<span>\n')), [paragraph('Part. <span>')])
  assert.deepEqual(content(markdownToAdf('3 < 4\n')), [paragraph('3 < 4')])
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

test('drops the tightness ADF does not record', () => {
  assert.deepEqual(content(markdownToAdf('- a\n\n- b\n')), [bulletList(item(paragraph('a')), item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('- a\n\n  2. b\n')), [bulletList(item(paragraph('a'), orderedList(2, item(paragraph('b')))))])
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

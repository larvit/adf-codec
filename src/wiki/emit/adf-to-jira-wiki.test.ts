import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessJiraWiki } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function wiki(...content: AdfNode[]): string {
  const result = adfToLosslessJiraWiki(document(...content))
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function refusal(result: Result<unknown>): string {
  return result.ok ? 'written' : `${result.error.code} at /${result.error.path.join('/')}`
}

function paragraph(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : { content, type: 'paragraph' }
}

function text(value: string, ...marks: AdfMark[]): AdfNode {
  return marks.length === 0 ? { text: value, type: 'text' } : { marks, text: value, type: 'text' }
}

function line(value: string): string {
  return wiki(paragraph(text(value)))
}

function marked(...marks: AdfMark[]): string {
  return wiki(paragraph(text('a '), text('b', ...marks), text(' c')))
}

function block(json: string): string {
  return `{adf:display=block}\n${json}\n{adf}`
}

function inline(json: string): string {
  return `{adf:display=inline}${json}{adf}`
}

function item(...content: AdfNode[]): AdfNode {
  return { content, type: 'listItem' }
}

function list(type: string, ...items: AdfNode[]): AdfNode {
  return type === 'orderedList' ? { attrs: { order: 1 }, content: items, type } : { content: items, type }
}

function cell(type: string, ...content: AdfNode[]): AdfNode {
  return { content: [paragraph(...content)], type }
}

function table(attrs: AdfAttributes, ...rows: AdfNode[][]): AdfNode {
  return { attrs, content: rows.map((cells) => ({ content: cells, type: 'tableRow' })), type: 'table' }
}

function code(language: string | undefined, value: string): AdfNode {
  return language === undefined ? { content: [text(value)], type: 'codeBlock' } : { attrs: { language }, content: [text(value)], type: 'codeBlock' }
}

function image(attrs: AdfAttributes, layout = 'center'): AdfNode {
  return { attrs: { layout }, content: [{ attrs, type: 'media' }], type: 'mediaSingle' }
}

function quote(...content: AdfNode[]): AdfNode {
  return { content, type: 'blockquote' }
}

function panel(panelType: string, ...content: AdfNode[]): AdfNode {
  return { attrs: { panelType }, content, type: 'panel' }
}

const plainTable = { isNumberColumnEnabled: false, layout: 'default' }

test('writes an empty document as the empty string', () => {
  assert.equal(wiki(), '')
})

test('carries a document holding no content key as its JSON', () => {
  const result = adfToLosslessJiraWiki({ type: 'doc', version: 1 })
  assert.equal(result.ok ? result.value : result.error.code, block('{"type":"doc","version":1}'))
})

test('parts blocks by one blank line', () => {
  assert.equal(wiki(paragraph(text('a')), paragraph(text('b'))), 'a\n\nb')
})

test('writes a heading by its level', () => {
  assert.equal(wiki({ attrs: { level: 2 }, content: [text('Title')], type: 'heading' }), 'h2. Title')
})

test('writes a blockquote of one paragraph as bq.', () => {
  assert.equal(wiki(quote(paragraph(text('Quoted')))), 'bq. Quoted')
})

test('writes any other blockquote as a quote macro', () => {
  assert.equal(wiki(quote(paragraph(text('a')), paragraph(text('b')))), '{quote}\na\n\nb\n{quote}')
})

test('writes a bullet list with an ordered list nested in an item', () => {
  assert.equal(wiki(list('bulletList', item(paragraph(text('a')), list('orderedList', item(paragraph(text('b'))))), item(paragraph(text('c'))))), '* a\n*# b\n* c')
})

test('writes an ordered list of order 1 with # markers', () => {
  assert.equal(wiki(list('orderedList', item(paragraph(text('a'))), item(paragraph(text('b'))))), '# a\n# b')
})

test('writes a code block of a listed language as a code macro', () => {
  assert.equal(wiki(code('java', 'x = 1;\ny()')), '{code:java}\nx = 1;\ny()\n{code}')
})

test('writes a code block of language "" as a noformat macro', () => {
  assert.equal(wiki(code('', '*x*')), '{noformat}\n*x*\n{noformat}')
})

test('writes a centred external image, with its alt where it holds one', () => {
  assert.equal(wiki(image({ type: 'external', url: 'https://example.com/a.png' })), '!https://example.com/a.png!')
  assert.equal(wiki(image({ alt: 'A cat', type: 'external', url: 'https://example.com/a.png' })), '!https://example.com/a.png|alt=A cat!')
})

test('writes a panel of each of the five types with its colour', () => {
  assert.equal(wiki(panel('info', paragraph(text('Note this')))), '{panel:bgColor=#deebff}\nNote this\n{panel}')
  assert.equal(wiki(panel('error', paragraph(text('x')))), '{panel:bgColor=#ffebe6}\nx\n{panel}')
})

test('writes a rule as four dashes', () => {
  assert.equal(wiki({ type: 'rule' }), '----')
})

test('writes a table a row per line, an empty paragraph as a space', () => {
  const header = [cell('tableHeader', text('H1')), cell('tableHeader', text('H2'))]
  assert.equal(wiki(table(plainTable, header, [cell('tableCell', text('a')), cell('tableCell')])), '||H1||H2||\n|a| |')
})

test('carries a whitespace-only text in a table cell inline, and its paragraph stands', () => {
  assert.equal(wiki(table(plainTable, [cell('tableCell', text(' '))])), `|${inline('{"text":" ","type":"text"}')}|`)
})

test('carries a block wiki markup cannot spell', () => {
  assert.equal(wiki({ attrs: { title: 'More' }, content: [paragraph(text('x'))], type: 'expand' }), block('{"attrs":{"title":"More"},"content":[{"content":[{"text":"x","type":"text"}],"type":"paragraph"}],"type":"expand"}'))
})

test('carries a paragraph holding no content or only whitespace outside a table cell', () => {
  assert.equal(wiki(paragraph()), block('{"type":"paragraph"}'))
  assert.equal(wiki(paragraph(text(' '))), block('{"content":[{"text":" ","type":"text"}],"type":"paragraph"}'))
})

test('carries a block holding an attribute value no spelling stands for', () => {
  assert.equal(wiki({ attrs: { order: 3 }, content: [item(paragraph(text('a')))], type: 'orderedList' }), block('{"attrs":{"order":3},"content":[{"content":[{"content":[{"text":"a","type":"text"}],"type":"paragraph"}],"type":"listItem"}],"type":"orderedList"}'))
  assert.equal(wiki({ attrs: { localId: 'p1' }, content: [text('a')], type: 'paragraph' }), block('{"attrs":{"localId":"p1"},"content":[{"text":"a","type":"text"}],"type":"paragraph"}'))
  assert.equal(wiki(code('foo', 'x')), block('{"attrs":{"language":"foo"},"content":[{"text":"x","type":"text"}],"type":"codeBlock"}'))
  assert.equal(wiki(code(undefined, 'x')), block('{"content":[{"text":"x","type":"text"}],"type":"codeBlock"}'))
  assert.equal(wiki(code('java', 'a {code} b')), block('{"attrs":{"language":"java"},"content":[{"text":"a \\u007bcode} b","type":"text"}],"type":"codeBlock"}'))
  assert.equal(wiki(panel('tip', paragraph(text('x')))).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(table({ isNumberColumnEnabled: true, layout: 'default' }, [cell('tableCell', text('a'))])).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(image({ type: 'external', url: 'https://example.com/a.png' }, 'wide')).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(image({ alt: 'a|b', type: 'external', url: 'https://example.com/a.png' })).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(image({ id: 'f1', type: 'file' })).startsWith('{adf:display=block}'), true)
})

test('carries a list or a table where a block it holds rides', () => {
  const riding = list('bulletList', item(paragraph(text('a')), code('foo', 'x')))
  assert.equal(wiki(riding).startsWith('{adf:display=block}\n{"content":[{"content":[{"content"'), true)
  assert.equal(wiki(list('bulletList', item(paragraph()))).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(table(plainTable, [{ content: [paragraph(text('a')), paragraph(text('b'))], type: 'tableCell' }])).startsWith('{adf:display=block}'), true)
})

test('carries a list item holding two lists of one kind in a row, which would read as one', () => {
  const nested = list('bulletList', item(paragraph(text('b'))))
  assert.equal(wiki(list('bulletList', item(paragraph(text('a')), nested, nested))).startsWith('{adf:display=block}'), true)
})

test('carries a quote macro holding another, and a panel holding another, since the macros cannot nest', () => {
  assert.equal(wiki(quote(paragraph(text('a')), quote(paragraph(text('b')), paragraph(text('c'))))).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(panel('info', panel('note', paragraph(text('a'))))).startsWith('{adf:display=block}'), true)
  assert.equal(wiki(quote(paragraph(text('a')), quote(paragraph(text('b'))))), '{quote}\na\n\nbq. b\n{quote}')
  assert.equal(wiki(panel('info', quote(paragraph(text('a')), paragraph(text('b'))))), '{panel:bgColor=#deebff}\n{quote}\na\n\nb\n{quote}\n{panel}')
})

test('carries a heading holding a node that rides', () => {
  assert.equal(wiki({ attrs: { level: 1 }, content: [{ attrs: { text: 'x' }, type: 'status' }], type: 'heading' }).startsWith('{adf:display=block}'), true)
})

test('writes a hard break as two backslashes', () => {
  assert.equal(wiki(paragraph(text('a'), { type: 'hardBreak' }, text('b'))), 'a\\\\b')
})

test('writes a mention by account id, and carries one holding any other attribute', () => {
  assert.equal(wiki(paragraph({ attrs: { accessLevel: '', id: '5b10' }, type: 'mention' })), '[~accountid:5b10]')
  assert.equal(wiki(paragraph({ attrs: { accessLevel: '', id: '5b10', text: '@Ann' }, type: 'mention' })), inline('{"attrs":{"accessLevel":"","id":"5b10","text":"@Ann"},"type":"mention"}'))
})

test('carries an inline node wiki markup cannot spell as its JSON', () => {
  assert.equal(wiki(paragraph(text('a '), { attrs: { text: 'DONE' }, type: 'status' }, text(' b'))), `a ${inline('{"attrs":{"text":"DONE"},"type":"status"}')} b`)
})

test('escapes a character wiki markup would read as markup where it stands', () => {
  assert.equal(line('*not bold*'), '\\*not bold\\*')
  assert.equal(line('a [b] {c} | d'), 'a \\[b\\] \\{c\\} \\| d')
  assert.equal(line('# not a list'), '\\# not a list')
  assert.equal(line('- not a list'), '\\- not a list')
  assert.equal(line('h1. not a heading'), '\\h1. not a heading')
  assert.equal(line('bq. not a quote'), '\\bq. not a quote')
  assert.equal(line('a -- b'), 'a \\-\\- b')
  assert.equal(line('what?? ok'), 'what\\?? ok')
  assert.equal(line('Wow!!'), 'Wow\\!!')
  assert.equal(line('Wow! (y) f(x) x:)'), 'Wow! \\(y) f\\(x) x\\:)')
})

test('leaves a character that reads as itself where it stands', () => {
  assert.equal(line('well-known a - b 2*3 snake_case Hello!'), 'well-known a - b 2*3 snake_case Hello!')
  assert.equal(line('a:Pb (on)x'), 'a:Pb (on)x')
})

test('carries a text no backslash protects', () => {
  assert.equal(line('C:\\temp'), inline('{"text":"C:\\\\temp","type":"text"}'))
  assert.equal(line('see https://example.com'), inline('{"text":"see https://example.com","type":"text"}'))
  assert.equal(line('a\nb'), inline('{"text":"a\\nb","type":"text"}'))
  assert.equal(wiki(paragraph(text(' a'), text('b', { type: 'strong' }))), `${inline('{"text":" a","type":"text"}')}*b*`)
})

test('carries the second of two texts the reader would read as one', () => {
  assert.equal(wiki(paragraph(text('a'), text('b'))), `a${inline('{"text":"b","type":"text"}')}`)
})

test('writes each spelled mark with its delimiters', () => {
  assert.equal(marked({ type: 'strong' }), 'a *b* c')
  assert.equal(marked({ type: 'em' }), 'a _b_ c')
  assert.equal(marked({ type: 'strike' }), 'a -b- c')
  assert.equal(marked({ type: 'underline' }), 'a +b+ c')
  assert.equal(marked({ type: 'code' }), 'a {{b}} c')
  assert.equal(marked({ attrs: { type: 'sup' }, type: 'subsup' }), 'a ^b^ c')
  assert.equal(marked({ attrs: { type: 'sub' }, type: 'subsup' }), 'a ~b~ c')
  assert.equal(marked({ attrs: { color: '#ff0000' }, type: 'textColor' }), 'a {color:#ff0000}b{color} c')
})

test('writes a link with its text, its title, or as its href alone', () => {
  assert.equal(marked({ attrs: { href: 'https://example.com' }, type: 'link' }), 'a [b|https://example.com] c')
  assert.equal(marked({ attrs: { href: 'https://example.com', title: 'Home page' }, type: 'link' }), 'a [b|https://example.com|Home page] c')
  assert.equal(wiki(paragraph(text('https://example.com', { attrs: { href: 'https://example.com' }, type: 'link' }))), '[https://example.com]')
})

test('nests marks in the order the array holds, outermost first', () => {
  assert.equal(marked({ type: 'strong' }, { type: 'em' }), 'a *_b_* c')
  assert.equal(marked({ type: 'em' }, { type: 'strong' }), 'a _*b*_ c')
  assert.equal(wiki(paragraph(text('a ', { type: 'strong' }), text('b', { type: 'strong' }, { type: 'em' }))), '*a _b_*')
})

test('carries a run whose delimiters would not read', () => {
  assert.equal(wiki(paragraph(text('a'), text('b', { type: 'strong' }), text('c'))), `a${inline('{"marks":[{"type":"strong"}],"text":"b","type":"text"}')}c`)
  assert.equal(wiki(paragraph(text('a '), text(' b', { type: 'em' }))), `a ${inline('{"marks":[{"type":"em"}],"text":" b","type":"text"}')}`)
})

test('carries the run of nodes under a mark with no spelling as an array', () => {
  const background = { attrs: { color: '#ffff00' }, type: 'backgroundColor' }
  assert.equal(wiki(paragraph(text('a', background), text('b', background, { type: 'strong' }))), inline('[{"marks":[{"attrs":{"color":"#ffff00"},"type":"backgroundColor"}],"text":"a","type":"text"},{"marks":[{"attrs":{"color":"#ffff00"},"type":"backgroundColor"},{"type":"strong"}],"text":"b","type":"text"}]'))
})

test('carries a mark holding an attribute value no spelling stands for', () => {
  assert.equal(marked({ attrs: {}, type: 'strong' }), `a ${inline('{"marks":[{"attrs":{},"type":"strong"}],"text":"b","type":"text"}')} c`)
  assert.equal(marked({ attrs: { color: 'red' }, type: 'textColor' }).includes('{adf:display=inline}'), true)
  assert.equal(marked({ attrs: { type: 'mid' }, type: 'subsup' }).includes('{adf:display=inline}'), true)
  assert.equal(marked({ attrs: { href: 'a b' }, type: 'link' }).includes('{adf:display=inline}'), true)
  assert.equal(marked({ attrs: { href: 'https://example.com', title: 'a|b' }, type: 'link' }).includes('{adf:display=inline}'), true)
  assert.equal(marked({ type: 'strong' }, { type: 'strong' }).includes('{adf:display=inline}'), true)
})

test('escapes a { inside a carried JSON string, so the closing macro is the only one', () => {
  assert.equal(wiki(paragraph({ attrs: { text: '{adf}' }, type: 'status' })), inline('{"attrs":{"text":"\\u007badf}"},"type":"status"}'))
})

test('refuses a carry whose JSON nests past 500 levels', () => {
  let value: AdfAttributes[string] = 1
  for (let level = 0; level < largestNesting - 2; level += 1) value = [value]
  assert.equal(refusal(adfToLosslessJiraWiki(document(paragraph({ attrs: { a: value }, type: 'unknownInline' })))), 'written')
  assert.equal(refusal(adfToLosslessJiraWiki(document(paragraph({ attrs: { a: [value] }, type: 'unknownInline' })))), 'unsupported-nesting-depth at /content/0/content/0')
  assert.equal(refusal(adfToLosslessJiraWiki(document({ attrs: { a: value }, type: 'unknownBlock' }))), 'written')
  assert.equal(refusal(adfToLosslessJiraWiki(document({ attrs: { a: [value] }, type: 'unknownBlock' }))), 'unsupported-nesting-depth at /content/0')
})

test('refuses what every writer refuses before writing', () => {
  assert.equal(refusal(adfToLosslessJiraWiki({ content: [], type: 'doc', version: 2 })), 'unsupported-document-version at /')
  assert.equal(refusal(adfToLosslessJiraWiki(JSON.parse('{"type":"doc"}'))), 'not-an-adf-document at /')
})

test('carries a heading of no level 1 to 6, or of no content', () => {
  assert.equal(wiki({ attrs: { level: 7 }, content: [text('a')], type: 'heading' }), block('{"attrs":{"level":7},"content":[{"text":"a","type":"text"}],"type":"heading"}'))
  assert.equal(wiki({ attrs: { level: 1 }, type: 'heading' }), block('{"attrs":{"level":1},"type":"heading"}'))
})

test('carries a rule holding attributes, and an image whose URL wiki markup cannot hold', () => {
  assert.equal(wiki({ attrs: { a: 1 }, type: 'rule' }), block('{"attrs":{"a":1},"type":"rule"}'))
  assert.equal(wiki(image({ type: 'external', url: 'a b' })).startsWith('{adf:display=block}'), true)
})

test('carries a marked hard break, and a mention whose id wiki markup cannot hold', () => {
  assert.equal(wiki(paragraph(text('a'), { marks: [{ type: 'strong' }], type: 'hardBreak' })), `a${inline('{"marks":[{"type":"strong"}],"type":"hardBreak"}')}`)
  assert.equal(wiki(paragraph({ attrs: { accessLevel: '', id: 'a b' }, type: 'mention' })), inline('{"attrs":{"accessLevel":"","id":"a b"},"type":"mention"}'))
})

test('carries a code mark holding attributes', () => {
  assert.equal(marked({ attrs: { a: 1 }, type: 'code' }), `a ${inline('{"marks":[{"attrs":{"a":1},"type":"code"}],"text":"b","type":"text"}')} c`)
})

test('writes a link text equal to its href with its text where the link marks a neighbour too', () => {
  const link = { attrs: { href: 'mailto:a@example.com' }, type: 'link' }
  assert.equal(wiki(paragraph(text('mailto:a@example.com', link), text('b', { type: 'strong' }, link))), '[mailto:a@example.com|mailto:a@example.com]*[b|mailto:a@example.com]*')
  assert.equal(wiki(paragraph(text('b', { type: 'strong' }, link), text('mailto:a@example.com', link))), '*[b|mailto:a@example.com]*[mailto:a@example.com|mailto:a@example.com]')
})

test('closes an inner mark where the next node leaves it', () => {
  assert.equal(wiki(paragraph(text('a', { type: 'strong' }, { type: 'em' }), text(' b', { type: 'strong' }))), '*_a_ b*')
})

test('escapes a smiley the node edge cuts, unless the line ends there', () => {
  assert.equal(wiki(paragraph(text('a ('), { attrs: { accessLevel: '', id: '5b10' }, type: 'mention' })), 'a \\([~accountid:5b10]')
  assert.equal(line('a ('), 'a (')
})

test('refuses a heading holding a carry past 500 levels', () => {
  let value: AdfAttributes[string] = 1
  for (let level = 0; level < largestNesting - 1; level += 1) value = [value]
  assert.equal(refusal(adfToLosslessJiraWiki(document({ attrs: { level: 1 }, content: [{ attrs: { a: value }, type: 'unknownInline' }], type: 'heading' }))), 'unsupported-nesting-depth at /content/0/content/0')
})

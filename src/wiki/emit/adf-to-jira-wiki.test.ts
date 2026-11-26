import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessJiraWiki } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'
import { smileys } from '../spellings.ts'

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
  assert.equal(wiki(image({ alt: 'A', type: 'external', url: 'https://example.com/a.png' })), '!https://example.com/a.png|alt=A!')
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

test('carries a block wiki markup cannot spell', () => {
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

test('carries a macro nested in its own kind, and writes one nested in the other kind or as bq.', () => {
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
  assert.equal(line('a -- b'), 'a \\-\\- b')
  assert.equal(line('what?? ok'), 'what\\?? ok')
  assert.equal(line('Wow!!'), 'Wow\\!!')
  assert.equal(line('Wow! (y) f(x) x:)'), 'Wow! \\(y) f\\(x) x:\\)')
  assert.equal(line('a :( b ;) c'), 'a :\\( b ;\\) c')
})

test('carries a text whose smiley or line-start word no backslash stops', () => {
  const carried = (value: string): string => inline(`{"text":${JSON.stringify(value)},"type":"text"}`)
  assert.equal(line('h1. not a heading'), carried('h1. not a heading'))
  assert.equal(line('Bq. not a quote'), carried('Bq. not a quote'))
  assert.equal(line('a :D b'), carried('a :D b'))
  assert.equal(line('a :P'), carried('a :P'))
  assert.equal(line('a ;'), 'a ;')
})

test('spells a text ending in `:` or `;` plainly, since no smiley continues with what the next node opens with', () => {
  const strong: AdfMark = { type: 'strong' }
  const em: AdfMark = { type: 'em' }
  const mention: AdfNode = { attrs: { accessLevel: '', id: '5b10' }, type: 'mention' }
  assert.equal(wiki(paragraph(text('Environment:', strong), text(' Chrome'))), '*Environment:* Chrome')
  assert.equal(wiki(paragraph(text('a;', strong), text(' b'))), '*a;* b')
  assert.equal(wiki(paragraph(text('a:', strong, em), text(' b', strong))), '*_a:_ b*')
  assert.equal(wiki(paragraph(text('a:', strong), text('b', strong, em))), '*a:_b_*')
  assert.equal(wiki(paragraph(text('Note:'), text('important', strong))), 'Note:*important*')
  assert.equal(wiki(paragraph(text('Steps:'), { type: 'hardBreak' }, text('b'))), 'Steps:\\\\b')
  assert.equal(wiki(paragraph(text('a :'), mention)), 'a :[~accountid:5b10]')
  assert.equal(wiki(paragraph(text('a :'), text(')'))), `a :${inline('{"text":")","type":"text"}')}`)
  assert.equal(wiki(paragraph(text('a:', { attrs: { color: '#ff0000' }, type: 'textColor' }), text(' b'))), '{color:#ff0000}a:{color} b')
  assert.equal(wiki(paragraph(text('a:', { attrs: { href: 'https://example.com' }, type: 'link' }), text(' b'))), '[a:|https://example.com] b')
  assert.equal(wiki(paragraph(text('a (', strong), mention)), '*a \\(*[~accountid:5b10]')
})

test('a smiley starting with `:` or `;` continues with no character a node opens with', () => {
  const opening = /^[:;][^*+\-^_~{}[\]|\\]/
  assert.deepEqual(smileys.filter((smiley) => /^[:;]/.test(smiley) && !opening.test(smiley)), [])
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

test('carries each node under a mark with no spelling in a macro of its own', () => {
  const background = { attrs: { color: '#ffff00' }, type: 'backgroundColor' }
  const first = inline('{"marks":[{"attrs":{"color":"#ffff00"},"type":"backgroundColor"}],"text":"a","type":"text"}')
  const second = inline('{"marks":[{"attrs":{"color":"#ffff00"},"type":"backgroundColor"},{"type":"strong"}],"text":"b","type":"text"}')
  assert.equal(wiki(paragraph(text('a', background), text('b', background, { type: 'strong' }))), first + second)
})

test('carries a mark no spelling stands for, and two marks of one type', () => {
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
  assert.equal(refusal(adfToLosslessJiraWiki(document(paragraph({ attrs: { a: [value] }, type: 'unknownInline' }), paragraph({ attrs: { a: [value] }, type: 'unknownInline' })))), 'unsupported-nesting-depth at /content/0/content/0')
  assert.equal(refusal(adfToLosslessJiraWiki(document({ attrs: { a: value }, type: 'unknownBlock' }))), 'written')
  assert.equal(refusal(adfToLosslessJiraWiki(document({ attrs: { a: [value] }, type: 'unknownBlock' }))), 'unsupported-nesting-depth at /content/0')
})

test('refuses what every writer refuses before writing', () => {
  assert.equal(refusal(adfToLosslessJiraWiki({ content: [], type: 'doc', version: 2 })), 'unsupported-document-version at /')
  assert.equal(refusal(adfToLosslessJiraWiki(JSON.parse('{"type":"doc"}'))), 'not-an-adf-document at /')
})

test('carries a heading whose level is outside 1 to 6, or that holds no content', () => {
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

test('writes a link text equal to its href as [text|href] where the link also marks a neighbour', () => {
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

test('carries a text holding a pipe in a table cell, where an escaped pipe still ends the cell', () => {
  assert.equal(wiki(table(plainTable, [cell('tableCell', text('a|b')), cell('tableCell', text('c'))])), `|${inline('{"text":"a|b","type":"text"}')}|c|`)
  assert.equal(wiki(table(plainTable, [cell('tableCell', text('x', { attrs: { href: 'https://example.com' }, type: 'link' }), text('|'))])), `|[x|https://example.com]${inline('{"text":"|","type":"text"}')}|`)
  assert.equal(wiki(table(plainTable, [cell('tableHeader', text('a|b'))])), `||${inline('{"text":"a|b","type":"text"}')}||`)
  assert.equal(line('a|b'), 'a\\|b')
  assert.equal(wiki(list('bulletList', item(paragraph(text('a|b'))))), '* a\\|b')
  assert.equal(wiki({ attrs: { level: 1 }, content: [text('a|b')], type: 'heading' }), 'h1. a\\|b')
})

test('refuses a heading holding a carry past 500 levels', () => {
  let value: AdfAttributes[string] = 1
  for (let level = 0; level < largestNesting - 1; level += 1) value = [value]
  assert.equal(refusal(adfToLosslessJiraWiki(document({ attrs: { level: 1 }, content: [{ attrs: { a: value }, type: 'unknownInline' }], type: 'heading' }))), 'unsupported-nesting-depth at /content/0/content/0')
})

// spec/wiki.md, Blocks: the names the help lists for a `codeBlock`.
for (const language of ['actionscript', 'ada', 'applescript', 'bash', 'c', 'c#', 'c++', 'css', 'erlang', 'go', 'groovy', 'haskell', 'html', 'java', 'javascript', 'json', 'lua', 'nyan', 'objc', 'perl', 'php', 'python', 'r', 'ruby', 'scala', 'sql', 'swift', 'visualbasic', 'xml', 'yaml']) {
  test(`writes a code block of language ${language} as a code macro`, () => {
    assert.equal(wiki(code(language, 'x')), `{code:${language}}\nx\n{code}`)
  })
}

for (const [panelType, colour] of [['error', '#ffebe6'], ['info', '#deebff'], ['note', '#eae6ff'], ['success', '#e3fcef'], ['warning', '#fffae6']]) {
  test(`writes a panel of type ${panelType} with bgColor ${colour}`, () => {
    assert.equal(wiki(panel(String(panelType), paragraph(text('x')))), `{panel:bgColor=${colour}}\nx\n{panel}`)
  })
}

const external = { type: 'external', url: 'https://example.com/a.png' }
const riddenBlocks: [string, AdfNode][] = [
  ['a blockquote holding a panel that holds a quote', quote(panel('info', quote(paragraph(text('a')), paragraph(text('b')))))],
  ['a blockquote holding no content', { type: 'blockquote' }],
  ['a code block holding another attribute', { attrs: { language: 'java', title: 'a' }, content: [text('x')], type: 'codeBlock' }],
  ['a code block of a marked text', { attrs: { language: 'java' }, content: [text('x', { type: 'strong' })], type: 'codeBlock' }],
  ['a code block of an empty text', { attrs: { language: 'java' }, content: [text('')], type: 'codeBlock' }],
  ['a code block whose text holds a carriage return', { attrs: { language: 'java' }, content: [text('a\r\nb')], type: 'codeBlock' }],
  ['a code block of no content', { attrs: { language: 'java' }, type: 'codeBlock' }],
  ['a code block of two texts', { attrs: { language: 'java' }, content: [text('x'), text('y', { type: 'strong' })], type: 'codeBlock' }],
  ['a code block whose language is no string', { attrs: { language: 5 }, content: [text('x')], type: 'codeBlock' }],
  ['a heading holding an empty content', { attrs: { level: 1 }, content: [], type: 'heading' }],
  ['a list holding a list item and a paragraph', { content: [item(paragraph(text('a'))), paragraph(text('b'))], type: 'bulletList' }],
  ['a list holding a paragraph', { content: [paragraph(text('a'))], type: 'bulletList' }],
  ['a list item holding a localId', list('bulletList', { attrs: { localId: 'i1' }, content: [paragraph(text('a'))], type: 'listItem' })],
  ['a list item opening with a list', list('bulletList', item(list('bulletList', item(paragraph(text('a'))))))],
  ['a media group of layout center', { attrs: { layout: 'center' }, content: [{ attrs: external, type: 'media' }], type: 'mediaGroup' }],
  ['a panel holding another attribute', { attrs: { panelIcon: ':x:', panelType: 'info' }, content: [paragraph(text('a'))], type: 'panel' }],
  ['a panel whose panelType is an array', { attrs: { panelType: ['info'] }, content: [paragraph(text('a'))], type: 'panel' }],
  ['a paragraph of whitespace texts', paragraph(text(' '), text(' ', { type: 'strong' }))],
  ['a table cell holding a code block', table(plainTable, [{ content: [code('java', 'x')], type: 'tableCell' }])],
  ['a table holding a paragraph', { attrs: plainTable, content: [paragraph(text('a'))], type: 'table' }],
  ['a table holding a row and a paragraph', { attrs: plainTable, content: [{ content: [cell('tableCell', text('a'))], type: 'tableRow' }, paragraph(text('b'))], type: 'table' }],
  ['a table row holding a cell and a paragraph', { attrs: plainTable, content: [{ content: [cell('tableCell', text('a')), paragraph(text('b'))], type: 'tableRow' }], type: 'table' }],
  ['a table row holding a localId', { attrs: plainTable, content: [{ attrs: { localId: 'r1' }, content: [cell('tableCell', text('a'))], type: 'tableRow' }], type: 'table' }],
  ['a table row holding a paragraph', { attrs: plainTable, content: [{ content: [paragraph(text('a'))], type: 'tableRow' }], type: 'table' }],
  ['a table whose cell holds a paragraph of an empty content', table(plainTable, [{ content: [{ content: [], type: 'paragraph' }], type: 'tableCell' }])],
  ['an image of a stored file with a URL', image({ type: 'file', url: 'https://example.com/a.png' })],
  ['an image whose URL holds no ://', image({ type: 'external', url: 'a.png' })],
  ['an image whose URL is no string', image({ type: 'external', url: 5 })],
  ['an image whose alt ends in whitespace', image({ ...external, alt: 'A cat ' })],
  ['an image whose alt is no string', image({ ...external, alt: 5 })],
  ['an image whose media holds a width', image({ ...external, width: 10 })],
  ['an image whose mediaSingle holds its caption first', { attrs: { layout: 'center' }, content: [{ content: [text('c')], type: 'caption' }, { attrs: external, type: 'media' }], type: 'mediaSingle' }],
  ['an image whose mediaSingle holds no content', { attrs: { layout: 'center' }, type: 'mediaSingle' }],
  ['an image whose mediaSingle holds no media', { attrs: { layout: 'center' }, content: [paragraph(text('a'))], type: 'mediaSingle' }],
  ['an image whose mediaSingle holds two media', { attrs: { layout: 'center' }, content: [{ attrs: external, type: 'media' }, { attrs: external, type: 'media' }], type: 'mediaSingle' }],
]
for (const [name, node] of riddenBlocks) {
  test(`carries ${name}`, () => {
    assert.equal(wiki(node), block(JSON.stringify(sortedKeys(node))))
  })
}

function sortedKeys(node: AdfNode): unknown {
  return JSON.parse(JSON.stringify(node), (_, value: unknown) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => (left < right ? -1 : 1))) : value))
}

test('writes a paragraph holding whitespace beside another node inline, carrying each', () => {
  assert.equal(wiki(paragraph(text(' '), { attrs: { text: 'A' }, type: 'status' })), `${inline('{"text":" ","type":"text"}')}${inline('{"attrs":{"text":"A"},"type":"status"}')}`)
})

test('writes the blocks after a block that rides', () => {
  assert.equal(wiki({ type: 'unknownBlock' }, paragraph(text('b'))), `${block('{"type":"unknownBlock"}')}\n\nb`)
})

test('writes a blockquote of one block other than a paragraph as a quote macro', () => {
  assert.equal(wiki(quote(code('java', 'x'))), '{quote}\n{code:java}\nx\n{code}\n{quote}')
})

test('writes a list inside a quote macro with a top-level list\'s markers', () => {
  assert.equal(wiki(quote(list('bulletList', item(paragraph(text('a')))), paragraph(text('b')))), '{quote}\n* a\n\nb\n{quote}')
})

test('writes a bullet list nested in a bullet list one marker deeper', () => {
  assert.equal(wiki(list('bulletList', item(paragraph(text('a')), list('bulletList', item(paragraph(text('b'))))))), '* a\n** b')
})

test('writes an empty paragraph in a header cell as a space', () => {
  assert.equal(wiki(table(plainTable, [cell('tableHeader', text('H')), cell('tableHeader')])), '||H|| ||')
})

test('carries a text that whitespace ends at the line end, or that holds http://', () => {
  assert.equal(wiki(paragraph(text('a', { type: 'strong' }), text('b '))), `*a*${inline('{"text":"b ","type":"text"}')}`)
  assert.equal(line('see http://example.com'), inline('{"text":"see http://example.com","type":"text"}'))
})

test('escapes a delimiter between punctuation, and one a node edge meets inside the line', () => {
  assert.equal(line('a "-" b'), 'a "\\-" b')
  assert.equal(wiki(paragraph({ type: 'hardBreak' }, text('_a'))), '\\\\\\_a')
})

test('leaves h1. and bq. that stand after a line start', () => {
  assert.equal(line('see h1. and bq. here'), 'see h1. and bq. here')
})

test('carries a run whose closing delimiter meets a letter after it', () => {
  assert.equal(wiki(paragraph(text('a '), text('b', { type: 'strong' }), text('c'))), `a ${inline('{"marks":[{"type":"strong"}],"text":"b","type":"text"}')}c`)
})

test('writes a run that a marked run or a carry follows', () => {
  assert.equal(wiki(paragraph(text('a '), text('b', { type: 'strong' }), text('c', { type: 'em' }))), 'a *b*_c_')
  assert.equal(wiki(paragraph(text('a '), text('b', { type: 'strong' }), { attrs: { text: 'A' }, type: 'status' })), `a *b*${inline('{"attrs":{"text":"A"},"type":"status"}')}`)
})

test('closes inner marks innermost first where the next node leaves them', () => {
  assert.equal(wiki(paragraph(text('a', { type: 'strong' }, { type: 'em' }, { type: 'underline' }), text(' b', { type: 'strong' }))), '*_+a+_ b*')
})

test('writes a link and a colour mid-word, whose delimiters read anywhere', () => {
  assert.equal(wiki(paragraph(text('a'), text('b', { attrs: { href: 'https://example.com' }, type: 'link' }), text('c'))), 'a[b|https://example.com]c')
  assert.equal(wiki(paragraph(text('a'), text('b', { attrs: { href: 'https://example.com', title: 'T' }, type: 'link' }), text('c'))), 'a[b|https://example.com|T]c')
  assert.equal(wiki(paragraph(text('a'), text('b', { attrs: { color: '#ff0000' }, type: 'textColor' }), text('c'))), 'a{color:#ff0000}b{color}c')
})

test('carries a code or subsup run mid-word, whose delimiters read only beside whitespace, punctuation or the line\'s edge', () => {
  assert.equal(wiki(paragraph(text('a '), text('b', { type: 'code' }), text('c'))).includes('{adf:display=inline}'), true)
  assert.equal(wiki(paragraph(text('a '), text('b', { attrs: { type: 'sup' }, type: 'subsup' }), text('c'))).includes('{adf:display=inline}'), true)
})

test('carries a link whose text is its href when Jira shows the href as text', () => {
  const link = { attrs: { href: 'word' }, type: 'link' }
  assert.equal(wiki(paragraph(text('word', link))), inline('{"marks":[{"attrs":{"href":"word"},"type":"link"}],"text":"word","type":"text"}'))
})

test('writes a link whose text is its href, holding a title, with its text', () => {
  assert.equal(wiki(paragraph(text('mailto:a@example.com', { attrs: { href: 'mailto:a@example.com', title: 'T' }, type: 'link' }))), '[mailto:a@example.com|mailto:a@example.com|T]')
})

const riddenMarks: [string, AdfMark][] = [
  ['a colour held in an array', { attrs: { color: ['#ff0000'] }, type: 'textColor' }],
  ['a colour holding another attribute', { attrs: { color: '#ff0000', x: 1 }, type: 'textColor' }],
  ['a colour of a hex code then more', { attrs: { color: '#ff0000x' }, type: 'textColor' }],
  ['a colour of more then a hex code', { attrs: { color: 'x#ff0000' }, type: 'textColor' }],
  ['a link holding another attribute', { attrs: { href: 'https://example.com', x: 1 }, type: 'link' }],
  ['a link whose href has a scheme Jira shows as text', { attrs: { href: 'javascript:alert(1)' }, type: 'link' }],
  ['a link whose href holds an incomplete percent escape', { attrs: { href: '/a%2' }, type: 'link' }],
  ['a link whose href is a bare word', { attrs: { href: 'word' }, type: 'link' }],
  ['a link whose href is no string', { attrs: { href: 5 }, type: 'link' }],
  ['a link whose href starts with ~', { attrs: { href: '~x' }, type: 'link' }],
  ['a link whose title ends in whitespace', { attrs: { href: 'https://example.com', title: 'T ' }, type: 'link' }],
  ['a link whose title is no string', { attrs: { href: 'https://example.com', title: 5 }, type: 'link' }],
  ['a mark of another type holding an href', { attrs: { href: 'https://example.com' }, type: 'fancyLink' }],
  ['a mark of type __proto__', { type: '__proto__' }],
  ['a mark of type toString', { type: 'toString' }],
  ['a subsup holding another attribute', { attrs: { type: 'sub', x: 1 }, type: 'subsup' }],
]
for (const [name, mark] of riddenMarks) {
  test(`carries the run of ${name}`, () => {
    assert.equal(marked(mark), `a ${inline(JSON.stringify({ marks: [sortedKeys({ ...mark, type: mark.type })], text: 'b', type: 'text' }))} c`)
  })
}

const riddenInlines: [string, AdfNode][] = [
  ['a mention of another accessLevel', { attrs: { accessLevel: 'CONTAINER', id: '5b10' }, type: 'mention' }],
  ['a mention whose id is no string', { attrs: { accessLevel: '', id: 5 }, type: 'mention' }],
  ['a node of another type holding an id and accessLevel ""', { attrs: { accessLevel: '', id: '5b10' }, type: 'unknownInline' }],
]
for (const [name, node] of riddenInlines) {
  test(`carries ${name}`, () => {
    assert.equal(wiki(paragraph(node)), inline(JSON.stringify(sortedKeys(node))))
  })
}

test('carries a text holding nothing', () => {
  assert.equal(wiki(paragraph(text('a'), text('', { type: 'strong' }))), `a${inline('{"marks":[{"type":"strong"}],"text":"","type":"text"}')}`)
})

test('refuses a carry past 500 levels in a list by the path of the first', () => {
  let value: AdfAttributes[string] = 1
  for (let level = 0; level < largestNesting - 1; level += 1) value = [value]
  const deep: AdfNode = { attrs: { a: value }, type: 'unknownInline' }
  assert.equal(refusal(adfToLosslessJiraWiki(document(list('bulletList', item(paragraph(deep)), item(paragraph(deep)))))), 'unsupported-nesting-depth at /content/0/content/0/content/0/content/0')
})

test('carries a text holding no text apart from its marked neighbour', () => {
  assert.equal(wiki(paragraph(text('a'), { type: 'text' })), `a${inline('{"type":"text"}')}`)
  assert.equal(wiki(paragraph(text('a', { type: 'strong' }), { marks: [{ type: 'strong' }], type: 'text' })), `*a*${inline('{"marks":[{"type":"strong"}],"type":"text"}')}`)
})

test('carries two inline nodes that each ride as two carries', () => {
  const first: AdfNode = { attrs: { a: 1 }, type: 'unknownInline' }
  const second: AdfNode = { attrs: { a: 2 }, type: 'unknownInline' }
  assert.equal(wiki(paragraph(first, second)), `${inline(JSON.stringify(first))}${inline(JSON.stringify(second))}`)
})

test('reads a letter outside the Basic Multilingual Plane beside a delimiter as a letter', () => {
  const strong = text('x', { type: 'strong' })
  assert.equal(wiki(paragraph(text('\u{20000}'), strong)), `\u{20000}${inline(JSON.stringify(strong))}`)
  assert.equal(wiki(paragraph(strong, text('\u{20000}'))), `${inline(JSON.stringify(strong))}\u{20000}`)
})

test('writes a delimiter followed by whitespace at a line start as itself', () => {
  assert.equal(line('+ a'), '+ a')
})

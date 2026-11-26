import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { adfToLosslessJiraWiki, adfToLossyJiraWiki } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'
import { smileys } from '../spellings.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function wrapped<T>(levels: number, innermost: T, wrap: (inner: T) => T): T {
  let value = innermost
  for (let level = 0; level < levels; level += 1) value = wrap(value)
  return value
}

function wiki(...content: AdfNode[]): string {
  const result = adfToLosslessJiraWiki(document(...content))
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function nested(levels: number): AdfAttributes[string] {
  return wrapped<AdfAttributes[string]>(levels, 1, (inner) => [inner])
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

test('writes a mark after a carried node as it does after punctuation', () => {
  const status: AdfNode = { attrs: { color: 'red', text: 'S' }, type: 'status' }
  assert.equal(wiki(paragraph(text('a'), status, text('b', { type: 'strong' }))), 'a{adf:display=inline}{"attrs":{"color":"red","text":"S"},"type":"status"}{adf}*b*')
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

const hardBreak = { type: 'hardBreak' }
const breakCarry = inline('{"type":"hardBreak"}')
const hardBreakBeforeBrace: [string, AdfNode[], string][] = [
  ['an escaped character', [text('_a')], `${breakCarry}\\_a`],
  ['an escaped brace', [text('{b')], `${breakCarry}\\{b`],
  ['a colour', [text('x', { attrs: { color: '#ff0000' }, type: 'textColor' })], `${breakCarry}{color:#ff0000}x{color}`],
  ['a code mark', [text('x', { type: 'code' })], `${breakCarry}{{x}}`],
  ['a hard break', [hardBreak, text('b')], `${breakCarry}\\\\b`],
  ['a carry', [{ attrs: { text: 'x' }, type: 'status' }], `${breakCarry}${inline('{"attrs":{"text":"x"},"type":"status"}')}`],
]
for (const [name, following, expected] of hardBreakBeforeBrace) {
  test(`carries a hard break before ${name}, since Jira reads no break where a brace or a backslash follows`, () => {
    assert.equal(wiki(paragraph(text('a'), hardBreak, ...following)), `a${expected}`)
  })
}

test('writes a hard break as two backslashes where a letter, a delimiter or a mark follows', () => {
  assert.equal(wiki(paragraph(text('a'), hardBreak, text('b', { type: 'strong' }), hardBreak, text('c'))), 'a\\\\*b*\\\\c')
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

test('carries a link whose href holds a character Jira stores as a percent escape, and writes an href that holds the escape', () => {
  const carried = (href: string): boolean => marked({ attrs: { href }, type: 'link' }).includes('{adf:display=inline}')
  assert.equal(carried('/a"b'), true)
  assert.equal(carried('/a<b'), true)
  assert.equal(carried('/a>b'), true)
  assert.equal(carried('/a`b'), true)
  assert.equal(carried('/a^'), true)
  assert.equal(carried('/a^:b'), true)
  assert.equal(carried('#a^b:c'), true)
  assert.equal(marked({ attrs: { href: '/a%22b%5E' }, type: 'link' }), 'a [b|/a%22b%5E] c')
})

test('writes a link whose text is an address that Jira stores as its href, as the text alone', () => {
  const link = (href: string) => ({ attrs: { href }, type: 'link' })
  assert.equal(wiki(paragraph(text('http://x/a^', link('http://x/a%5E')))), '[http://x/a^]')
  assert.equal(wiki(paragraph(text('/a"b<', link('/a%22b%3C')))), '[/a"b<]')
  assert.equal(wiki(paragraph(text('/a^b', link('/a%5Eb')))), '[/a^b|/a%5Eb]')
  assert.equal(wiki(paragraph(text('/a^', link('/b%5E')))), '[/a\\^|/b%5E]')
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
  const value = nested(largestNesting - 2)
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
  const value = nested(largestNesting - 1)
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
  const value = nested(largestNesting - 1)
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

function lossy(...content: AdfNode[]): string {
  const result = adfToLossyJiraWiki(document(...content))
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

const bold: AdfMark = { type: 'strong' }
const externalImage = (url: string, alt?: string): AdfNode => image(alt === undefined ? { type: 'external', url } : { alt, type: 'external', url })
const stored = (alt?: string): AdfNode => image(alt === undefined ? { collection: 'c', id: 'i', type: 'file' } : { alt, collection: 'c', id: 'i', type: 'file' })
const task = (state: string, value: string): AdfNode => ({ attrs: { localId: 'l', state }, content: [text(value)], type: 'taskItem' })
const mention = (attrs: AdfAttributes): AdfNode => ({ attrs, type: 'mention' })
const spelledDocument = [
  { attrs: { level: 1 }, content: [text('T')], type: 'heading' },
  paragraph(text('a '), text('b', bold), text(' c', { attrs: { href: 'https://x.se' }, type: 'link' })),
  list('bulletList', item(paragraph(text('one')), list('orderedList', item(paragraph(text('two')))))),
  table(plainTable, [cell('tableHeader', text('h')), cell('tableCell', text('c'))]),
  code('java', 'x'),
  quote(paragraph(text('q'))),
  { type: 'rule' },
  panel('info', paragraph(text('p'))),
]

test('writes the lossless spelling of a document that carries nothing', () => {
  assert.equal(lossy(...spelledDocument), wiki(...spelledDocument))
})

test('writes a document holding no content key as the empty string', () => {
  const result = adfToLossyJiraWiki({ type: 'doc', version: 1 })
  assert.equal(result.ok ? result.value : result.error.code, '')
})

test('refuses what the lossless writer refuses', () => {
  assert.equal(refusal(adfToLossyJiraWiki({ content: [], type: 'doc', version: 2 })), 'unsupported-document-version at /')
  assert.equal(refusal(adfToLossyJiraWiki(JSON.parse('{"type":"doc"}'))), 'not-an-adf-document at /')
})

function nestedIn(wrap: (inner: AdfNode) => AdfNode, levels: number): AdfNode {
  return wrapped(levels, paragraph(text('x')), wrap)
}

const nestings: [string, (inner: AdfNode) => AdfNode, number][] = [
  ['blockquote', (inner) => quote(inner), 1],
  ['panel', (inner) => panel('info', inner), 1],
  ['expand', (inner) => ({ content: [inner], type: 'expand' }), 1],
  ['unknown block', (inner) => ({ content: [inner], type: 'unknownBlock' }), 1],
  ['bullet list', (inner) => list('bulletList', item(paragraph(text('x')), inner)), 2],
]
for (const [name, wrap, perWrap] of nestings) {
  test(`the lossy writer writes ${name}s nested to 500 levels and refuses 501`, () => {
    const levels = (largestNesting - 2) / perWrap
    assert.equal(refusal(adfToLossyJiraWiki(document(nestedIn(wrap, levels)))), 'written')
    assert.equal(refusal(adfToLossyJiraWiki(document(nestedIn(wrap, levels + 1)))).split(' at ')[0], 'unsupported-nesting-depth')
  })
}

const lossyCases: [string, AdfNode[], string][] = [
  ['keeps the blocks of a node of an unknown type', [{ content: [paragraph(text('inner'))], type: 'unknownBlock' }], 'inner'],
  ['keeps the text of a block with no content', [{ attrs: { text: 'Ext' }, type: 'extension' }], 'Ext'],
  ['keeps the text of an unknown block of text', [{ text: 'Own', type: 'unknownBlock' }], 'Own'],
  ['drops a block with nothing to show', [paragraph(text('a')), { type: 'unknownBlock' }], 'a'],
  ['keeps the inline content of an unknown block as a paragraph', [{ content: [text('a '), text('b', bold)], type: 'decisionItem' }], 'a *b*'],
  ['groups an inline node standing among blocks into a paragraph', [text('a'), { type: 'status', attrs: { text: 'S' } }, paragraph(text('b'))], 'aS\n\nb'],
  ['drops the attributes with no spelling of a heading and a paragraph', [{ attrs: { level: 2, localId: 'x' }, content: [text('T')], type: 'heading' }, { attrs: { localId: 'y' }, content: [text('p')], type: 'paragraph' }], 'h2. T\n\np'],
  ['reads a heading of another level as a paragraph', [{ attrs: { level: 9 }, content: [text('T')], type: 'heading' }], 'T'],
  ['drops a heading holding no text', [{ attrs: { level: 1 }, content: [text(' ')], type: 'heading' }, paragraph(text('a'))], 'a'],
  ['drops a blank paragraph outside a cell', [paragraph(text('a')), paragraph(), paragraph(text(' ')), paragraph(text('b'))], 'a\n\nb'],
  ['drops the order of an ordered list', [{ attrs: { order: 3 }, content: [item(paragraph(text('a')))], type: 'orderedList' }], '# a'],
  ['drops an empty list and an empty blockquote', [list('bulletList'), quote(paragraph()), paragraph(text('a'))], 'a'],
  ['drops a table of no rows, a row of no cells and a node that is no row or cell', [{ content: [], type: 'table' }, { content: [{ content: [], type: 'tableRow' }, { content: [], type: 'caption' }], type: 'table' }], ''],
  ['keeps what a table or a row cannot hold after the table', [{ content: [{ content: [cell('tableCell', text('c')), paragraph(text('stray'))], type: 'tableRow' }, paragraph(text('loose'))], type: 'table' }], '|c|\n\nstray\n\nloose'],
  ['writes a panel of another type as an info panel', [panel('custom', paragraph(text('x')))], '{panel:bgColor=#deebff}\nx\n{panel}'],
  ['drops a panel holding no block', [panel('info', paragraph())], ''],
  ['writes a panel in a panel as its blocks', [panel('info', paragraph(text('a')), panel('error', paragraph(text('b'))))], '{panel:bgColor=#deebff}\na\n\nb\n{panel}'],
  ['writes a blockquote in a blockquote as its blocks', [quote(paragraph(text('a')), paragraph(text('b')), quote(paragraph(text('c')), paragraph(text('d'))))], '{quote}\na\n\nb\n\nc\n\nd\n{quote}'],
  ['writes an expand as its title in strong and then its body', [{ attrs: { title: 'Title' }, content: [paragraph(text('Body'))], type: 'expand' }], '*Title*\n\nBody'],
  ['writes an expand with no title as its body', [{ content: [paragraph(text('Body'))], type: 'nestedExpand' }], 'Body'],
  ['writes a task list as a bullet list led by its states', [{ content: [task('TODO', 'a'), task('DONE', 'b')], type: 'taskList' }], '* ☐ a\n* ☑ b'],
  ['nests a task list under the task before it', [{ content: [task('TODO', 'a'), { content: [task('DONE', 'b')], type: 'taskList' }], type: 'taskList' }], '* ☐ a\n** ☑ b'],
  ['writes a block task item with its marker, and one with no text as its marker alone', [{ content: [{ content: [paragraph(text('a'))], type: 'blockTaskItem' }, { content: [{ type: 'codeBlock', content: [text('c')] }], type: 'blockTaskItem' }, { type: 'taskItem' }], type: 'taskList' }], '* ☐ a\n* ☐ \\\\c\n* ☐'],
  ['keeps what a list holds that is no item as an item', [{ content: [text('a'), paragraph(text('b'))], type: 'bulletList' }], '* a\n* b'],
  ['writes a decision list as a paragraph per item', [{ content: [{ content: [text('Decided')], type: 'decisionItem' }, { content: [text('Next')], type: 'decisionItem' }], type: 'decisionList' }], 'Decided\n\nNext'],
  ['keeps an item\'s other blocks in its paragraph, parted by line breaks', [list('bulletList', item(paragraph(text('a')), paragraph(text('b')), code('java', 'c')))], '* a\\\\b\\\\c'],
  ['opens an item that opens with a list with an empty paragraph', [list('bulletList', item(list('orderedList', item(paragraph(text('a'))))))], '*  \n*# a'],
  ['writes two lists of one kind an item holds as one', [list('bulletList', item(paragraph(text('a')), list('orderedList', item(paragraph(text('b')))), list('orderedList', item(paragraph(text('c'))))))], '* a\n*# b\n*# c'],
  ['starts an item of its own for a block after a list an item holds', [list('bulletList', item(paragraph(text('a')), list('orderedList', item(paragraph(text('b')))), paragraph(text('c')), paragraph(text('d'))))], '* a\n*# b\n* c\\\\d'],
  ['parts the blocks of a table cell by line breaks', [table({}, [{ content: [paragraph(text('a')), list('bulletList', item(paragraph(text('b')))), { type: 'rule' }, quote(paragraph(text('c'))), externalImage('https://x.se/i.png', 'A')], type: 'tableCell' }])], '|a\\\\b\\\\c\\\\A (https://x.se/i.png)|'],
  ['writes an empty table cell as a space', [table({ layout: 'wide', width: 700 }, [{ attrs: { colspan: 2 }, content: [{ type: 'paragraph' }], type: 'tableHeader' }])], '|| ||'],
  ['writes a code block of a language the help lists, in lowercase', [code('JAVA', 'x')], '{code:java}\nx\n{code}'],
  ['writes each carriage return of a code block as a line feed', [code('java', 'a\r\nb\rc')], '{code:java}\na\nb\nc\n{code}'],
  ['writes a code block of another language or none as {noformat}', [code('cobol', 'x'), code(undefined, 'y')], '{noformat}\nx\n{noformat}\n\n{noformat}\ny\n{noformat}'],
  ['writes the lines of a code block holding {code} as a paragraph parted by line breaks', [code('java', 'a\n{code}\n\nb')], String.raw`a\\ \{code\}\\ \\b`],
  ['drops an empty code block', [{ type: 'codeBlock' }, paragraph(text('a'))], 'a'],
  ['writes a stored image as its alt, else [image]', [stored('A cat'), stored()], 'A cat\n\n\\[image\\]'],
  ['writes an external image of an address with no spelling by its encoded address', [externalImage('https://x.se/a b!.png')], '!https://x.se/a%20b%21.png!'],
  ['writes an external image with no address as its alt', [externalImage(' ', 'Gone')], 'Gone'],
  ['writes an external image whose address holds no :// as its alt and address, else its address', [externalImage('a.png', 'A'), externalImage('b.png')], 'A (a.png)\n\nb.png'],
  ['keeps the alt of an image on it where wiki markup spells it there, and after the image where not', [externalImage('https://x.se/a.png', ' a  alt '), externalImage('https://x.se/b.png', 'a,b')], '!https://x.se/a.png|alt=a  alt!\n\n!https://x.se/b.png!\n\na,b'],
  ['keeps the caption of an image as a paragraph', [{ attrs: { layout: 'wide', width: 100 }, content: [{ attrs: { type: 'external', url: 'https://x.se/a.png', width: 1 }, type: 'media' }, { content: [text('Cap')], type: 'caption' }], type: 'mediaSingle' }], '!https://x.se/a.png!\n\nCap'],
  ['writes a media group and a media on its own as their images', [{ content: [{ attrs: { alt: 'A', type: 'file' }, type: 'media' }], type: 'mediaGroup' }, { attrs: { type: 'external', url: 'https://x.se/a.png' }, type: 'media' }], 'A\n\n!https://x.se/a.png!'],
  ['writes what a status, a date and an emoji show', [paragraph(text('a '), { attrs: { color: 'blue', text: 'In progress' }, type: 'status' }, text(' '), { attrs: { timestamp: '1700000000000' }, type: 'date' }, text(' '), { attrs: { shortName: ':smile:', text: '😄' }, type: 'emoji' })], 'a In progress 2023-11-14 😄'],
  ["writes nothing for an inline node that doesn't show anything", [paragraph(text('a'), { type: 'inlineCard' }, text('b'))], 'ab'],
  ['keeps what a node of text and content holds, in order', [paragraph(text('a'), { attrs: { title: 'T' }, content: [paragraph(text('b'))], type: 'expand' })], 'aTb'],
  ['keeps the content of an unknown inline node', [paragraph(text('a'), { content: [text('b')], type: 'unknownInline' })], 'ab'],
  ['writes a mention by its id, and one whose id has no spelling by its text', [paragraph(mention({ accessLevel: 'CONTAINER', id: 'abc', text: '@Anna' }), text(' '), mention({ id: 'a b', text: '@Bo' }))], '[~accountid:abc] @Bo'],
  ['writes an inline media as its alt, else [image]', [paragraph({ attrs: { alt: 'A', type: 'file' }, type: 'mediaInline' }, text(' '), { attrs: { type: 'file' }, type: 'mediaInline' })], 'A \\[image\\]'],
  ['drops a mark with no spelling and the attributes of one that has', [paragraph(text('a '), text('b', { attrs: { color: '#fff' }, type: 'backgroundColor' }, { attrs: { x: 1 }, type: 'em' }), text(' c', { type: 'annotation' }))], 'a _b_ c'],
  ['drops the second mark of one type and the mark a hard break holds', [paragraph(text('a', bold, { type: 'em' }, bold), text(' '), { marks: [bold], type: 'hardBreak' })], '*_a_* \\\\'],
  ['writes a colour as the hex code Jira reads', [paragraph(text('a', { attrs: { color: '#f00' }, type: 'textColor' }), text(' '), text('b', { attrs: { color: '#00FF00' }, type: 'textColor' }), text(' '), text('c', { attrs: { color: 'red' }, type: 'textColor' }), text(' '), text('d', { attrs: { type: 'sup' }, type: 'subsup' }), text(' '), text('e', { attrs: { type: 'x' }, type: 'subsup' }))], '{color:#ff0000}a{color} {color:#00FF00}b{color} c ^d^ e'],
  ['writes a link by its address with the characters it cannot hold encoded, and drops one with no address', [paragraph(text('a', { attrs: { href: 'https://x.se/a b|c' }, type: 'link' }), text(' '), text('b', { attrs: { href: ' ' }, type: 'link' }), text(' '), text('c', { attrs: { href: 'https://x.se', title: 'T' }, type: 'link' }), text(' '), text('d', { attrs: { href: 'https://x.se', title: '  ' }, type: 'link' }))], '[a|https://x.se/a%20b%7Cc] b [c|https://x.se] (T) [d|https://x.se]'],
  ['keeps a link title after the link, one run of text at a time, since Jira drops one written in the link', [paragraph(text('a', { attrs: { href: 'https://x.se', title: 'a|b' }, type: 'link' }), text('b', { attrs: { href: 'https://x.se', title: 'a|b' }, type: 'link' }, bold), text(' c'))], '[ab|https://x.se] (a\\|b) c'],
  ['keeps a link title after the last text', [paragraph(text('a', { attrs: { href: 'https://x.se', title: 'a|b' }, type: 'link' }))], '[a|https://x.se] (a\\|b)'],
  ['writes a text as it stands where no backslash protects it', [paragraph(text('a\\b see http://x.se :D')), paragraph(text('h1. x'))], 'a\\b see http://x.se :D\n\nh1. x'],
  ['writes a line feed in a text as a hard break and drops a carriage return', [paragraph(text('a\r\nb\n\nc'))], 'a\\\\b\\\\ \\\\c'],
  ["drops the whitespace at a line's edges and parts it from a marked text", [paragraph(text(' ', bold), text(' a ', bold), text(' b'), text(' ')), paragraph(text('x', bold), text(' y'))], '*a*  b\n\n*x* y'],
  ['writes a marked text beside a letter as its text', [paragraph(text('un'), text('believ', bold), text('able'))], 'unbelievable'],
  ['writes the marks it can of a group where one cannot read', [paragraph(text('un'), text('believ', bold, { attrs: { href: 'https://x.se' }, type: 'link' }), text('able'))], 'un[believ|https://x.se]able'],
]
const colour = (color: string): AdfMark => ({ attrs: { color }, type: 'textColor' })
const link: AdfMark = { attrs: { href: 'https://x.se' }, type: 'link' }
const checkedMarks: [string, AdfMark, string][] = [
  ['code', { type: 'code' }, '{{a}}'],
  ['em', { type: 'em' }, '_a_'],
  ['strike', { type: 'strike' }, '-a-'],
  ['strong', bold, '*a*'],
  ['sub', { attrs: { type: 'sub' }, type: 'subsup' }, '~a~'],
  ['sup', { attrs: { type: 'sup' }, type: 'subsup' }, '^a^'],
  ['underline', { type: 'underline' }, '+a+'],
]
for (const [name, mark, spelled] of checkedMarks) {
  test(`the lossy writer parts the whitespace at the edges of a ${name} text`, () => {
    assert.equal(lossy(paragraph(text('x'), text(' a ', mark), text('y'))), `x ${spelled} y`)
    assert.equal(lossy(paragraph(text('x'), text(' a', mark))), `x ${spelled}`)
    assert.equal(lossy(paragraph(text('a ', mark), text('y'))), `${spelled} y`)
  })
}

test('the lossy writer refuses a document nested past the limit by its message and the path of the first node past it', () => {
  const result = adfToLossyJiraWiki(document(nestedIn((inner) => quote(inner), largestNesting - 1)))
  assert.equal(result.ok ? 'written' : `${result.error.message} at /${result.error.path.join('/')}`, `the document nests deeper than the ${largestNesting} levels the lossy wiki writer writes at /${Array(largestNesting + 1).fill('content/0').join('/')}`)
})

test('the lossy writer names the first of two nodes nested past the limit', () => {
  const result = adfToLossyJiraWiki(document(nestedIn((inner) => quote(inner), largestNesting - 1), nestedIn((inner) => quote(inner), largestNesting - 1)))
  assert.equal(result.ok ? 'written' : result.error.path.slice(0, 2).join('/'), 'content/0')
})

const moreLossyCases: [string, AdfNode[], string][] = [
  ['writes a link Jira would show as text as its text, then its address unless the text is the address, then its title', [paragraph(text('a', { attrs: { href: 'a' }, type: 'link' }), text(' '), text('b', { attrs: { href: 'a' }, type: 'link' }), text(' '), text('c', { attrs: { href: 'a', title: 'T' }, type: 'link' }))], 'a b (a) c (a) (T)'],
  ['writes a link address as Jira stores it, with its double quote, `<`, `>`, backtick and `^` percent-encoded', [paragraph(text('a', { attrs: { href: 'http://x.se/"<>`^' }, type: 'link' }))], '[a|http://x.se/%22%3C%3E%60%5E]'],
  ['writes a link Jira would show as text, in a table cell, as its text', [{ content: [{ content: [{ content: [paragraph(text('a', { attrs: { href: 'a' }, type: 'link' }))], type: 'tableHeader' }], type: 'tableRow' }], type: 'table' }], '||a||'],
  ['keeps a bq. inside a {quote}', [quote(quote(paragraph(text('c'))), paragraph(text('d')))], '{quote}\nbq. c\n\nd\n{quote}'],
  ['writes a nested expand as its title in strong and then its body', [{ attrs: { title: 'Title' }, content: [paragraph(text('Body'))], type: 'nestedExpand' }], '*Title*\n\nBody'],
  ['writes a panel by its type', [panel('error', paragraph(text('x')))], '{panel:bgColor=#ffebe6}\nx\n{panel}'],
  ['joins the texts of a code block', [{ attrs: { language: 'java' }, content: [text('a'), text('b')], type: 'codeBlock' }], '{code:java}\nab\n{code}'],
  ['encodes a ! in the address of an image that has an alt', [externalImage('https://x.se/a!b.png', 'alt')], '!https://x.se/a%21b.png|alt=alt!'],
  ['drops the whitespace around the address of an image', [externalImage(' https://x.se/a.png ')], '!https://x.se/a.png!'],
  ["ends an item at a block after a list that doesn't show anything", [list('bulletList', item(paragraph(text('a')), list('orderedList', item(paragraph(text('b')))), { type: 'rule' }))], '* a\n*# b'],
  ["writes an item that doesn't show anything as an empty item", [list('bulletList', item({ type: 'rule' }))], '*  '],
  ['writes what a table holds that is no row after it', [{ content: [{ content: [cell('tableCell', text('c'))], type: 'tableRow' }, code('java', 'x')], type: 'table' }], '|c|\n\n{code:java}\nx\n{code}'],
  ['parts the lines of a code block in a cell, an empty one too', [table({}, [{ content: [code('java', 'a\n\nb')], type: 'tableCell' }])], String.raw`|a\\ \\b|`],
  ['writes no line for a blank paragraph in a cell', [table({}, [{ content: [paragraph(text('a')), paragraph(), paragraph(text('b'))], type: 'tableCell' }])], String.raw`|a\\b|`],
  ['writes an image with no alt in a cell as its address', [table({}, [{ content: [{ attrs: { type: 'external', url: 'https://x.se/i.png' }, type: 'media' }], type: 'tableCell' }])], '|https://x.se/i.png|'],
  ['writes an emoji with an id as its text', [paragraph({ attrs: { id: 'smile', shortName: ':smile:', text: '😄' }, type: 'emoji' })], '😄'],
  ['drops a mark of another type holding an address', [paragraph(text('a', { attrs: { href: 'https://x.se' }, type: 'annotation' }))], 'a'],
  ['drops a mark of another type holding a title', [paragraph(text('a', { attrs: { title: 'a|b' }, type: 'annotation' }))], 'a'],
  ['drops a colour that is no hex code', [paragraph(text('a', colour('x#fff')), text(' b', colour('#ffff')), text(' c', colour('x#00ff00')), text(' d', colour('#00ff00ff')))], 'a b c d'],
  ['parts the edges of a text with several checked marks', [paragraph(text('x'), text(' a ', bold, colour('#f00')), text('y'))], 'x *{color:#ff0000}a{color}* y'],
  ['keeps the space of a marked text that is only whitespace', [paragraph(text('a'), text(' ', bold), text('b'))], 'a b'],
  ['drops the whitespace a line starts and ends with', [paragraph(text('  a  '))], 'a'],
  ['drops the links that hold only whitespace before the text', [paragraph(text(' ', link), text(' ', { attrs: { href: 'https://y.se' }, type: 'link' }), text('a'))], 'a'],
  ['writes a pipe in a table cell between {noformat}, a run of them as one', [table(plainTable, [cell('tableCell', text('a|b||c'))])], '|a{noformat}|{noformat}b{noformat}||{noformat}c|'],
  ['writes a run of two backslashes between {noformat}, and a run of one or three before a letter as it stands', [paragraph(text('a\\b \\\\fileserver\\share \\\\\\c'))], String.raw`a\b {noformat}\\{noformat}fileserver\share \\\c`],
  ['writes a backslash before a character the writer escapes between {noformat}', [paragraph(text('a \\*b'))], String.raw`a {noformat}\{noformat}\*b`],
  ['writes a backslash that ends a text before a mark between {noformat}, and one that ends the line as it stands', [paragraph(text('C:\\'), text('dir', bold)), paragraph(text('a\\'))], String.raw`C:{noformat}\{noformat}*dir*` + '\n\na\\'],
  ['writes a hard break and a space where a brace or a backslash follows', [paragraph(text('a'), hardBreak, text('_a'), hardBreak, text('x', { type: 'code' }), hardBreak, hardBreak, text('c'))], String.raw`a\\ \_a\\ {{x}}\\ \\c`],
  ['writes a hard break and a space before a backslash run between {noformat}', [paragraph(text('a'), hardBreak, text('\\\\b'))], String.raw`a\\ {noformat}\\{noformat}b`],
  ['writes a backslash before a hard break between {noformat}', [paragraph(text('a\\'), { type: 'hardBreak' }, text('b'))], String.raw`a{noformat}\{noformat}\\b`],
  ['writes a backslash before a pipe in a table cell, and one that ends a cell, between {noformat}', [table(plainTable, [cell('tableCell', text('\\|')), cell('tableCell', text('a\\'))])], String.raw`|{noformat}\|{noformat}|a{noformat}\{noformat}|`],
  ['drops the marks around a text holding {noformat}', [paragraph(text('a\\\\b', bold))], String.raw`a{noformat}\\{noformat}b`],
  ['keeps the alt and the address of an image in a table cell', [table({}, [{ content: [externalImage('https://x.se/i.png', 'A,B')], type: 'tableCell' }])], String.raw`|https://x.se/i.png\\A,B|`],
  ['keeps the alt and the address of an image in a list item', [list('bulletList', item(paragraph(text('a')), externalImage('https://x.se/i.png', 'A')))], String.raw`* a\\A (https://x.se/i.png)`],
  ['keeps the link around an image after it', [{ attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: 'https://x.se/i.png' }, marks: [{ attrs: { href: 'https://x.se/page', title: 'T' }, type: 'link' }], type: 'media' }], type: 'mediaSingle' }], '!https://x.se/i.png!\n\n[https://x.se/page] (T)'],
  ['keeps the name and the address of a card that holds them in its data', [{ attrs: { data: { name: 'Name', url: 'https://x.se/c' } }, type: 'blockCard' }], 'Name (https://x.se/c)'],
  ['writes the text of a code block whose child holds none as nothing', [{ attrs: { language: 'java' }, content: [text('a'), { type: 'hardBreak' }], type: 'codeBlock' }], '{code:java}\na\n{code}'],
  ['writes the text of a code block in a list item whose child holds none as nothing', [list('bulletList', item(paragraph(text('x')), { attrs: { language: 'java' }, content: [text('a'), { type: 'hardBreak' }], type: 'codeBlock' }))], String.raw`* x\\a`],
  ['drops a colour that is no string', [paragraph(text('a', { attrs: { color: ['#abc'] }, type: 'textColor' }))], 'a'],
  ['writes a panel whose type is no string as an info panel', [{ attrs: { panelType: ['warning'] }, content: [paragraph(text('a'))], type: 'panel' }], '{panel:bgColor=#deebff}\na\n{panel}'],
  ['writes an expand with no title after a paragraph with nothing between', [paragraph(text('A')), { content: [paragraph(text('Body'))], type: 'nestedExpand' }], 'A\n\nBody'],
  ['drops a mark of an image that is no link', [{ attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: 'https://x.se/i.png' }, marks: [{ type: 'strong' }], type: 'media' }], type: 'mediaSingle' }], '!https://x.se/i.png!'],
  ['writes a card whose name is its address as the address alone', [paragraph(text('a '), { attrs: { data: { name: 'https://x.se/c', url: 'https://x.se/c' } }, type: 'inlineCard' })], 'a https://x.se/c'],
  ['keeps the name and the address of an embed card and of an inline card', [{ attrs: { data: { name: 'N', url: 'https://x.se/c' } }, type: 'embedCard' }, paragraph({ attrs: { data: { name: 'N', url: 'https://x.se/c' } }, type: 'inlineCard' })], 'N (https://x.se/c)\n\nN (https://x.se/c)'],
  ['writes a card holding a name and no address as the name', [{ attrs: { data: { name: 'N' } }, type: 'blockCard' }], 'N'],
  ['writes a media in a paragraph as nothing', [paragraph(text('a '), { attrs: { type: 'external', url: 'https://x.se/i.png' }, type: 'media' })], 'a'],
  ['keeps the address of an inline card in a paragraph', [paragraph(text('see '), { attrs: { url: 'https://x.se/c' }, type: 'inlineCard' })], 'see https://x.se/c'],
  ['keeps the text of an unknown block before its blocks', [{ content: [paragraph(text('b'))], text: 'Own', type: 'unknownBlock' }], 'Own\n\nb'],
  ['keeps the link around a stored image after its alt', [{ attrs: { layout: 'center' }, content: [{ attrs: { alt: 'A', collection: 'c', id: 'i', type: 'file' }, marks: [{ attrs: { href: 'https://x.se/page' }, type: 'link' }], type: 'media' }], type: 'mediaSingle' }], 'A\n\n[https://x.se/page]'],
]
for (const [name, content, expected] of moreLossyCases) {
  test(`the lossy writer ${name}`, () => {
    assert.equal(lossy(...content), expected)
  })
}

for (const [name, content, expected] of lossyCases) {
  test(`the lossy writer ${name}`, () => {
    assert.equal(lossy(...content), expected)
  })
}

// Past the engine's limit on a call's arguments, and past what a quadratic walk finishes in.
const wide = 200_000

test('the lossy writer writes a block holding 200,000 blocks', () => {
  const result = adfToLossyJiraWiki(document({ content: Array.from({ length: wide }, () => paragraph(text('a'))), type: 'expand' }))
  assert.equal(result.ok ? result.value.length : result.error.code, wide * 3 - 2)
})

test('the lossy writer writes a code block of 200,000 lines in a list item', () => {
  const result = adfToLossyJiraWiki(document(list('bulletList', item(paragraph(text('a')), code('java', `${'b\n'.repeat(wide - 1)}b`)))))
  assert.equal(result.ok ? result.value.split('\\\\').length : result.error.code, wide + 1)
})

test('the lossy writer writes an item followed by 200,000 lists of its kind', { timeout: 60000 }, () => {
  const result = adfToLossyJiraWiki(document({ content: [item(paragraph(text('a'))), ...Array.from({ length: wide }, () => list('bulletList', item(paragraph(text('b')))))], type: 'bulletList' }))
  assert.equal(result.ok ? result.value.split('\n').length : result.error.code, wide + 1)
})

test('the lossy writer writes 200,000 marked texts parted by spaces', { timeout: 60000 }, () => {
  const result = adfToLossyJiraWiki(document({ content: Array.from({ length: wide }, () => [text('a', bold), text(' ')]).flat(), type: 'paragraph' }))
  assert.equal(result.ok ? result.value.length : result.error.code, wide * 4 - 1)
})

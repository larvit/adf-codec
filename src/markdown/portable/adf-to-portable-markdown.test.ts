import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import { adfToPortableMarkdown, reduceToPortable } from './adf-to-portable-markdown.ts'
import { largestNesting } from '../../nesting.ts'

const code: AdfMark = { type: 'code' }
const em: AdfMark = { type: 'em' }
const strong: AdfMark = { type: 'strong' }

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function portable(...content: AdfNode[]): string {
  return portableDocument(document(...content))
}

function portableDocument(input: AdfDocument): string {
  const markdown = adfToPortableMarkdown(input)
  return markdown.ok ? markdown.value : `${markdown.error.code} at /${markdown.error.path.join('/')}`
}

function text(value: string, ...marks: AdfMark[]): AdfNode {
  return marks.length === 0 ? { text: value, type: 'text' } : { marks, text: value, type: 'text' }
}

function node(type: string, attrs: AdfAttributes, ...content: AdfNode[]): AdfNode {
  return { attrs, content, type }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return { content, type: 'paragraph' }
}

function said(value: string): AdfNode {
  return paragraph(text(value))
}

function item(...content: AdfNode[]): AdfNode {
  return { content, type: 'listItem' }
}

function bulletList(...content: AdfNode[]): AdfNode {
  return { content, type: 'bulletList' }
}

function cell(type: string, ...content: AdfNode[]): AdfNode {
  return { content, type }
}

function row(...content: AdfNode[]): AdfNode {
  return { content, type: 'tableRow' }
}

function link(href: string, title?: string): AdfMark {
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
}

test('refuses what the document guard refuses, and nothing else', () => {
  assert.equal(portableDocument({ type: 'doc', version: Number.NaN }), 'not-an-adf-document at /')
  assert.equal(portableDocument({ type: 'doc', version: 2 }), 'unsupported-document-version at /')
  let deep: AdfNode = said('x')
  for (let level = 0; level <= largestNesting; level += 1) deep = { content: [deep], type: 'layoutColumn' }
  assert.match(portableDocument(document(deep)), /^unsupported-nesting-depth at \/content\/0(\/content\/0)+$/)
  assert.match(portableDocument(document(paragraph(text('a'), text('b')), text('c'), text('d'), deep)), /^unsupported-nesting-depth at \/content\/3(\/content\/0)+$/)
  let deepInline: AdfNode = text('x')
  for (let level = 0; level <= largestNesting; level += 1) deepInline = { content: [deepInline], type: 'unknownInline' }
  assert.match(portableDocument(document(paragraph(deepInline))), /^unsupported-nesting-depth at /)
})

test('refuses nesting past 500 levels wherever the reduction walks', () => {
  const lowest = (bottom: AdfNode): string => {
    let deep = bottom
    for (let level = 0; level < largestNesting; level += 1) deep = { content: [deep], type: 'layoutColumn' }
    return portableDocument(document(deep)).split(' ')[0] ?? ''
  }
  const wrapped: AdfNode = { content: [text('x')], type: 'unknownInline' }
  const bottoms: AdfNode[] = [
    bulletList(item(said('x'))),
    node('taskList', {}, node('taskList', {}, node('taskItem', {}, text('x')))),
    node('taskList', {}, node('taskItem', {}, wrapped)),
    node('taskList', {}, node('blockTaskItem', {}, said('x'))),
    node('panel', {}, said('x')),
    node('expand', {}, said('x')),
    node('decisionList', {}, node('decisionItem', {}, text('x'))),
    node('table', {}, row(cell('tableCell', said('x')))),
    node('mediaSingle', {}, node('caption', {}, text('x'))),
    node('heading', { level: 1 }, wrapped),
    node('codeBlock', {}, wrapped),
    paragraph(wrapped),
  ]
  for (const bottom of bottoms) assert.equal(lowest(bottom), 'unsupported-nesting-depth', bottom.type)
})

test('spells a panel as an alert in the GitHub word for its colour', () => {
  const panel = (panelType: string | undefined): string =>
    portable(node('panel', panelType === undefined ? {} : { localId: '01a0d99b-1f56-7a50-889a-f4375f09ee05', panelType }, said('Check it.')))
  assert.equal(panel('info'), '> [!NOTE]\n>\n> Check it.\n')
  assert.equal(panel('note'), '> [!IMPORTANT]\n>\n> Check it.\n')
  assert.equal(panel('tip'), '> [!TIP]\n>\n> Check it.\n')
  assert.equal(panel('success'), '> [!TIP]\n>\n> Check it.\n')
  assert.equal(panel('warning'), '> [!WARNING]\n>\n> Check it.\n')
  assert.equal(panel('error'), '> [!CAUTION]\n>\n> Check it.\n')
  assert.equal(panel('custom'), '> [!NOTE]\n>\n> Check it.\n')
  assert.equal(panel(undefined), '> [!NOTE]\n>\n> Check it.\n')
  assert.equal(portable(node('panel', { panelType: 'warning' })), '> [!WARNING]\n')
})

test('spells an expand and a nested expand as a folded callout titled by the marker line', () => {
  const nested = node('nestedExpand', { title: 'Inner' }, said('Deep.'))
  assert.equal(
    portable(node('expand', { localId: '01a0d99b-1f57-7fec-94ae-50c2ee25c9de', title: 'Build log' }, said('Line.'), nested)),
    '> [!NOTE]- Build log\n>\n> Line.\n>\n> > [!NOTE]- Inner\n> >\n> > Deep.\n',
  )
  assert.equal(portable(node('expand', {}, said('Line.'))), '> [!NOTE]-\n>\n> Line.\n')
  assert.equal(portable(node('expand', { title: ' *Two*\nlines ' })), '> [!NOTE]- \\*Two\\* lines\n')
  assert.equal(portable(node('expand', { title: '\ta \t b\t ' })), '> [!NOTE]- a \t b\n')
  assert.equal(portable(node('expand', { title: '**x** [y](z) ==w==' }, said('b'))), '> [!NOTE]- \\*\\*x\\*\\* \\[y](z) \\==w\\==\n>\n> b\n')
})

test('spells a task list as a bullet list whose items lead with their state', () => {
  const task = (state: string, value: string): AdfNode => node('taskItem', { localId: '01a0d99b-1f58-7b95-829b-6f9860371d54', state }, text(value))
  const nested = node('taskList', {}, task('TODO', 'Review'))
  assert.equal(portable(node('taskList', {}, task('DONE', 'Write the spec'), nested, task('TODO', 'Ship it'))), '- [x] Write the spec\n  - [ ] Review\n- [ ] Ship it\n')
  assert.equal(portable(node('taskList', {}, nested, task('DONE', ''), said('Stray'))), '- - [ ] Review\n- \\[x]\n- Stray\n')
  assert.equal(portable(node('taskList', {}, node('taskList', {}), task('DONE', 'a'), said('b'), node('taskList', {}, task('TODO', 'c')))), '- \\[x] a\n- b\n  - [ ] c\n')
  assert.equal(portable(node('taskList', {}, paragraph(), task('DONE', 'a'))), '- [x] a\n')
  assert.equal(portable(bulletList(item(said('x'))), node('taskList', {}, task('DONE', 'a'), node('taskList', {}, task('TODO', 'c')))), '- x\n\n* [x] a\n  - [ ] c\n')
  assert.equal(portable(node('taskList', {}), task('TODO', 'Loose')), 'Loose\n')
  const blockTask = node('blockTaskItem', { state: 'DONE' }, said('First.'), said('Second.'))
  const codeTask = node('blockTaskItem', { state: 'TODO' }, { content: [text('x')], type: 'codeBlock' })
  assert.equal(portable(node('taskList', {}, blockTask, codeTask)), '- [x] First.\n\n  Second.\n- [ ]\n\n```\nx\n```\n')
  const parent = node('blockTaskItem', { state: 'TODO' }, said('q'), said('q2'))
  assert.equal(portable(node('taskList', {}, parent, node('taskList', {}, task('DONE', 'n')), task('DONE', 'B'))), '- [ ] q\n\n  q2\n  - [x] n\n- [x] B\n')
  const holding = node('blockTaskItem', { state: 'TODO' }, said('A'), node('taskList', {}, task('TODO', 'c')))
  assert.equal(portable(node('taskList', {}, holding, node('taskList', {}, task('TODO', 'd')), task('TODO', 'B'))), '- [ ] A\n  - [ ] c\n  * [ ] d\n- [ ] B\n')
  const listTask = node('blockTaskItem', { state: 'DONE' }, bulletList(item(said('a'))))
  assert.equal(portable(node('taskList', {}, task('TODO', ''), listTask, node('taskList', {}, task('TODO', 'b')))), '- [ ]\n- [x]\n\n* a\n\n- [ ] b\n')
  assert.equal(portable(node('taskList', {}, task('DONE', 'a'), node('taskList', {}, task('TODO', '')))), '- [x] a\n  - [ ]\n')
})

test('spells a decision list as a plain bullet list', () => {
  assert.equal(portable(node('decisionList', {}, node('decisionItem', { state: 'DECIDED' }, text('Ship')), said('Stray'))), '- Ship\n- Stray\n')
})

test('spells a highlight as a == pair around the run, whatever its colour', () => {
  const highlight = (color: string): AdfMark => ({ attrs: { color }, type: 'backgroundColor' })
  assert.equal(portable(paragraph(text('a '), text('hi', highlight('#fff')), text(' there', highlight('#000')), text(' b'))), 'a ==hi there== b\n')
  assert.equal(portable(paragraph(text('hi ', strong, highlight('#fff')), text('b'))), '**==hi==** b\n')
  assert.equal(portable(paragraph(text('a', strong, highlight('#fff')), text('b', highlight('#fff'), em))), '==**a**_b_==\n')
  assert.equal(portable(paragraph(text('a', highlight('#fff'), code), text('b', highlight('#fff')))), '`a`==b==\n')
  assert.equal(portable(paragraph(text('=', highlight('#fff')), text(' '), text('a==b', highlight('#fff')))), '==\\=== ==a==b==\n')
  assert.equal(portable(paragraph(text('x'), text('y', highlight('#fff')), text(' z'))), 'xy z\n')
  assert.equal(portable(paragraph(text('この機能は'), text('日本語', highlight('#fff')), text('でのみ'))), 'この機能は==日本語==でのみ\n')
  assert.equal(portable(paragraph(text('サーバー'), text('停止', highlight('#fff')), text('中 iPhone'), text('専用', highlight('#fff')), text('アプリ 기능은 '), text('한국어', highlight('#fff')), text('에서만'))), 'サーバー==停止==中 iPhone==専用==アプリ 기능은 ==한국어==에서만\n')
  assert.equal(portable(paragraph(text('日==本==語'))), '日\\==本\\==語\n')
})

test('escapes text a renderer would take as a flavour marker, and only there', () => {
  assert.equal(portable(said('==x== a == b a==b ===')), '\\==x\\== a == b a==b \\=\\==\n')
  assert.equal(portable({ content: [said('[!NOTE] x'), said('[!TIP]')], type: 'blockquote' }), '> \\[!NOTE] x\n>\n> [!TIP]\n')
  assert.equal(portable({ content: [said('[!NOTE]x')], type: 'blockquote' }, said('[!NOTE]')), '> [!NOTE]x\n\n[!NOTE]\n')
  assert.equal(portable(bulletList(item(said('[x] a')), item(said('[ ]')))), '- \\[x] a\n- \\[ ]\n')
  assert.equal(portable(bulletList(item(said('[x] a')), item(said('b'))), node('orderedList', { order: 1 }, item(said('[x] c')))), '- \\[x] a\n- b\n\n1. \\[x] c\n')
  const task = (state: string, value: string): AdfNode => node('taskItem', { state }, text(value))
  assert.equal(portable(node('taskList', {}, task('DONE', '[x] a'), task('TODO', '==b=='))), '- [x] [x] a\n- [ ] \\==b\\==\n')
  assert.equal(portable(said('!adf:panel ~~x~~'), node('expand', { title: '!adf:x ==y==' }, said('z'))), '!adf:panel \\~~x\\~~\n\n> [!NOTE]- !adf:x \\==y\\==\n>\n> z\n')
})

test('unwraps the containers portable markdown has no spelling for to their body blocks in order', () => {
  const column = (value: string): AdfNode => node('layoutColumn', { width: 50 }, said(value))
  assert.equal(portable(node('layoutSection', {}, column('Left.'), column('Right.'))), 'Left.\n\nRight.\n')
  assert.equal(portable(node('bodiedExtension', { extensionKey: 'k' }, said('Body.'))), 'Body.\n')
  assert.equal(portable(node('bodiedSyncBlock', { resourceId: 'r' }, said('Synced.'))), 'Synced.\n')
  const frame = (value: string): AdfNode => node('extensionFrame', {}, said(value))
  assert.equal(portable(node('multiBodiedExtension', { extensionKey: 'k' }, frame('One.'), frame('Two.'))), 'One.\n\nTwo.\n')
})

test('keeps the CommonMark blocks in their spelling and drops their attributes and marks', () => {
  const localId = { localId: '01a0d99b-1f56-7a50-889a-f4375f09ee05' }
  assert.equal(portable(node('paragraph', localId, text('x')), node('heading', { level: 2, localId: '01a0d99b-1f57-7fec-94ae-50c2ee25c9de' }, text('h'))), 'x\n\n## h\n')
  assert.equal(portable({ attrs: localId, content: [said('q')], marks: [{ type: 'breakout' }], type: 'blockquote' }), '> q\n')
  assert.equal(portable(node('codeBlock', { language: 'ts', wrap: true }, text('a\r\nb\u0000'))), '```ts\na\nb\n```\n')
  assert.equal(portable(node('codeBlock', { language: 'adf:x' }, text('a'), { type: 'hardBreak' }, text('b', strong))), '```adf:x\na\nb\n```\n')
  assert.equal(portable(node('codeBlock', {})), '```\n```\n')
  assert.equal(portable(node('rule', { color: '#000' })), '---\n')
  assert.equal(portable(node('orderedList', { localId: '01a0d99b-1f58-7b95-829b-6f9860371d54', order: 3 }, item(said('c')))), '3. c\n')
  assert.equal(portable(node('orderedList', {}, item(said('a')))), '1. a\n')
  assert.equal(portable(node('orderedList', { order: -1 }, item(said('a')))), '1. a\n')
  const code: AdfNode = { content: [text('x')], type: 'codeBlock' }
  assert.equal(portable(node('orderedList', { order: 1e10 }, item(said('Alpha')), item(code), item())), '- 10000000000. Alpha\n- 10000000001.\n\n  ```\n  x\n  ```\n- 10000000002.\n')
  const long = node('orderedList', { order: 1e10 }, item(said('y')))
  assert.equal(portable(bulletList(item(said('x'))), long, bulletList(item(said('z')))), '- x\n\n* 10000000000. y\n\n- z\n')
  assert.equal(portable(node('taskList', {}, node('taskItem', { state: 'DONE' }, text('t'))), long), '- [x] t\n\n* 10000000000. y\n')
  assert.equal(portable(bulletList(item(said('a'), bulletList(item(said('x'))), long))), '- a\n  - x\n  * 10000000000. y\n')
  const givesWay = node('orderedList', { order: 1e10 }, item(node('rule', {})), item(bulletList(item(bulletList(item())))))
  assert.equal(portable(givesWay, bulletList(item(said('z')))), '- 10000000000.\n- 10000000001.\n  - -\n\n* z\n')
  assert.equal(portable(node('orderedList', { order: 999999999 }, item(said('a'))), node('orderedList', { order: 5 }, item(said('b')))), '999999999. a\n\n5) b\n')
  assert.equal(portable(node('heading', { level: 7 }, text('h'))), 'h\n')
})

test('spells an inline node as its text', () => {
  assert.equal(portable(paragraph(node('mention', { id: 'a', text: '@Mikael' }), text(' and '), node('status', { color: 'red', text: 'Blocked' }))), '@Mikael and Blocked\n')
  assert.equal(portable(paragraph(node('emoji', { shortName: ':tada:', text: '🎉' }), node('emoji', { shortName: ':smile:' }))), '🎉:smile:\n')
  assert.equal(portable(paragraph(node('date', { timestamp: '1757721600000' }), text(' '), node('date', { timestamp: 'soon' }))), '2025-09-13\n')
  assert.equal(portable(paragraph({ marks: [strong], ...node('mention', { text: '@Mikael' }) })), '**@Mikael**\n')
  assert.equal(portable(paragraph(text('by '), node('mention', { id: '5b10a2' }), node('mention', {}))), 'by @5b10a2\n')
})

test('spells a card as a link to its url, or to its data url named by its data name, else a note', () => {
  assert.equal(portable(paragraph(node('inlineCard', { url: 'https://example.com' }))), '<https://example.com>\n')
  assert.equal(portable(paragraph({ ...node('inlineCard', { url: 'https://example.com' }), marks: [strong, link('https://other.com')] })), '**<https://example.com>**\n')
  assert.equal(portable(paragraph(text('see '), node('inlineCard', { data: {} }))), 'see _(link card not included)_\n')
  assert.equal(portable(paragraph(node('inlineCard', { data: { name: 'Spec', url: 'https://e.com/s' } }), text(' '), node('inlineCard', { data: { url: 'https://e.com/u' } }))), '[Spec](https://e.com/s) <https://e.com/u>\n')
  assert.equal(portable(paragraph(node('inlineCard', { data: { name: 'Spec' } }), text(' '), node('inlineCard', { data: ['x'] }))), 'Spec _(link card not included)_\n')
  assert.equal(portable(node('blockCard', { url: 'https://example.com/a b' })), '[https://example.com/a b](<https://example.com/a b>)\n')
  assert.equal(portable(node('embedCard', { layout: 'center', url: 'https://example.com' })), '<https://example.com>\n')
  assert.equal(portable(node('blockCard', { data: {} })), '_(link card not included)_\n')
})

test('keeps an external image wherever it stands and spells a stored file as its alt text, else a note', () => {
  const media = (attrs: AdfAttributes): AdfNode => ({ attrs, type: 'media' })
  const caption: AdfNode = node('caption', {}, text('The moon.'))
  const external = media({ alt: 'Moon', height: 10, type: 'external', url: 'https://example.com/moon.png' })
  assert.equal(portable(node('mediaSingle', { layout: 'wide', width: 50 }, external, caption)), '![Moon](https://example.com/moon.png)\n\nThe moon.\n')
  assert.equal(portable(node('mediaSingle', {}, media({ alt: '', type: 'external', url: 'https://example.com/a.png' }))), '![](https://example.com/a.png)\n')
  assert.equal(portable(node('mediaSingle', {}, media({ alt: ' Two\nlines ', type: 'external', url: 'u' }), media({ type: 'external', url: 'v' }))), '![Two lines](u)\n\n![](v)\n')
  assert.equal(portable(node('mediaSingle', {}, media({ alt: 'Bad', type: 'external', url: 'a\\b <&amp;>' }))), '![Bad](<a%5Cb %3C%26amp;%3E>)\n')
  assert.equal(portable(node('mediaSingle', {}, media({ alt: 'Photo', collection: 'c', id: 'i', type: 'file' }))), 'Photo\n')
  assert.equal(portable(node('mediaGroup', {}, media({ alt: 'One', type: 'file' }), media({ type: 'file' }), external)), 'One\n\n_(image not included)_\n\n![Moon](https://example.com/moon.png)\n')
  assert.equal(portable(external), '![Moon](https://example.com/moon.png)\n')
  assert.equal(portable(paragraph(text('a '), node('mediaInline', { alt: 'clip', type: 'file' }), text(' '), node('mediaInline', { type: 'file' }))), 'a clip _(image not included)_\n')
  assert.equal(portable(paragraph(text('See '), external, text(' for '), node('mediaInline', { type: 'external', url: 'https://e.com/i.png' }))), 'See [Moon](https://example.com/moon.png) for <https://e.com/i.png>\n')
  assert.equal(portable(caption), 'The moon.\n')
})

test('spells an extension as its text attribute, else a note naming it, and a placeholder as nothing', () => {
  assert.equal(portable(node('extension', { extensionKey: 'toc', text: 'Contents' }), node('extension', { extensionKey: 'jira-issues-table' })), 'Contents\n\n_(jira-issues-table not included)_\n')
  assert.equal(portable(node('syncBlock', { resourceId: 'r' })), '_(synced block not included)_\n')
  assert.equal(portable(node('extension', { extensionKey: 'jira\r\nissues\u0000' })), '_(jira issues not included)_\n')
  assert.equal(portable(node('extension', { extensionKey: '\r\u0000' }), node('extension', { extensionKey: '\n' })), '_(extension not included)_\n\n_(extension not included)_\n')
  const blank = paragraph(node('inlineExtension', { extensionKey: 'k', text: '\r' }), text(' '), node('mediaInline', { alt: '\u0000', type: 'file' }), text(' '), node('mention', { id: '5b10a2', text: '\r' }))
  assert.equal(portable(blank), '_(k not included)_ _(image not included)_ @5b10a2\n')
  assert.equal(portable(paragraph(text('a '), node('inlineExtension', { text: 'macro' }), text(' '), node('inlineExtension', {}), node('placeholder', { text: 'Type here' }))), 'a macro _(extension not included)_\n')
})

test('spells a node no row names, or one standing where no spelling holds it, as its blocks or its text', () => {
  assert.equal(portable(node('futureBlock', {}, said('Inside.'))), 'Inside.\n')
  assert.equal(portable(paragraph(text('a '), { content: [text('b')], text: 'c', type: 'futureInline' })), 'a c b\n')
  assert.equal(portable(text('loose'), node('mention', { text: '@x' }), node('listItem', {}, said('item'))), 'loose@x\n\nitem\n')
  assert.equal(portable(paragraph(text('a '), node('bulletList', {}, item(said('b')), item(said('c'))))), 'a  b c\n')
  assert.equal(portable(bulletList(said('stray'), item(said('b')), text('loose'))), '- stray\n- b\n- loose\n')
  assert.equal(portable(bulletList()), '')
  assert.equal(portable(bulletList(item({ content: [text('a\n  \nb')], type: 'codeBlock' }))), '- ```\n  a\n\n  b\n  ```\n')
  assert.equal(portable(bulletList(item({ content: [text(' ')], type: 'codeBlock' }))), '- ```\n  ```\n')
  assert.equal(portable(bulletList(item(node('rule', {}), node('rule', {}), said('Install')), item(said('Configure')))), '- Install\n- Configure\n')
  assert.equal(portable(bulletList(item(node('rule', {}), node('rule', {})), item(said('Configure')))), '-\n- Configure\n')
  assert.equal(portable(bulletList(item(bulletList(item(bulletList(item())))))), '- -\n')
  assert.equal(portable(node('nestedExpand', {}, node('tableCell', {}, said('c')))), '> [!NOTE]-\n>\n> c\n')
})

test('keeps a table as a pipe table headed by its first row, one line per cell', () => {
  const table = node(
    'table',
    { layout: 'wide' },
    row(cell('tableCell', said('Part')), cell('tableCell', said('Qty'))),
    row(cell('tableHeader', said('Bolt'), bulletList(item(said('M8')))), { attrs: { background: '#fff' }, content: [paragraph(text('4'), { type: 'hardBreak' }, text('0'))], type: 'tableCell' }),
  )
  assert.equal(portable(table), '| Part | Qty |\n| --- | --- |\n| Bolt M8 | 4 0 |\n')
  const spanned = node(
    'table',
    {},
    row(cell('tableHeader', said('A')), cell('tableHeader', said('B')), cell('tableHeader', said('C'))),
    row(node('tableCell', { colspan: 2, rowspan: 2 }, said('wide')), cell('tableCell', said('c'))),
    row(cell('tableCell', said('d'))),
    row(cell('tableCell')),
  )
  assert.equal(portable(spanned), '| A | B | C |\n| --- | --- | --- |\n| wide |  | c |\n|  |  | d |\n|  |  |  |\n')
  const huge = node('table', {}, row(node('tableHeader', { colspan: 1e9, rowspan: 1e9 }, said('A')), cell('tableHeader', said('B'))), row(cell('tableCell', said('c'))))
  assert.equal(portable(huge), '| A |  |  |  | B |\n| --- | --- | --- | --- | --- |\n| c |  |  |  |  |\n')
  assert.equal(portable(node('table', {}, row(cell('tableHeader', paragraph(text('a|b', code), text(' '), text('x', link('https://e.com/|'))))))), '| a\\|b [x](https://e.com/%7C) |\n| --- |\n')
  assert.equal(portable(node('table', {}, said('stray'))), '| stray |\n| --- |\n')
  const titled = paragraph(text('t', link('https://e.com', 'a|b')))
  const folded = [node('expand', { title: 'Log' }, said('x')), node('nestedExpand', {}, said('y'))]
  assert.equal(portable(node('table', {}, row(cell('tableHeader', titled), cell('tableHeader', ...folded)))), '| [t](https://e.com) | Log x y |\n| --- | --- |\n')
  assert.equal(portable(node('table', {}, row())), '')
})

test('keeps code, em, link, strike and strong and drops every other mark, keeping its text', () => {
  const marks: AdfMark[] = [{ type: 'strike' }, { attrs: { type: 'sub' }, type: 'subsup' }, { type: 'underline' }, { attrs: { color: '#f00' }, type: 'textColor' }]
  assert.equal(portable(paragraph(text('H'), text('2', ...marks), text('O', em, strong), text('!', { attrs: { size: 1 }, type: 'border' }))), 'H~~2~~_**O**_!\n')
  assert.equal(portable(paragraph(text('x', code, strong), text(' '), text('y', { attrs: { x: 1 }, type: 'strong' }), text('z', em, em))), '**`x`** **y**_z_\n')
  assert.equal(portable(paragraph(text('site', { attrs: { collection: 'c', href: 'https://e.com', id: 'i' }, type: 'link' }))), '[site](https://e.com)\n')
})

test('percent-encodes a link href no CommonMark escape writes until one does', () => {
  assert.equal(portable(paragraph(text('a', link('a\\b')), text(' '), text('b', { attrs: { id: 'i' }, type: 'link' }), text(' '), text('c', link('/&amp;')))), '[a](a%5Cb) b [c](/%26amp;)\n')
  assert.equal(portable(paragraph(text('t', link('https://e.com', 'two\nlines')), text(' '), text('u', link('https://e.com', 'a\\b')))), '[t](https://e.com "two lines") [u](https://e.com)\n')
  assert.equal(portable(paragraph(text(']: a', link('/u'), code))), '[\\]: a](/u)\n')
})

test('drops the mark of a run CommonMark flanking or matching cannot spell', () => {
  assert.equal(portable(paragraph(text('un'), text('-real', strong), text('istic'))), 'un-realistic\n')
  assert.equal(portable(paragraph(text('a', em), text('b', strong), text('c', em))), '_a_**b**_c_\n')
  assert.equal(portable(paragraph(text('x'), text('*', em), text('y'))), 'x\\*y\n')
  const highlight: AdfMark = { type: 'backgroundColor' }
  assert.equal(portable(paragraph(text('a'), text('b', highlight), text(' c'), text('d', highlight), text(' '), text('e', highlight))), 'ab cd ==e==\n')
})

test('breaks a line at a newline and trims whitespace at every edge CommonMark strips', () => {
  assert.equal(portable(paragraph(text(' \n a \n b\n'))), 'a\\\nb\n')
  assert.equal(portable(paragraph({ type: 'hardBreak' }, text('a'), { attrs: { text: '\n' }, type: 'hardBreak' }, text('b'), { type: 'hardBreak' })), 'a\\\nb\n')
  assert.equal(portable(paragraph(text('a'), text(' b ', strong), text('c'))), 'a **b** c\n')
  assert.equal(portable(paragraph(text(' '), text('b', strong), text(' \n'), text('c', strong), text(' '))), '**b**\\\n**c**\n')
  assert.equal(portable(paragraph(text('x'), text('.', em), { type: 'hardBreak' }, text('b', em))), 'x.\\\n_b_\n')
  assert.equal(portable(paragraph(text('a'), text(' b ', em, strong), text(' ', em), text('c', em))), 'a _**b**  c_\n')
  assert.equal(portable(paragraph(text(' x ', code))), '`  x  `\n')
  assert.equal(portable(node('heading', { level: 1 }, text(' h\ni '))), '# h i\n')
  assert.equal(portable(paragraph(text('a\r\u0000b'))), 'ab\n')
  assert.equal(portable(paragraph(text('x', link('/u', 't\r\u0000')))), '[x](/u "t")\n')
  assert.equal(portable(paragraph({ content: [text('dropped')], text: 'a', type: 'text' }, text('b'))), 'ab\n')
})

test('keeps a code span opening a line, whose backticks open no fence', () => {
  assert.equal(portable(paragraph(text('``` x', code))), '```` ``` x ````\n')
  assert.equal(portable(paragraph(text('a\n'), text('``` x', code))), 'a\\\n```` ``` x ````\n')
})

test('drops an empty paragraph and alternates the marker between adjacent lists of a kind', () => {
  const ordered = (order: number, value: string): AdfNode => node('orderedList', { order }, item(said(value)))
  assert.equal(portable(said('a'), paragraph(), paragraph(text('  ')), said('b')), 'a\n\nb\n')
  assert.equal(portable(bulletList(item(said('a'))), paragraph(), node('decisionList', {}, node('decisionItem', {}, text('b')))), '- a\n\n* b\n')
  assert.equal(portable(ordered(2, 'a'), ordered(3, 'b'), bulletList(item(said('c')))), '2. a\n\n3) b\n\n- c\n')
  assert.equal(portable(bulletList(item(said('x'))), ordered(1, 'a'), ordered(5, 'b'), ordered(6, 'c')), '- x\n\n1. a\n\n5) b\n\n6. c\n')
  assert.equal(portable(ordered(1, 'a'), ordered(1e10, 'y')), '1. a\n\n- 10000000000. y\n')
  assert.equal(portable(node('taskList', {}, ordered(1e10, 'y')), bulletList(ordered(1e10, 'z'))), '- - 10000000000. y\n\n* - 10000000000. z\n')
  const column = (list: AdfNode): AdfNode => node('layoutColumn', {}, list)
  assert.equal(portable(node('layoutSection', {}, column(bulletList(item(said('a')))), column(bulletList(item(said('b')))))), '- a\n\n* b\n')
})

test('keeps the nodes the portable flavour spells and degrades only what it cannot', () => {
  const tasks = node('taskList', {}, node('taskItem', { localId: '01a0d99b-1f58-7b95-829b-6f9860371d54', state: 'DONE' }, text('t')))
  const reduced = reduceToPortable(document(node('panel', { localId: '01a0d99b-1f56-7a50-889a-f4375f09ee05', panelType: 'info' }, said('x')), tasks))
  assert.deepEqual(reduced.ok ? reduced.value : undefined, document(node('panel', { panelType: 'info' }, said('x')), { content: [node('taskItem', { state: 'DONE' }, text('t'))], type: 'taskList' }))
})

test('writes what the editor-normal form of the document writes', () => {
  assert.equal(portable({ attrs: { order: -0 }, content: [{ content: [], type: 'listItem' }], type: 'orderedList' }), '0.\n')
  assert.equal(portable({ content: [], text: 'hi', type: 'futureInline' }), 'hi\n')
  assert.equal(portable(paragraph({ marks: [{ attrs: {}, type: 'code' }], text: 'a', type: 'text' }, { marks: [{ type: 'code' }], text: '|b', type: 'text' })), '`a|b`\n')
})

test('writes a text node holding content the same in either order beside its neighbour', () => {
  const holding: AdfNode = { content: [text('inner')], text: 'a', type: 'text' }
  assert.equal(portable(paragraph(holding, text('b'))), 'ab\n')
  assert.equal(portable(paragraph(text('b'), holding)), 'ba\n')
})

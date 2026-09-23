import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import { adfToMarkdown } from './adf-to-markdown.ts'
import { largestNesting } from '../../nesting.ts'
import { reduceToPlain } from './plain-reduction.ts'

const code: AdfMark = { type: 'code' }
const em: AdfMark = { type: 'em' }
const strong: AdfMark = { type: 'strong' }

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function plain(...content: AdfNode[]): string {
  return plainDocument(document(...content))
}

function plainDocument(input: AdfDocument): string {
  const reduced = reduceToPlain(input)
  if (!reduced.ok) return `${reduced.error.code} at /${reduced.error.path.join('/')}`
  const markdown = adfToMarkdown(reduced.value)
  if (!markdown.ok) return `emit ${markdown.error.code}: ${markdown.error.message}`
  return markdown.value
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
  assert.equal(plainDocument({ type: 'doc', version: Number.NaN }), 'not-an-adf-document at /')
  assert.equal(plainDocument({ type: 'doc', version: 2 }), 'unsupported-document-version at /')
  let deep: AdfNode = said('x')
  for (let level = 0; level <= largestNesting; level += 1) deep = { content: [deep], type: 'layoutColumn' }
  assert.match(plainDocument(document(deep)), /^unsupported-nesting-depth at \/content\/0(\/content\/0)+$/)
  let deepInline: AdfNode = text('x')
  for (let level = 0; level <= largestNesting; level += 1) deepInline = { content: [deepInline], type: 'unknownInline' }
  assert.match(plainDocument(document(paragraph(deepInline))), /^unsupported-nesting-depth at /)
})

test('refuses nesting past 500 levels wherever the reduction walks', () => {
  const lowest = (bottom: AdfNode): string => {
    let deep = bottom
    for (let level = 0; level < largestNesting; level += 1) deep = { content: [deep], type: 'layoutColumn' }
    return plainDocument(document(deep)).split(' ')[0] ?? ''
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
    plain(node('panel', panelType === undefined ? {} : { localId: 'a', panelType }, said('Check it.')))
  assert.equal(panel('info'), '> [!NOTE]\n>\n> Check it.\n')
  assert.equal(panel('note'), '> [!IMPORTANT]\n>\n> Check it.\n')
  assert.equal(panel('tip'), '> [!TIP]\n>\n> Check it.\n')
  assert.equal(panel('success'), '> [!TIP]\n>\n> Check it.\n')
  assert.equal(panel('warning'), '> [!WARNING]\n>\n> Check it.\n')
  assert.equal(panel('error'), '> [!CAUTION]\n>\n> Check it.\n')
  assert.equal(panel('custom'), '> [!NOTE]\n>\n> Check it.\n')
  assert.equal(panel(undefined), '> [!NOTE]\n>\n> Check it.\n')
  assert.equal(plain(node('panel', { panelType: 'warning' })), '> [!WARNING]\n')
})

test('spells an expand and a nested expand as a folded callout titled by the marker line', () => {
  const nested = node('nestedExpand', { title: 'Inner' }, said('Deep.'))
  assert.equal(
    plain(node('expand', { localId: 'a', title: 'Build log' }, said('Line.'), nested)),
    '> [!NOTE]- Build log\n>\n> Line.\n>\n> > [!NOTE]- Inner\n> >\n> > Deep.\n',
  )
  assert.equal(plain(node('expand', {}, said('Line.'))), '> [!NOTE]-\n>\n> Line.\n')
  assert.equal(plain(node('expand', { title: ' *Two*\nlines ' })), '> [!NOTE]- \\*Two\\*\\\n> lines\n')
})

test('spells a task list as a bullet list whose items lead with their state', () => {
  const task = (state: string, value: string): AdfNode => node('taskItem', { localId: 'a', state }, text(value))
  const nested = node('taskList', {}, task('TODO', 'Review'))
  assert.equal(plain(node('taskList', {}, task('DONE', 'Write the spec'), nested, task('TODO', 'Ship it'))), '- [x] Write the spec\n  - [ ] Review\n- [ ] Ship it\n')
  assert.equal(plain(node('taskList', {}, nested, task('DONE', ''), said('Stray'))), '- - [ ] Review\n- [x]\n- Stray\n')
  assert.equal(plain(node('taskList', {}), task('TODO', 'Loose')), 'Loose\n')
  const blockTask = node('blockTaskItem', { state: 'DONE' }, said('First.'), said('Second.'))
  const codeTask = node('blockTaskItem', { state: 'TODO' }, { content: [text('x')], type: 'codeBlock' })
  assert.equal(plain(node('taskList', {}, blockTask, codeTask)), '- [x] First.\n\n  Second.\n- [ ]\n\n  ```\n  x\n  ```\n')
})

test('spells a decision list as a plain bullet list', () => {
  assert.equal(plain(node('decisionList', {}, node('decisionItem', { state: 'DECIDED' }, text('Ship')), said('Stray'))), '- Ship\n- Stray\n')
})

test('spells a highlight as a == pair around the run, whatever its colour', () => {
  const highlight = (color: string): AdfMark => ({ attrs: { color }, type: 'backgroundColor' })
  assert.equal(plain(paragraph(text('a '), text('hi', highlight('#fff')), text(' there', highlight('#000')), text(' b'))), 'a ==hi there== b\n')
  assert.equal(plain(paragraph(text('hi ', strong, highlight('#fff')), text('b'))), '**==hi==** b\n')
  assert.equal(plain(paragraph(text('a', strong, highlight('#fff')), text('b', highlight('#fff'), em))), '==**a**_b_==\n')
  assert.equal(plain(paragraph(text('a', highlight('#fff'), code))), '==`a`==\n')
})

test('unwraps the containers plain markdown has no spelling for to their body blocks in order', () => {
  const column = (value: string): AdfNode => node('layoutColumn', { width: 50 }, said(value))
  assert.equal(plain(node('layoutSection', {}, column('Left.'), column('Right.'))), 'Left.\n\nRight.\n')
  assert.equal(plain(node('bodiedExtension', { extensionKey: 'k' }, said('Body.'))), 'Body.\n')
  assert.equal(plain(node('bodiedSyncBlock', { resourceId: 'r' }, said('Synced.'))), 'Synced.\n')
  const frame = (value: string): AdfNode => node('extensionFrame', {}, said(value))
  assert.equal(plain(node('multiBodiedExtension', { extensionKey: 'k' }, frame('One.'), frame('Two.'))), 'One.\n\nTwo.\n')
})

test('keeps the CommonMark blocks in their spelling and drops their attributes and marks', () => {
  const localId = { localId: 'a' }
  assert.equal(plain(node('paragraph', localId, text('x')), node('heading', { level: 2, localId: 'a' }, text('h'))), 'x\n\n## h\n')
  assert.equal(plain({ attrs: localId, content: [said('q')], marks: [{ type: 'breakout' }], type: 'blockquote' }), '> q\n')
  assert.equal(plain(node('codeBlock', { language: 'ts', wrap: true }, text('a\r\nb\u0000'))), '```ts\na\nb\n```\n')
  assert.equal(plain(node('codeBlock', { language: 'carry' }, text('a'), { type: 'hardBreak' }, text('b', strong))), '```\na\nb\n```\n')
  assert.equal(plain(node('codeBlock', {})), '```\n```\n')
  assert.equal(plain(node('rule', { color: '#000' })), '---\n')
  assert.equal(plain(node('orderedList', { localId: 'a', order: 3 }, item(said('c')))), '3. c\n')
  assert.equal(plain(node('orderedList', {}, item(said('a')))), '1. a\n')
  assert.equal(plain(node('orderedList', { order: -1 }, item(said('a')))), '1. a\n')
  assert.equal(plain(node('heading', { level: 7 }, text('h'))), 'h\n')
})

test('spells an inline node as its text', () => {
  assert.equal(plain(paragraph(node('mention', { id: 'a', text: '@Mikael' }), text(' and '), node('status', { color: 'red', text: 'Blocked' }))), '@Mikael and Blocked\n')
  assert.equal(plain(paragraph(node('emoji', { shortName: ':tada:', text: '🎉' }), node('emoji', { shortName: ':smile:' }))), '🎉:smile:\n')
  assert.equal(plain(paragraph(node('date', { timestamp: '1757721600000' }), text(' '), node('date', { timestamp: 'soon' }))), '2025-09-13\n')
  assert.equal(plain(paragraph({ marks: [strong], ...node('mention', { text: '@Mikael' }) })), '**@Mikael**\n')
})

test('spells a card as a link to its url, dropping one carrying only data', () => {
  assert.equal(plain(paragraph(node('inlineCard', { url: 'https://example.com' }))), '<https://example.com>\n')
  assert.equal(plain(paragraph({ ...node('inlineCard', { url: 'https://example.com' }), marks: [strong, link('https://other.com')] })), '**<https://example.com>**\n')
  assert.equal(plain(paragraph(text('see '), node('inlineCard', { data: {} }))), 'see\n')
  assert.equal(plain(node('blockCard', { url: 'https://example.com/a b' })), '[https://example.com/a b](<https://example.com/a b>)\n')
  assert.equal(plain(node('embedCard', { layout: 'center', url: 'https://example.com' })), '<https://example.com>\n')
  assert.equal(plain(node('blockCard', { data: {} })), '')
})

test('keeps an external image and spells other media as their alt text', () => {
  const media = (attrs: AdfAttributes): AdfNode => ({ attrs, type: 'media' })
  const caption: AdfNode = node('caption', {}, text('The moon.'))
  const external = media({ alt: 'Moon', height: 10, type: 'external', url: 'https://example.com/moon.png' })
  assert.equal(plain(node('mediaSingle', { layout: 'wide', width: 50 }, external, caption)), '![Moon](https://example.com/moon.png)\n\nThe moon.\n')
  assert.equal(plain(node('mediaSingle', {}, media({ alt: '', type: 'external', url: 'https://example.com/a.png' }))), '![](https://example.com/a.png)\n')
  assert.equal(plain(node('mediaSingle', {}, media({ alt: ' Two\nlines ', type: 'external', url: 'u' }), media({ type: 'external', url: 'v' }))), '![Two lines](u)\n\n![](v)\n')
  assert.equal(plain(node('mediaSingle', {}, media({ alt: 'Bad', type: 'external', url: 'a\\b' }))), 'Bad\n')
  assert.equal(plain(node('mediaSingle', {}, media({ alt: 'Photo', collection: 'c', id: 'i', type: 'file' }))), 'Photo\n')
  assert.equal(plain(node('mediaGroup', {}, media({ alt: 'One', type: 'file' }), media({ type: 'file' }))), 'One\n')
  assert.equal(plain(paragraph(text('a '), node('mediaInline', { alt: 'clip', type: 'file' }), node('mediaInline', { type: 'file' }))), 'a clip\n')
  assert.equal(plain(caption), 'The moon.\n')
})

test('spells an extension as its text attribute and a placeholder as nothing', () => {
  assert.equal(plain(node('extension', { extensionKey: 'toc', text: 'Contents' }), node('extension', { extensionKey: 'toc' })), 'Contents\n')
  assert.equal(plain(node('syncBlock', { resourceId: 'r' })), '')
  assert.equal(plain(paragraph(text('a '), node('inlineExtension', { text: 'macro' }), node('placeholder', { text: 'Type here' }))), 'a macro\n')
})

test('spells a node no row names, or one standing where no spelling holds it, as its blocks or its text', () => {
  assert.equal(plain(node('futureBlock', {}, said('Inside.'))), 'Inside.\n')
  assert.equal(plain(paragraph(text('a '), { content: [text('b')], text: 'c', type: 'futureInline' })), 'a c b\n')
  assert.equal(plain(text('loose'), node('mention', { text: '@x' }), node('listItem', {}, said('item'))), 'loose@x\n\nitem\n')
  assert.equal(plain(paragraph(text('a '), node('bulletList', {}, item(said('b')), item(said('c'))))), 'a  b c\n')
  assert.equal(plain(bulletList(said('stray'), item(said('b')), text('loose'))), '- stray\n- b\n- loose\n')
  assert.equal(plain(bulletList()), '')
  assert.equal(plain(bulletList(item(node('rule', {}), said('x')))), '---\n\nx\n')
  assert.equal(plain(bulletList(item({ content: [text('a\n  \nb')], type: 'codeBlock' }))), '```\na\n  \nb\n```\n')
  assert.equal(plain(node('nestedExpand', {}, node('tableCell', {}, said('c')))), '> [!NOTE]-\n>\n> c\n')
})

test('keeps a table as a pipe table headed by its first row, one line per cell', () => {
  const table = node(
    'table',
    { layout: 'wide' },
    row(cell('tableCell', said('Part')), cell('tableCell', said('Qty'))),
    row(cell('tableHeader', said('Bolt'), bulletList(item(said('M8')))), { attrs: { background: '#fff' }, content: [paragraph(text('4'), { type: 'hardBreak' }, text('0'))], type: 'tableCell' }),
  )
  assert.equal(plain(table), '| Part | Qty |\n| --- | --- |\n| Bolt M8 | 4 0 |\n')
  const spanned = node(
    'table',
    {},
    row(cell('tableHeader', said('A')), cell('tableHeader', said('B')), cell('tableHeader', said('C'))),
    row(node('tableCell', { colspan: 2 }, said('wide')), cell('tableCell', said('c'))),
    row(cell('tableCell')),
  )
  assert.equal(plain(spanned), '| A | B | C |\n| --- | --- | --- |\n| wide | c |  |\n|  |  |  |\n')
  assert.equal(plain(node('table', {}, row(cell('tableHeader', paragraph(text('a|b', code), text(' '), text('x', link('https://e.com/|'))))))), '| a\\|b x |\n| --- |\n')
  assert.equal(plain(node('table', {}, said('stray'))), '| stray |\n| --- |\n')
  const titled = paragraph(text('t', link('https://e.com', 'a|b')))
  const folded = [node('expand', { title: 'Log' }, said('x')), node('nestedExpand', {}, said('y'))]
  assert.equal(plain(node('table', {}, row(cell('tableHeader', titled), cell('tableHeader', ...folded)))), '| [t](https://e.com) | Log x y |\n| --- | --- |\n')
  assert.equal(plain(node('table', {}, row())), '')
})

test('keeps code, em, link, strike and strong and drops every other mark, keeping its text', () => {
  const marks: AdfMark[] = [{ type: 'strike' }, { attrs: { type: 'sub' }, type: 'subsup' }, { type: 'underline' }, { attrs: { color: '#f00' }, type: 'textColor' }]
  assert.equal(plain(paragraph(text('H'), text('2', ...marks), text('O', em, strong), text('!', { attrs: { size: 1 }, type: 'border' }))), 'H~~2~~_**O**_!\n')
  assert.equal(plain(paragraph(text('x', code, strong), text(' '), text('y', { attrs: { x: 1 }, type: 'strong' }), text('z', em, em))), '**`x`** **y**_z_\n')
  assert.equal(plain(paragraph(text('site', { attrs: { collection: 'c', href: 'https://e.com', id: 'i' }, type: 'link' }))), '[site](https://e.com)\n')
})

test('spells a link no CommonMark escape writes as its text', () => {
  assert.equal(plain(paragraph(text('a', link('a\\b')), text(' '), text('b', { attrs: { id: 'i' }, type: 'link' }))), 'a b\n')
  assert.equal(plain(paragraph(text('t', link('https://e.com', 'two\nlines')), text(' '), text('u', link('https://e.com', 'Title')))), '[t](https://e.com) [u](https://e.com "Title")\n')
  assert.equal(plain(paragraph(text(']: a', link('/u'), code))), '`]: a`\n')
})

test('drops the mark of a run CommonMark flanking or matching cannot spell', () => {
  assert.equal(plain(paragraph(text('un'), text('-real', strong), text('istic'))), 'un-realistic\n')
  assert.equal(plain(paragraph(text('a', em), text('b', strong), text('c', em))), '_a_**b**_c_\n')
  assert.equal(plain(paragraph(text('x'), text('*', em), text('y'))), 'x\\*y\n')
})

test('breaks a line at a newline and trims whitespace at every edge CommonMark strips', () => {
  assert.equal(plain(paragraph(text(' \n a \n b\n'))), 'a\\\nb\n')
  assert.equal(plain(paragraph({ type: 'hardBreak' }, text('a'), { attrs: { text: '\n' }, type: 'hardBreak' }, text('b'), { type: 'hardBreak' })), 'a\\\nb\n')
  assert.equal(plain(paragraph(text('a'), text(' b ', strong), text('c'))), 'a **b** c\n')
  assert.equal(plain(paragraph(text('a'), text(' b ', em, strong), text(' ', em), text('c', em))), 'a _**b**  c_\n')
  assert.equal(plain(paragraph(text(' x ', code))), '`  x  `\n')
  assert.equal(plain(node('heading', { level: 1 }, text(' h\ni '))), '# h i\n')
  assert.equal(plain(paragraph(text('a\r\u0000b'))), 'ab\n')
})

test('drops the code mark of a span opening a line with backticks that read as a fence', () => {
  assert.equal(plain(paragraph(text('``` x', code))), '\\`\\`\\` x\n')
  assert.equal(plain(paragraph(text('a\n'), text('``` x', code))), 'a\\\n\\`\\`\\` x\n')
  assert.equal(plain(paragraph(text('a '), text('``` x', code))), 'a ```` ``` x ````\n')
})

test('drops an empty paragraph and merges adjacent lists of one type', () => {
  const ordered = (order: number, value: string): AdfNode => node('orderedList', { order }, item(said(value)))
  assert.equal(plain(said('a'), paragraph(), paragraph(text('  ')), said('b')), 'a\n\nb\n')
  assert.equal(plain(bulletList(item(said('a'))), paragraph(), node('decisionList', {}, node('decisionItem', {}, text('b')))), '- a\n- b\n')
  assert.equal(plain(ordered(2, 'a'), ordered(7, 'b'), bulletList(item(said('c')))), '2. a\n3. b\n\n- c\n')
  const column = (list: AdfNode): AdfNode => node('layoutColumn', {}, list)
  assert.equal(plain(node('layoutSection', {}, column(bulletList(item(said('a')))), column(bulletList(item(said('b')))))), '- a\n- b\n')
})

test('returns a document the lossless emitter spells without a directive', () => {
  const reduced = reduceToPlain(document(node('panel', { panelType: 'info' }, said('x'))))
  assert.deepEqual(reduced.ok ? reduced.value : undefined, document({ content: [said('[!NOTE]'), said('x')], type: 'blockquote' }))
})

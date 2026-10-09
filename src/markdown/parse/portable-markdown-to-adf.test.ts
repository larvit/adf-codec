import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import { adfToPortableMarkdown } from '../portable/adf-to-portable-markdown.ts'
import { largestNesting } from '../../nesting.ts'
import { portableMarkdownToAdf } from './markdown-to-adf.ts'

const code: AdfMark = { type: 'code' }
const em: AdfMark = { type: 'em' }
const highlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }
const strong: AdfMark = { type: 'strong' }

const taskTypes = ['blockTaskItem', 'taskItem', 'taskList']

function read(markdown: string): readonly AdfNode[] | string {
  const parsed = portableMarkdownToAdf(markdown)
  if (!parsed.ok) return parsed.error.code
  const blocks = parsed.value.content ?? []
  const pending = [...blocks]
  for (let block = pending.pop(); block !== undefined; block = pending.pop()) {
    for (const child of block.content ?? []) pending.push(child)
    if (!taskTypes.includes(block.type)) continue
    const { localId, ...attrs } = block.attrs ?? {}
    assert.equal(typeof localId, 'string', `${block.type} in ${JSON.stringify(markdown)}`)
    if (Object.keys(attrs).length === 0) delete block.attrs
    else block.attrs = attrs
  }
  return blocks
}

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function roundTripped(...content: AdfNode[]): readonly AdfNode[] | string {
  const markdown = adfToPortableMarkdown(document(...content))
  return markdown.ok ? read(markdown.value) : markdown.error.code
}

function text(value: string, ...marks: AdfMark[]): AdfNode {
  return marks.length === 0 ? { text: value, type: 'text' } : { marks, text: value, type: 'text' }
}

function node(type: string, attrs: AdfAttributes, ...content: AdfNode[]): AdfNode {
  return { attrs, content, type }
}

function bare(type: string, ...content: AdfNode[]): AdfNode {
  return { content, type }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : bare('paragraph', ...content)
}

function said(value: string): AdfNode {
  return paragraph(text(value))
}

function panel(panelType: string, ...content: AdfNode[]): AdfNode {
  return node('panel', { panelType }, ...content)
}

function task(state: string, ...content: AdfNode[]): AdfNode {
  return node('taskItem', { state }, ...content)
}

test('reads an alert to a panel by its GitHub word, in any case', () => {
  const alert = (word: string): readonly AdfNode[] | string => read(`> [!${word}]\n>\n> Check it.\n`)
  assert.deepEqual(alert('NOTE'), [panel('info', said('Check it.'))])
  assert.deepEqual(alert('IMPORTANT'), [panel('note', said('Check it.'))])
  assert.deepEqual(alert('TIP'), [panel('tip', said('Check it.'))])
  assert.deepEqual(alert('WARNING'), [panel('warning', said('Check it.'))])
  assert.deepEqual(alert('CAUTION'), [panel('error', said('Check it.'))])
  assert.deepEqual(alert('Warning'), [panel('warning', said('Check it.'))])
  assert.deepEqual(alert('caution'), [panel('error', said('Check it.'))])
})

test('reads an Obsidian callout to a panel by what its word means, any other word info', () => {
  const alert = (word: string): unknown => {
    const blocks = read(`> [!${word}]\n> Body.\n`)
    return typeof blocks === 'string' ? blocks : blocks[0]?.attrs
  }
  assert.deepEqual(alert('hint'), { panelType: 'tip' })
  for (const word of ['success', 'check', 'Done']) assert.deepEqual(alert(word), { panelType: 'success' }, word)
  assert.deepEqual(alert('attention'), { panelType: 'warning' })
  for (const word of ['danger', 'error', 'failure', 'fail', 'missing', 'BUG']) assert.deepEqual(alert(word), { panelType: 'error' }, word)
  for (const word of ['info', 'note', 'question', 'my-type']) assert.deepEqual(alert(word), { panelType: 'info' }, word)
})

test('reads the rest of an alert marker line as the panel first body paragraph, the lines after as the next', () => {
  assert.deepEqual(read('> [!NOTE]\n> Line **one**.\n>\n> Two.\n'), [panel('info', paragraph(text('Line '), text('one', strong), text('.')), said('Two.'))])
  assert.deepEqual(read('> [!tip] Title\n'), [panel('tip', said('Title'))])
  assert.deepEqual(read('> [!tip] Title\n> body\n'), [panel('tip', said('Title'), said('body'))])
  assert.deepEqual(read('> [!tip] Title\\\n> body\n'), [panel('tip', said('Title'), said('body'))])
  assert.deepEqual(read('> [!NOTE]\\\n> Broken.\n'), [panel('info', said('Broken.'))])
  assert.deepEqual(read('> [!NOTE]\n'), [panel('info', paragraph())])
  assert.deepEqual(read('> > [!WARNING]\n> > Inner.\n'), [bare('blockquote', panel('warning', said('Inner.')))])
})

test('leaves a quote plain where its first line is no alert marker', () => {
  for (const markdown of ['> \\[!NOTE]\n> x\n', '> [!NOTE]x\n', '> **[!NOTE]**\n', '> See [!NOTE]\n', '> [!NOTE]**x**\n', '> [!]\n', '> ```\n> [!NOTE]\n> ```\n']) {
    const blocks = read(markdown)
    assert.equal(typeof blocks !== 'string' && blocks[0]?.type, 'blockquote', markdown)
  }
})

test('reads a folded callout to an expand titled by the rest of its marker line, whatever the word', () => {
  assert.deepEqual(read('> [!NOTE]- Build log\n>\n> Line.\n'), [node('expand', { title: 'Build log' }, said('Line.'))])
  assert.deepEqual(read('> [!bug]+ Open **by** default\n> body\n>\n> Line.\n'), [node('expand', { title: 'Open by default' }, said('body'), said('Line.'))])
  const link: AdfMark = { attrs: { href: 'https://example.com' }, type: 'link' }
  assert.deepEqual(read('> [!faq]- Why?\n> See [the docs](https://example.com), **now**.\n'), [
    node('expand', { title: 'Why?' }, paragraph(text('See '), text('the docs', link), text(', '), text('now', strong), text('.'))),
  ])
  assert.deepEqual(read('> [!NOTE]- Two\\\n> lines\n'), [node('expand', { title: 'Two' }, said('lines'))])
  assert.deepEqual(read('> [!faq]- See [x](http://y)\n'), [node('expand', { title: 'See x (http://y)' }, paragraph())])
  assert.deepEqual(read('> [!faq]- [a **b**](u "t")[c](u) and [d](v)\n'), [node('expand', { title: 'a bc (u) and d (v)' }, paragraph())])
  assert.deepEqual(read('> [!faq]- <http://y> or <a@b.c> or <http://a\\b>\n'), [node('expand', { title: 'http://y or a@b.c or http://a\\b' }, paragraph())])
  assert.deepEqual(read('> [!faq]- [a&#10;b](u)\n'), [node('expand', { title: 'a\nb (u)' }, paragraph())])
  assert.deepEqual(read('> [!faq]- !adf:status[x]{color=red} ~~y~~\n'), [node('expand', { title: '!adf:status[x]{color=red} y' }, paragraph())])
  assert.deepEqual(read('> [!NOTE]- Set ==x== here\n'), [node('expand', { title: 'Set x here' }, paragraph())])
  assert.deepEqual(read('> [!NOTE]-\n>\n> Line.\n'), [bare('expand', said('Line.'))])
})

test('reads a folded callout inside an expand to a nested expand', () => {
  const markdown = '> [!NOTE]- Outer\n>\n> > [!NOTE]- Inner\n> >\n> > Deep.\n>\n> > [!TIP]\n> >\n> > > [!NOTE]-\n'
  assert.deepEqual(read(markdown), [node('expand', { title: 'Outer' }, node('nestedExpand', { title: 'Inner' }, said('Deep.')), panel('tip', bare('nestedExpand', paragraph())))])
  assert.deepEqual(read('- > [!NOTE]-\n'), [bare('bulletList', bare('listItem', bare('expand', paragraph())))])
})

test('reads a bullet list whose every item leads with a task marker to a task list', () => {
  assert.deepEqual(read('- [x] Write the spec\n- [ ] Ship **it**\n- [X] Tell\n'), [
    bare('taskList', task('DONE', text('Write the spec')), task('TODO', text('Ship '), text('it', strong)), task('DONE', text('Tell'))),
  ])
  assert.deepEqual(read('- [x]\n- [ ]\\\n  after\n'), [bare('taskList', task('DONE'), task('TODO', text('after')))])
  const minted = portableMarkdownToAdf('- [x] Parent\n  - [ ] Child\n')
  assert.deepEqual(minted.ok ? minted.value.content : minted.error.code, [
    node(
      'taskList',
      { localId: '51470556-7c91-46cb-b140-16e225a9b1f2' },
      node('taskItem', { localId: 'e04cbd87-eb04-4737-ae72-6d56d7799874', state: 'DONE' }, text('Parent')),
      node('taskList', { localId: '9ab33f3f-8c58-428f-b4eb-343a32a177d6' }, node('taskItem', { localId: 'b16a2f09-9543-499b-8a97-b88fc342b918', state: 'TODO' }, text('Child'))),
    ),
  ])
})

test('moves a nested task list beside its item and makes an item holding more than one paragraph a block task item', () => {
  assert.deepEqual(read('- [x] Parent\n  - [ ] Child\n- [ ] Next\n'), [bare('taskList', task('DONE', text('Parent')), bare('taskList', task('TODO', text('Child'))), task('TODO', text('Next')))])
  assert.deepEqual(read('- [x] First.\n\n  Second.\n- [ ] Next\n'), [bare('taskList', node('blockTaskItem', { state: 'DONE' }, said('First.'), said('Second.')), task('TODO', text('Next')))])
  const nested = bare('taskList', node('blockTaskItem', { state: 'DONE' }, said('p1'), said('p2')), bare('taskList', task('TODO', text('n'))), task('TODO', text('B')))
  assert.deepEqual(read('- [x] p1\n\n  p2\n  - [ ] n\n- [ ] B\n'), [nested])
  assert.deepEqual(roundTripped(nested), [nested])
})

test('stands a block a task item cannot hold, and what follows it in the item, after the task list, which resumes at the next task', () => {
  assert.deepEqual(read('- [x] Deploy\n\n  ![a](u)\n- [ ] Tell\n'), [
    bare('taskList', task('DONE', text('Deploy'))),
    node('mediaSingle', { layout: 'center' }, { attrs: { alt: 'a', type: 'external', url: 'u' }, type: 'media' }),
    bare('taskList', task('TODO', text('Tell'))),
  ])
  assert.deepEqual(read('- [x] First.\n\n  Second.\n\n  > q\n\n  Third.\n- [ ]\n\n  ```\n  x\n  ```\n'), [
    bare('taskList', node('blockTaskItem', { state: 'DONE' }, said('First.'), said('Second.'))),
    bare('blockquote', said('q')),
    said('Third.'),
    bare('taskList', task('TODO')),
    bare('codeBlock', text('x')),
  ])
  assert.deepEqual(read('- [x] A\n  - plain\n- [ ] B\n'), [bare('taskList', task('DONE', text('A'))), bare('bulletList', bare('listItem', said('plain'))), bare('taskList', task('TODO', text('B')))])
  assert.deepEqual(read('- [ ] A\n  - [ ] Child\n\n  # h\n- [ ] B\n'), [
    bare('taskList', task('TODO', text('A')), bare('taskList', task('TODO', text('Child')))),
    node('heading', { level: 1 }, text('h')),
    bare('taskList', task('TODO', text('B'))),
  ])
  assert.deepEqual(read('- [ ] A\n\n  # h\n  - [ ] Child\n- [ ] B\n'), [
    bare('taskList', task('TODO', text('A'))),
    node('heading', { level: 1 }, text('h')),
    bare('taskList', task('TODO', text('Child'))),
    bare('taskList', task('TODO', text('B'))),
  ])
})

test('reads a task list beside a list of another bullet character as two lists', () => {
  const tasks = (state: string, value: string): AdfNode => bare('taskList', node('taskItem', { state }, text(value)))
  assert.deepEqual(read('- [x] a\n* b\n'), [tasks('DONE', 'a'), bare('bulletList', bare('listItem', bare('paragraph', text('b'))))])
  assert.deepEqual(read('- [x] a\n* [ ] b\n'), [tasks('DONE', 'a'), tasks('TODO', 'b')])
})

test('leaves mixed, ordered and unmarked lists plain', () => {
  for (const markdown of ['- \\[x] a\n', '- [x] a\n- \\[ ] b\n', '- [x] a\n- b\n', '1. [x] a\n', '- [x]a\n', '- **[x]** a\n', '- [x]**a**\n', '- [-] a\n', '- > [x] a\n']) {
    const blocks = read(markdown)
    assert.notEqual(typeof blocks !== 'string' && blocks[0]?.type, 'taskList', markdown)
    assert.equal(JSON.stringify(blocks).includes('taskItem'), false, markdown)
  }
  assert.deepEqual(read('- plain\n  - [ ] nested\n'), [bare('bulletList', bare('listItem', said('plain'), bare('taskList', task('TODO', text('nested')))))])
})

test('reads a == pair to the editor default highlight, Yellow200 #f8e6a0 in @atlaskit/adf-schema 57.6.8', () => {
  assert.deepEqual(read('a ==hi there== b\n'), [paragraph(text('a '), text('hi there', highlight), text(' b'))])
  assert.deepEqual(read('**==hi==** b\n'), [paragraph(text('hi', highlight, strong), text(' b'))])
  assert.deepEqual(read('==**a**_b_ `c`==\n'), [paragraph(text('a', highlight, strong), text('b', highlight, em), text(' ', highlight), text('c', code))])
  assert.deepEqual(read('==`a`==\n'), [paragraph(text('a', code))])
  assert.deepEqual(read('x==y==z ==a == b==, (==c==) _d_==e==\n'), [paragraph(text('x==y==z '), text('a == b', highlight), text(', ('), text('c', highlight), text(') '), text('d', em), text('e', highlight))])
  assert.deepEqual(read('😀==b== ==c==😀 é==d==\n'), [paragraph(text('😀'), text('b', highlight), text(' '), text('c', highlight), text('😀 é==d=='))])
  assert.deepEqual(read('この機能は==日本語==でのみ、中文==重点==内容、ภาษา==ไทย==ดี 𠀀==𠀁==𠀂 이 기능은 ==한국어==에서만 サーバー==停止==中 このiPhone==専用==アプリ\n'), [
    paragraph(
      text('この機能は'), text('日本語', highlight), text('でのみ、中文'), text('重点', highlight), text('内容、ภาษา'), text('ไทย', highlight), text('ดี 𠀀'), text('𠀁', highlight),
      text('𠀂 이 기능은 '), text('한국어', highlight), text('에서만 サーバー'), text('停止', highlight), text('中 このiPhone'), text('専用', highlight), text('アプリ'),
    ),
  ])
  assert.deepEqual(read('# ==h==\n\n| ==c== |\n| --- |\n'), [
    node('heading', { level: 1 }, text('h', highlight)),
    bare('table', bare('tableRow', bare('tableHeader', paragraph(text('c', highlight))))),
  ])
  assert.deepEqual(read('> [!NOTE]\n> ==x==\n'), [panel('info', paragraph(text('x', highlight)))])
  assert.deepEqual(read('==a==\\\n==b==\n'), [paragraph(text('a', highlight), { type: 'hardBreak' }, text('b', highlight))])
})

test('leaves a == no pair flanks as text', () => {
  for (const markdown of ['\\==x==\n', '==x\\==\n', 'a == b == c\n', 'if a==b and c==d then\n', 'a==b== c\n', '==a==b\n', '====\n', '`==x==`\n', '==a\\\nb==\n', '**==a**==\n', '==a', '== a==\n', '==a ==\n']) {
    assert.equal(JSON.stringify(read(markdown)).includes('backgroundColor'), false, markdown)
  }
})

test('reads what the reduction wrote back to the node it reduced, less the attributes it drops', () => {
  const localId = '01a0d99b-1f59-7e2c-a3d4-62c1f0b8e7a1'
  for (const panelType of ['info', 'note', 'tip', 'warning', 'error']) {
    assert.deepEqual(roundTripped(node('panel', { localId, panelType }, said('Check.'))), [panel(panelType, said('Check.'))], panelType)
  }
  const expand = node('expand', { localId, title: 'Log' }, said('Line.'), node('nestedExpand', { title: 'Inner' }, said('Deep.')))
  assert.deepEqual(roundTripped(node('panel', { panelType: 'tip' }, paragraph()), node('expand', { title: 'Empty' }, paragraph())), [panel('tip', paragraph()), node('expand', { title: 'Empty' }, paragraph())])
  assert.deepEqual(roundTripped(expand), [node('expand', { title: 'Log' }, said('Line.'), node('nestedExpand', { title: 'Inner' }, said('Deep.')))])
  const tasks = bare(
    'taskList',
    node('taskItem', { localId, state: 'DONE' }, text('Write')),
    bare('taskList', task('TODO', text('Review'))),
    node('blockTaskItem', { state: 'TODO' }, said('First.'), said('Second.')),
    node('blockTaskItem', { state: 'DONE' }, bare('codeBlock', text('x'))),
  )
  const plainTasks = bare(
    'taskList',
    task('DONE', text('Write')),
    bare('taskList', task('TODO', text('Review'))),
    node('blockTaskItem', { state: 'TODO' }, said('First.'), said('Second.')),
    task('DONE'),
  )
  assert.deepEqual(roundTripped(tasks), [plainTasks, bare('codeBlock', text('x'))])
  const colour: AdfMark = { attrs: { color: '#c6edfb' }, type: 'backgroundColor' }
  assert.deepEqual(roundTripped(paragraph(text('a '), text('hi', colour, strong), text(' b'))), [paragraph(text('a '), text('hi', highlight, strong), text(' b'))])
  assert.deepEqual(roundTripped(paragraph(text('=', colour), text(' '), text('a==b', colour))), [paragraph(text('=', highlight), text(' '), text('a==b', highlight))])
  assert.deepEqual(roundTripped(paragraph(text('x'), text('y', colour))), [said('xy')])
  assert.deepEqual(roundTripped(node('expand', { title: '**x** [y](z)' }, said('b'))), [node('expand', { title: '**x** [y](z)' }, said('b'))])
})

test('reads text the writer kept from reading as a marker back as text', () => {
  const quote = bare('blockquote', said('[!NOTE] x'))
  const list = bare('bulletList', bare('listItem', said('[x] a')), bare('listItem', said('[ ] b')))
  assert.deepEqual(roundTripped(said('==x== a==b 日==本==語'), quote, list), [said('==x== a==b 日==本==語'), quote, list])
  assert.deepEqual(roundTripped(bare('taskList', task('DONE', text('[x] ==a==')))), [bare('taskList', task('DONE', text('[x] ==a==')))])
})

test('reads what CommonMark reads where no row reads, a directive and a carry fence among it, an image sharing its paragraph with a marker among it', () => {
  assert.deepEqual(read('!adf:panel\n'), [said('!adf:panel')])
  assert.deepEqual(read('a !adf:carry{json="{}"} \\!adf:x\n'), [said('a !adf:carry{json="{}"} !adf:x')])
  assert.deepEqual(read('```adf:blockCard\n{}\n```\n'), [node('codeBlock', { language: 'adf:blockCard' }, text('{}'))])
  const linked = paragraph(text('a', { attrs: { href: 'u' }, type: 'link' }))
  const image = node('mediaSingle', { layout: 'center' }, { attrs: { alt: 'a', type: 'external', url: 'u' }, type: 'media' })
  assert.deepEqual(read('> [!tip] ![a](u)\n'), [panel('tip', image)])
  assert.deepEqual(read('> [!tip]\n> ![a](u)\n'), [panel('tip', image)])
  assert.deepEqual(read('> [!tip]\n>\n> ![a](u)\n'), [panel('tip', image)])
  assert.deepEqual(read('> [!tip]\n> ![a](u) b\n'), [panel('tip', paragraph(...(linked.content ?? []), text(' b')))])
  assert.deepEqual(read('> [!NOTE]- t\n> ![a](u)\n'), [node('expand', { title: 't' }, image)])
  assert.deepEqual(read('> [!NOTE]- ![a](u)\n'), [node('expand', { title: 'a (u)' }, paragraph())])
  assert.deepEqual(read('- [x] ![a](u)\n'), [bare('taskList', task('DONE', ...(linked.content ?? [])))])
  assert.deepEqual(read('- [x]\n  ![a](u)\n'), [bare('taskList', task('DONE', ...(linked.content ?? [])))])
  let deep = 'x\n'
  for (let level = 0; level < largestNesting; level += 1) deep = `> ${deep}`
  assert.equal(typeof read(deep), 'object')
})

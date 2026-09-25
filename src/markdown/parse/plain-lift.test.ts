import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import { adfToMarkdown } from '../emit/adf-to-markdown.ts'
import { largestNesting } from '../../nesting.ts'
import { liftFromPlain } from './plain-lift.ts'
import { markdownToAdf } from './markdown-to-adf.ts'
import { reduceToPlain } from '../emit/plain-reduction.ts'
import { toEditorNormal } from '../../adf/editor-normal.ts'

const code: AdfMark = { type: 'code' }
const em: AdfMark = { type: 'em' }
const highlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }
const strong: AdfMark = { type: 'strong' }

function lifted(markdown: string): readonly AdfNode[] | string {
  const parsed = markdownToAdf(markdown)
  return parsed.ok ? (toEditorNormal(liftFromPlain(parsed.value)).content ?? []) : parsed.error.code
}

function normal(...blocks: AdfNode[]): readonly AdfNode[] {
  return toEditorNormal(document(...blocks)).content ?? []
}

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

// ADF the reduction wrote, spelled and read back through the lift.
function roundTripped(...content: AdfNode[]): readonly AdfNode[] | string {
  const reduced = reduceToPlain(document(...content))
  const markdown = reduced.ok ? adfToMarkdown(reduced.value) : reduced
  return markdown.ok ? lifted(markdown.value) : markdown.error.code
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
  return bare('paragraph', ...content)
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

test('lifts an alert to a panel by its GitHub word, in any case', () => {
  const alert = (word: string): readonly AdfNode[] | string => lifted(`> [!${word}]\n>\n> Check it.\n`)
  assert.deepEqual(alert('NOTE'), [panel('info', said('Check it.'))])
  assert.deepEqual(alert('IMPORTANT'), [panel('note', said('Check it.'))])
  assert.deepEqual(alert('TIP'), [panel('tip', said('Check it.'))])
  assert.deepEqual(alert('WARNING'), [panel('warning', said('Check it.'))])
  assert.deepEqual(alert('CAUTION'), [panel('error', said('Check it.'))])
  assert.deepEqual(alert('Warning'), [panel('warning', said('Check it.'))])
  assert.deepEqual(alert('caution'), [panel('error', said('Check it.'))])
})

test('lifts an Obsidian callout to a panel by what its word means, any other word info', () => {
  const alert = (word: string): unknown => {
    const blocks = lifted(`> [!${word}]\n> Body.\n`)
    return typeof blocks === 'string' ? blocks : blocks[0]?.attrs
  }
  assert.deepEqual(alert('hint'), { panelType: 'tip' })
  for (const word of ['success', 'check', 'Done']) assert.deepEqual(alert(word), { panelType: 'success' }, word)
  assert.deepEqual(alert('attention'), { panelType: 'warning' })
  for (const word of ['danger', 'error', 'failure', 'fail', 'missing', 'BUG']) assert.deepEqual(alert(word), { panelType: 'error' }, word)
  for (const word of ['info', 'note', 'question', 'my-type']) assert.deepEqual(alert(word), { panelType: 'info' }, word)
})

test('reads text after an alert marker in its paragraph as the panel first body paragraph', () => {
  assert.deepEqual(lifted('> [!NOTE]\n> Line **one**.\n>\n> Two.\n'), [panel('info', paragraph(text('Line '), text('one', strong), text('.')), said('Two.'))])
  assert.deepEqual(lifted('> [!tip] Title\n'), [panel('tip', said('Title'))])
  assert.deepEqual(lifted('> [!NOTE]\\\n> Broken.\n'), [panel('info', said('Broken.'))])
  assert.deepEqual(lifted('> [!NOTE]\n'), normal(panel('info', paragraph())))
  assert.deepEqual(lifted('> > [!WARNING]\n> > Inner.\n'), [bare('blockquote', panel('warning', said('Inner.')))])
})

test('leaves a quote plain where its first line is no alert marker', () => {
  for (const markdown of ['> [!NOTE]x\n', '> **[!NOTE]**\n', '> See [!NOTE]\n', '> [!NOTE]**x**\n', '> [!]\n', '> ```\n> [!NOTE]\n> ```\n']) {
    const blocks = lifted(markdown)
    assert.equal(typeof blocks !== 'string' && blocks[0]?.type, 'blockquote', markdown)
  }
})

test('lifts a folded callout to an expand titled by the rest of its marker paragraph, whatever the word', () => {
  assert.deepEqual(lifted('> [!NOTE]- Build log\n>\n> Line.\n'), [node('expand', { title: 'Build log' }, said('Line.'))])
  assert.deepEqual(lifted('> [!bug]+ Open **by** default\n> still title\n>\n> Line.\n'), [node('expand', { title: 'Open by default still title' }, said('Line.'))])
  assert.deepEqual(lifted('> [!NOTE]- Two\\\n> lines\n'), normal(node('expand', { title: 'Two\nlines' }, paragraph())))
  assert.deepEqual(lifted('> [!NOTE]-\n>\n> Line.\n'), [bare('expand', said('Line.'))])
})

test('lifts a folded callout inside an expand to a nested expand', () => {
  const markdown = '> [!NOTE]- Outer\n>\n> > [!NOTE]- Inner\n> >\n> > Deep.\n>\n> > [!TIP]\n> >\n> > > [!NOTE]-\n'
  assert.deepEqual(lifted(markdown), normal(node('expand', { title: 'Outer' }, node('nestedExpand', { title: 'Inner' }, said('Deep.')), panel('tip', bare('nestedExpand', paragraph())))))
  assert.deepEqual(lifted('- > [!NOTE]-\n'), normal(bare('bulletList', bare('listItem', bare('expand', paragraph())))))
})

test('lifts a bullet list whose every item leads with a task marker to a task list', () => {
  assert.deepEqual(lifted('- [x] Write the spec\n- [ ] Ship **it**\n- [X] Tell\n'), [
    bare('taskList', task('DONE', text('Write the spec')), task('TODO', text('Ship '), text('it', strong)), task('DONE', text('Tell'))),
  ])
  assert.deepEqual(lifted('- [x]\n- [ ]\\\n  after\n'), normal(bare('taskList', task('DONE'), task('TODO', text('after')))))
})

test('moves a nested task list beside its item and makes an item holding more than one block a block task item', () => {
  assert.deepEqual(lifted('- [x] Parent\n  - [ ] Child\n- [ ] Next\n'), [bare('taskList', task('DONE', text('Parent')), bare('taskList', task('TODO', text('Child'))), task('TODO', text('Next')))])
  assert.deepEqual(lifted('- [x] First.\n\n  Second.\n- [ ]\n\n  ```\n  x\n  ```\n'), [
    bare('taskList', node('blockTaskItem', { state: 'DONE' }, said('First.'), said('Second.')), node('blockTaskItem', { state: 'TODO' }, bare('codeBlock', text('x')))),
  ])
  assert.deepEqual(lifted('- [x] A\n  - plain\n'), [bare('taskList', node('blockTaskItem', { state: 'DONE' }, said('A'), bare('bulletList', bare('listItem', said('plain')))))])
})

test('leaves mixed, ordered and unmarked lists plain', () => {
  for (const markdown of ['- [x] a\n- b\n', '1. [x] a\n', '- [x]a\n', '- **[x]** a\n', '- [x]**a**\n', '- [-] a\n', '- > [x] a\n']) {
    const blocks = lifted(markdown)
    assert.notEqual(typeof blocks !== 'string' && blocks[0]?.type, 'taskList', markdown)
    assert.equal(JSON.stringify(blocks).includes('taskItem'), false, markdown)
  }
  assert.deepEqual(lifted('- plain\n  - [ ] nested\n'), [bare('bulletList', bare('listItem', said('plain'), bare('taskList', task('TODO', text('nested')))))])
})

test('lifts a == pair to the editor default highlight, Yellow200 #f8e6a0 in @atlaskit/adf-schema 57.6.8', () => {
  assert.deepEqual(lifted('a ==hi there== b\n'), [paragraph(text('a '), text('hi there', highlight), text(' b'))])
  assert.deepEqual(lifted('**==hi==** b\n'), [paragraph(text('hi', highlight, strong), text(' b'))])
  assert.deepEqual(lifted('==**a**_b_ `c`==\n'), [paragraph(text('a', highlight, strong), text('b', highlight, em), text(' ', highlight), text('c', code))])
  assert.deepEqual(lifted('==`a`==\n'), [paragraph(text('a', code))])
  assert.deepEqual(lifted('x==y==z ==a == b==, (==c==) _d_==e==\n'), [paragraph(text('x==y==z '), text('a == b', highlight), text(', ('), text('c', highlight), text(') '), text('d', em), text('e', highlight))])
  assert.deepEqual(lifted('😀==b== ==c==😀 é==d==\n'), [paragraph(text('😀'), text('b', highlight), text(' '), text('c', highlight), text('😀 é==d=='))])
  assert.deepEqual(lifted('# ==h==\n\n| ==c== |\n| --- |\n'), [
    node('heading', { level: 1 }, text('h', highlight)),
    bare('table', bare('tableRow', bare('tableHeader', paragraph(text('c', highlight))))),
  ])
  assert.deepEqual(lifted('> [!NOTE]\n> ==x==\n'), [panel('info', paragraph(text('x', highlight)))])
  assert.deepEqual(lifted('==a==\\\n==b==\n'), [paragraph(text('a', highlight), { type: 'hardBreak' }, text('b', highlight))])
})

test('leaves a == no pair flanks as text', () => {
  for (const markdown of ['a == b == c\n', 'if a==b and c==d then\n', 'a==b== c\n', '==a==b\n', '====\n', '`==x==`\n', '==a\\\nb==\n', '**==a**==\n', '==a', '== a==\n', '==a ==\n']) {
    assert.equal(JSON.stringify(lifted(markdown)).includes('backgroundColor'), false, markdown)
  }
})

test('lifts what the reduction wrote back to the node it reduced, less the attributes it drops', () => {
  const localId = '01a0d99b-1f59-7e2c-a3d4-62c1f0b8e7a1'
  for (const panelType of ['info', 'note', 'tip', 'warning', 'error']) {
    assert.deepEqual(roundTripped(node('panel', { localId, panelType }, said('Check.'))), [panel(panelType, said('Check.'))], panelType)
  }
  const expand = node('expand', { localId, title: 'Log' }, said('Line.'), node('nestedExpand', { title: 'Inner' }, said('Deep.')))
  assert.deepEqual(roundTripped(node('panel', { panelType: 'tip' }, paragraph()), node('expand', { title: 'Empty' }, paragraph())), normal(panel('tip', paragraph()), node('expand', { title: 'Empty' }, paragraph())))
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
    node('blockTaskItem', { state: 'DONE' }, bare('codeBlock', text('x'))),
  )
  assert.deepEqual(roundTripped(tasks), [plainTasks])
  const colour: AdfMark = { attrs: { color: '#c6edfb' }, type: 'backgroundColor' }
  assert.deepEqual(roundTripped(paragraph(text('a '), text('hi', colour, strong), text(' b'))), [paragraph(text('a '), text('hi', highlight, strong), text(' b'))])
})

test('keeps what markdownToAdf reads that no row lifts, and refuses only what it refuses', () => {
  assert.deepEqual(lifted('!adf:panel warning\n- [x] a\n!adf:/panel\n'), [panel('warning', bare('taskList', task('DONE', text('a'))))])
  const future = bare('futureBlock', text('==x=='))
  const carried = adfToMarkdown(document(future))
  assert.deepEqual(carried.ok ? lifted(carried.value) : carried.error.code, [future])
  const red: AdfMark = { attrs: { color: '#ff0000' }, type: 'backgroundColor' }
  const held = paragraph(text('a ==b== c', red), text(' ==d '), { attrs: { note: 'x' }, text: 'e==f', type: 'text' }, text(' g=='))
  const spelled = adfToMarkdown(document(held))
  assert.deepEqual(spelled.ok ? lifted(spelled.value) : spelled.error.code, [paragraph(text('a ==b== c', red), text(' '), text('d ', highlight), { attrs: { note: 'x' }, text: 'e==f', type: 'text' }, text(' g', highlight))])
  assert.equal(lifted('!adf:panel\n'), 'malformed-directive')
  let deep = 'x\n'
  for (let level = 0; level < largestNesting; level += 1) deep = `> ${deep}`
  assert.equal(typeof lifted(deep), 'object')
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../adf/document.ts'
import type { Result } from '../result.ts'
import { adfToHtml, adfToPlainText } from '../index.ts'
import { largestNesting } from '../nesting.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function plain(result: Result<string>): string {
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

function item(...content: AdfNode[]): AdfNode {
  return { content, type: 'listItem' }
}

function bullets(...items: AdfNode[]): AdfNode {
  return { content: items, type: 'bulletList' }
}

function numbers(...items: AdfNode[]): AdfNode {
  return { content: items, type: 'orderedList' }
}

function line(value: string): AdfNode {
  return paragraph(text(value))
}

test('writes blocks as their text, a blank line apart, with bullets, numbers and nesting indented', () => {
  const mention: AdfNode = { attrs: { id: '557058:ann', text: '@Ann Lee' }, type: 'mention' }
  const written = adfToPlainText(
    document(
      { attrs: { level: 2 }, content: [text('Release notes')], type: 'heading' },
      line('Ship on Friday.'),
      paragraph(text('Ask '), mention, text(' first.'), { type: 'hardBreak' }, text('Then ship.')),
      bullets(item(line('Fix login')), item(line('Fix export'), bullets(item(line('CSV')), item(line('JSON')))), item(line('Docs'))),
      numbers(item(line('Build')), item(line('Test')), item(line('Ship'))),
      { content: [line('Measure twice.')], type: 'blockquote' },
      { content: [text('npm test')], type: 'codeBlock' },
      line('Done.'),
    ),
  )
  assert.equal(
    plain(written),
    [
      'Release notes',
      '',
      'Ship on Friday.',
      '',
      'Ask @Ann Lee first.',
      'Then ship.',
      '',
      '• Fix login',
      '• Fix export',
      '  • CSV',
      '  • JSON',
      '• Docs',
      '',
      '1. Build',
      '2. Test',
      '3. Ship',
      '',
      'Measure twice.',
      '',
      'npm test',
      '',
      'Done.',
    ].join('\n'),
  )
})

test('writes marks other than a link as the text they mark', () => {
  assert.equal(plain(adfToPlainText(document(paragraph(text('a ', { type: 'strong' }), text('b', { type: 'em' }), text(' c', { type: 'code' }))))), 'a b c')
})

test('writes an empty document as nothing', () => {
  assert.equal(plain(adfToPlainText(document())), '')
  assert.equal(plain(adfToPlainText({ type: 'doc', version: 1 })), '')
})

test('writes a link\'s address and title after the text it covers, once for a run of text nodes', () => {
  const link = (href: string, title?: string): AdfMark => ({ attrs: title === undefined ? { href } : { href, title }, type: 'link' })
  const written = adfToPlainText(
    document(
      paragraph(text('Read the '), text('do', link('https://example.com/docs', 'Guide')), text('cs', link('https://example.com/docs', 'Guide'), { type: 'strong' }), text(' and the '), text('changelog', link('https://example.com/changes')), text('.')),
      paragraph(text('https://example.com/', link('https://example.com/'))),
      paragraph(text('a', link('https://one.example/')), text('b', link('https://two.example/'))),
    ),
  )
  assert.equal(plain(written), 'Read the docs (https://example.com/docs, "Guide") and the changelog (https://example.com/changes).\n\nhttps://example.com/\n\na (https://one.example/)b (https://two.example/)')
})

test('writes no address after a link whose text, over several text nodes, is its address', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(plain(adfToPlainText(document(paragraph(text('https://exa', link), text('mple.com/', link))))), 'https://example.com/')
})

test('writes an address after each of two links to one address with different titles', () => {
  const link = (title: string): AdfMark => ({ attrs: { href: 'https://example.com/', title }, type: 'link' })
  assert.equal(plain(adfToPlainText(document(paragraph(text('a', link('x')), text('b', link('y')))))), 'a (https://example.com/, "x")b (https://example.com/, "y")')
})

test('finds a link among the other marks of a text node', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(plain(adfToPlainText(document(paragraph(text('a', { type: 'strong' }, link))))), 'a (https://example.com/)')
})

test('writes no address after a node that is no text node, whatever marks it holds', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(plain(adfToPlainText(document(paragraph({ marks: [link], text: 'a', type: 'unknownInline' })))), 'a')
})

test('writes a link with a title after its address even where the text is the address', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/', title: 'Home' }, type: 'link' }
  assert.equal(plain(adfToPlainText(document(paragraph(text('https://example.com/', link))))), 'https://example.com/ (https://example.com/, "Home")')
})

test('writes a link whose text is empty as nothing, and a link mark with no address as its text', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  assert.equal(plain(adfToPlainText(document(paragraph(text('a'), text('', link), text('b'))))), 'ab')
  assert.equal(plain(adfToPlainText(document(paragraph(text('a', { attrs: { title: 'x' }, type: 'link' }))))), 'a')
})

test('writes nothing for a block holding no text, and parts the blocks around it once', () => {
  assert.equal(plain(adfToPlainText(document(paragraph(), line('a'), { type: 'rule' }, paragraph(), line('b'), bullets(item())))), 'a\n\nb')
})

test('writes a text node holding nothing as nothing', () => {
  assert.equal(plain(adfToPlainText(document(line('a'), paragraph(text('')), line('b')))), 'a\n\nb')
})

test('writes the text nodes of an item\'s paragraph on one line', () => {
  assert.equal(plain(adfToPlainText(document(bullets(item(paragraph(text('a'), text('b'))))))), '• ab')
})

test('writes the items of a list a line feed apart, whatever blocks they hold', () => {
  assert.equal(plain(adfToPlainText(document(bullets(item(line('a')), item({ content: [line('b')], type: 'blockquote' }))))), '• a\n• b')
})

test('writes the blocks of one item a line feed apart, under its marker', () => {
  assert.equal(plain(adfToPlainText(document(bullets(item(bullets(item(line('x'))), line('z')))))), '• • x\n  z')
})

test('writes an item holding an empty list before its text as that text', () => {
  assert.equal(plain(adfToPlainText(document(bullets(item(bullets(item()), line('x')))))), '• x')
})

test('writes the nodes of an unknown inline container on one line', () => {
  const inline: AdfNode = paragraph({ text: 'a', type: 'unknownInline' }, { text: 'b', type: 'unknownInline' })
  assert.equal(plain(adfToPlainText(document(inline))), 'ab')
})

test('numbers an ordered list from its first number, and widens the indent to the marker', () => {
  const list: AdfNode = { attrs: { order: 9 }, content: [item(line('nine'), paragraph(text('a'), { type: 'hardBreak' }), line('b')), item(line('ten'), bullets(item(line('x'))))], type: 'orderedList' }
  assert.equal(plain(adfToPlainText(document(list))), '9. nine\n   a\n   b\n10. ten\n    • x')
  assert.equal(plain(adfToPlainText(document({ attrs: { order: 1.5 }, content: [item(line('a'))], type: 'orderedList' }))), '1. a')
})

test('keeps a marker for an item whose first content is a nested list', () => {
  assert.equal(plain(adfToPlainText(document(bullets(item(bullets(item(line('x')))), item(line('y')))))), '• • x\n• y')
})

test('writes a task list nested in a task list under its parent item, with no marker of its own', () => {
  const task = (value: string): AdfNode => ({ attrs: { state: 'TODO' }, content: [text(value)], type: 'taskItem' })
  const nested: AdfNode = { content: [task('a'), { content: [task('b')], type: 'taskList' }], type: 'taskList' }
  assert.equal(plain(adfToPlainText(document(nested))), '☐ a\n  ☐ b')
})

test('writes two hard breaks in a row as a blank line', () => {
  assert.equal(plain(adfToPlainText(document(paragraph(text('a'), { type: 'hardBreak' }, { type: 'hardBreak' }, text('b'))))), 'a\n\nb')
})

test('keeps the larger of the line feeds a text ends in and the ones owed before it', () => {
  assert.equal(plain(adfToPlainText(document(paragraph(text('a'), { type: 'hardBreak' }, text('\n\n'), text('b'))))), 'a\n\nb')
})

test('writes a block that is no item in an ordered list under the item before it', () => {
  assert.equal(plain(adfToPlainText(document(numbers(item(line('a')), bullets(item(line('b'))))))), '1. a\n   • b')
})

test('writes a code block ending in a line feed as one block, a blank line from the next', () => {
  assert.equal(plain(adfToPlainText(document({ content: [text('a\n')], type: 'codeBlock' }, line('b')))), 'a\n\nb')
})

test('writes a task item holding blocks as an item', () => {
  const tasks: AdfNode = { content: [{ attrs: { localId: 'a', state: 'TODO' }, content: [line('a'), line('b')], type: 'blockTaskItem' }], type: 'taskList' }
  assert.equal(plain(adfToPlainText(document(tasks))), '☐ a\n  b')
})

test('writes a task list with a box checked for a done item, and a decision list as bullets', () => {
  const tasks: AdfNode = { content: [{ attrs: { state: 'DONE' }, content: [text('Write the spec')], type: 'taskItem' }, { attrs: { state: 'TODO' }, content: [text('Ship')], type: 'taskItem' }], type: 'taskList' }
  const decisions: AdfNode = { content: [{ attrs: { state: 'DECIDED' }, content: [text('Use Node')], type: 'decisionItem' }], type: 'decisionList' }
  assert.equal(plain(adfToPlainText(document(tasks, decisions))), '☑ Write the spec\n☐ Ship\n\n• Use Node')
})

test('writes a mention, an emoji, a date and a status as the text they show', () => {
  const nodes: AdfNode[] = [
    { attrs: { id: '557058:ann' }, type: 'mention' },
    { attrs: { shortName: ':smile:', text: '😄' }, type: 'emoji' },
    { attrs: { timestamp: '1756080000000' }, type: 'date' },
    { attrs: { color: 'green', text: 'Done' }, type: 'status' },
  ]
  assert.equal(plain(adfToPlainText(document(paragraph(...nodes.flatMap((node) => [node, text(' ')]))))), '@557058:ann 😄 2025-08-25 Done ')
})

test('writes a table\'s cells as blocks, until a table has its own spelling', () => {
  const cell = (value: string): AdfNode => ({ content: [line(value)], type: 'tableCell' })
  const table: AdfNode = { content: [{ content: [cell('a'), cell('b')], type: 'tableRow' }, { content: [cell('c'), cell('d')], type: 'tableRow' }], type: 'table' }
  assert.equal(plain(adfToPlainText(document(table))), 'a\n\nb\n\nc\n\nd')
})

test('writes a node of an unknown type as the text it holds, its children a blank line apart', () => {
  const unknown: AdfNode = { content: [line('one'), { content: [text('two'), text(' three')], type: 'unknownBlock' }], type: 'unknownContainer' }
  assert.equal(plain(adfToPlainText(document(unknown, { text: 'loose', type: 'unknownText' }, paragraph({ content: [text('in'), text(' line')], type: 'unknownInline' })))), 'one\n\ntwo three\n\nloose\n\nin line')
})

test('writes a node of an unknown type holding text and blocks as blocks, and a mention with nothing to show as nothing', () => {
  assert.equal(plain(adfToPlainText(document({ content: [text('a'), line('b')], type: 'unknownContainer' }))), 'a\n\nb')
  assert.equal(plain(adfToPlainText(document(paragraph(text('a'), { type: 'mention' }, text('b'))))), 'ab')
  assert.equal(plain(adfToPlainText(document({ content: [text('a'), { attrs: { text: '😄' }, type: 'emoji' }, text('b')], type: 'unknownContainer' }))), 'a😄b')
})

test('writes a code block\'s lines and a list item\'s continuation lines under their indent, never a blank line with spaces', () => {
  const code: AdfNode = { content: [text('a\n\nb')], type: 'codeBlock' }
  assert.equal(plain(adfToPlainText(document(bullets(item(code))))), '• a\n\n  b')
})

function deepQuote(levels: number): AdfNode {
  let node = line('x')
  for (let level = 0; level < levels; level += 1) node = { content: [node], type: 'blockquote' }
  return node
}

const refusedDocuments: Record<string, AdfDocument> = {
  'a document version that is no number': { type: 'doc', version: Number.NaN },
  'a document version 2': { type: 'doc', version: 2 },
  'nesting past the limit': document(deepQuote(largestNesting + 1)),
  'nesting past the limit after a block': document(line('a'), deepQuote(largestNesting + 1)),
  'a card with a link mark': document(paragraph(text('See '), { attrs: { url: 'https://example.com/' }, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'inlineCard' })),
}

for (const [name, input] of Object.entries(refusedDocuments)) {
  test(`refuses ${name} as adfToHtml does, with the same code and path`, () => {
    assert.notEqual(refusal(adfToHtml(input)), 'written')
    assert.equal(refusal(adfToPlainText(input)), refusal(adfToHtml(input)))
  })
}

for (const cell of ['tableCell', 'tableHeader']) {
  const table = (levels: number): AdfDocument => document({ content: [{ content: [{ content: [deepQuote(levels)], type: cell }], type: 'tableRow' }], type: 'table' })
  for (let levels = largestNesting - 3; levels <= largestNesting + 1; levels += 1) {
    test(`counts the levels of a ${cell} holding ${levels} levels as adfToHtml does`, () => {
      assert.equal(refusal(adfToPlainText(table(levels))), refusal(adfToHtml(table(levels))))
    })
  }
  test(`writes a ${cell} just inside the limit and refuses one past it`, () => {
    assert.equal(refusal(adfToPlainText(table(largestNesting - 3))), 'written')
    assert.equal(refusal(adfToPlainText(table(largestNesting + 1))).startsWith('unsupported-nesting-depth'), true)
  })
}

test('writes blocks nested 500 levels', () => {
  let node = line('x')
  for (let level = 0; level < largestNesting; level += 1) node = { content: [node], type: 'blockquote' }
  assert.equal(plain(adfToPlainText(document(node))), 'x')
  let list = line('x')
  for (let level = 0; level < largestNesting; level += 1) list = bullets(item(list))
  assert.equal(plain(adfToPlainText(document(list))), `${'• '.repeat(largestNesting)}x`)
  assert.equal(refusal(adfToPlainText(document(bullets(item(list))))), refusal(adfToHtml(document(bullets(item(list))))))
  assert.equal(refusal(adfToPlainText(document(bullets(item(list))))).startsWith('unsupported-nesting-depth at /content/0/content/0/content/0'), true)
})

test('refuses text past V8\'s longest string, which the indent of a deep list can add', () => {
  let list: AdfNode = { content: [text('a\n'.repeat(400000))], type: 'codeBlock' }
  for (let level = 0; level < 400; level += 1) list = bullets(item(list))
  let tooDeep: AdfNode = line('x')
  for (let level = 0; level <= largestNesting; level += 1) tooDeep = { content: [tooDeep], type: 'blockquote' }
  const refused = adfToPlainText(document(list, list, tooDeep))
  assert.equal(!refused.ok && refused.error.code, 'unsupported-node-shape')
  assert.equal(!refused.ok && refused.error.message.includes('536870888'), true)
})

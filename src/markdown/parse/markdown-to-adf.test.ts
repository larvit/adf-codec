import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { ParseError, Result, SourcePosition } from '../../result.ts'
import { largestNesting } from '../../nesting.ts'
import { markdownToAdf } from './markdown-to-adf.ts'

const em: AdfMark = { type: 'em' }
const strike: AdfMark = { type: 'strike' }
const strong: AdfMark = { type: 'strong' }
const underline: AdfMark = { type: 'underline' }

function code(result: Result<AdfDocument>): string {
  return result.ok ? `built ${JSON.stringify(result.value)}` : result.error.code
}

function content(result: Result<AdfDocument>): AdfNode[] | string {
  return result.ok ? (result.value.content ?? []) : `${result.error.code}: ${result.error.message}`
}

function path(result: Result<AdfDocument>): readonly (number | string)[] {
  return result.ok ? ['built'] : result.error.path
}

function position(result: Result<AdfDocument, ParseError>): SourcePosition | string {
  return result.ok ? 'built' : result.error.position
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

function cell(type: string, ...content: AdfNode[]): AdfNode {
  return { content: [content.length === 0 ? { type: 'paragraph' } : { content, type: 'paragraph' }], type }
}

function row(...cells: AdfNode[]): AdfNode {
  return { content: cells, type: 'tableRow' }
}

function table(...rows: AdfNode[]): AdfNode {
  return { content: rows, type: 'table' }
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

test('reads the codeBlock directive body as the node content, the info string its language', () => {
  const fenced = '!adf:codeBlock {wrap=true}\n```rust\nfn main() {}\n```\n!adf:/codeBlock\n'
  assert.deepEqual(content(markdownToAdf(fenced)), [
    { attrs: { language: 'rust', wrap: true }, content: [text('fn main() {}')], type: 'codeBlock' },
  ])
  assert.deepEqual(content(markdownToAdf('!adf:codeBlock {wrap=true}\n```\n```\n!adf:/codeBlock\n')), [{ attrs: { wrap: true }, type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('!adf:codeBlock {language=""}\n```\nx\n```\n!adf:/codeBlock\n')), [
    { attrs: { language: '' }, content: [text('x')], type: 'codeBlock' },
  ])
  assert.deepEqual(content(markdownToAdf('!adf:codeBlock {wrap=true}\n    fn()\n!adf:/codeBlock\n')), [
    { attrs: { wrap: true }, content: [text('fn()')], type: 'codeBlock' },
  ])
  // The body is a CommonMark fence, so its info string decodes escapes the way any other fence's does.
  assert.deepEqual(content(markdownToAdf('!adf:codeBlock {wrap=true}\n```\\#c\nx\n```\n!adf:/codeBlock\n')), [
    { attrs: { language: '#c', wrap: true }, content: [text('x')], type: 'codeBlock' },
  ])
})

test('names the slot a codeBlock spells its language outside of', () => {
  const slot = 'unsupported-node-shape: codeBlock spells its language in the fence info string, or in the attribute where no info string carries it back'
  assert.equal(content(markdownToAdf('!adf:codeBlock {language=rust wrap=true}\n```\nx\n```\n!adf:/codeBlock\n')), slot)
  assert.equal(content(markdownToAdf('!adf:codeBlock {language=rust}\n```sql\nx\n```\n!adf:/codeBlock\n')), slot)
  assert.equal(content(markdownToAdf('!adf:codeBlock {wrap=true}\n```carry\nx\n```\n!adf:/codeBlock\n')), slot)
  assert.equal(content(markdownToAdf('!adf:codeBlock {wrap=true}\n```a\\b\nx\n```\n!adf:/codeBlock\n')), slot)
})

test('reads a pipe table into the header row and the body rows under it', () => {
  const pipes = '| Part | Note |\n| --- | --- |\n| Nut \\| washer | `8.8` |\n| Spare |  |\n'
  assert.deepEqual(content(markdownToAdf(pipes)), [
    table(
      row(cell('tableHeader', text('Part')), cell('tableHeader', text('Note'))),
      row(cell('tableCell', text('Nut | washer')), cell('tableCell', codeSpan('8.8'))),
      row(cell('tableCell', text('Spare')), cell('tableCell')),
    ),
  ])
  assert.deepEqual(content(markdownToAdf('| Part\n| -\n')), [table(row(cell('tableHeader', text('Part'))))])
  assert.deepEqual(content(markdownToAdf('   | Part |\n   | --- |\n')), [table(row(cell('tableHeader', text('Part'))))])
})

test('claims the line a pipe opens and gives the rest back to the block walk', () => {
  const header = table(row(cell('tableHeader', text('a'))))
  assert.deepEqual(content(markdownToAdf('Part.\n| a |\n| --- |\n')), [paragraph('Part.'), header])
  assert.deepEqual(content(markdownToAdf('| a |\n| --- |\nPart.\n')), [header, paragraph('Part.')])
  assert.deepEqual(content(markdownToAdf('> | a |\n> | --- |\n')), [quote(header)])
  assert.deepEqual(content(markdownToAdf('- | a |\n  | --- |\n')), [bulletList(item(header))])
  assert.deepEqual(content(markdownToAdf('| a |\n| --- |\n    x\n')), [header, { content: [text('x')], type: 'codeBlock' }])
  assert.deepEqual(content(markdownToAdf('\\| a |\n')), [paragraph('| a |')])
})

test('names the pipe table a claimed line does not spell', () => {
  assert.equal(content(markdownToAdf('| a | b |\n')), 'malformed-pipe-table: a pipe table underlines its header with a row of `-` runs: this one has none; \\| at the start of every row keeps them literal text')
  assert.equal(content(markdownToAdf('| a |\n| x |\n')), 'malformed-pipe-table: a pipe table underlines its header with a row of `-` runs: this one has none; \\| at the start of every row keeps them literal text')
  assert.equal(content(markdownToAdf('| a | b |\n| :--- | ---: |\n')), 'malformed-pipe-table: a pipe table carries no column alignment ADF could hold: this delimiter row holds an alignment colon')
  assert.equal(content(markdownToAdf('| a | b |\n| --- |\n')), 'malformed-pipe-table: a pipe table row holds 1 cell where its header holds 2 cells')
  assert.equal(content(markdownToAdf('| a |\n| --- |\n| b | c |\n')), 'malformed-pipe-table: a pipe table row holds 2 cells where its header holds 1 cell')
  assert.deepEqual(path(markdownToAdf('Part.\n\n| a |\n')), ['content', 1])
})

test('names the pipe table whose rows open with no pipe', () => {
  const bare = 'malformed-pipe-table: a pipe table opens every row with `|`: this one does not; \\| keeps a pipe literal text'
  assert.equal(content(markdownToAdf('a | b\n--- | ---\n')), bare)
  assert.equal(content(markdownToAdf('Intro.\na | b\n--- | ---\n')), bare)
  assert.equal(content(markdownToAdf('a | b\n--- | ---\n===\n')), bare)
  assert.equal(content(markdownToAdf('a | b\n:--- | ---:\n')), bare)
  assert.deepEqual(content(markdownToAdf('a | b\nc | d\n')), [paragraph('a | b c | d')])
  assert.deepEqual(content(markdownToAdf('a | b\n--- | --- | ---\n')), [paragraph('a | b --- | --- | ---')])
  assert.deepEqual(content(markdownToAdf('a \\| b\n--- | ---\n')), [paragraph('a | b --- | ---')])
  assert.deepEqual(content(markdownToAdf('a\n---\n')), [{ attrs: { level: 2 }, content: [text('a')], type: 'heading' }])
  assert.deepEqual(path(markdownToAdf('Part.\n\na | b\n--- | ---\n')), ['content', 1])
})

test('gives back the refusal an inline body holds, never the shape check above it', () => {
  const bare = 'malformed-pipe-table: a pipe table opens every row with `|`: this one does not; \\| keeps a pipe literal text'
  assert.equal(content(markdownToAdf('!adf:caption\na | b\n--- | ---\n!adf:/caption\n')), bare)
  assert.deepEqual(position(markdownToAdf('!adf:caption\na | b\n--- | ---\n!adf:/caption\n')), { line: 2, offset: 13 })
  assert.equal(code(markdownToAdf('!adf:caption\n| a |\n!adf:/caption\n')), 'malformed-pipe-table')
  assert.equal(content(markdownToAdf('!adf:caption\n- a\n!adf:/caption\n')), 'unsupported-node-shape: caption takes one paragraph as its body: this body is not one')
})

test('reads the separator that parts two adjacent lists of one kind', () => {
  const parted = [bulletList(item(paragraph('a'))), bulletList(item(paragraph('b')))]
  assert.deepEqual(content(markdownToAdf('- a\n\n!adf:listBreak\n\n- b\n')), parted)
  assert.deepEqual(content(markdownToAdf('- a\n!adf:listBreak\n- b\n')), parted)
  assert.deepEqual(content(markdownToAdf('1. a\n\n!adf:listBreak\n\n1. b\n')), [orderedList(1, item(paragraph('a'))), orderedList(1, item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('> - a\n> !adf:listBreak\n> - b\n')), [quote(...parted)])
  assert.deepEqual(path(markdownToAdf('- a\n\n!adf:listBreak\n\n- b\n\n| x |\n')), ['content', 2])
})

test('refuses the list separator that parts anything else', () => {
  const parts = 'unsupported-node-shape: listBreak parts two adjacent lists of one type: this one parts something else'
  assert.equal(content(markdownToAdf('!adf:listBreak\n')), parts)
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak\n')), parts)
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak\n\n1. b\n')), parts)
  assert.equal(content(markdownToAdf('Part.\n\n!adf:listBreak\n\n- b\n')), parts)
  const bare = 'unsupported-node-shape: listBreak spells the bare leaf form, !adf:listBreak: this one spells more'
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak x\n\n- b\n')), bare)
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak {id=x}\n\n- b\n')), bare)
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak\n- b\n!adf:/listBreak\n')), 'malformed-directive: listBreak takes no body, so no !adf:/listBreak closes it; \\!adf: keeps the prefix literal')
  assert.equal(content(markdownToAdf('!adf:listBreak{}\n')), 'unsupported-node-shape: listBreak takes the block form, !adf:listBreak, never the inline form')
  assert.deepEqual(path(markdownToAdf('Part.\n\n!adf:listBreak\n')), ['content', 1])
})

test('refuses the image a pipe cell holds no ADF node for', () => {
  assert.equal(content(markdownToAdf('| a |\n| --- |\n| ![x](/u) |\n')), 'unmappable-image: no ADF node carries an image inside a paragraph')
  assert.deepEqual(path(markdownToAdf('| a |\n| --- |\n| ![x](/u) |\n')), ['content', 0, 'content', 1, 'content', 0, 'content', 0])
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

test('claims a block line the prefix opens with no directive to parse it', () => {
  assert.equal(code(markdownToAdf('!adf:/panel\n')), 'malformed-directive')
  assert.equal(code(markdownToAdf('!adf:panel  info\n')), 'malformed-directive')
  assert.equal(code(markdownToAdf('!adf:panel {a=1 a=2}\n!adf:/panel\n')), 'malformed-directive')
  assert.equal(content(markdownToAdf('!adf:Panel\n')), 'malformed-directive: an unescaped !adf: completes no directive; \\!adf: keeps the prefix literal')
  assert.deepEqual(content(markdownToAdf(':::panel info\nPart.\n:::\n')), [paragraph(':::panel info Part. :::')])
  assert.deepEqual(content(markdownToAdf('::rule\n')), [paragraph('::rule')])
})

test('reads the three directive forms into the nodes the tables name', () => {
  assert.deepEqual(content(markdownToAdf('!adf:rule {localId=a-1}\n')), [{ attrs: { localId: 'a-1' }, type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('!adf:paragraph\n!adf:/paragraph\n')), [{ type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('!adf:bulletList\n!adf:/bulletList\n')), [{ type: 'bulletList' }])
  assert.deepEqual(content(markdownToAdf('   !adf:panel info\nPart.\n   !adf:/panel\n')), [
    { attrs: { panelType: 'info' }, content: [paragraph('Part.')], type: 'panel' },
  ])
  assert.deepEqual(content(markdownToAdf('!adf:blockquote {localId=a-1}\n!adf:/blockquote\n')), [{ attrs: { localId: 'a-1' }, type: 'blockquote' }])
  assert.deepEqual(content(markdownToAdf('!adf:heading {level=2 localId=a-1}\nPart.\n!adf:/heading\n')), [
    { attrs: { level: 2, localId: 'a-1' }, content: [text('Part.')], type: 'heading' },
  ])
  assert.deepEqual(content(markdownToAdf('Part!adf:hardBreak{}.\n')), [{ content: [text('Part'), hardBreak(), text('.')], type: 'paragraph' }])
})

test('names the directive form a node CommonMark spells refuses', () => {
  const named = (type: string): string => `unsupported-node-shape: ${type} takes the CommonMark spelling, not the directive form`
  assert.equal(content(markdownToAdf('!adf:rule\n')), named('rule'))
  assert.equal(content(markdownToAdf('!adf:blockquote\nPart.\n!adf:/blockquote\n')), named('blockquote'))
  assert.equal(content(markdownToAdf('!adf:heading {level=2}\nPart.\n!adf:/heading\n')), named('heading'))
  assert.equal(content(markdownToAdf('!adf:paragraph\nPart.\n!adf:/paragraph\n')), named('paragraph'))
  assert.equal(content(markdownToAdf('!adf:bulletList\n!adf:listItem\nPart.\n!adf:/listItem\n!adf:/bulletList\n')), named('bulletList'))
  // The item whose first line reads back as a thematic break keeps the directive form the emitter falls back to.
  assert.deepEqual(content(markdownToAdf('!adf:bulletList\n!adf:listItem\n---\n!adf:/listItem\n!adf:/bulletList\n')), [bulletList(item({ type: 'rule' }))])
})

// The spelling the emitter refuses gives the emitter's own error, never a second name for it.
test('gives back the refusal the CommonMark spelling itself raises', () => {
  const lineStart = '!adf:blockquote\n` `` `\n!adf:/blockquote\n'
  assert.equal(content(markdownToAdf(lineStart)), 'unspellable-line-start: block parsing would claim the emitted line "``` `` ```"')
})

test('names the directive name no node reads back to', () => {
  assert.equal(code(markdownToAdf('!adf:widget info\nx\n!adf:/widget\n')), 'unknown-directive-name')
  assert.equal(content(markdownToAdf('!adf:widget\n')), 'unknown-directive-name: the directive name widget reads back to no node; \\!adf: keeps the prefix literal')
  assert.equal(content(markdownToAdf('!adf:widget[x]\n')), 'unknown-directive-name: the directive name widget reads back to no node; \\!adf: keeps the prefix literal')
  assert.equal(content(markdownToAdf('ratio a!adf:b[c]{d}\n')), 'malformed-directive: an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.deepEqual(path(markdownToAdf('Part.\n\n!adf:widget\n')), ['content', 1])
})

test('names the container no closer closes inside the block holding it', () => {
  const unclosed = (name: string): string => `malformed-directive: the ${name} container is unclosed: no !adf:/${name} follows inside the block holding it; \\!adf: keeps the prefix literal`
  assert.equal(content(markdownToAdf('Part.\n!adf:expand\n')), unclosed('expand'))
  assert.deepEqual(path(markdownToAdf('Part.\n!adf:expand\n')), ['content', 1])
  assert.equal(content(markdownToAdf('!adf:bulletList\n')), unclosed('bulletList'))
  assert.equal(content(markdownToAdf('- !adf:panel info\n  Part.\n!adf:/panel\n')), unclosed('panel'))
  assert.equal(content(markdownToAdf('> !adf:panel info\n> - a\n>   !adf:/panel\n')), unclosed('panel'))
  assert.equal(content(markdownToAdf('!adf:panel info\n!adf:expand\nPart.\n!adf:/panel\n')), unclosed('expand'))
  assert.deepEqual(path(markdownToAdf('!adf:panel info\n!adf:expand\nPart.\n!adf:/panel\n')), ['content', 0, 'content', 0])
})

test('names the closer that finds no container open where it stands', () => {
  const unopened = (name: string): string => `malformed-directive: the closer !adf:/${name} closes no ${name} container open where it stands; \\!adf: keeps the prefix literal`
  assert.equal(content(markdownToAdf('Part.\n\n!adf:/panel\n')), unopened('panel'))
  assert.equal(content(markdownToAdf('!adf:panel info\n> !adf:/panel\n!adf:/panel\n')), unopened('panel'))
  assert.equal(content(markdownToAdf('!adf:panel info\n- !adf:/panel\n!adf:/panel\n')), unopened('panel'))
  assert.equal(content(markdownToAdf('!adf:panel info\nPart.\n!adf:/expand\n!adf:/panel\n')), unopened('expand'))
})

test('names the leaf given a body at its opener, ahead of any refusal the leaf holds itself', () => {
  const body = (name: string): string => `malformed-directive: ${name} takes no body, so no !adf:/${name} closes it; \\!adf: keeps the prefix literal`
  assert.equal(content(markdownToAdf('!adf:rule\nPart.\n!adf:/rule\n')), body('rule'))
  assert.deepEqual(position(markdownToAdf('Part.\n\n!adf:rule\nPart.\n!adf:/rule\n')), { line: 3, offset: 7 })
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak\n!adf:/listBreak\n\n- b\n')), body('listBreak'))
  assert.equal(content(markdownToAdf('- a\n\n!adf:listBreak\nPart.\n!adf:/listBreak\n\n- b\n')), body('listBreak'))
  assert.deepEqual(path(markdownToAdf('!adf:rule {localId=a-1}\n!adf:rule {localId=a-2}\nPart.\n!adf:/rule\n')), ['content', 1])
  assert.deepEqual(path(markdownToAdf('!adf:rule {localId=a-1}\n!adf:/rule\n!adf:/rule\n')), ['content', 0])
  assert.deepEqual(path(markdownToAdf('Part.\n\n!adf:/rule\n')), ['content', 1])
  assert.deepEqual(path(markdownToAdf('!adf:panel info\n!adf:rule {localId=a-1}\n!adf:/panel\n!adf:/rule\n')), ['content', 1])
})

test('names the position a directive name the other one spells belongs to', () => {
  assert.equal(content(markdownToAdf('!adf:em\na\n!adf:/em\n')), 'unsupported-node-shape: em is spelled _x_, never as a block directive')
  assert.equal(content(markdownToAdf('!adf:underline\n')), 'unsupported-node-shape: underline is spelled !adf:underline[…], never as a block directive')
  assert.equal(content(markdownToAdf('!adf:link\n')), 'unsupported-node-shape: link is spelled [x](url) or !adf:link[…], never as a block directive')
  assert.equal(content(markdownToAdf('!adf:text {text=" "}\n')), 'unsupported-node-shape: text takes the inline form, !adf:text{…}, never the block form')
  assert.equal(content(markdownToAdf('!adf:date {timestamp=1}\n')), 'unsupported-node-shape: date takes the inline form, !adf:date{…}, never the block form')
  assert.equal(content(markdownToAdf('!adf:paragraph[a]\n')), 'unsupported-node-shape: paragraph takes the block form, !adf:paragraph, never the inline form')
  assert.equal(content(markdownToAdf('!adf:rule[a]\n')), 'unsupported-node-shape: rule takes the block form, !adf:rule, never the inline form')
  assert.equal(code(markdownToAdf('!adf:widget\na\n!adf:/widget\n')), 'unknown-directive-name')
  assert.equal(code(markdownToAdf('!adf:widget[a]\n')), 'unknown-directive-name')
})

test('names the reserved carry name a block directive spells', () => {
  const reserved = 'malformed-directive: the name carry is reserved for the opaque carry, whose block form is the carry fence'
  assert.equal(content(markdownToAdf('!adf:carry\n')), reserved)
  assert.equal(content(markdownToAdf('!adf:carry\nx\n!adf:/carry\n')), reserved)
  assert.deepEqual(content(markdownToAdf('```adf\nx\n```\n')), [{ attrs: { language: 'adf' }, content: [text('x')], type: 'codeBlock' }])
})

const carried = '!adf:carry{json="{\\"type\\":\\"placeholder\\"}"}'

test('reads the carry fence back to the node its JSON holds', () => {
  assert.deepEqual(content(markdownToAdf('```carry\n{\n  "attrs": {\n    "url": "https://example.com/x"\n  },\n  "type": "blockCard"\n}\n```\n')), [
    { attrs: { url: 'https://example.com/x' }, type: 'blockCard' },
  ])
})

test('reads the inline carry back to the node its json attribute holds', () => {
  assert.deepEqual(content(markdownToAdf(`a ${carried} b\n`)), [
    { content: [text('a '), { type: 'placeholder' }, text(' b')], type: 'paragraph' },
  ])
})

test('names the invalid JSON no opaque carry holds', () => {
  const invalid = 'malformed-directive: the opaque carry holds invalid JSON'
  assert.equal(content(markdownToAdf('```carry\n{"type":\n```\n')), invalid)
  assert.equal(content(markdownToAdf('```carry\n```\n')), invalid)
  assert.equal(content(markdownToAdf('!adf:carry{json="{"}\n')), invalid)
  assert.equal(content(markdownToAdf('!adf:carry{json=abc}\n')), invalid)
})

test('names the canonical spelling a carried JSON reads alone', () => {
  const canonically = "unsupported-node-shape: the opaque carry spells its node's JSON canonically: "
  assert.equal(content(markdownToAdf('```carry\n{"type":"blockCard"}\n```\n')), `${canonically}two-space indent, keys sorted`)
  assert.equal(content(markdownToAdf('!adf:carry{json="{\\"type\\": \\"blockCard\\"}"}\n')), `${canonically}compact, keys sorted`)
  assert.equal(content(markdownToAdf('!adf:carry{json="{\\"type\\":\\"blockCard\\",\\"attrs\\":{}}"}\n')), `${canonically}compact, keys sorted`)
})

test('names the node JSON an opaque carry restores alone', () => {
  const node = "unsupported-node-shape: the opaque carry holds one ADF node's JSON: this JSON is no ADF node"
  assert.equal(content(markdownToAdf('```carry\n[]\n```\n')), node)
  assert.equal(content(markdownToAdf('!adf:carry{json=null}\n')), node)
  assert.equal(content(markdownToAdf('!adf:carry{json="{\\"kind\\":\\"x\\"}"}\n')), node)
})

test('names the shape the inline carry reads alone', () => {
  assert.equal(content(markdownToAdf('!adf:carry[x]{json="{}"}\n')), 'unsupported-node-shape: carry takes no content: this one holds some')
  assert.equal(content(markdownToAdf('!adf:carry{}\n')), 'unsupported-node-shape: carry holds one json attribute alone: this one does not')
  assert.equal(content(markdownToAdf('!adf:carry{json="{}" localId=x}\n')), 'unsupported-node-shape: carry holds one json attribute alone: this one does not')
  assert.equal(content(markdownToAdf('!adf:carry{json="null"}\n')), 'unsupported-node-shape: carry spells its json attribute as json=null')
})

test('holds a carried JSON value to the nesting its position leaves', () => {
  const nested = (levels: number): string => `${'['.repeat(levels)}${']'.repeat(levels)}`
  const fence = (prefix: string, levels: number): string => `${prefix}\`\`\`carry\n${prefix}${nested(levels)}\n${prefix}\`\`\`\n`
  const deeper = (levels: number): string => `unsupported-nesting-depth: a carried node's JSON nests deeper than the ${levels} levels its position leaves`
  assert.equal(content(markdownToAdf(`!adf:carry{json="${nested(largestNesting + 2)}"}\n`)), deeper(largestNesting))
  assert.equal(
    content(markdownToAdf(fence('', largestNesting + 1))),
    "unsupported-node-shape: the opaque carry spells its node's JSON canonically: two-space indent, keys sorted",
  )
  assert.equal(content(markdownToAdf(fence('> ', largestNesting + 1))), deeper(largestNesting - 1))
})

test('names the number no JSON spelling carries in an opaque carry', () => {
  const named = 'unsupported-node-shape: the opaque carry holds a number JSON cannot spell'
  assert.equal(content(markdownToAdf('!adf:carry{json="{\\"attrs\\":{\\"width\\":1e999},\\"type\\":\\"blockCard\\"}"}\n')), named)
  assert.equal(content(markdownToAdf('```carry\n1e999\n```\n')), named)
})

test('names the mark spelling no opaque carry sits inside', () => {
  const named = 'unsupported-node-shape: no mark spelling wraps an opaque carry: the carried node restores exactly, marks included'
  assert.equal(content(markdownToAdf(`_a ${carried} b_\n`)), named)
  assert.equal(content(markdownToAdf(`**${carried}**\n`)), named)
  assert.equal(content(markdownToAdf(`~~a ${carried}~~\n`)), named)
  assert.equal(content(markdownToAdf(`[a ${carried} b](https://example.com/x)\n`)), named)
  assert.equal(content(markdownToAdf(`[*<http://x/>${carried}*](/w)\n`)), named)
  assert.equal(content(markdownToAdf(`!adf:underline[${carried}]\n`)), named)
  assert.equal(content(markdownToAdf(`!adf:textColor[a ${carried}]{color="#ae2e24"}\n`)), named)
  assert.equal(content(markdownToAdf(`![_a ${carried}_](https://example.com/i)\n`)), named)
})

test('keeps the carry a mark spelling does not wrap', () => {
  assert.deepEqual(content(markdownToAdf(`[a ${carried} b]\n`)), [
    { content: [text('[a '), { type: 'placeholder' }, text(' b]')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf(`**a**${carried}**b**\n`)), [
    { content: [marked('a', strong), { type: 'placeholder' }, marked('b', strong)], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf(`![a ${carried} b](https://example.com/i)\n`)), [image('https://example.com/i', 'a  b')])
})

test('reads each attribute value as the type its section assigns', () => {
  assert.deepEqual(content(markdownToAdf('!adf:media {height=10 id=a-1 type=file url="/x y" width="20.5"}\n')), [
    { attrs: { height: 10, id: 'a-1', type: 'file', url: '/x y', width: 20.5 }, type: 'media' },
  ])
  assert.deepEqual(content(markdownToAdf('!adf:table {isNumberColumnEnabled=true}\n!adf:/table\n')), [{ attrs: { isNumberColumnEnabled: true }, type: 'table' }])
  assert.deepEqual(content(markdownToAdf('!adf:tableCell {colwidth="[340,420]"}\n!adf:/tableCell\n')), [{ attrs: { colwidth: [340, 420] }, type: 'tableCell' }])
  assert.deepEqual(content(markdownToAdf('!adf:rule {localId=a-1}\n')), [{ attrs: { localId: 'a-1' }, type: 'rule' }])
})

test('reads the reserved marks key as the node array it spells', () => {
  assert.deepEqual(content(markdownToAdf('!adf:rule {marks="[{\\"type\\":\\"em\\"}]"}\n')), [{ marks: [em], type: 'rule' }])
  assert.deepEqual(content(markdownToAdf('!adf:rule {localId=a-1 marks="[{\\"attrs\\":{\\"mode\\":\\"wide\\"},\\"type\\":\\"breakout\\"}]"}\n')), [
    { attrs: { localId: 'a-1' }, marks: [{ attrs: { mode: 'wide' }, type: 'breakout' }], type: 'rule' },
  ])
})

test('names the marks key no marks array reads back from', () => {
  const named = 'unsupported-node-shape: the marks attribute of rule is its marks array in canonical JSON: this one is not'
  assert.equal(content(markdownToAdf('!adf:rule {marks="[]"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:rule {marks="[1]"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:rule {marks="{}"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:rule {marks=x}\n')), named)
  assert.equal(content(markdownToAdf('!adf:rule {marks="[{\\"attrs\\":{},\\"type\\":\\"em\\"}]"}\n')), named)
})

test('names the attribute a node holds no reading for', () => {
  assert.equal(content(markdownToAdf('!adf:rule {bogus=1}\n')), 'unsupported-node-shape: rule holds no bogus attribute: this one spells it')
  assert.equal(content(markdownToAdf('!adf:media {width=wide}\n')), 'unsupported-node-shape: the width attribute of media is no number')
  assert.equal(content(markdownToAdf('!adf:table {isNumberColumnEnabled=yes}\n!adf:/table\n')), 'unsupported-node-shape: the isNumberColumnEnabled attribute of table is no boolean')
  assert.equal(content(markdownToAdf('!adf:media {width=true}\n')), 'unsupported-node-shape: the width attribute of media is no number')
  assert.equal(content(markdownToAdf('!adf:tableCell {colwidth="[340,"}\n!adf:/tableCell\n')), 'unsupported-node-shape: the colwidth attribute of tableCell is no json')
  assert.equal(content(markdownToAdf('!adf:panel info {panelType=note}\nx\n!adf:/panel\n')), 'unsupported-node-shape: panel spells its panelType attribute as the directive argument, never in {attrs}')
  assert.equal(content(markdownToAdf('Part !adf:mention{id=b1c2 text=A}.\n')), 'unsupported-node-shape: mention spells its text attribute in the content slot, never in {attrs}')
})

test('names the depth an attribute value nests past, never the kind the JSON reads as', () => {
  const nested = (levels: number): string => `${'['.repeat(levels)}1${']'.repeat(levels)}`
  const deeper = (key: string, type: string): string =>
    `unsupported-nesting-depth: the ${key} attribute of ${type} nests deeper than the ${largestNesting} levels an attribute carries`
  assert.equal(content(markdownToAdf(`!adf:tableCell {colwidth="${nested(largestNesting + 1)}"}\n!adf:/tableCell\n`)), deeper('colwidth', 'tableCell'))
  assert.equal(content(markdownToAdf(`!adf:rule {marks="${nested(largestNesting + 1)}"}\n`)), deeper('marks', 'rule'))
  assert.equal(content(markdownToAdf(`!adf:rule {marks="[{\\"attrs\\":{\\"deep\\":${nested(largestNesting - 2)}},\\"type\\":\\"em\\"}]"}\n`)), deeper('marks', 'rule'))
  assert.equal(content(markdownToAdf(`!adf:media {width="${nested(largestNesting + 1)}"}\n`)), 'unsupported-node-shape: the width attribute of media is no number')
})

test('names the attribute value spelled outside the canonical form', () => {
  assert.equal(content(markdownToAdf('!adf:rule {localId="a-1"}\n')), 'unsupported-node-shape: rule spells its localId attribute as localId=a-1')
  assert.equal(content(markdownToAdf('!adf:media {width="20.0"}\n')), 'unsupported-node-shape: media spells its width attribute as width=20')
  assert.equal(content(markdownToAdf('!adf:tableCell {colwidth="[340, 420]"}\n!adf:/tableCell\n')), 'unsupported-node-shape: tableCell spells its colwidth attribute as colwidth="[340,420]"')
})

test('names the argument and the body a node takes no reading for', () => {
  assert.equal(content(markdownToAdf('!adf:rule x\n')), 'unsupported-node-shape: rule takes no argument: this one spells one')
  assert.equal(content(markdownToAdf('!adf:paragraph\nOne.\n\nTwo.\n!adf:/paragraph\n')), 'unsupported-node-shape: paragraph takes one paragraph as its body: this body is not one')
  assert.equal(content(markdownToAdf('!adf:paragraph\n---\n!adf:/paragraph\n')), 'unsupported-node-shape: paragraph takes one paragraph as its body: this body is not one')
  assert.equal(content(markdownToAdf('!adf:codeBlock {wrap=true}\nx\n!adf:/codeBlock\n')), 'unsupported-node-shape: codeBlock takes one code block as its body: this body is not one')
  assert.equal(content(markdownToAdf('!adf:paragraph\n![a](/u)\n!adf:/paragraph\n')), 'unmappable-image: no ADF node carries an image inside a paragraph')
  assert.equal(content(markdownToAdf('Part !adf:date[now]{timestamp=1}.\n')), 'unsupported-node-shape: date takes no content: this one holds some')
})

test('leaves the text that opens no directive the text it is', () => {
  assert.deepEqual(content(markdownToAdf('At 10:30 :smile: today.\n')), [paragraph('At 10:30 :smile: today.')])
  assert.deepEqual(content(markdownToAdf(':mention[@A] and !adfx and a!\n')), [paragraph(':mention[@A] and !adfx and a!')])
  assert.deepEqual(content(markdownToAdf('\\!adf:mention[@A]\n')), [paragraph('!adf:mention[@A]')])
  assert.deepEqual(content(markdownToAdf('`!adf:mention[@A]`\n')), [{ content: [codeSpan('!adf:mention[@A]')], type: 'paragraph' }])
})

test('names the unescaped prefix that completes no directive', () => {
  const named = 'malformed-directive: an unescaped !adf: completes no directive; \\!adf: keeps the prefix literal'
  assert.equal(content(markdownToAdf('Part !adf: here.\n')), named)
  assert.equal(content(markdownToAdf('Part !adf:Mention[@A] here.\n')), named)
  assert.equal(content(markdownToAdf('Part !adf:mention @A here.\n')), named)
  assert.equal(content(markdownToAdf('!adf:underline[a !adf: b]\n')), named)
})

test('names the inline directive left unclosed at the end of its line', () => {
  assert.equal(content(markdownToAdf('Part !adf:mention[@A\n')), 'malformed-directive: an inline directive [content] is unclosed; \\!adf: keeps the prefix literal')
  assert.equal(code(markdownToAdf('Part !adf:mention[@A]{id=\n')), 'malformed-directive')
  assert.deepEqual(path(markdownToAdf('> Part !adf:mention[@A\n')), ['content', 0, 'content', 0])
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
  assert.equal(code(markdownToAdf('<div>\nx\n\n!adf:/panel\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\n- x\n</div>\n')), 'unmappable-html')
})

test('swallows an HTML block ahead of the claim a line inside it would make', () => {
  assert.equal(code(markdownToAdf('<!--\n!adf:/panel\n-->\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('<div>\n| x |\n</div>\n')), 'unmappable-html')
})

test('names the line and the offset in the input a refusal sits at, the innermost block winning', () => {
  assert.deepEqual(position(markdownToAdf('<div>\n')), { line: 1, offset: 0 })
  assert.deepEqual(position(markdownToAdf('Part.\n\n<div>\n')), { line: 3, offset: 7 })
  assert.deepEqual(position(markdownToAdf('> Part.\n>\n> a <span>b</span>\n')), { line: 3, offset: 10 })
  assert.deepEqual(position(markdownToAdf('- Part.\n- a <span>b</span>\n')), { line: 2, offset: 8 })
  assert.deepEqual(position(markdownToAdf('Part.\n\n!adf:panel info\nMore.\n')), { line: 3, offset: 7 })
  assert.deepEqual(position(markdownToAdf('x\n\na <span>b</span>\n===\n')), { line: 3, offset: 3 })
  assert.deepEqual(position(markdownToAdf('x\n\n```carry\n{\n```\n')), { line: 3, offset: 3 })
  assert.deepEqual(position(markdownToAdf('x\n\n| a |\n')), { line: 3, offset: 3 })
  assert.deepEqual(position(markdownToAdf('a\nb <span>c</span>\n')), { line: 1, offset: 0 })
  assert.deepEqual(position(markdownToAdf('Part.\r\n\r\n<div>\r\n')), { line: 3, offset: 9 })
  assert.deepEqual(position(markdownToAdf('a\u0000b\n\n<div>\n')), { line: 3, offset: 5 })
  assert.deepEqual(position(markdownToAdf('!adf:caption\na <span>b</span>\n!adf:/caption\n')), { line: 2, offset: 13 })
  assert.deepEqual(position(markdownToAdf('x\n\n!adf:caption\n- a\n!adf:/caption\n')), { line: 3, offset: 3 })
})

test('names the line the text a paragraph keeps starts on, never a definition line it gave up', () => {
  assert.deepEqual(position(markdownToAdf('[a]: /url\n<span>b</span>\n')), { line: 2, offset: 10 })
  assert.deepEqual(position(markdownToAdf('[a]: /a\n[b]: /b\n[c]: /c\n[d]: /d\n<span>x</span>\n')), { line: 5, offset: 32 })
  assert.deepEqual(position(markdownToAdf('[a]:\n<the url>\n"Title"\n<span>b</span>\n')), { line: 4, offset: 23 })
  assert.deepEqual(position(markdownToAdf('> [a]: /url\n> <span>b</span>\n')), { line: 2, offset: 12 })
  assert.deepEqual(position(markdownToAdf('!adf:caption\n[a]: /url\n<span>b</span>\n!adf:/caption\n')), { line: 3, offset: 23 })
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
  assert.deepEqual(content(markdownToAdf('- a\n* b\n')), [bulletList(item(paragraph('a')), item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('- a\n\n+ b\n')), [bulletList(item(paragraph('a')), item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('- a\n-\n\n- c\n')), [bulletList(item(paragraph('a')), item(), item(paragraph('c')))])
  assert.deepEqual(content(markdownToAdf('- a\n1. b\n')), [bulletList(item(paragraph('a'))), orderedList(1, item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('- a\n\n[r]: /u\n\n- b\n')), [bulletList(item(paragraph('a')), item(paragraph('b')))])
  assert.deepEqual(content(markdownToAdf('-\n\n  Part.\n')), [bulletList(item()), paragraph('Part.')])
})

test('reads an ordered list, its first marker the order attribute', () => {
  assert.deepEqual(content(markdownToAdf('9. Bolt M8\n10. Nut M8\n')), [orderedList(9, item(paragraph('Bolt M8')), item(paragraph('Nut M8')))])
  assert.deepEqual(content(markdownToAdf('1) Loosen the clamp\n')), [orderedList(1, item(paragraph('Loosen the clamp')))])
  assert.deepEqual(content(markdownToAdf('1. a\n1) b\n')), [orderedList(1, item(paragraph('a')), item(paragraph('b')))])
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
  assert.equal(code(markdownToAdf('> Part.\n!adf:/panel\n')), 'malformed-directive')
  assert.deepEqual(path(markdownToAdf('> Part.\n!adf:/panel\n')), ['content', 1])
  assert.equal(code(markdownToAdf('- Part.\n| x |\n')), 'malformed-pipe-table')
})

test('names the block the claim inside a container opens', () => {
  assert.deepEqual(path(markdownToAdf('> Part.\n>\n> !adf:expand\n')), ['content', 0, 'content', 1])
  assert.deepEqual(path(markdownToAdf('- Part.\n- | x |\n')), ['content', 0, 'content', 1, 'content', 0])
})

test('refuses input nested deeper than the parser carries', () => {
  assert.equal(code(markdownToAdf('> '.repeat(501))), 'unsupported-nesting-depth')
  assert.ok(markdownToAdf('> '.repeat(500)).ok)
  const marks = (levels: number): string => `${'!adf:underline['.repeat(levels)}a${']'.repeat(levels)}\n`
  assert.equal(code(markdownToAdf(marks(largestNesting + 1))), 'unsupported-nesting-depth')
  assert.deepEqual(content(markdownToAdf(marks(largestNesting))), [{ content: [marked('a', underline)], type: 'paragraph' }])
  const nest = (names: readonly string[], body: string): string => [...names.map((name) => `!adf:${name}\n`), body, ...names.map((name) => `!adf:/${name}\n`).reverse()].join('')
  const repeated = (name: string): string[] => Array.from({ length: largestNesting }, () => name)
  assert.ok(markdownToAdf(nest(repeated('panel'), '!adf:paragraph {localId=a-1}\nPart.\n!adf:/paragraph\n')).ok)
  assert.deepEqual(position(markdownToAdf(nest(['expand', ...repeated('panel'), 'expand'], 'Part.\n'))), { line: 501, offset: 5501 })
  assert.equal(code(markdownToAdf(nest(['panel', ...repeated('expand'), 'panel'], 'Part.\n'))), 'unsupported-nesting-depth')
  const listed = (levels: number): string => `${'!adf:bulletList\n!adf:listItem\n---\n'.repeat(levels)}${'!adf:/listItem\n!adf:/bulletList\n'.repeat(levels)}`
  const directiveLists = largestNesting / 2
  assert.ok(markdownToAdf(listed(directiveLists)).ok)
  assert.equal(code(markdownToAdf(listed(directiveLists + 1))), 'unsupported-nesting-depth')
  assert.ok(markdownToAdf(`${'- '.repeat(largestNesting)}a\n`).ok)
  assert.equal(code(markdownToAdf(`${'- '.repeat(largestNesting + 1)}a\n`)), 'unsupported-nesting-depth')
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
  assert.deepEqual(content(markdownToAdf('`!adf:/panel` `~~x~~` `\\*` `&amp;`\n')), [
    {
      content: [codeSpan('!adf:/panel'), text(' '), codeSpan('~~x~~'), text(' '), codeSpan('\\*'), text(' '), codeSpan('&amp;')],
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
  assert.equal(content(markdownToAdf('Part <span> here.\n')), 'unmappable-html: no raw HTML converts at this version: <span>')
  assert.equal(content(markdownToAdf('Part </div> here.\n')), 'unmappable-html: no raw HTML converts at this version: <div>')
  assert.equal(content(markdownToAdf('Part <!-- note --> here.\n')), 'unmappable-html: no raw HTML converts at this version: an HTML comment')
  assert.equal(content(markdownToAdf('Part <?php ?> here.\n')), 'unmappable-html: no raw HTML converts at this version: an HTML processing instruction')
  assert.equal(content(markdownToAdf('Part <!DOCTYPE html> here.\n')), 'unmappable-html: no raw HTML converts at this version: an HTML declaration')
  assert.equal(content(markdownToAdf('Part <![CDATA[x]]> here.\n')), 'unmappable-html: no raw HTML converts at this version: a CDATA section')
  assert.equal(content(markdownToAdf('Part <!--> here.\n')), 'unmappable-html: no raw HTML converts at this version: an HTML comment')
  assert.equal(content(markdownToAdf('Part <!---> here.\n')), 'unmappable-html: no raw HTML converts at this version: an HTML comment')
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

test('leaves the brackets of a link whose text already holds one the text they are', () => {
  const held: AdfMark = { attrs: { collection: 'c', href: '/u' }, type: 'link' }
  assert.deepEqual(content(markdownToAdf('[<http://x/>](/v)\n')), [
    { content: [text('['), marked('http://x/', link('http://x/')), text('](/v)')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('[a<http://x/>b](/v)\n')), [
    { content: [text('[a'), marked('http://x/', link('http://x/')), text('b](/v)')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('[!adf:link[a]{collection=c href="/u"}](/v)\n')), [
    { content: [text('['), marked('a', held), text('](/v)')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('[<http://x/>][r]\n\n[r]: /v\n')), [
    { content: [text('['), marked('http://x/', link('http://x/')), text(']'), marked('r', link('/v'))], type: 'paragraph' },
  ])
})

test('keeps the carry and the image the brackets a nested link leaves literal hold', () => {
  assert.deepEqual(content(markdownToAdf(`[<http://x/>${carried}](/w)\n`)), [
    { content: [text('['), marked('http://x/', link('http://x/')), { type: 'placeholder' }, text('](/w)')], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf(`[[<http://x/>](/c)${carried}](/w)\n`)), [
    { content: [text('[['), marked('http://x/', link('http://x/')), text('](/c)'), { type: 'placeholder' }, text('](/w)')], type: 'paragraph' },
  ])
  // The failing bracket sits inside the image, not beside it: beside it the link-marked piece survives, and the deactivation stops being what the assertion pins.
  assert.deepEqual(content(markdownToAdf('![![a [b](/c) ](/i)[![[<http://x/>](/c)](/y)](/w)](/v)\n')), [image('/v', 'a b [[http://x/](/c)](/w)')])
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
  assert.deepEqual(content(markdownToAdf('![a !adf:mention[@A]{id=b1c2} b](/u)\n')), [image('/u', 'a @A b')])
  assert.deepEqual(content(markdownToAdf('![!adf:mention[@A]{id=b1c2}](/u)\n')), [image('/u', '@A')])
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
  assert.equal(content(markdownToAdf('See ![a](/u).\n')), 'unmappable-image: an image fits only as a paragraph of its own: this one sits inside other content')
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

test('reads the content slot as the text attribute the node spells there', () => {
  const status = (attrs: AdfAttributes): AdfNode[] => [{ content: [{ attrs, type: 'status' }], type: 'paragraph' }]
  assert.deepEqual(content(markdownToAdf('!adf:status[In review]{color=yellow}\n')), status({ color: 'yellow', text: 'In review' }))
  assert.deepEqual(content(markdownToAdf('!adf:status{color=neutral}\n')), status({ color: 'neutral' }))
  assert.deepEqual(content(markdownToAdf('!adf:status[]{color=neutral}\n')), status({ color: 'neutral', text: '' }))
  assert.deepEqual(content(markdownToAdf('!adf:status[ In review ]{color=yellow}\n')), status({ color: 'yellow', text: ' In review ' }))
  assert.deepEqual(content(markdownToAdf('!adf:status[In!adf:text{text=" "}review]{color=yellow}\n')), status({ color: 'yellow', text: 'In review' }))
  assert.deepEqual(content(markdownToAdf('!adf:status[a\\]b]{color=yellow}\n')), status({ color: 'yellow', text: 'a]b' }))
  assert.deepEqual(content(markdownToAdf('**!adf:mention[@A]{id=b1c2}**\n')), [
    { content: [{ attrs: { id: 'b1c2', text: '@A' }, marks: [strong], type: 'mention' }], type: 'paragraph' },
  ])
})

test('names the content slot no lone plain text node reads back from', () => {
  const named = 'unsupported-node-shape: the status content slot holds one text node carrying neither marks, attributes nor content: this one holds something else'
  assert.equal(content(markdownToAdf('!adf:status[**A**]{color=yellow}\n')), named)
  assert.equal(content(markdownToAdf('!adf:status[!adf:carry{json="{\\"attrs\\":{\\"localId\\":\\"a\\"},\\"text\\":\\"A\\",\\"type\\":\\"text\\"}"}]{color=yellow}\n')), named)
  assert.equal(content(markdownToAdf('!adf:status[!adf:carry{json="{\\"content\\":[{\\"text\\":\\"B\\",\\"type\\":\\"text\\"}],\\"text\\":\\"A\\",\\"type\\":\\"text\\"}"}]{color=yellow}\n')), named)
  assert.equal(code(markdownToAdf('!adf:status[a`b`]{color=yellow}\n')), 'unsupported-node-shape')
  assert.equal(code(markdownToAdf('!adf:status[!adf:date{timestamp=1}]{color=yellow}\n')), 'unsupported-node-shape')
  assert.equal(content(markdownToAdf('!adf:status[![a](/u)]{color=yellow}\n')), 'unmappable-image: an image fits only as a paragraph of its own: this one sits inside other content')
  assert.equal(code(markdownToAdf('!adf:status[<div>]{color=yellow}\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('!adf:date[<div>]{timestamp=1}\n')), 'unmappable-html')
  assert.equal(code(markdownToAdf('!adf:widget[<div>]\n')), 'unmappable-html')
  const spans = 'unspellable-whitespace: the status content slot holds a newline no inline directive spans'
  assert.equal(content(markdownToAdf('!adf:status[!adf:text{text="\\n"}]{color=yellow}\n')), spans)
  assert.equal(content(markdownToAdf('!adf:status[a&#10;b]{color=yellow}\n')), spans)
  assert.equal(content(markdownToAdf('!adf:status[a&#13;b]{color=yellow}\n')), spans)
  assert.equal(content(markdownToAdf('Part !adf:mention{id=b1c2 text=A}.\n')), 'unsupported-node-shape: mention spells its text attribute in the content slot, never in {attrs}')
})

test('reads the whitespace the reserved text directive carries', () => {
  assert.deepEqual(content(markdownToAdf('!adf:text{text="  "}a\n')), [paragraph('  a')])
  assert.deepEqual(content(markdownToAdf('a!adf:text{text="\\n"}b\n')), [paragraph('a\nb')])
  assert.deepEqual(content(markdownToAdf('a!adf:text{text="\\t"}\n')), [paragraph('a\t')])
  assert.deepEqual(content(markdownToAdf('_!adf:text{text=" "}a_\n')), [{ content: [marked(' a', em)], type: 'paragraph' }])
})

test('names the text directive spelling no whitespace run reads back from', () => {
  const named = 'unsupported-node-shape: text spells one run of spaces and tabs, or one run of newlines: this one spells neither'
  assert.equal(content(markdownToAdf('!adf:text{text=hi}\n')), named)
  assert.equal(content(markdownToAdf('!adf:text{text=" \\n"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:text{text=""}\n')), named)
  assert.equal(content(markdownToAdf('!adf:text{}\n')), 'unsupported-node-shape: text holds one text attribute alone: this one does not')
  assert.equal(content(markdownToAdf('!adf:text{localId=a text=" "}\n')), 'unsupported-node-shape: text holds one text attribute alone: this one does not')
  assert.equal(content(markdownToAdf('!adf:text[a]{text=" "}\n')), 'unsupported-node-shape: text takes no content: this one holds some')
  assert.equal(content(markdownToAdf('!adf:text{text="\\u0020"}\n')), 'unsupported-node-shape: text spells its text attribute as text=" "')
})

test('reads the directive marks, the nesting outermost first', () => {
  const wrapped = (...marks: AdfMark[]): AdfNode[] => [{ content: [marked('a', ...marks)], type: 'paragraph' }]
  assert.deepEqual(content(markdownToAdf('!adf:underline[a]\n')), wrapped(underline))
  assert.deepEqual(content(markdownToAdf('_!adf:underline[a]_\n')), wrapped(em, underline))
  assert.deepEqual(content(markdownToAdf('!adf:underline[_a_]\n')), wrapped(underline, em))
  assert.deepEqual(content(markdownToAdf('!adf:underline[!adf:underline[a]]\n')), wrapped(underline))
  assert.deepEqual(content(markdownToAdf('!adf:textColor[a]{color="#ae2e24"}\n')), wrapped({ attrs: { color: '#ae2e24' }, type: 'textColor' }))
  assert.deepEqual(content(markdownToAdf('!adf:subsup[a]{type=sub}\n')), wrapped({ attrs: { type: 'sub' }, type: 'subsup' }))
  assert.deepEqual(content(markdownToAdf('!adf:border[a]{color="#091e42" size=2}\n')), wrapped({ attrs: { color: '#091e42', size: 2 }, type: 'border' }))
  assert.deepEqual(content(markdownToAdf('!adf:underline[a!adf:date{timestamp=1}]\n')), [
    { content: [marked('a', underline), { attrs: { timestamp: '1' }, marks: [underline], type: 'date' }], type: 'paragraph' },
  ])
  assert.deepEqual(content(markdownToAdf('_!adf:underline[a!adf:date{timestamp=1}]_\n')), [
    { content: [marked('a', em, underline), { attrs: { timestamp: '1' }, marks: [em, underline], type: 'date' }], type: 'paragraph' },
  ])
  assert.equal(content(markdownToAdf('!adf:border[a]{color="#091e42" size=x}\n')), 'unsupported-node-shape: the size attribute of border is no number')
})

test('names the mark markdown spells, never a directive', () => {
  assert.equal(content(markdownToAdf('!adf:em[a]\n')), 'unsupported-node-shape: em is spelled _x_, never as a directive')
  assert.equal(content(markdownToAdf('!adf:strong[a]\n')), 'unsupported-node-shape: strong is spelled **x**, never as a directive')
  assert.equal(content(markdownToAdf('!adf:strike[a]\n')), 'unsupported-node-shape: strike is spelled ~~x~~, never as a directive')
  assert.equal(content(markdownToAdf('!adf:code[a]\n')), 'unsupported-node-shape: code is spelled `x`, never as a directive')
})

test('refuses the directive link CommonMark could spell, and reads the one it could not', () => {
  const refused = 'unsupported-node-shape: link takes the directive form only where CommonMark cannot spell it: this one it can, as [text](url "title") or <url>'
  assert.equal(content(markdownToAdf('!adf:link[a]{href="/u"}\n')), refused)
  assert.equal(content(markdownToAdf('See !adf:link[a]{href="/u"}.\n')), refused)
  assert.equal(content(markdownToAdf('!adf:link[https://example.com/]{href="https://example.com/"}\n')), refused)
  assert.equal(content(markdownToAdf('# !adf:link[`]: a`]{href="/u"}\n')), refused)
  assert.equal(content(markdownToAdf('| !adf:link[`]: a`]{href="/u"} |\n| --- |\n')), refused)
  assert.equal(content(markdownToAdf('!adf:underline[!adf:link[a]{href="/u"}]\n')), refused)
  assert.deepEqual(path(markdownToAdf('Part.\n\nSee !adf:link[a]{href="/u"}.\n')), ['content', 1])
  const opening: AdfNode = { marks: [{ attrs: { href: '/u' }, type: 'link' }, { type: 'code' }], text: ']: a', type: 'text' }
  assert.deepEqual(content(markdownToAdf('!adf:link[`]: a`]{href="/u"}\n')), [{ content: [opening], type: 'paragraph' }])
  assert.deepEqual(content(markdownToAdf('!adf:heading {level=1 localId=h}\n!adf:link[`]: a`]{href="/u"}\n!adf:/heading\n')), [
    { attrs: { level: 1, localId: 'h' }, content: [opening], type: 'heading' },
  ])
})

test('names the href the directive link spells no value for', () => {
  const named = 'unsupported-node-shape: the link mark spells its href: this one spells none'
  assert.equal(content(markdownToAdf('!adf:link[a]\n')), named)
  assert.equal(content(markdownToAdf('!adf:link[a]{title=t}\n')), named)
  assert.equal(content(markdownToAdf('See !adf:link[a]{id=01a032c3-7a90-70c9-88f6-c60f710eda07}.\n')), named)
  assert.equal(content(markdownToAdf('!adf:link[<http://x/>]{collection=c}\n')), named)
})

test('names the link a directive link wraps, no link holding another', () => {
  const named = 'unsupported-node-shape: no link wraps a link: the [content] this one marks already holds one'
  assert.equal(content(markdownToAdf('!adf:link[<http://x/>]{collection=c href="/u"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:link[[a](/v)]{collection=c href="/u"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:link[a <http://x/> b]{collection=c href="/u"}\n')), named)
  assert.equal(content(markdownToAdf('!adf:link[<http://x/>]{href="/u"}\n')), named)
})

test('names the directive mark left without the content it wraps', () => {
  const named = 'unsupported-node-shape: the underline mark wraps the [content] it marks: this one wraps none'
  assert.equal(content(markdownToAdf('!adf:underline[]\n')), named)
  assert.equal(content(markdownToAdf('!adf:underline{}\n')), named)
})

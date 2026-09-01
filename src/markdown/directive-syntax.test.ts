import assert from 'node:assert/strict'
import test from 'node:test'

import type { DirectiveLine } from './directive-syntax.ts'
import { largestNesting } from '../nesting.ts'
import { readDirectiveLine, readInlineDirective } from './directive-syntax.ts'

function attributes(...pairs: [string, string][]): ReadonlyMap<string, string> {
  return new Map(pairs)
}

function header(colons: number, name: string, argument?: string, ...pairs: [string, string][]): { value: DirectiveLine } {
  return { value: { argument, attributes: attributes(...pairs), colons, kind: 'header', name } }
}

function fault(line: string): string {
  const read = readDirectiveLine(line)
  return read?.fault === undefined ? `read ${JSON.stringify(read)}` : read.fault.message
}

function inline(text: string): unknown {
  const read = readInlineDirective(text, 0)
  if (read === undefined) return 'unclaimed'
  if (read.fault !== undefined) return read.fault.message
  return { attributes: read.value.attributes, content: read.value.content, length: read.value.length, name: read.value.name }
}

function spans(text: string, name: string, content: string | undefined, ...pairs: [string, string][]): void {
  assert.deepEqual(inline(text), { attributes: attributes(...pairs), content, length: text.length, name })
}

test('claims a colon-run line only where a name or nothing follows the colons', () => {
  assert.equal(readDirectiveLine('Part.'), undefined)
  assert.equal(readDirectiveLine(':: two'), undefined)
  assert.equal(readDirectiveLine(':panel'), undefined)
  assert.equal(readDirectiveLine('  ::rule'), undefined)
})

test('reads a bare colon run as the fence that closes a container', () => {
  assert.deepEqual(readDirectiveLine(':::'), { value: { colons: 3, kind: 'closing' } })
  assert.deepEqual(readDirectiveLine('::'), { value: { colons: 2, kind: 'closing' } })
  assert.deepEqual(readDirectiveLine('::::::  \t'), { value: { colons: 6, kind: 'closing' } })
})

test('reads the leaf and container forms, their argument and their attributes', () => {
  assert.deepEqual(readDirectiveLine('::rule'), header(2, 'rule'))
  assert.deepEqual(readDirectiveLine('::rule  '), header(2, 'rule'))
  assert.deepEqual(readDirectiveLine('::taskItem TODO'), header(2, 'taskItem', 'TODO'))
  assert.deepEqual(readDirectiveLine('::hardBreak {}'), header(2, 'hardBreak'))
  assert.deepEqual(readDirectiveLine('::media {id=a-1 type=file}'), header(2, 'media', undefined, ['id', 'a-1'], ['type', 'file']))
  assert.deepEqual(readDirectiveLine('::panel info {panelColor="#ff0000"} '), header(2, 'panel', 'info', ['panelColor', '#ff0000']))
  assert.deepEqual(readDirectiveLine(':::panel info'), header(3, 'panel', 'info'))
})

test('decodes a quoted attribute value, the escapes {attrs} reserves included', () => {
  assert.deepEqual(readDirectiveLine('::extension {text="two words"}'), header(2, 'extension', undefined, ['text', 'two words']))
  assert.deepEqual(readDirectiveLine('::extension {text="a\\u0060b\\u0026c\\u003cd\\u007ce"}'), header(2, 'extension', undefined, ['text', 'a`b&c<d|e']))
  assert.deepEqual(readDirectiveLine('::extension {text="a\\"b\\\\c\\nd"}'), header(2, 'extension', undefined, ['text', 'a"b\\c\nd']))
  assert.deepEqual(readDirectiveLine('::extension {text="}{"}'), header(2, 'extension', undefined, ['text', '}{']))
})

test('names the directive line no spelling reads', () => {
  assert.equal(fault('::Panel'), 'a directive name reads [a-z][A-Za-z0-9]*')
  assert.equal(fault('::1panel'), 'a directive name reads [a-z][A-Za-z0-9]*')
  assert.equal(fault('::panel  info'), 'a directive line reads a name, one bare argument and {attrs}, one space apart')
  assert.equal(fault('::panel info extra'), 'a directive line reads a name, one bare argument and {attrs}, one space apart')
  assert.equal(fault('::panel{}'), 'a directive line reads a name, one bare argument and {attrs}, one space apart')
  assert.equal(fault('::panel info{}'), 'a directive line reads a name, one bare argument and {attrs}, one space apart')
  assert.equal(fault('::panel {} x'), 'a directive line reads a name, one bare argument and {attrs}, one space apart')
})

test('names the attributes no spelling reads', () => {
  assert.equal(fault('::panel {a=1'), 'the {attrs} closing brace is missing')
  assert.equal(fault('::panel {a="x}'), 'the {attrs} quoted value is unclosed')
  assert.equal(fault('::panel {a="\\uzzzz"}'), 'the {attrs} quoted value is not a JSON string')
  assert.equal(fault('::panel {a}'), 'an attribute reads key=value, the value bare or double-quoted')
  assert.equal(fault('::panel {a=}'), 'an attribute reads key=value, the value bare or double-quoted')
  assert.equal(fault('::panel {=1}'), 'an attribute reads key=value, the value bare or double-quoted')
  assert.equal(fault('::panel {a=1  b=2}'), 'an attribute reads key=value, the value bare or double-quoted')
  assert.equal(fault('::panel { a=1}'), 'an attribute reads key=value, the value bare or double-quoted')
  assert.equal(fault('::panel {a=1 }'), 'an attribute reads key=value, the value bare or double-quoted')
  assert.equal(fault('::panel {a=1 a=2}'), 'the attribute key a is spelled twice')
})

test('breaks the directive on the raw characters a quoted value spells as escapes', () => {
  assert.equal(fault('::panel {a="x`y"}'), 'a raw ` inside {attrs} breaks the directive: spell it \\u0060')
  assert.equal(fault('::panel {a="x&y"}'), 'a raw & inside {attrs} breaks the directive: spell it \\u0026')
  assert.equal(fault('::panel {a="x<y"}'), 'a raw < inside {attrs} breaks the directive: spell it \\u003c')
  assert.equal(fault('::panel {a="x|y"}'), 'a raw | inside {attrs} breaks the directive: spell it \\u007c')
})

test('reads an inline directive only where a bracket or a brace follows the name', () => {
  assert.equal(inline('Part.'), 'unclaimed')
  assert.equal(inline(':10:30'), 'unclaimed')
  assert.equal(inline(':smile:'), 'unclaimed')
  assert.equal(inline(':Mention[@A]'), 'unclaimed')
  assert.equal(inline(':mention @A'), 'unclaimed')
  spans(':mention[@A]', 'mention', '@A')
  spans(':date{timestamp=1756080000000}', 'date', undefined, ['timestamp', '1756080000000'])
  spans(':emoji[]{shortName=":tada:"}', 'emoji', '', ['shortName', ':tada:'])
  spans(':underline[ a ]', 'underline', ' a ')
})

test('binds an inline directive as a unit, its content balancing brackets like link text', () => {
  spans(':underline[a [b] c]', 'underline', 'a [b] c')
  spans(':underline[a \\] b]', 'underline', 'a \\] b')
  spans(':underline[a `]` b]', 'underline', 'a `]` b')
  spans(':underline[a `b c]', 'underline', 'a `b c')
  spans(':underline[:status[x]{color=red}]', 'underline', ':status[x]{color=red}')
  spans(':status[x]{color=red style="bold "}', 'status', 'x', ['color', 'red'], ['style', 'bold '])
  assert.deepEqual(inline(':underline[a]{}(b)'), { attributes: attributes(), content: 'a', length: 15, name: 'underline' })
  assert.deepEqual(inline(':underline[a] {}'), { attributes: attributes(), content: 'a', length: 13, name: 'underline' })
  assert.deepEqual(inline(':text{text=" "} and more'), { attributes: attributes(['text', ' ']), content: undefined, length: 15, name: 'text' })
})

test('names the inline directive left unclosed at the end of its line', () => {
  assert.equal(inline(':mention[@A'), 'an inline directive [content] is unclosed')
  assert.equal(inline(':mention[@A\nB]'), 'an inline directive [content] is unclosed')
  assert.equal(inline(':mention[a `b\nc` d]'), 'an inline directive [content] is unclosed')
  assert.equal(inline(':underline[:status[x'), 'an inline directive [content] is unclosed')
  assert.equal(inline(':mention[@A]{id=1'), 'the {attrs} closing brace is missing')
  assert.equal(inline(':mention{id=1'), 'the {attrs} closing brace is missing')
})

test('refuses inline directives nested deeper than the parser carries', () => {
  const nest = (depth: number): string => `${':underline['.repeat(depth)}x${']'.repeat(depth)}`
  spans(nest(largestNesting), 'underline', nest(largestNesting - 1))
  assert.equal(inline(nest(largestNesting + 1)), `the input nests inline directives deeper than the ${largestNesting} levels the parser carries`)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import type { DirectiveAttributes, DirectiveLine } from './directive-syntax.ts'
import { largestNesting } from '../nesting.ts'
import { claimsDirectivePrefix, readDirectiveLine, readInlineDirective } from './directive-syntax.ts'

// A pair the input spells bare decodes to itself; a quoted one names its spelling beside the decoding.
type Pair = [string, string, string?]

function attributes(...pairs: Pair[]): DirectiveAttributes {
  return new Map(pairs.map(([key, decoded, spelling]) => [key, { decoded, spelling: spelling ?? decoded }]))
}

function opener(name: string, argument?: string, ...pairs: Pair[]): { value: DirectiveLine } {
  return { value: { argument, attributes: attributes(...pairs), kind: 'opener', name } }
}

function fault(line: string): string {
  const read = readDirectiveLine(line)
  return read?.fault === undefined ? `read ${JSON.stringify(read)}` : read.fault.message
}

function inline(text: string): unknown {
  if (!claimsDirectivePrefix(text, 0)) return 'unclaimed'
  const read = readInlineDirective(text, 0)
  if (read.fault !== undefined) return read.fault.message
  return { attributes: read.value.attributes, content: read.value.content, length: read.value.length, name: read.value.name }
}

function spans(text: string, name: string, content: string | undefined, ...pairs: Pair[]): void {
  assert.deepEqual(inline(text), { attributes: attributes(...pairs), content, length: text.length, name })
}

test('claims a prefixed line only where a closer, or a name a space or the line end follows, opens it', () => {
  assert.equal(readDirectiveLine('Part.'), undefined)
  assert.equal(readDirectiveLine(':::panel info'), undefined)
  assert.equal(readDirectiveLine('  !adf:rule'), undefined)
  assert.equal(readDirectiveLine('!adf:mention[@A]'), undefined)
  assert.equal(readDirectiveLine('!adf:hardBreak{}'), undefined)
  assert.equal(readDirectiveLine('!adf:panel{}'), undefined)
  assert.equal(readDirectiveLine('!adf:'), undefined)
  assert.equal(readDirectiveLine('!adf:/'), undefined)
  assert.equal(readDirectiveLine('!adf:Panel'), undefined)
  assert.equal(readDirectiveLine('!adf:panel\tinfo'), undefined)
})

test('reads a closer as the name it closes, and nothing after the name', () => {
  assert.deepEqual(readDirectiveLine('!adf:/panel'), { value: { kind: 'closer', name: 'panel' } })
  assert.deepEqual(readDirectiveLine('!adf:/panel \t'), { value: { kind: 'closer', name: 'panel' } })
  const closer = 'a closer carries nothing after its name: this one does; \\!adf: keeps the prefix literal'
  assert.equal(fault('!adf:/panel info'), closer)
  assert.equal(fault('!adf:/panel{}'), closer)
})

test('reads the opener, its argument and its attributes', () => {
  assert.deepEqual(readDirectiveLine('!adf:rule'), opener('rule'))
  assert.deepEqual(readDirectiveLine('!adf:rule \t'), opener('rule'))
  assert.deepEqual(readDirectiveLine('!adf:rule\t'), opener('rule'))
  assert.deepEqual(readDirectiveLine('!adf:taskItem TODO'), opener('taskItem', 'TODO'))
  assert.deepEqual(readDirectiveLine('!adf:media {id=a-1 type=file}'), opener('media', undefined, ['id', 'a-1'], ['type', 'file']))
  assert.deepEqual(readDirectiveLine('!adf:panel info {panelColor="#ff0000"} '), opener('panel', 'info', ['panelColor', '#ff0000', '"#ff0000"']))
})

test('decodes a quoted attribute value, the escapes {attrs} reserves included', () => {
  assert.deepEqual(readDirectiveLine('!adf:extension {text="two words"}'), opener('extension', undefined, ['text', 'two words', '"two words"']))
  assert.deepEqual(
    readDirectiveLine('!adf:extension {text="a\\u0060b\\u0026c\\u003cd\\u007ce"}'),
    opener('extension', undefined, ['text', 'a`b&c<d|e', '"a\\u0060b\\u0026c\\u003cd\\u007ce"']),
  )
  assert.deepEqual(readDirectiveLine('!adf:extension {text="a\\"b\\\\c\\nd"}'), opener('extension', undefined, ['text', 'a"b\\c\nd', '"a\\"b\\\\c\\nd"']))
  assert.deepEqual(readDirectiveLine('!adf:extension {text="}{"}'), opener('extension', undefined, ['text', '}{', '"}{"']))
})

test('names the {attrs} keys read out of the alphabetical order canonical form spells', () => {
  assert.equal(fault('!adf:media {type=file id=a-1}'), 'the {attrs} keys read in alphabetical order: id before type')
  assert.deepEqual(readDirectiveLine('!adf:media {id=a-1 type=file}'), opener('media', undefined, ['id', 'a-1'], ['type', 'file']))
})

test('spells an empty {attrs} only where the brace itself claims the directive', () => {
  const omitted = 'an empty {attrs} is omitted unless the { itself claims the directive: this one spells {}'
  assert.equal(fault('!adf:rule {}'), omitted)
  assert.equal(fault('!adf:panel info {}'), omitted)
  assert.equal(inline('!adf:underline[a]{}'), omitted)
  spans('!adf:hardBreak{}', 'hardBreak', undefined)
})

test('names the opener no spelling reads', () => {
  const shape = 'a directive opener reads a name, one bare argument and {attrs}, one space apart: this one does not; \\!adf: keeps the prefix literal'
  assert.equal(fault('!adf:panel  info'), shape)
  assert.equal(fault('!adf:panel info extra'), shape)
  assert.equal(fault('!adf:panel "info"'), shape)
  assert.equal(fault('!adf:panel info{}'), shape)
  assert.equal(fault('!adf:panel {a=1} x'), shape)
})

test('names the attributes no spelling reads', () => {
  assert.equal(fault('!adf:panel {a=1'), 'the {attrs} closing brace is missing')
  assert.equal(fault('!adf:panel {a="x}'), 'the {attrs} quoted value is unclosed')
  assert.equal(fault('!adf:panel {a="\\uzzzz"}'), 'the {attrs} quoted value is not a JSON string')
  assert.equal(fault('!adf:panel {a}'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.equal(fault('!adf:panel {a=}'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.equal(fault('!adf:panel {=1}'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.equal(fault('!adf:panel {a=1  b=2}'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.equal(fault('!adf:panel { a=1}'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.equal(fault('!adf:panel {a=1 }'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
  assert.equal(fault('!adf:panel {a=1 a=2}'), 'the attribute key a is spelled twice')
  assert.equal(inline('!adf:mention[@A]{id}'), 'an attribute reads key=value, the value bare or double-quoted: this one does not; \\!adf: keeps the prefix literal')
})

test('breaks the directive on the raw characters a quoted value spells as escapes', () => {
  assert.equal(fault('!adf:panel {a="x`y"}'), 'a raw ` inside {attrs} breaks the directive: spell it \\u0060')
  assert.equal(fault('!adf:panel {a="x&y"}'), 'a raw & inside {attrs} breaks the directive: spell it \\u0026')
  assert.equal(fault('!adf:panel {a="x<y"}'), 'a raw < inside {attrs} breaks the directive: spell it \\u003c')
  assert.equal(fault('!adf:panel {a="x|y"}'), 'a raw | inside {attrs} breaks the directive: spell it \\u007c')
})

test('claims at the prefix, and reads a directive only where a bracket or a brace follows the name', () => {
  const completes = 'an unescaped !adf: completes no directive; \\!adf: keeps the prefix literal'
  assert.equal(inline('Part.'), 'unclaimed')
  assert.equal(inline(':mention[@A]'), 'unclaimed')
  assert.equal(inline('!adfx:mention[@A]'), 'unclaimed')
  assert.equal(inline('!adf:'), completes)
  assert.equal(inline('!adf:Mention[@A]'), completes)
  assert.equal(inline('!adf:mention @A'), completes)
  spans('!adf:mention[@A]', 'mention', '@A')
  spans('!adf:date{timestamp=1756080000000}', 'date', undefined, ['timestamp', '1756080000000'])
  spans('!adf:emoji[]{shortName=":tada:"}', 'emoji', '', ['shortName', ':tada:', '":tada:"'])
  spans('!adf:underline[ a ]', 'underline', ' a ')
})

test('binds an inline directive as a unit, its content balancing brackets like link text', () => {
  spans('!adf:underline[a [b] c]', 'underline', 'a [b] c')
  spans('!adf:underline[a \\] b]', 'underline', 'a \\] b')
  spans('!adf:underline[a `]` b]', 'underline', 'a `]` b')
  spans('!adf:underline[a `b c]', 'underline', 'a `b c')
  spans('!adf:underline[!adf:status[x]{color=red}]', 'underline', '!adf:status[x]{color=red}')
  spans('!adf:status[x]{color=red style="bold "}', 'status', 'x', ['color', 'red'], ['style', 'bold ', '"bold "'])
  assert.deepEqual(inline('!adf:underline[a] {}'), { attributes: attributes(), content: 'a', length: 17, name: 'underline' })
  assert.deepEqual(inline('!adf:text{text=" "} and more'), { attributes: attributes(['text', ' ', '" "']), content: undefined, length: 19, name: 'text' })
})

test('names the inline directive left unclosed at the end of its line', () => {
  assert.equal(inline('!adf:mention[@A'), 'an inline directive [content] is unclosed; \\!adf: keeps the prefix literal')
  assert.equal(inline('!adf:mention[@A\nB]'), 'an inline directive [content] is unclosed; \\!adf: keeps the prefix literal')
  assert.equal(inline('!adf:mention[a `b\nc` d]'), 'an inline directive [content] is unclosed; \\!adf: keeps the prefix literal')
  assert.equal(inline('!adf:underline[!adf:status[x'), 'an inline directive [content] is unclosed; \\!adf: keeps the prefix literal')
  assert.equal(inline('!adf:mention[@A]{id=1'), 'the {attrs} closing brace is missing')
  assert.equal(inline('!adf:mention{id=1'), 'the {attrs} closing brace is missing')
  assert.equal(inline('!adf:text{text="a\nb"}'), 'the {attrs} quoted value is not a JSON string')
})

test('refuses inline directives nested deeper than the parser carries', () => {
  const nest = (depth: number): string => `${'!adf:underline['.repeat(depth)}x${']'.repeat(depth)}`
  spans(nest(largestNesting), 'underline', nest(largestNesting - 1))
  assert.equal(inline(nest(largestNesting + 1)), `the input nests inline directives deeper than the ${largestNesting} levels the parser carries`)
})

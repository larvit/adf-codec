import fc from 'fast-check'
import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument } from './adf/document.ts'
import type { Arbitrary, DepthIdentifier } from 'fast-check'
import type { AttributeVocabulary } from './adf/attribute-vocabulary.ts'
import type { JsonValue } from './json-value.ts'
import type { Result } from './result.ts'
import { adfDocument, attributes, jsonKey, jsonValue, markdownPieces, propertyRuns, propertyTimeout, textOf } from './property-harness.ts'
import { adfToMarkdown } from './markdown/emit/adf-to-markdown.ts'
import { blockArgument } from './markdown/block-directive-arguments.ts'
import { blockDirectives } from './adf/block-directives.ts'
import { carryFence, carryName } from './markdown/opaque-carry.ts'
import { directivePrefix, spellAttributes, spellDirectiveOpener, spellJsonAttribute, spellLeafDirective, spellStringAttribute, spellVocabulary } from './markdown/directive-syntax.ts'
import { fencedCodeBlock } from './markdown/backtick-runs.ts'
import { inlineDirectives } from './adf/inline-directives.ts'
import { listBreakName } from './markdown/list-break.ts'
import { markAttributes } from './adf/mark-attributes.ts'
import { markSpelling } from './markdown/mark-spellings.ts'
import { markdownToAdf } from './markdown/parse/markdown-to-adf.ts'
import { marksAttribute } from './markdown/block-directive-marks.ts'
import { nodeContent, nodeMarks } from './adf/document.ts'
import { serializeCanonicalJson } from './canonical-json.ts'
import { textDirectiveName } from './markdown/text-directive.ts'
import { toEditorNormal } from './adf/editor-normal.ts'
import { vocabularyPairs } from './adf/attribute-vocabulary.ts'

type Choice = { arbitrary: Arbitrary<string>; hostile?: true; weight: number }

type Edit = [at: number, removed: number, inserted: string]

type InlineMarkdown = { destination: Arbitrary<string>; inlines: Arbitrary<string>; label: Arbitrary<string>; oneLine: Arbitrary<string>; text: Arbitrary<string>; word: Arbitrary<string> }

type LeafMarkdown = { fencedCode: Arbitrary<string>; leafBlock: Arbitrary<string> }

const commonMarkTypes = new Set(['blockquote', 'bulletList', 'codeBlock', 'hardBreak', 'heading', 'listItem', 'orderedList', 'paragraph', 'rule', 'text'])
const directiveShapedFloor = 330
const fixpointFloor = 600
const gateRuns = 1000
const markdownMarkTypes = new Set(Object.keys(markAttributes).filter((type) => markSpelling(type)?.kind !== 'directive'))

const vocabularies = [...Object.values(blockDirectives).map((directive) => directive.attributes), ...Object.values(inlineDirectives).map((directive) => directive.attributes), ...Object.values(markAttributes)]
const attributeKeys = [
  ...new Set([...vocabularies.flatMap((vocabulary) => Object.keys(vocabulary)), ...Object.keys(blockDirectives).flatMap((type) => blockArgument(type) ?? []), marksAttribute, 'json', textDirectiveName]),
]
const directiveNames = [...Object.keys(blockDirectives), ...Object.keys(inlineDirectives), ...Object.keys(markAttributes), carryName, listBreakName, textDirectiveName]

// Hostile generation reaches refusals; clean generation holds none a single piece would trip, so a whole document reaches the emitter.
function choose(hostile: boolean, choices: readonly Choice[], depth?: { depthIdentifier: DepthIdentifier; maxDepth: number }): Arbitrary<string> {
  const held = choices.filter((choice) => hostile || choice.hostile !== true).map(({ arbitrary, weight }) => ({ arbitrary, weight }))
  return depth === undefined ? fc.oneof(...held) : fc.oneof({ ...depth, depthSize: 'small' }, ...held)
}

const bareToken = fc.stringMatching(/^[A-Za-z0-9_-]{1,8}$/)
const prose = fc.stringMatching(/^[A-Za-z][a-z]{0,6}(?: [a-z]{1,6}){0,3}$/)
const cleanText = fc.string({ maxLength: 12, unit: fc.constantFrom(...'aZ09 \t!"#$%&\'()*+,-./;=?@[\\]^_`{}~é\xa0🎉') })
const syntaxTokens = fc.constantFrom(
  ...[...String.fromCodePoint(0x0, 0xb, 0xc, 0x85, 0xa0, 0x200b, 0x2028, 0x3000, 0xfeff)],
  '\n',
  '\r\n',
  '\r',
  '\t',
  '    ',
  '  \n',
  '\\\n',
  '**',
  '__',
  '~~',
  '***',
  '```',
  '~~~',
  '![',
  '](',
  '{}',
  '::',
  ':::',
  '> ',
  '- ',
  '* ',
  '1. ',
  '2) ',
  '# ',
  '---',
  '===',
  '| ',
  ' |',
  '<!--',
  '-->',
  '&amp;',
  '&#',
)
const piece = fc.oneof(markdownPieces, syntaxTokens)

const namedEntity = fc.constantFrom('&amp;', '&lt;', '&quot;', '&copy;', '&nbsp;', '&ouml;', '&bogus;', '&amp', '&#;', '&AMP;', '&ngE;')
const numericEntity = fc
  .tuple(fc.oneof(fc.integer({ max: 0x7f, min: 0 }), fc.integer({ max: 0xffff, min: 0 }), fc.integer({ max: 0x110000, min: 0 })), fc.boolean())
  .map(([code, hex]) => (hex ? `&#x${code.toString(16)};` : `&#${code};`))
const escape = fc.constantFrom(...'!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~a \n').map((escaped) => `\\${escaped}`)
const backticks = fc.integer({ max: 3, min: 1 }).map((count) => '`'.repeat(count))
const codeSpan = fc
  .tuple(backticks, fc.oneof(prose, textOf(0)), fc.oneof({ arbitrary: fc.constant(undefined), weight: 4 }, { arbitrary: backticks, weight: 1 }))
  .map(([opener, body, closer]) => `${opener}${body}${closer ?? opener}`)
const autolink = fc.oneof(
  fc.tuple(fc.constantFrom('http://', 'https://', 'mailto:', 'ab:', 'x+y.z-:'), prose).map(([scheme, rest]) => `<${scheme}${rest.replaceAll(' ', '/')}>`),
  fc.stringMatching(/^<[a-z.+]{1,6}@[a-z-]{1,6}(?:\.[a-z]{1,4})?>$/),
)
const hostileAutolink = fc.tuple(fc.constantFrom('http://', 'ab:', 'a:'), textOf(0)).map(([scheme, rest]) => `<${scheme}${rest}>`)
const inlineHtml = fc.constantFrom('<span>', '</span>', '<a href="x">', "<b class='y'/>", '<!-- c -->', '<!---->', '<?x?>', '<![CDATA[x]]>', '<!X y>', '<br/>', '<b', '<3', '< a>')
const hardBreak = fc.constantFrom('\\\n', '  \n', '\n', spellLeafDirective('hardBreak', ''))
const spellTextDirective = (held: string) => spellLeafDirective(textDirectiveName, `{${textDirectiveName}=${spellStringAttribute(held)}}`)
const textDirective = fc.constantFrom(' ', '  ', '\t', '\n', '\n\n').map(spellTextDirective)
const hostileTextDirective = fc.constantFrom(' \n', 'a', '').map(spellTextDirective)

const url = fc.stringMatching(/^https?:\/\/[a-z]{1,6}\.[a-z]{2,3}(?:\/[a-z0-9()]{0,5})?$/)
const title = (text: Arbitrary<string>) => fc.oneof(fc.constant(''), text.map((held) => ` "${held}"`), text.map((held) => ` '${held}'`), text.map((held) => ` (${held})`))

const attributeValue = fc.oneof(
  { arbitrary: bareToken, weight: 3 },
  { arbitrary: fc.constantFrom('true', 'false', '0', '1', '3', '-1', '1.5', '1e2', '"1"', '01', 'null', '"[]"', '"{}"', '"#deebff"'), weight: 2 },
  { arbitrary: textOf(0).map(spellStringAttribute), weight: 3 },
  { arbitrary: jsonValue.map(spellJsonAttribute), weight: 2 },
  { arbitrary: textOf(0).map((held) => JSON.stringify(held)), weight: 1 },
  { arbitrary: textOf(0).map((held) => `"${held}`), weight: 1 },
)
const attributePairs = fc.uniqueArray(fc.tuple(fc.oneof({ arbitrary: fc.constantFrom(...attributeKeys), weight: 4 }, { arbitrary: bareToken, weight: 1 }), attributeValue), {
  maxLength: 3,
  minLength: 1,
  selector: ([key]) => key,
})
const hostileAttributes = fc.oneof(
  { arbitrary: fc.constant(''), weight: 3 },
  {
    arbitrary: fc.tuple(attributePairs, fc.boolean()).map(([pairs, sorted]) => {
      const ordered = sorted ? pairs.toSorted(([left], [right]) => (left < right ? -1 : 1)) : pairs
      return `{${ordered.map(([key, value]) => `${key}=${value}`).join(' ')}}`
    }),
    weight: 6,
  },
  { arbitrary: fc.constantFrom('{}', '{ }', '{a}', '{a=}', '{=b}', '{a=b', '{a=b  c=d}', '{a="}"}'), weight: 1 },
)

function tableAttributes(vocabulary: AttributeVocabulary, slot?: string): Arbitrary<string> {
  return attributes(vocabulary).map((attrs) => spellAttributes(spellVocabulary(vocabularyPairs(attrs, vocabulary, slot === undefined ? [] : [slot]) ?? [])))
}

const directiveName = fc.oneof({ arbitrary: fc.constantFrom(...directiveNames), weight: 8 }, { arbitrary: fc.stringMatching(/^[A-Za-z0-9-]{1,6}$/), weight: 1 })
const hostileArgument = fc.oneof(
  { arbitrary: fc.constant(''), weight: 3 },
  { arbitrary: fc.constantFrom(' info', ' warning', ' custom', ' DONE', ' TODO'), weight: 2 },
  { arbitrary: fc.oneof(bareToken.map((held) => ` ${held}`), fc.constantFrom('  info', ' a b', ' "a"')), weight: 1 },
)

function directiveHeader(colons: number, name: string, argument: string, attrs: string): string {
  return `${':'.repeat(colons)}${name}${argument}${attrs === '' ? '' : ` ${attrs}`}`
}

function container(header: (colons: number) => string, body: string, closer: number | null): string {
  const colons = Math.max(2, ...[...body.matchAll(/:{2,}/g)].map(([run]) => run.length)) + 1
  return [header(colons), ...(body === '' ? [] : [body]), ':'.repeat(closer ?? colons)].join('\n')
}

const carriedNode = fc.oneof(
  fc.tuple(fc.constantFrom('mention', 'paragraph', 'status', 'widget'), fc.dictionary(jsonKey, jsonValue, { maxKeys: 2, noNullPrototype: true })).map(([type, attrs]): JsonValue => ({ attrs, type })),
  textOf(1).map((held): JsonValue => ({ text: held, type: 'text' })),
)
const spellCarry = (json: string) => spellLeafDirective(carryName, `{json=${spellStringAttribute(json)}}`)
const inlineCarry = carriedNode.map((node) => spellCarry(serializeCanonicalJson(node, 'compact')))
const hostileInlineCarry = fc.oneof(carriedNode, jsonValue).map((node) => spellCarry(JSON.stringify(node, null, 1)))
const blockCarry = carriedNode.map((node) => fencedCodeBlock(carryFence, serializeCanonicalJson(node, 'two-space')))
const hostileBlockCarry = fc.oneof(carriedNode, jsonValue).map((node) => fencedCodeBlock(carryFence, JSON.stringify(node)))

function prefixLines(body: string, first: string, rest: (index: number) => string): string {
  return body
    .split('\n')
    .map((line, index) => (index === 0 ? `${first}${line}` : line === '' ? rest(index).trimEnd() : `${rest(index)}${line}`))
    .join('\n')
}

const separator = fc.oneof({ arbitrary: fc.constant('\n\n'), weight: 4 }, { arbitrary: fc.constant('\n'), weight: 3 }, { arbitrary: fc.constantFrom('\n\n\n', '\n \n', '\n\t\n'), weight: 1 })
const quotePrefix = fc.oneof({ arbitrary: fc.constant('> '), weight: 6 }, { arbitrary: fc.constantFrom('>', ' > ', '>  ', '>\t', ''), weight: 1 })
const listMarker = fc.oneof(
  { arbitrary: fc.constantFrom('-', '*', '+'), weight: 3 },
  {
    arbitrary: fc
      .tuple(fc.oneof({ arbitrary: fc.integer({ max: 3, min: 0 }), weight: 4 }, { arbitrary: fc.integer({ max: 1000000000, min: 0 }), weight: 1 }), fc.constantFrom('.', ')'))
      .map(([start, delimiter]) => `${start}${delimiter}`),
    weight: 2,
  },
)
const indentDrift = fc.oneof({ arbitrary: fc.constant(0), weight: 6 }, { arbitrary: fc.integer({ max: 2, min: -2 }), weight: 1 })
const closerDrift = fc.option(fc.integer({ max: 5, min: 2 }), { freq: 6 })

function markdownOf(hostile: boolean): Arbitrary<string> {
  const inline = inlineMarkdown(hostile)
  return blockMarkdown(hostile, inline, leafBlocks(hostile, inline))
}

function inlineMarkdown(hostile: boolean): InlineMarkdown {
  const inlineDepth = fc.createDepthIdentifier()
  const text = hostile ? fc.oneof(cleanText, textOf(0)) : cleanText
  const word = fc.oneof({ arbitrary: prose, weight: 3 }, { arbitrary: text.filter((held) => held !== ''), weight: 2 })
  const destination = fc.oneof(url, text, fc.stringMatching(/^<[0-9.#][a-z0-9 ]{0,6}>$/), fc.constant(''), ...(hostile ? [text.map((held) => `<${held}>`)] : []))
  const label = fc.oneof(prose, word)

  const { inlines } = fc.letrec<{ inline: string; inlines: string }>((tie) => ({
    inline: choose(
      hostile,
      [
        { arbitrary: word, weight: 12 },
        { arbitrary: fc.oneof(codeSpan, autolink, namedEntity, numericEntity, escape, hardBreak, textDirective, inlineCarry), weight: 8 },
        { arbitrary: fc.oneof(hostileAutolink, hostileInlineCarry, hostileTextDirective, inlineHtml, piece), hostile: true, weight: 4 },
        {
          arbitrary: fc
            .tuple(fc.constantFrom('*', '_', '**', '__', '***', '~~', '~'), fc.constantFrom('', '', ' '), tie('inlines'), fc.constantFrom('', '', ' '), fc.option(fc.constantFrom('*', '_', '**', '~~'), { freq: 4 }))
            .map(([opener, inside, body, closing, closer]) => `${opener}${inside}${body}${closing}${closer ?? opener}`),
          weight: 4,
        },
        {
          arbitrary: fc
            .tuple(fc.constantFrom('', '', hostile ? '!' : ''), tie('inlines'), fc.oneof(fc.tuple(destination, title(text)).map(([target, titled]) => `(${target}${titled})`), label.map((held) => `[${held}]`), fc.constantFrom('', '[]')))
            .map(([image, content, target]) => `${image}[${content}]${target}`),
          weight: 3,
        },
        {
          arbitrary: fc.oneof(
            ...Object.entries(inlineDirectives).map(([name, directive]) =>
              fc
                .tuple(directive.textAttribute === undefined ? fc.constant(null) : fc.option(hostile ? word : prose), tableAttributes(directive.attributes, directive.textAttribute))
                .map(([slot, attrs]) => (slot === null ? spellLeafDirective(name, attrs) : `${spellDirectiveOpener(name)}${slot}]${attrs}`)),
            ),
            ...Object.entries(markAttributes)
              .filter(([name]) => hostile || markSpelling(name)?.kind === 'directive')
              .map(([name, vocabulary]) => fc.tuple(tie('inlines'), tableAttributes(vocabulary)).map(([content, attrs]) => `${spellDirectiveOpener(name)}${content}]${attrs}`)),
          ),
          weight: 2,
        },
        {
          arbitrary: fc
            .tuple(directiveName, fc.option(tie('inlines'), { freq: 3 }), hostileAttributes)
            .map(([name, content, attrs]) => `${directivePrefix}${name}${content === null ? '' : `[${content}]`}${attrs}`),
          hostile: true,
          weight: 2,
        },
      ],
      { depthIdentifier: inlineDepth, maxDepth: 3 },
    ),
    inlines: fc.array(tie('inline'), { depthIdentifier: inlineDepth, maxLength: 4, minLength: 1 }).map((parts) => parts.join('')),
  }))
  return { destination, inlines, label, oneLine: inlines.map((held) => held.replace(/[\n\r]/g, ' ')), text, word }
}

function leafBlocks(hostile: boolean, { destination, inlines, label, oneLine, text, word }: InlineMarkdown): LeafMarkdown {
  const fencedCode = fc
    .tuple(
      fc.constantFrom('```', '```', '~~~', '````', '``'),
      fc.oneof(fc.constant(''), bareToken, text),
      fc.array(fc.oneof(prose, text, fc.constantFrom('```', '~~~', ':::', '    x')), { maxLength: 3 }),
      fc.constantFrom('', '', '`', '~', 'none'),
    )
    .map(([fence, info, lines, closer]) => [`${fence}${info}`, ...lines, ...(closer === 'none' ? [] : [`${fence}${closer}`])].join('\n'))
  const pipeTable = fc
    .record({
      body: fc.array(fc.array(oneLine, { maxLength: 3 }), { maxLength: 2 }),
      delimiter: fc.array(fc.constantFrom('---', '-', ':--', '--:', ':-:', '', '==='), { maxLength: 3, minLength: 1 }),
      header: fc.array(oneLine, { maxLength: 3, minLength: 1 }),
      leading: fc.boolean(),
      regular: hostile ? fc.boolean() : fc.constant(true),
      trailing: fc.boolean(),
    })
    .map(({ body, delimiter, header, leading, regular, trailing }) => {
      const row = (cells: readonly string[]) => (regular || leading ? `| ${cells.join(' | ')}` : cells.join(' | ')) + (regular || trailing ? ' |' : '')
      const width = (cells: readonly string[]) => (regular ? header.map((_, index) => cells[index] ?? '') : cells)
      return [row(header), row(regular ? header.map(() => '---') : delimiter), ...body.map((cells) => row(width(cells)))].join('\n')
    })

  const leafBlock = choose(hostile, [
    {
      arbitrary: fc
        .tuple(fc.integer({ max: 7, min: 1 }), fc.constantFrom(' ', ' ', '', '\t'), oneLine, fc.constantFrom('', '', ' #', '#', ' ##  '))
        .map(([level, gap, content, closer]) => `${'#'.repeat(level)}${gap}${content}${closer}`),
      weight: 3,
    },
    {
      arbitrary: fc.tuple(inlines, fc.constantFrom('=', '-'), fc.integer({ max: 4, min: 1 }), fc.constantFrom('', ' ')).map(([content, underline, length, trailing]) => `${content}\n${underline.repeat(length)}${trailing}`),
      weight: 2,
    },
    { arbitrary: fc.constantFrom('---', '***', '___', '- - -', ' * * *', '_____', '--', '*-*'), weight: 1 },
    { arbitrary: fencedCode, weight: 2 },
    { arbitrary: blockCarry, weight: 1 },
    {
      arbitrary: fc.tuple(fc.constantFrom('    ', '\t', '     '), fc.array(fc.oneof(prose, text), { maxLength: 3, minLength: 1 })).map(([indent, lines]) => lines.map((line) => `${indent}${line}`).join('\n')),
      weight: 1,
    },
    { arbitrary: pipeTable, weight: 2 },
    { arbitrary: fc.tuple(label, destination, title(text)).map(([name, target, titled]) => `[${name}]: ${target}${titled}`), weight: 1 },
    { arbitrary: fc.tuple(word, fc.oneof(url, fc.constant(''))).map(([alt, target]) => `![${alt}](${target})`), weight: 1 },
    { arbitrary: hostileBlockCarry, hostile: true, weight: 1 },
    {
      arbitrary: fc.constantFrom('<div>\ntext\n</div>', '<!-- comment -->', '<pre>\nx\n</pre>', '<?php echo 1; ?>', '<!DOCTYPE html>', '<table>', '<custom-tag attr="1">', '</div>', '<![CDATA[\nx\n]]>'),
      hostile: true,
      weight: 1,
    },
    {
      arbitrary: fc.tuple(fc.constantFrom(2, 2, 3, 1, 4), directiveName, hostileArgument, hostileAttributes).map(([colons, name, argument, attrs]) => directiveHeader(colons, name, argument, attrs)),
      hostile: true,
      weight: 1,
    },
    { arbitrary: fc.constantFrom(':::', '::', '::::', ':::panel', '::: panel', ':::panel info extra'), hostile: true, weight: 1 },
  ])
  return { fencedCode, leafBlock }
}

function blockMarkdown(hostile: boolean, { inlines, oneLine }: InlineMarkdown, { fencedCode, leafBlock }: LeafMarkdown): Arbitrary<string> {
  const blockDepth = fc.createDepthIdentifier()
  const { blocks } = fc.letrec<{ block: string; blocks: string }>((tie) => {
    const bodyByModel = { block: fc.oneof(tie('blocks'), fc.constant('')), code: fencedCode, inline: fc.oneof(oneLine, fc.constant('')) }
    const tableDirectives = Object.entries(blockDirectives).map(([name, directive]) => {
      const argument =
        blockArgument(name) === undefined
          ? fc.constant('')
          : fc.oneof({ arbitrary: fc.constantFrom(' DONE', ' TODO', ' custom', ' info', ' warning'), weight: 3 }, { arbitrary: bareToken.map((held) => ` ${held}`), weight: 1 })
      const attrs = hostile ? fc.oneof({ arbitrary: tableAttributes(directive.attributes), weight: 4 }, { arbitrary: hostileAttributes, weight: 1 }) : tableAttributes(directive.attributes)
      if (directive.contentModel === 'none') return fc.tuple(argument, attrs).map(([held, spelled]) => directiveHeader(2, name, held, spelled))
      return fc
        .tuple(argument, attrs, bodyByModel[directive.contentModel], hostile ? closerDrift : fc.constant(null))
        .map(([held, spelled, body, closer]) => container((colons) => directiveHeader(colons, name, held, spelled), body, closer))
    })
    return {
      block: choose(
        hostile,
        [
          { arbitrary: fc.array(inlines, { maxLength: 3, minLength: 1 }).map((lines) => lines.join('\n')), weight: 10 },
          { arbitrary: leafBlock, weight: 10 },
          {
            arbitrary: fc.tuple(tie('blocks'), fc.array(quotePrefix, { maxLength: 3, minLength: 1 })).map(([body, prefixes]) => prefixLines(body, '> ', (index) => prefixes[index % prefixes.length] ?? '')),
            weight: 3,
          },
          {
            arbitrary: fc
              .tuple(listMarker, fc.array(fc.tuple(fc.option(listMarker, { freq: 4 }), fc.constantFrom(' ', ' ', ' ', '  ', '\t', '', '     '), tie('blocks'), indentDrift), { maxLength: 3, minLength: 1 }), separator)
              .map(([listed, items, gap]) =>
                items
                  .map(([own, space, body, drift]) => {
                    const marker = own ?? listed
                    return prefixLines(body, `${marker}${space}`, () => ' '.repeat(Math.max(0, marker.length + space.length + drift)))
                  })
                  .join(gap === '\n\n' ? '\n\n' : '\n'),
              ),
            weight: 4,
          },
          { arbitrary: fc.oneof(...tableDirectives), weight: 3 },
          {
            arbitrary: fc
              .tuple(directiveName, hostileArgument, hostileAttributes, tie('blocks'), fc.option(fc.integer({ max: 5, min: 3 }), { freq: 2 }), closerDrift)
              .map(([name, argument, attrs, body, opener, closer]) => container((colons) => directiveHeader(opener ?? colons, name, argument, attrs), body, closer)),
            hostile: true,
            weight: 1,
          },
        ],
        { depthIdentifier: blockDepth, maxDepth: 3 },
      ),
      blocks: fc
        .array(fc.tuple(separator, tie('block')), { depthIdentifier: blockDepth, maxLength: 3, minLength: 1 })
        .map((entries) => entries.map(([gap, block], index) => (index === 0 ? block : `${gap}${block}`)).join('')),
    }
  })
  return blocks
}

const cleanMarkdown = markdownOf(false)
const hostileMarkdown = markdownOf(true)

const canonical = adfDocument
  .map((document) => adfToMarkdown(document))
  .filter((emitted): emitted is Extract<Result<string>, { ok: true }> => emitted.ok)
  .map((emitted) => emitted.value)

function edited(markdown: string, edits: readonly Edit[]): string {
  let text = markdown
  for (const [at, removed, inserted] of edits) {
    const index = at % (text.length + 1)
    text = `${text.slice(0, index)}${inserted}${text.slice(index + removed)}`
  }
  return text
}

const edit: Arbitrary<Edit> = fc.tuple(fc.nat(), fc.nat({ max: 3 }), fc.oneof(piece, fc.constant('')))

const markdown = fc.oneof(
  { arbitrary: cleanMarkdown, weight: 4 },
  { arbitrary: hostileMarkdown, weight: 2 },
  { arbitrary: canonical, weight: 2 },
  { arbitrary: fc.tuple(fc.oneof(cleanMarkdown, canonical), fc.array(edit, { maxLength: 3, minLength: 1 })).map(([held, edits]) => edited(held, edits)), weight: 3 },
  { arbitrary: fc.string({ maxLength: 40, unit: piece }), weight: 1 },
)

const document = fc
  .tuple(markdown, fc.oneof({ arbitrary: fc.constant('\n'), weight: 8 }, { arbitrary: fc.constantFrom('\r\n', '\r'), weight: 1 }), fc.constantFrom('', '', '\n', '  \n'))
  .map(([held, ending, trailing]) => `${held}${trailing}`.replaceAll('\n', ending))

function holdsDirectiveShape(document: AdfDocument): boolean {
  const pending = [...nodeContent(document)]
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (!commonMarkTypes.has(node.type) || nodeMarks(node).some((mark) => !markdownMarkTypes.has(mark.type))) return true
    pending.push(...nodeContent(node))
  }
  return false
}

test('generated markdown refuses, or what it parses to refuses to emit, or its spelling reads back and spells itself', { timeout: propertyTimeout }, () => {
  const parameters = propertyRuns(gateRuns)
  let directiveShaped = 0
  let fixpoints = 0
  fc.assert(
    fc.property(document, (input) => {
      const parsed = markdownToAdf(input)
      if (!parsed.ok) return
      const emitted = adfToMarkdown(parsed.value)
      if (!emitted.ok) return
      fixpoints += 1
      if (holdsDirectiveShape(parsed.value)) directiveShaped += 1
      const read = markdownToAdf(emitted.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(emitted.value)}`)
      assert.deepEqual(toEditorNormal(read.value), toEditorNormal(parsed.value), `reading ${JSON.stringify(emitted.value)}`)
      const respelled = adfToMarkdown(read.value)
      assert.ok(respelled.ok, respelled.ok ? '' : `${respelled.error.code}: ${respelled.error.message} — spelling ${JSON.stringify(emitted.value)} again`)
      assert.equal(respelled.value, emitted.value)
    }),
    parameters,
  )
  if (!parameters.gate) return
  assert.ok(fixpoints >= fixpointFloor, `${fixpoints} of ${gateRuns} runs reached the fixpoint, under the floor of ${fixpointFloor}`)
  assert.ok(directiveShaped >= directiveShapedFloor, `${directiveShaped} runs reaching the fixpoint held a node or mark outside CommonMark's own types, under the floor of ${directiveShapedFloor}`)
})


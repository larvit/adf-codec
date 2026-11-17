import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfMark, AdfNode } from '../../adf/document.ts'
import { adfToLosslessJiraWiki, jiraWikiToAdf } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'

type Case = { name: string; reads: AdfNode[]; wiki: string }

function read(wiki: string): AdfNode[] | string {
  const result = jiraWikiToAdf(wiki)
  if (!result.ok) return `${result.error.code} at line ${result.error.position.line}, offset ${result.error.position.offset}`
  return result.value.content ?? 'a document holding no content key'
}

function node(type: string, attrs: AdfAttributes | undefined, ...content: AdfNode[]): AdfNode {
  return { ...(attrs === undefined ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return node('paragraph', undefined, ...content)
}

function text(value: string, ...marks: AdfMark[]): AdfNode {
  return marks.length === 0 ? { text: value, type: 'text' } : { marks, text: value, type: 'text' }
}

function line(...content: AdfNode[]): AdfNode[] {
  return [paragraph(...content)]
}

function item(...content: AdfNode[]): AdfNode {
  return node('listItem', undefined, ...content)
}

function bullets(...items: AdfNode[]): AdfNode {
  return node('bulletList', undefined, ...items)
}

function ordered(...items: AdfNode[]): AdfNode {
  return node('orderedList', { order: 1 }, ...items)
}

function table(...rows: AdfNode[][]): AdfNode {
  return node('table', { isNumberColumnEnabled: false, layout: 'default' }, ...rows.map((cells) => node('tableRow', undefined, ...cells)))
}

function cell(...content: AdfNode[]): AdfNode {
  return node('tableCell', undefined, paragraph(...content))
}

function header(...content: AdfNode[]): AdfNode {
  return node('tableHeader', undefined, paragraph(...content))
}

function code(language: string, value?: string): AdfNode {
  return node('codeBlock', { language }, ...(value === undefined ? [] : [text(value)]))
}

function image(url: string, alt?: string): AdfNode {
  return node('mediaSingle', { layout: 'center' }, node('media', { ...(alt === undefined ? {} : { alt }), type: 'external', url }))
}

function emoji(shortName: string, id: string, shown: string): AdfNode {
  return node('emoji', { id, shortName, text: shown })
}

function link(href: string, title?: string): AdfMark {
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
}

function colour(color: string): AdfMark {
  return { attrs: { color }, type: 'textColor' }
}

const breakNode: AdfNode = { type: 'hardBreak' }
const em: AdfMark = { type: 'em' }
const strike: AdfMark = { type: 'strike' }
const strong: AdfMark = { type: 'strong' }
const underline: AdfMark = { type: 'underline' }
const codeMark: AdfMark = { type: 'code' }
const sub: AdfMark = { attrs: { type: 'sub' }, type: 'subsup' }
const sup: AdfMark = { attrs: { type: 'sup' }, type: 'subsup' }
const rule: AdfNode = { type: 'rule' }
const status: AdfNode = { attrs: { color: 'red', text: 'x' }, type: 'status' }
const statusMacro = '{adf:display=inline}{"attrs":{"color":"red","text":"x"},"type":"status"}{adf}'
const smile = emoji(':slight_smile:', '1f642', '🙂')

const blocks: Case[] = [
  { name: 'the empty string as a document of no blocks', reads: [], wiki: '' },
  { name: 'blank lines alone as a document of no blocks', reads: [], wiki: '\n \n\n' },
  { name: 'a line as a paragraph', reads: line(text('a b')), wiki: 'a b' },
  { name: 'a line feed in a paragraph as a hardBreak', reads: line(text('a'), breakNode, text('b')), wiki: 'a\nb' },
  { name: 'blank lines as parting paragraphs, however many', reads: [paragraph(text('a')), paragraph(text('b'))], wiki: 'a\n\n\n\nb' },
  { name: 'whitespace at a line\'s edges as nothing, a carriage return included', reads: line(text('a'), breakNode, text('b')), wiki: '  a \r\n\tb  ' },
  { name: 'h1. to h6. as a heading of that level', reads: [node('heading', { level: 1 }, text('a')), node('heading', { level: 6 }, text('b'))], wiki: 'h1. a\n\nh6. b' },
  { name: 'a heading as one line, the next line a paragraph', reads: [node('heading', { level: 2 }, text('a')), paragraph(text('b'))], wiki: 'h2. a\nb' },
  { name: 'a heading holding no text as a heading holding no content', reads: [node('heading', { level: 3 })], wiki: 'h3. ' },
  { name: 'h7. and H1. as text', reads: [paragraph(text('h7. a')), paragraph(text('H1. a'))], wiki: 'h7. a\n\nH1. a' },
  { name: 'bq. as a blockquote of one paragraph, the next line a paragraph', reads: [node('blockquote', undefined, paragraph(text('a'))), paragraph(text('b'))], wiki: 'bq. a\nb' },
  { name: '{quote} as a blockquote of its blocks', reads: [node('blockquote', undefined, paragraph(text('a')), paragraph(text('b')))], wiki: '{quote}\na\n\nb\n{quote}' },
  { name: 'a {quote} holding nothing as a blockquote of an empty paragraph', reads: [node('blockquote', undefined, paragraph())], wiki: '{quote}\n{quote}' },
  { name: 'a {quote} left open as closing at the end', reads: [node('blockquote', undefined, paragraph(text('a')))], wiki: '{quote}\na' },
  { name: 'a {quote} inside a line as text', reads: [node('blockquote', undefined, paragraph(text('a{quote} b')))], wiki: '{quote}a{quote} b' },
  { name: 'a bq. inside a {quote}', reads: [node('blockquote', undefined, node('blockquote', undefined, paragraph(text('a'))))], wiki: '{quote}\nbq. a\n{quote}' },
  { name: '---- as a rule, longer runs too', reads: [rule, rule], wiki: '----\n\n------' },
  { name: 'a rule between lines as parting two paragraphs', reads: [paragraph(text('a')), rule, paragraph(text('b'))], wiki: 'a\n----\nb' },
  { name: '* and # items as lists', reads: [bullets(item(paragraph(text('a'))), item(paragraph(text('b')))), ordered(item(paragraph(text('c'))))], wiki: '* a\n* b\n\n# c' },
  { name: '- items as a bulletList', reads: [bullets(item(paragraph(text('a'))), item(paragraph(text('b'))))], wiki: '- a\n- b' },
  { name: 'one more marker per level, nested lists mixed', reads: [bullets(item(paragraph(text('a')), ordered(item(paragraph(text('b')))), bullets(item(paragraph(text('c'))))), item(paragraph(text('d'))))], wiki: '* a\n*# b\n** c\n* d' },
  { name: 'a list of the other kind with no blank line as a second list', reads: [ordered(item(paragraph(text('a')))), bullets(item(paragraph(text('b'))))], wiki: '# a\n* b' },
  { name: 'a line after an item as a hardBreak in the item\'s paragraph', reads: [bullets(item(paragraph(text('a'), breakNode, text('b'))))], wiki: '* a\nb' },
  { name: 'a marker two levels deeper as an item holding an empty paragraph between', reads: [bullets(item(paragraph(text('a')), bullets(item(paragraph(), bullets(item(paragraph(text('b'))))))))], wiki: '* a\n*** b' },
  { name: 'a marker with no space or no text as text', reads: [paragraph(text('*a')), paragraph(text('*'))], wiki: '*a\n\n* ' },
  { name: 'a list after a paragraph line', reads: [paragraph(text('a')), bullets(item(paragraph(text('b'))))], wiki: 'a\n* b' },
  { name: 'a blank line as parting two lists of one kind', reads: [bullets(item(paragraph(text('a')))), bullets(item(paragraph(text('b'))))], wiki: '* a\n\n* b' },
  { name: '{noformat} as a codeBlock of language ""', reads: [code('', 'a\n\n  b')], wiki: '{noformat}\na\n\n  b\n{noformat}' },
  { name: '{code:<language>} in lowercase, {code} as java', reads: [code('python', 'x'), code('java', 'y')], wiki: '{code:Python}\nx\n{code}\n\n{code}\ny\n{code}' },
  { name: 'a {code} dropping its title and borderStyle', reads: [code('sql', 'x'), code('java', 'y')], wiki: '{code:sql|title=T|borderStyle=solid}\nx\n{code}\n\n{code:title=T}\ny\n{code}' },
  { name: 'a code text whole, markup, carriage returns and edge blanks included', reads: [code('', ' *a* \r\n{quote}\n')], wiki: '{noformat}\n *a* \r\n{quote}\n\n{noformat}' },
  { name: 'a {code} holding nothing as a codeBlock holding no content', reads: [code('java')], wiki: '{code}\n{code}' },
  { name: 'a {code} left open as closing at the end', reads: [code('java', 'a')], wiki: '{code}\na' },
  { name: 'an image alone on its line as a mediaSingle', reads: [image('http://a.b/c.png')], wiki: '!http://a.b/c.png!' },
  { name: 'an image\'s alt, dropping thumbnail, align and the other parameters', reads: [image('http://a.b/c.png', 'hi there'), image('http://a.b/c.png')], wiki: '!http://a.b/c.png|alt=hi there, width=30!\n\n!http://a.b/c.png|thumbnail!' },
  { name: 'an image between lines as parting two paragraphs', reads: [paragraph(text('a')), image('ftp://a.b/c.png'), paragraph(text('b'))], wiki: 'a\n!ftp://a.b/c.png!\nb' },
  { name: '!name.ext! as its text', reads: line(text('!name.ext!')), wiki: '!name.ext!' },
  { name: 'a panel by its bgColor, compared without case', reads: [node('panel', { panelType: 'error' }, paragraph(text('a'))), node('panel', { panelType: 'note' }, paragraph(text('b')))], wiki: '{panel:bgColor=#FFEBE6}\na\n{panel}\n\n{panel:bgColor=#eae6ff}\nb\n{panel}' },
  { name: '{panel} and any other bgColor as info', reads: [node('panel', { panelType: 'info' }, paragraph(text('a'))), node('panel', { panelType: 'info' }, paragraph(text('b')))], wiki: '{panel}\na\n{panel}\n\n{panel:bgColor=red|borderStyle=dashed}\nb\n{panel}' },
  { name: 'a panel\'s title as its first paragraph in strong', reads: [node('panel', { panelType: 'success' }, paragraph(text('T *t*', strong)), paragraph(text('a')))], wiki: '{panel:title=T *t*|bgColor=#e3fcef}\na\n{panel}' },
  { name: 'a panel holding a list and a quote', reads: [node('panel', { panelType: 'info' }, bullets(item(paragraph(text('a')))), node('blockquote', undefined, paragraph(text('b'))))], wiki: '{panel}\n* a\n{quote}\nb\n{quote}\n{panel}' },
  { name: 'a {panel} holding parameters inside a panel as text', reads: [node('panel', { panelType: 'info' }, paragraph(text('{panel:title=x}'), breakNode, text('a')))], wiki: '{panel}\n{panel:title=x}\na\n{panel}' },
  { name: 'a table row per line, || a tableHeader and | a tableCell', reads: [table([header(text('h')), header(text('i'))], [cell(text('a')), cell(text('b'))])], wiki: '||h||i||\n|a|b|' },
  { name: 'a space-only cell as an empty paragraph, and a cell\'s edge blanks as nothing', reads: [table([cell(text('a')), cell()])], wiki: '| a | |' },
  { name: 'a row its last delimiter leaves open', reads: [table([cell(text('a')), cell(text('b'))])], wiki: '|a|b' },
  { name: 'a header after a cell in one row', reads: [table([cell(text('a')), header(text('b'))])], wiki: '|a||b|' },
  { name: 'a line after a table as a paragraph', reads: [table([cell(text('a'))]), paragraph(text('b|c|'))], wiki: '|a|\nb|c|' },
  { name: 'an escaped | as ending its cell, the backslash kept', reads: [table([cell(text('a\\')), cell(text('b'))])], wiki: '|a\\|b|' },
  { name: 'a link, a mark and a carry inside a cell', reads: [table([cell(text('a', strong)), cell(text('x', link('http://y.z'))), cell(status)])], wiki: `|*a*|[x|http://y.z]|${statusMacro}|` },
  { name: '{adf:display=block} as its node', reads: [rule, node('expand', { title: 'a|b' }, paragraph(text('{')))], wiki: '{adf:display=block}\n{"type":"rule"}\n{adf}\n\n{adf:display=block}\n{"attrs":{"title":"a|b"},"content":[{"content":[{"text":"\\u007b","type":"text"}],"type":"paragraph"}],"type":"expand"}\n{adf}' },
  { name: 'an {adf} macro in any JSON spelling, with no display or no line feeds', reads: [rule, rule], wiki: '{adf}{ "type" : "rule" }{adf}\n{adf:display=block}{"type":"rule"}{adf}' },
  { name: 'a block carry\'s JSON holding line feeds', reads: [rule, paragraph(text('a'))], wiki: '{adf:display=block}\n{\n"type":\n"rule"}\n{adf} a' },
  { name: 'a block of a type this version doesn\'t know', reads: [node('futureBlock', { a: 1 })], wiki: '{adf:display=block}\n{"attrs":{"a":1},"type":"futureBlock"}\n{adf}' },
]

const inline: Case[] = [
  { name: '\\\\ as a hardBreak', reads: line(text('a'), breakNode, text('b'), breakNode, breakNode), wiki: 'a\\\\b\\\\\\\\' },
  { name: '\\X as X, markup or not', reads: line(text('*a* [a] {a} a|b - (y) :) !a! #')), wiki: '\\*a\\* \\[a\\] \\{a\\} a\\|b \\- \\(y) :\\) \\!a! \\#' },
  { name: 'a backslash before :, ;, ., a comma, a letter or a digit as itself', reads: line(text('\\a \\1 \\: \\; \\. \\, \\')), wiki: '\\a \\1 \\: \\; \\. \\, \\' },
  { name: '\\\\ as a hardBreak before \\X reads X', reads: line(breakNode, text('*')), wiki: '\\\\\\*' },
  { name: 'each character mark', reads: line(text('a', strong), text(' '), text('b', em), text(' '), text('c', strike), text(' '), text('d', underline), text(' '), text('e', codeMark)), wiki: '*a* _b_ -c- +d+ {{e}}' },
  { name: '??x?? as em, ^x^ as sup and ~x~ as sub', reads: line(text('a b', em), text(' '), text('c', sup), text(' '), text('d', sub)), wiki: '??a b?? ^c^ ~d~' },
  { name: 'marks nested outermost first', reads: line(text('a ', strong), text('b', strong, em), text(' c', strong)), wiki: '*a _b_ c*' },
  { name: 'a mark outside a code mark, and inside one', reads: line(text('a', strong, codeMark), text(' '), text('b', codeMark, strong)), wiki: '*{{a}}* {{*b*}}' },
  { name: 'a delimiter beside a letter or digit outside, or whitespace inside, as text', reads: line(text('a*b*c x^2^ * a * *a *b')), wiki: 'a*b*c x^2^ * a * *a *b' },
  { name: 'a delimiter beside punctuation as a mark', reads: line(text('('), text('a', strong), text('). '), text('b', em), text(',')), wiki: '(*a*). _b_,' },
  { name: 'a mark inside a word\'s own delimiter characters', reads: line(text('a_b', em), text(' '), text('a-b', strike), text(' '), text('a*b', strong)), wiki: '_a_b_ -a-b- *a*b*' },
  { name: 'the nearest opener of a type as the one a closer takes', reads: line(text('*a '), text('b', strong), text(' c* *'), text('d', strong), text('*')), wiki: '*a *b* c* **d**' },
  { name: 'a mark as ending with its line', reads: line(text('*a'), breakNode, text('b*')), wiki: '*a\nb*' },
  { name: 'a mark crossing another as the first to close, the other text', reads: line(text('a _b', strong), text(' c_')), wiki: '*a _b* c_' },
  { name: 'a mark around a hardBreak as marking the text alone', reads: line(text('a', strong), breakNode, text('b', strong)), wiki: '*a\\\\b*' },
  { name: '{color} by hex code, as written', reads: line(text('a', colour('#FF0000')), text('b')), wiki: '{color:#FF0000}a{color}b' },
  { name: '{color} by CSS name as its hex code, compared without case', reads: line(text('a', colour('#ff0000')), text(' '), text('b', colour('#00008b'))), wiki: '{color:red}a{color} {color:DarkBlue}b{color}' },
  { name: 'a {color} of no CSS name, and one left open, as text', reads: line(text('{color:nonsense}a{color} {color:red}b')), wiki: '{color:nonsense}a{color} {color:red}b' },
  { name: 'a colour inside a mark and around one', reads: line(text('a', strong, colour('#0000ff')), text(' '), text('b', colour('#ff0000'), strong), text(' c', colour('#ff0000'))), wiki: '*{color:blue}a{color}* {color:red}*b* c{color}' },
  { name: '[text|href] and [text|href|title] as a link', reads: line(text('a b', link('http://x.y')), text(' '), text('c', link('#d', 'T t'))), wiki: '[a b|http://x.y] [c|#d|T t]' },
  { name: '[href] as a link whose text is its href', reads: line(text('http://x.y', link('http://x.y')), text(' '), text('#anchor', link('#anchor')), text(' '), text('^name.ext', link('^name.ext'))), wiki: '[http://x.y] [#anchor] [^name.ext]' },
  { name: 'a link holding no text as its href', reads: line(text('http://x.y', link('http://x.y'))), wiki: '[|http://x.y]' },
  { name: 'a mark inside a link and around one', reads: line(text('a', link('http://x.y'), strong), text(' '), text('b', strong, link('http://x.y'))), wiki: '[*a*|http://x.y] *[b|http://x.y]*' },
  { name: 'an escaped bracket and | in a link\'s text', reads: line(text('a]|b', link('http://x.y'))), wiki: '[a\\]\\|b|http://x.y]' },
  { name: 'brackets holding no link as text', reads: line(text('[] [a b] [a|b c] [a|b|c|d] [a')), wiki: '[] [a b] [a|b c] [a|b|c|d] [a' },
  { name: 'a link as ending with its line', reads: line(text('[a'), breakNode, text('b|'), text('http://x.y', link('http://x.y')), text(']')), wiki: '[a\nb|http://x.y]' },
  { name: '[~accountid:<id>] as a mention', reads: line(node('mention', { accessLevel: '', id: 'abc:1-2' })), wiki: '[~accountid:abc:1-2]' },
  { name: '[~name] and an accountid holding nothing as text', reads: line(text('[~name] [~accountid:]')), wiki: '[~name] [~accountid:]' },
  { name: 'a bare address as a link, up to whitespace', reads: line(text('See '), text('http://a.b/c?d=1,2', link('http://a.b/c?d=1,2')), text(' and '), text('https://e.f', link('https://e.f'))), wiki: 'See http://a.b/c?d=1,2 and https://e.f' },
  { name: 'a bare address less the punctuation ending it', reads: line(text('('), text('http://a.b/c', link('http://a.b/c')), text('). '), text('http://a.b/c:', link('http://a.b/c:')), text(' '), text('http://a.b', link('http://a.b')), text('!?')), wiki: '(http://a.b/c). http://a.b/c: http://a.b!?' },
  { name: 'an address of another scheme or case, and a scheme alone, as text', reads: line(text('ftp://a.b HTTP://a.b http://')), wiki: 'ftp://a.b HTTP://a.b http://' },
  { name: 'an image inside a line as text, its address a link', reads: line(text('a !'), text('http://a.b/c.png', link('http://a.b/c.png')), text('! b')), wiki: 'a !http://a.b/c.png! b' },
  { name: '{adf:display=inline} as its node', reads: line(text('a '), status, text(' b')), wiki: `a ${statusMacro} b` },
  { name: 'a carried text as a node of its own beside text of its marks', reads: line(text('a'), text('b'), text('c')), wiki: 'a{adf:display=inline}{"text":"b","type":"text"}{adf}c' },
  { name: '{anchor} as nothing', reads: [paragraph(text('a b'))], wiki: '{anchor:top}a {anchor}b\n\n{anchor:x}' },
  { name: 'a macro this version doesn\'t know as text', reads: line(text('{foo} {foo:a=b}x{foo}')), wiki: '{foo} {foo:a=b}x{foo}' },
  { name: '-- and --- between blanks or line edges as dashes', reads: line(text('– a – b a--b a — b a---b ---- —')), wiki: '-- a -- b a--b a --- b a---b ---- ---' },
  { name: 'a smiley as its emoji wherever no letter or digit follows', reads: line(text('x'), smile, text(' f'), emoji(':cross_mark:', 'atlassian-cross_mark', ':cross_mark:'), text(' a:Pb :)x '), emoji(':smiley:', '1f603', '😃'), text('.')), wiki: 'x:) f(x) a:Pb :)x :D.' },
  { name: 'each star and flag smiley', reads: line(emoji(':yellow_star:', 'atlassian-yellow_star', ':yellow_star:'), emoji(':yellow_star:', 'atlassian-yellow_star', ':yellow_star:'), emoji(':red_star:', 'atlassian-red_star', ':red_star:'), emoji(':flag_off:', 'atlassian-flag_off', ':flag_off:'), emoji(':flag_on:', 'atlassian-flag_on', ':flag_on:')), wiki: '(*)(*y)(*r)(flagoff)(flag)' },
  { name: 'a smiley inside a mark, unmarked', reads: line(text('a', strong), smile), wiki: '*a:)*' },
]

for (const { name, reads, wiki } of [...blocks, ...inline]) {
  test(`reads ${name}`, () => {
    assert.deepEqual(read(wiki), reads)
  })
}

const smileys: [string, string, string, string][] = [
  [':)', ':slight_smile:', '1f642', '🙂'],
  [':(', ':disappointed:', '1f61e', '😞'],
  [':P', ':stuck_out_tongue:', '1f61b', '😛'],
  [':D', ':smiley:', '1f603', '😃'],
  [';)', ':wink:', '1f609', '😉'],
  ['(y)', ':thumbsup:', '1f44d', '👍'],
  ['(n)', ':thumbsdown:', '1f44e', '👎'],
  ['(i)', ':info:', 'atlassian-info', ':info:'],
  ['(/)', ':check_mark:', 'atlassian-check_mark', ':check_mark:'],
  ['(x)', ':cross_mark:', 'atlassian-cross_mark', ':cross_mark:'],
  ['(!)', ':warning:', 'atlassian-warning', ':warning:'],
  ['(+)', ':plus:', 'atlassian-plus', ':plus:'],
  ['(-)', ':minus:', 'atlassian-minus', ':minus:'],
  ['(?)', ':question:', 'atlassian-question_mark', ':question:'],
  ['(on)', ':light_bulb_on:', 'atlassian-light_bulb_on', ':light_bulb_on:'],
  ['(off)', ':light_bulb_off:', 'atlassian-light_bulb_off', ':light_bulb_off:'],
  ['(*)', ':yellow_star:', 'atlassian-yellow_star', ':yellow_star:'],
  ['(*y)', ':yellow_star:', 'atlassian-yellow_star', ':yellow_star:'],
  ['(*r)', ':red_star:', 'atlassian-red_star', ':red_star:'],
  ['(*g)', ':green_star:', 'atlassian-green_star', ':green_star:'],
  ['(*b)', ':blue_star:', 'atlassian-blue_star', ':blue_star:'],
  ['(flag)', ':flag_on:', 'atlassian-flag_on', ':flag_on:'],
  ['(flagoff)', ':flag_off:', 'atlassian-flag_off', ':flag_off:'],
]

for (const [smiley, shortName, id, shown] of smileys) {
  test(`reads the smiley ${smiley} as ${shortName}`, () => {
    assert.deepEqual(read(`a ${smiley}`), line(text('a '), emoji(shortName, id, shown)))
  })
}

test('reads the carry of a document holding no content key as that document', () => {
  assert.deepEqual(jiraWikiToAdf('{adf:display=block}\n{"type":"doc","version":1}\n{adf}'), { ok: true, value: { type: 'doc', version: 1 } })
})

const refusals: { name: string; refusal: string; wiki: string }[] = [
  { name: 'an {adf} macro holding invalid JSON', refusal: 'unsupported-node-shape at line 3, offset 3', wiki: 'a\n\n{adf:display=block}\nnot json\n{adf}' },
  { name: 'an inline {adf} macro holding invalid JSON', refusal: 'unsupported-node-shape at line 2, offset 2', wiki: 'a\nb {adf:display=inline}{bad{adf}' },
  { name: 'an {adf} macro holding JSON that is no node', refusal: 'unsupported-node-shape at line 1, offset 0', wiki: '{adf:display=block}\n[1]\n{adf}' },
  { name: 'an {adf} macro left open', refusal: 'unsupported-node-shape at line 1, offset 0', wiki: '{adf:display=block}\n{"type":"rule"}' },
  { name: 'an inline {adf} macro closing on a later line', refusal: 'unsupported-node-shape at line 1, offset 0', wiki: 'a {adf:display=inline}{"type":\n"status"}{adf}' },
  { name: 'an inline {adf} macro left open', refusal: 'unsupported-node-shape at line 1, offset 0', wiki: '|a {adf:display=inline}{"type":"status"}|' },
  { name: 'a carried node nesting deeper than its position leaves', refusal: 'unsupported-nesting-depth at line 1, offset 0', wiki: `{adf:display=block}\n{"attrs":{"a":${'['.repeat(largestNesting + 1)}${']'.repeat(largestNesting + 1)}},"type":"x"}\n{adf}` },
  { name: `a list nesting deeper than ${largestNesting} levels`, refusal: 'unsupported-nesting-depth at line 2, offset 4', wiki: `* a\n${'*'.repeat(largestNesting + 1)} b` },
]

for (const { name, refusal, wiki } of refusals) {
  test(`refuses ${name}`, () => {
    assert.equal(read(wiki), refusal)
  })
}

test('refuses what is not a string', () => {
  const result = jiraWikiToAdf(JSON.parse('7'))
  assert.equal(result.ok ? 'read' : result.error.code, 'not-a-string')
})

test(`reads a list nesting ${largestNesting} levels`, () => {
  const result = jiraWikiToAdf(`${'*'.repeat(largestNesting)} a`)
  assert.equal(result.ok, true)
})

const roundTrips: { name: string; wiki: string }[] = [
  { name: 'a quote holding a panel holding a list', wiki: '{quote}\n{panel:bgColor=#deebff}\n* a\n*# b\n{panel}\n\nc\n{quote}' },
  { name: 'a table of marked cells and an empty one', wiki: '||*a*||[b|http://x.y|T]||\n| |{color:#ff0000}c{color}|' },
  { name: 'escaped markup', wiki: '\\*a\\* \\[b\\] :\\) \\(y) c\\!d' },
  { name: 'a code block and an image', wiki: '{code:sql}\nselect *\n\nfrom a\n{code}\n\n!http://a.b/c.png|alt=d e!' },
  { name: 'nested marks sharing their outermost', wiki: '*a _b_* -c-\\\\[~accountid:d]' },
]

for (const { name, wiki } of roundTrips) {
  test(`reads ${name} to the document that writes it`, () => {
    const result = jiraWikiToAdf(wiki)
    const written = result.ok ? adfToLosslessJiraWiki(result.value) : result
    assert.equal(written.ok ? written.value : written.error.code, wiki)
  })
}

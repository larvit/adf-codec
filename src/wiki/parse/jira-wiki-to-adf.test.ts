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
  { name: 'a code text whole, markup and edge blanks included', reads: [code('', ' *a* \n{quote}\n')], wiki: '{noformat}\n *a* \n{quote}\n\n{noformat}' },
  { name: 'a code text of lines ending in a carriage return and a line feed with a line feed between them', reads: [code('', 'a\n\nb\rc')], wiki: '{noformat}\r\na\r\n\r\nb\rc\r\n{noformat}' },
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
  { name: '[href] as a link whose text is its href', reads: line(text('http://x.y', link('http://x.y')), text(' '), text('#anchor', link('#anchor'))), wiki: '[http://x.y] [#anchor]' },
  { name: 'an address Jira links as a link, in either spelling', reads: line(text('a', link('/p?q=1#f')), text(' '), text('//h/p', link('//h/p')), text(' '), text('b', link('mailto:a@b.c')), text(' '), text('HTTP://x', link('HTTP://x')), text(' '), text('c', link('urn:x')), text(' '), text('#', link('#')), text(' '), text('d', link('/a%20b%5E'))), wiki: '[a|/p?q=1#f] [//h/p] [b|mailto:a@b.c] [HTTP://x] [c|urn:x] [#] [d|/a%20b^]' },
  ...['[word]', '[a|word]', '[^name.ext]', '[~name]', '[a|ws://x]', '[a|/p%2]', '[/p|t]', '[a|http://x/a%b]', '[http://x/a#b#c]'].map((wiki) => ({ name: `${wiki} as text`, reads: line(text(wiki)), wiki })),
  { name: 'a link\'s " < > ` and ^ as the percent escapes Jira stores, its text as written', reads: line(text('a', link('/a%22b')), text(' '), text('b', link('/a%3Cb%3E%60')), text(' '), text('c', link('/a%5E')), text(' '), text('/a"b', link('/a%22b')), text(' '), text('http://x/a^', link('http://x/a%5E'))), wiki: '[a|/a"b] [b|/a<b>`] [c|/a^] [/a"b] [http://x/a^]' },
  { name: 'a path or anchor Jira links where a ^ is followed by a : or ends it, with each ^ escaped', reads: line(text('a', link('/a%5E:b')), text(' '), text('b', link('#a%5Eb:c')), text(' '), text('c', link('/a%5E:%5E')), text(' '), text('/a^b:c', link('/a%5Eb:c'))), wiki: '[a|/a^:b] [b|#a^b:c] [c|/a^:^] [/a^b:c]' },
  ...['[a|/a^b]', '[a|/a^b:c^d]', '[a|/a^b^]', '[a|mailto:a^b]', '[/a^b]', '[a|/a^b|t]'].map((wiki) => ({ name: `${wiki}, an attachment embed in Jira, as text`, reads: line(text(wiki)), wiki })),
  { name: 'a title beside an escaped address', reads: line(text('a', link('/a%22b', 'T'))), wiki: '[a|/a"b|T]' },
  { name: 'a link holding no text as its href', reads: line(text('http://x.y', link('http://x.y'))), wiki: '[|http://x.y]' },
  { name: 'a mark inside a link and around one', reads: line(text('a', link('http://x.y'), strong), text(' '), text('b', strong, link('http://x.y'))), wiki: '[*a*|http://x.y] *[b|http://x.y]*' },
  { name: 'an escaped bracket and | in a link\'s text', reads: line(text('a]|b', link('http://x.y'))), wiki: '[a\\]\\|b|http://x.y]' },
  { name: 'brackets holding no link as text', reads: line(text('[] [a b] [a|b c] [a|b|c|d] [a')), wiki: '[] [a b] [a|b c] [a|b|c|d] [a' },
  { name: 'a link as ending with its line', reads: line(text('[a'), breakNode, text('b|'), text('http://x.y', link('http://x.y')), text(']')), wiki: '[a\nb|http://x.y]' },
  { name: '[~accountid:<id>] as a mention', reads: line(node('mention', { accessLevel: '', id: 'abc:1-2' })), wiki: '[~accountid:abc:1-2]' },
  { name: '[~name] and an accountid holding nothing as text', reads: line(text('[~name] [~accountid:]')), wiki: '[~name] [~accountid:]' },
  { name: 'a bare address as a link, up to whitespace', reads: line(text('See '), text('http://a.b/c?d=1,2', link('http://a.b/c?d=1,2')), text(' and '), text('https://e.f', link('https://e.f'))), wiki: 'See http://a.b/c?d=1,2 and https://e.f' },
  { name: 'a bare address less the punctuation ending it', reads: line(text('('), text('http://a.b/c', link('http://a.b/c')), text('). '), text('http://a.b/c:', link('http://a.b/c:')), text(' '), text('http://a.b', link('http://a.b')), text('!?')), wiki: '(http://a.b/c). http://a.b/c: http://a.b!?' },
  { name: 'a bare address with a second # or a malformed % escape as text, and one with a good escape as a link', reads: line(text('http://x/a#b#c http://x/a% http://x/a%zz '), text('http://x/a%41', link('http://x/a%41'))), wiki: 'http://x/a#b#c http://x/a% http://x/a%zz http://x/a%41' },
  { name: 'a bare address linked whole through < and ^, its ^ and < escaped in the href, and ended by " ` or >', reads: line(text('http://x/a<b^', link('http://x/a%3Cb%5E')), text(' '), text('http://x/^y', link('http://x/%5Ey')), text(' '), text('http://x/a', link('http://x/a')), text('"b '), text('http://x/a', link('http://x/a')), text('`b '), text('http://x/a<b', link('http://x/a%3Cb')), text('>c')), wiki: 'http://x/a<b^ http://x/^y http://x/a"b http://x/a`b http://x/a<b>c' },
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

const edgeCases: Case[] = [
  { name: 'a heading and a quote with no space after the dot', reads: [node('heading', { level: 2 }, text('x')), node('blockquote', undefined, paragraph(text('y')))], wiki: 'h2.x\nbq.y' },
  { name: 'an anchor macro whose name holds an opening brace as text', reads: [paragraph(text('{anchor:a'))], wiki: '{anchor:a{anchor:b}' },
  { name: 'a table on each side of a list', reads: [node('table', { isNumberColumnEnabled: false, layout: 'default' }, node('tableRow', undefined, node('tableCell', undefined, paragraph(text('a'))))), node('bulletList', undefined, node('listItem', undefined, paragraph(text('b')))), node('table', { isNumberColumnEnabled: false, layout: 'default' }, node('tableRow', undefined, node('tableCell', undefined, paragraph(text('c')))))], wiki: '|a|\n* b\n|c|' },
  { name: 'text after the macro closing a quote as a paragraph after the quote', reads: [node('blockquote', undefined, paragraph(text('a'))), paragraph(text('b'))], wiki: '{quote}\na\n{quote}b' },
  { name: 'a backslash before a bar in a cell\'s link text', reads: [node('table', { isNumberColumnEnabled: false, layout: 'default' }, node('tableRow', undefined, node('tableCell', undefined, paragraph(text('a|b', { attrs: { href: 'http://c.d' }, type: 'link' })))))], wiki: '|[a\\|b|http://c.d]|' },
  { name: 'a backslash before a bar that ends a cell', reads: [{ attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: [{ content: [{ content: [{ content: [{ text: 'a \\', type: 'text' }], type: 'paragraph' }], type: 'tableCell' }, { content: [{ content: [{ text: 'b', type: 'text' }], type: 'paragraph' }], type: 'tableCell' }], type: 'tableRow' }], type: 'table' }], wiki: '|a \\| b|' },
  { name: 'a bar alone', reads: [{ content: [{ text: '|', type: 'text' }], type: 'paragraph' }], wiki: '|' },
  { name: 'a bar in a heading', reads: [{ attrs: { level: 1 }, content: [{ text: 'a|b', type: 'text' }], type: 'heading' }], wiki: 'h1. a|b' },
  { name: 'a bar in an item', reads: [{ content: [{ content: [{ content: [{ text: 'a|b', type: 'text' }], type: 'paragraph' }], type: 'listItem' }], type: 'bulletList' }], wiki: '* a|b' },
  { name: 'a bracket before a link', reads: [{ content: [{ text: '[a', type: 'text' }, { marks: [{ attrs: { href: 'http://c.d' }, type: 'link' }], text: 'b', type: 'text' }], type: 'paragraph' }], wiki: '[a[b|http://c.d]' },
  { name: 'a cell ending in a mark, then a space', reads: [{ attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: [{ content: [{ content: [{ content: [{ marks: [{ type: 'strong' }], text: 'a', type: 'text' }], type: 'paragraph' }], type: 'tableCell' }], type: 'tableRow' }], type: 'table' }], wiki: '|*a* |' },
  { name: 'a closing code delimiter that opens nothing', reads: [{ content: [{ text: '}}a}}', type: 'text' }], type: 'paragraph' }], wiki: '}}a}}' },
  { name: 'a code block on one line', reads: [{ attrs: { language: '' }, content: [{ text: 'x', type: 'text' }], type: 'codeBlock' }], wiki: '{noformat}x{noformat}' },
  { name: 'a colour holding nothing', reads: [{ content: [{ text: '{color:red}{color}', type: 'text' }], type: 'paragraph' }], wiki: '{color:red}{color}' },
  { name: 'a colour opened inside another, the first staying text', reads: [{ content: [{ text: '{color:red}a', type: 'text' }, { marks: [{ attrs: { color: '#0000ff' }, type: 'textColor' }], text: 'b', type: 'text' }], type: 'paragraph' }], wiki: '{color:red}a{color:blue}b{color}' },
  { name: 'a dash run after a letter', reads: [{ content: [{ text: 'a-- b', type: 'text' }], type: 'paragraph' }], wiki: 'a-- b' },
  { name: 'a dash run before a letter', reads: [{ content: [{ text: 'a --b', type: 'text' }], type: 'paragraph' }], wiki: 'a --b' },
  { name: 'a delimiter after a letter outside the Basic Multilingual Plane', reads: [{ content: [{ text: '𝐀*b*', type: 'text' }], type: 'paragraph' }], wiki: '𝐀*b*' },
  { name: 'a heading word inside a line', reads: [{ content: [{ text: 'x h1. y', type: 'text' }], type: 'paragraph' }], wiki: 'x h1. y' },
  { name: 'a language in capitals between spaces', reads: [{ attrs: { language: 'python' }, content: [{ text: 'x', type: 'text' }], type: 'codeBlock' }], wiki: '{code: Python }\nx\n{code}' },
  { name: 'a line after an item holding only an anchor', reads: [{ content: [{ content: [{ type: 'paragraph' }], type: 'listItem' }], type: 'bulletList' }, { content: [{ text: 'b', type: 'text' }], type: 'paragraph' }], wiki: '* {anchor:a}\nb' },
  { name: 'a link holding a bar in a cell', reads: [{ attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: [{ content: [{ content: [{ content: [{ marks: [{ attrs: { href: 'http://b.c' }, type: 'link' }], text: 'a', type: 'text' }], type: 'paragraph' }], type: 'tableCell' }], type: 'tableRow' }], type: 'table' }], wiki: '|[a|http://b.c]|' },
  { name: 'a link holding an empty title', reads: [{ content: [{ text: '[a|', type: 'text' }, { marks: [{ attrs: { href: 'http://b.c' }, type: 'link' }], text: 'http://b.c', type: 'text' }, { text: '|]', type: 'text' }], type: 'paragraph' }], wiki: '[a|http://b.c|]' },
  { name: 'a numbered list after a bullet list', reads: [{ content: [{ content: [{ content: [{ text: 'a', type: 'text' }], type: 'paragraph' }], type: 'listItem' }], type: 'bulletList' }, { attrs: { order: 1 }, content: [{ content: [{ content: [{ text: 'b', type: 'text' }], type: 'paragraph' }], type: 'listItem' }], type: 'orderedList' }], wiki: '* a\n# b' },
  { name: 'a paragraph after a closed quote', reads: [{ content: [{ content: [{ text: 'a', type: 'text' }], type: 'paragraph' }], type: 'blockquote' }, { content: [{ text: 'b', type: 'text' }], type: 'paragraph' }], wiki: '{quote}\na\n{quote}\nb' },
  { name: 'a quote left open and empty', reads: [{ content: [{ type: 'paragraph' }], type: 'blockquote' }], wiki: '{quote}' },
  { name: 'a rule after text', reads: [{ content: [{ text: 'a ----', type: 'text' }], type: 'paragraph' }], wiki: 'a ----' },
  { name: 'a rule before text', reads: [{ content: [{ text: '---- a', type: 'text' }], type: 'paragraph' }], wiki: '---- a' },
  { name: 'an address before a run of punctuation', reads: [{ content: [{ marks: [{ attrs: { href: 'http://a.b/c' }, type: 'link' }], text: 'http://a.b/c', type: 'text' }, { text: '.,;? d', type: 'text' }], type: 'paragraph' }], wiki: 'http://a.b/c.,;? d' },
  { name: 'an address in a link text as text', reads: [{ content: [{ marks: [{ attrs: { href: 'http://c.d' }, type: 'link' }], text: 'see http://a.b', type: 'text' }], type: 'paragraph' }], wiki: '[see http://a.b|http://c.d]' },
  { name: 'an image after text on its line', reads: [{ content: [{ text: 'x !', type: 'text' }, { marks: [{ attrs: { href: 'http://a.b/c.png' }, type: 'link' }], text: 'http://a.b/c.png', type: 'text' }, { text: '!', type: 'text' }], type: 'paragraph' }], wiki: 'x !http://a.b/c.png!' },
  { name: 'an image before text on its line', reads: [{ content: [{ text: '!', type: 'text' }, { marks: [{ attrs: { href: 'http://a.b/c.png' }, type: 'link' }], text: 'http://a.b/c.png', type: 'text' }, { text: '! x', type: 'text' }], type: 'paragraph' }], wiki: '!http://a.b/c.png! x' },
  { name: 'an image parameter between spaces, its value holding an equals sign', reads: [{ attrs: { layout: 'center' }, content: [{ attrs: { alt: 'x=y', type: 'external', url: 'http://a.b/c.png' }, type: 'media' }], type: 'mediaSingle' }], wiki: '!http://a.b/c.png| alt = x=y !' },
  { name: 'an item after two spaces', reads: [{ content: [{ content: [{ content: [{ text: 'a', type: 'text' }], type: 'paragraph' }], type: 'listItem' }], type: 'bulletList' }], wiki: '*  a' },
  { name: 'an item holding only an anchor', reads: [{ content: [{ content: [{ type: 'paragraph' }], type: 'listItem' }], type: 'bulletList' }], wiki: '* {anchor:a}' },
  { name: 'an opening code delimiter that closes nothing', reads: [{ content: [{ text: '{{a{{ b', type: 'text' }], type: 'paragraph' }], wiki: '{{a{{ b' },
  { name: 'brackets holding three bars', reads: [{ content: [{ text: '[a|', type: 'text' }, { marks: [{ attrs: { href: 'http://b.c' }, type: 'link' }], text: 'http://b.c', type: 'text' }, { text: '|t|u]', type: 'text' }], type: 'paragraph' }], wiki: '[a|http://b.c|t|u]' },
  { name: 'two delimiters holding nothing', reads: [{ content: [{ text: 'x ** a', type: 'text' }], type: 'paragraph' }], wiki: 'x ** a' },
]

for (const { name, reads, wiki } of edgeCases) {
  test(`reads ${name}`, () => {
    assert.deepEqual(read(wiki), reads)
  })
}

test('refuses an {adf} macro left open, naming its line', () => {
  assert.deepEqual(jiraWikiToAdf('a\nb\n{adf}'), { error: { code: 'unsupported-node-shape', message: 'an {adf} macro closes with {adf}: this one is left open', path: [], position: { line: 3, offset: 4 } }, ok: false })
})

test('refuses an {adf} macro holding no JSON, naming its line', () => {
  assert.deepEqual(jiraWikiToAdf('a\n\n  {adf:display=block}x{adf}'), { error: { code: 'unsupported-node-shape', message: 'an {adf} macro holds one ADF node\'s JSON: this is no JSON', path: [], position: { line: 3, offset: 3 } }, ok: false })
})

test('refuses a number, naming what it wants', () => {
  assert.deepEqual(jiraWikiToAdf(JSON.parse('5')), { error: { code: 'not-a-string', message: 'Jira wiki markup is a string: found a number', path: [], position: { line: 1, offset: 0 } }, ok: false })
})

test(`refuses a list nesting past ${largestNesting} levels, naming its line`, () => {
  assert.deepEqual(jiraWikiToAdf(`a\n${'*'.repeat(largestNesting + 1)} b`), {
    error: { code: 'unsupported-nesting-depth', message: 'lists nest deeper than 500 levels', path: [], position: { line: 2, offset: 2 } },
    ok: false,
  })
})

test('refuses an inline {adf} macro that closes at the next line\'s start', () => {
  assert.deepEqual(jiraWikiToAdf('a {adf:display=inline}{"type":"status"}\n{adf}'), {
    error: { code: 'unsupported-node-shape', message: 'an {adf} macro inside a line closes on that line: this one closes on a later line', path: [], position: { line: 1, offset: 0 } },
    ok: false,
  })
})

test('names the line of a refusal after empty lines', () => {
  assert.equal(read('\n\n{adf}'), 'unsupported-node-shape at line 3, offset 2')
})

test('reads the carry of a document holding no content key, whatever whitespace surrounds it', () => {
  for (const around of ['\n', '\r\n', ' ']) assert.deepEqual(jiraWikiToAdf(`${around}{adf:display=block}${around}{"type":"doc","version":1}${around}{adf}${around}`), { ok: true, value: { type: 'doc', version: 1 } })
})

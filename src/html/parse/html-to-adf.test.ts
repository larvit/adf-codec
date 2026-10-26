import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { ParseError, Result } from '../../result.ts'
import { adfToHtml, htmlToAdf } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'

const ids = {
  item: '019ad5af-efd9-7f4e-a7c9-6aef16d4945f',
  list: '019d8e77-7df8-7a83-91ea-43a7ca2aae3b',
  paragraph: '01957ad9-e3f7-70aa-a5f3-4c013274f488',
  quote: '019d2fe4-3e67-7b76-b40a-a776a8f76aea',
}

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
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

function read(result: Result<AdfDocument, ParseError>): AdfDocument | string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function refusal(result: Result<AdfDocument, ParseError>): string {
  return result.ok ? 'read' : `${result.error.code} at /${result.error.path.join('/')} line ${result.error.position.line} offset ${result.error.position.offset}`
}

// The carry element of `node`, showing `shown`.
function carry(tag: 'div' | 'span', node: unknown, shown: string): string {
  return `<${tag} class="adf-carry" data-adf="${JSON.stringify(node).replaceAll('"', '&quot;')}">${shown}</${tag}>`
}

test('reads an empty string as a document of no blocks, and the document\'s carry as one holding no content key', () => {
  assert.deepEqual(read(htmlToAdf('')), document())
  assert.deepEqual(read(htmlToAdf(`${carry('div', { type: 'doc', version: 1 }, '')}\n`)), { type: 'doc', version: 1 })
})

test('reads paragraphs, headings and rules, a line feed after each', () => {
  const heading = (level: number, ...content: AdfNode[]): AdfNode => (content.length === 0 ? { attrs: { level }, type: 'heading' } : { attrs: { level }, content, type: 'heading' })
  assert.deepEqual(read(htmlToAdf('<h1>Level 1</h1>\n<p>Read the manual.</p>\n<hr>\n<h6>Level 6</h6>\n')), document(heading(1, text('Level 1')), paragraph(text('Read the manual.')), { type: 'rule' }, heading(6, text('Level 6'))))
  assert.deepEqual(read(htmlToAdf('<p></p>\n<h2></h2>\n')), document(paragraph(), heading(2)))
})

test('reads text\'s marks from its elements, the outermost first, and each run of text as one text node', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/a?b=1&c=2', title: 'The "A" page' }, type: 'link' }
  const html = '<p>Read <em>the</em> <strong><em>manual</em></strong>: <code><a href="https://example.com/a?b=1&amp;c=2" title="The &quot;A&quot; page">npm ci</a></code> or <a href="https://example.com/">this</a><br>Line two</p>\n'
  const line = paragraph(text('Read '), text('the', { type: 'em' }), text(' '), text('manual', { type: 'strong' }, { type: 'em' }), text(': '), text('npm ci', { type: 'code' }, link), text(' or '), text('this', { attrs: { href: 'https://example.com/' }, type: 'link' }), { type: 'hardBreak' }, text('Line two'))
  assert.deepEqual(read(htmlToAdf(html)), document(line))
  assert.deepEqual(read(htmlToAdf('<p><a href="x" title="">y</a></p>\n')), document(paragraph(text('y', { attrs: { href: 'x', title: '' }, type: 'link' }))))
})

test('reads escaped text, and keeps tabs, line feeds and form feeds', () => {
  assert.deepEqual(read(htmlToAdf('<p>a &lt; b &amp;&amp; c &gt; &quot;d&quot; \'e\'\tf\ng\fh &amp;lt;</p>\n')), document(paragraph(text('a < b && c > "d" \'e\'\tf\ng\fh &lt;'))))
})

test('reads lists, an item\'s first paragraph on its line and its other blocks a line each', () => {
  assert.deepEqual(read(htmlToAdf('<ul>\n<li>Bolt</li>\n<li>Nut</li>\n</ul>\n')), document({ content: [item(paragraph(text('Bolt'))), item(paragraph(text('Nut')))], type: 'bulletList' }))
  const listed: AdfNode = { attrs: { order: 3 }, content: [item(paragraph(text('Bolt')), { content: [item(paragraph(text('M8')))], type: 'bulletList' }), item(paragraph(text('a')), paragraph(text('b')))], type: 'orderedList' }
  assert.deepEqual(read(htmlToAdf('<ol start="3">\n<li>Bolt\n<ul>\n<li>M8</li>\n</ul>\n</li>\n<li>a\n<p>b</p>\n</li>\n</ol>\n')), document(listed))
  assert.deepEqual(read(htmlToAdf('<ol>\n<li>\n<hr>\n</li>\n<li></li>\n</ol>\n')), document({ content: [item({ type: 'rule' }), { type: 'listItem' }], type: 'orderedList' }))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li>\n<p></p>\n</li>\n</ul>\n')), document({ content: [item(paragraph())], type: 'bulletList' }))
  assert.deepEqual(read(htmlToAdf('<ol start="-2">\n<li>x</li>\n</ol>\n')), document({ attrs: { order: -2 }, content: [item(paragraph(text('x')))], type: 'orderedList' }))
})

test('reads the text ending an item\'s line up to the line feed before the item\'s next block', () => {
  const listed = (...blocks: AdfNode[]): AdfDocument => document({ content: [item(...blocks)], type: 'bulletList' })
  assert.deepEqual(read(htmlToAdf('<ul>\n<li>a\n\n<p>b</p>\n</li>\n</ul>\n')), listed(paragraph(text('a\n')), paragraph(text('b'))))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li><br>\n<hr>\n</li>\n</ul>\n')), listed(paragraph({ type: 'hardBreak' }), { type: 'rule' }))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li>\n</li>\n</ul>\n')), listed(paragraph(text('\n'))))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li>\n<em>a</em></li>\n</ul>\n')), listed(paragraph(text('\n'), text('a', { type: 'em' }))))
})

test('reads an item\'s first paragraph holding an attribute as its element on the item\'s line', () => {
  const listed = (...blocks: AdfNode[]): AdfDocument => document({ content: [item(...blocks)], type: 'bulletList' })
  const held: AdfNode = { attrs: { localId: ids.paragraph }, content: [text('Bolt')], type: 'paragraph' }
  assert.deepEqual(read(htmlToAdf(`<ul>\n<li><p data-local-id="${ids.paragraph}">Bolt</p></li>\n</ul>\n`)), listed(held))
  assert.deepEqual(read(htmlToAdf(`<ul>\n<li><p data-local-id="${ids.paragraph}">Bolt</p>\n<ul>\n<li>M8</li>\n</ul>\n</li>\n</ul>\n`)), listed(held, { content: [item(paragraph(text('M8')))], type: 'bulletList' }))
  assert.deepEqual(read(htmlToAdf(`<ul>\n<li><p data-local-id="${ids.paragraph}"></p></li>\n</ul>\n`)), listed({ attrs: { localId: ids.paragraph }, type: 'paragraph' }))
})

test('reads data-* attributes as the attributes they name, a value that is no string from its JSON', () => {
  const localId = { localId: ids.paragraph }
  assert.deepEqual(read(htmlToAdf(`<h2 data-local-id="${ids.paragraph}">x</h2>\n`)), document({ attrs: { level: 2, ...localId }, content: [text('x')], type: 'heading' }))
  assert.deepEqual(read(htmlToAdf(`<blockquote data-local-id="${ids.quote}">\n<p>x</p>\n</blockquote>\n`)), document({ attrs: { localId: ids.quote }, content: [paragraph(text('x'))], type: 'blockquote' }))
  const listed: AdfNode = { attrs: { localId: ids.list, order: 3 }, content: [{ attrs: { localId: ids.item }, content: [{ attrs: localId, content: [text('Bolt')], type: 'paragraph' }], type: 'listItem' }], type: 'orderedList' }
  assert.deepEqual(read(htmlToAdf(`<ol start="3" data-local-id="${ids.list}">\n<li data-local-id="${ids.item}"><p data-local-id="${ids.paragraph}">Bolt</p></li>\n</ol>\n`)), document(listed))
  const code: AdfNode = { attrs: { hideLineNumbers: false, language: 'js', wrap: true, ...localId }, content: [text('x')], type: 'codeBlock' }
  assert.deepEqual(read(htmlToAdf(`<pre data-hide-line-numbers="false" data-local-id="${ids.paragraph}" data-wrap="true"><code class="language-js">x</code></pre>\n`)), document(code))
  assert.deepEqual(read(htmlToAdf('<hr data-color="#ccc" data-style="a&quot;b" data-weight="-0">\n')), document({ attrs: { color: '#ccc', style: 'a"b', weight: -0 }, type: 'rule' }))
})

test('reads quotes, code blocks and containers holding no content key', () => {
  assert.deepEqual(read(htmlToAdf('<blockquote>\n<p>Quoted</p>\n<blockquote>\n<p>Twice</p>\n</blockquote>\n</blockquote>\n')), document({ content: [paragraph(text('Quoted')), { content: [paragraph(text('Twice'))], type: 'blockquote' }], type: 'blockquote' }))
  assert.deepEqual(read(htmlToAdf('<pre><code class="language-javascript">if (a &lt; b)\n  run()</code></pre>\n')), document({ attrs: { language: 'javascript' }, content: [text('if (a < b)\n  run()')], type: 'codeBlock' }))
  assert.deepEqual(read(htmlToAdf('<pre><code>plain</code></pre>\n<pre><code></code></pre>\n')), document({ content: [text('plain')], type: 'codeBlock' }, { type: 'codeBlock' }))
  assert.deepEqual(read(htmlToAdf('<blockquote></blockquote>\n<ul></ul>\n<ol></ol>\n')), document({ type: 'blockquote' }, { type: 'bulletList' }, { type: 'orderedList' }))
})

test('reads an image standing alone in a paragraph, a link around it where one marks it', () => {
  const image = (media: AdfNode): AdfNode => ({ attrs: { layout: 'center' }, content: [media], type: 'mediaSingle' })
  assert.deepEqual(read(htmlToAdf('<p><img src="https://example.com/moon.jpg" alt="The moon"></p>\n')), document(image({ attrs: { alt: 'The moon', type: 'external', url: 'https://example.com/moon.jpg' }, type: 'media' })))
  const linked = image({ attrs: { type: 'external', url: 'https://example.com/moon.jpg' }, marks: [{ attrs: { href: 'https://example.com/', title: 'Home' }, type: 'link' }], type: 'media' })
  assert.deepEqual(read(htmlToAdf('<p><a href="https://example.com/" title="Home"><img src="https://example.com/moon.jpg"></a></p>\n')), document(linked))
})

test('reads a carry element from its data-adf alone, whatever it shows', () => {
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Check the collation.'))], type: 'panel' }
  const mention: AdfNode = { attrs: { id: '5b10a2', text: '@Mikael' }, type: 'mention' }
  const expected = document(panel, paragraph(text('Ask '), mention))
  assert.deepEqual(read(htmlToAdf(`${carry('div', panel, '<p>Check the collation.</p>')}\n<p>Ask ${carry('span', mention, '@Mikael')}</p>\n`)), expected)
  assert.deepEqual(read(htmlToAdf(`${carry('div', panel, '<p>Edited <b>away</b> &nbsp;</p>')}\n<p>Ask ${carry('span', mention, '')}</p>\n`)), expected)
  assert.deepEqual(read(htmlToAdf(`<p>${carry('span', text('a\u0085b', { type: 'underline' }), 'ab').replace('\u0085', '\\u0085')}</p>\n`)), document(paragraph(text('a\u0085b', { type: 'underline' }))))
})

test('reads a carry element holding a node HTML writes as its own element as that node', () => {
  assert.deepEqual(read(htmlToAdf(`${carry('div', paragraph(text('x')), '<p>x</p>')}\n`)), document(paragraph(text('x'))))
  assert.deepEqual(read(htmlToAdf(`<p>a${carry('span', text('b'), 'b')}</p>\n`)), document(paragraph(text('a'), text('b'))))
  assert.deepEqual(read(htmlToAdf(`<ul>\n<li>\n${carry('div', paragraph(text('x')), '<p>x</p>')}\n</li>\n</ul>\n`)), document({ content: [item(paragraph(text('x')))], type: 'bulletList' }))
})

test('refuses a value that is not a string as not-a-string', () => {
  for (const value of [null, 5, undefined, {}]) {
    // @ts-expect-error -- a caller without types can pass anything.
    assert.equal(refusal(htmlToAdf(value)), 'not-a-string at / line 1 offset 0')
  }
})

test('refuses HTML adfToHtml does not write as unmappable-html, at the start of the line it stands on', () => {
  const refused = (html: string): string => refusal(htmlToAdf(html))
  assert.equal(refused('<p>x</p>'), 'unmappable-html at / line 1 offset 0')
  assert.equal(refused('<p>x</p>\n\n'), 'unmappable-html at /content/1 line 2 offset 9')
  assert.equal(refused('\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p>a</p>\n<div>b</div>\n'), 'unmappable-html at /content/1 line 2 offset 9')
  assert.equal(refused('<p>a</p>\n<P>b</P>\n'), 'unmappable-html at /content/1 line 2 offset 9')
  assert.equal(refused('<h7>x</h7>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p class="x">a</p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p>a<b>b</b></p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p>a<br/>b</p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p>it&#39;s</p>\n'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<p>a > b</p>\n'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<p>a\rb</p>\n'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  const lines = `${carry('div', { type: 'unknownBlock' }, 'a\r\nb\rc')}\n<i>d</i>\n`
  assert.equal(refused(lines), `unmappable-html at /content/1 line 4 offset ${lines.indexOf('<i>')}`)
  assert.equal(refused('<p><a href="x" target="y">a</a></p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p><a title="t" href="x">a</a></p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p><a href="a"b">a</a></p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
})

test('refuses marks adfToHtml would not write around text', () => {
  const refused = (inline: string): string => refusal(htmlToAdf(`<p>${inline}</p>\n`))
  assert.equal(refused('<em><em>a</em></em>'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<em></em>'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<em>a<strong>b</strong></em>'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<em><strong>a</em></strong>'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<em>a &bogus; b</em>'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('a<a href="x"><img src="y"></a>'), 'unmappable-html at /content/0/content/1 line 1 offset 0')
  assert.equal(refusal(htmlToAdf('<p><em>a')), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refusal(htmlToAdf('<p>a')), 'unmappable-html at /content/0 line 1 offset 0')
})

test('refuses block shapes adfToHtml would not write', () => {
  const refused = (html: string): string => refusal(htmlToAdf(html))
  assert.equal(refused('<ul>\n<li><p>Bolt</p></li>\n</ul>\n'), 'unmappable-html at /content/0/content/0/content/0 line 2 offset 5')
  assert.equal(refused('<ul>\n<li>\n<p>Bolt</p>\n</li>\n</ul>\n'), 'unmappable-html at /content/0/content/0/content/0 line 3 offset 10')
  assert.equal(refused(`<ul>\n<li>\n<p data-local-id="${ids.paragraph}"></p>\n</li>\n</ul>\n`), 'unmappable-html at /content/0/content/0/content/0 line 3 offset 10')
  assert.equal(refused('<ul>\n<li><hr></li>\n</ul>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 5')
  assert.equal(refused('<ul>\n<li>a</ul>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 5')
  assert.equal(refused(`<ul>\n<li><p data-local-id="${ids.paragraph}">a</p></ul>\n`), 'unmappable-html at /content/0/content/0 line 2 offset 5')
  assert.equal(refused('<ul>\n<p>a</p>\n</ul>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 5')
  assert.equal(refused('<ul>\n</ul>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 5')
  assert.equal(refused('<ul><li>a</li></ul>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<blockquote>\n<p>a</p></blockquote>\n'), 'unmappable-html at /content/0 line 2 offset 13')
  assert.equal(refused('<p>a</p><p>b</p>\n'), 'unmappable-html at / line 1 offset 0')
  for (const start of ['03', '1.5', '-0', '', 'x', '9007199254740993']) assert.equal(refused(`<ol start="${start}">\n<li>a</li>\n</ol>\n`), 'unmappable-html at /content/0 line 1 offset 0', start)
  assert.equal(refused('<pre><code class="lang-js">x</code></pre>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<pre><code class="language-">x</code></pre>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<pre><code class="language-js" id="x">x</code></pre>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<pre>x</pre>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<pre><code>a &bogus; b</code></pre>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<pre><code>x</code></pre\n'), 'unmappable-html at /content/0 line 1 offset 0')
})

test('refuses an image adfToHtml would not write', () => {
  const refused = (inner: string): string => refusal(htmlToAdf(`<p>${inner}</p>\n`))
  assert.equal(refused('<img src="a" alt="">'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<img alt="b" src="a">'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<img src="a" alt="b" title="c">'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<img src="a">b'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<a href="x" rel="y"><img src="a"></a>'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refusal(htmlToAdf('<p data-local-id="a"><img src="a"></p>\n')), 'unmappable-html at /content/0 line 1 offset 0')
})

test('refuses a data-* attribute out of the order adfToHtml writes as unmappable-html, and one no attribute of its node spells as unsupported-node-shape', () => {
  const refused = (html: string): string => refusal(htmlToAdf(html))
  assert.equal(refused('<hr data-style="a" data-color="b">\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<hr data-color="a" data-color="b">\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p data-color="x">a</p>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<h1 data-level="2">a</h1>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<ol data-order="2">\n<li>a</li>\n</ol>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<pre data-language="js"><code>x</code></pre>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<p data-localid="x">a</p>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  for (const wrap of ['yes', ' true', '1', '"true"']) assert.equal(refused(`<pre data-wrap="${wrap.replaceAll('"', '&quot;')}"><code>x</code></pre>\n`), 'unsupported-node-shape at /content/0 line 1 offset 0', wrap)
  assert.equal(refused('<hr data-weight="1.0">\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<hr data-weight="1e999">\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<ul>\n<li data-x="a">a</li>\n</ul>\n'), 'unsupported-node-shape at /content/0/content/0 line 2 offset 5')
  assert.equal(refused('<blockquote data-local-id="a" data-x="b"></blockquote>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
})

test('refuses a carry element adfToHtml would not write', () => {
  const refused = (html: string): string => refusal(htmlToAdf(html))
  const rule = JSON.stringify({ type: 'unknownBlock' }).replaceAll('"', '&quot;')
  assert.equal(refused(`<div data-adf="${rule}" class="adf-carry"></div>\n`), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused(`<div class="adf-carry" data-adf="${rule}" id="x"></div>\n`), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused(`<div class="carry" data-adf="${rule}"></div>\n`), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused(`<div class="adf-carry" data-adf="${rule}">\n`), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<div class="adf-carry" data-adf="{"></div>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<div class="adf-carry" data-adf="{&quot;type&quot;:1e999}"></div>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<div class="adf-carry" data-adf="{ &quot;type&quot;:&quot;x&quot;}"></div>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<p><span class="adf-carry" data-adf="{&quot;text&quot;:&quot;a\u0085&quot;,&quot;type&quot;:&quot;text&quot;}"></span></p>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<p><span class="adf-carry" data-adf="{&quot;type&quot;:&quot;text&quot;,&quot;text&quot;:&quot;a&quot;}"></span></p>\n'), 'unsupported-node-shape at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<div class="adf-carry" data-adf="{&quot;type&quot;:5}"></div>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<p><span class="adf-carry" data-adf="[]"></span></p>\n'), 'unsupported-node-shape at /content/0/content/0 line 1 offset 0')
  assert.equal(refused('<p><span>a</span></p>\n'), 'unmappable-html at /content/0/content/0 line 1 offset 0')
})

test('refuses the document\'s carry anywhere but as the whole document', () => {
  const documentCarry = carry('div', { type: 'doc', version: 1 }, '')
  assert.equal(refusal(htmlToAdf(`${documentCarry}\n<hr>\n`)), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refusal(htmlToAdf(`<hr>\n${documentCarry}\n`)), 'unsupported-node-shape at /content/1 line 2 offset 5')
  assert.equal(refusal(htmlToAdf(`<blockquote>\n${documentCarry}\n</blockquote>\n`)), 'unsupported-node-shape at /content/0/content/0 line 2 offset 13')
  assert.equal(refusal(htmlToAdf(`${carry('div', { type: 'doc', version: 2 }, '')}\n`)), 'unsupported-node-shape at /content/0 line 1 offset 0')
})

test('reads blocks nested 500 levels, and refuses the next level, a list\'s items one level below it', () => {
  const quotes = (levels: number): string => `${'<blockquote>\n'.repeat(levels)}<p>x</p>${'\n</blockquote>'.repeat(levels)}\n`
  assert.equal(refusal(htmlToAdf(quotes(largestNesting))), 'read')
  assert.equal(refusal(htmlToAdf(quotes(largestNesting + 1))).startsWith(`unsupported-nesting-depth at /${'content/0/'.repeat(largestNesting + 1)}content/0 line ${largestNesting + 2}`), true)
  const lists = (levels: number): string => `${'<ul>\n<li>x\n'.repeat(levels)}<hr>${'\n</li>\n</ul>'.repeat(levels)}\n`
  assert.equal(refusal(htmlToAdf(lists(largestNesting))), 'read')
  assert.equal(refusal(htmlToAdf(lists(largestNesting + 1))).startsWith('unsupported-nesting-depth'), true)
  assert.equal(refusal(htmlToAdf('<blockquote>\n'.repeat(1_000_000))).startsWith('unsupported-nesting-depth'), true)
})

test('refuses a carried node whose JSON nests past the levels its depth leaves, and an inline carry past 500', () => {
  let value: unknown = 1
  for (let level = 0; level < largestNesting - 2; level += 1) value = [value]
  const carried = carry('div', { attrs: { a: value }, type: 'unknownBlock' }, '')
  assert.equal(refusal(htmlToAdf(`${carried}\n`)), 'read')
  assert.equal(refusal(htmlToAdf(`<blockquote>\n${carried}\n</blockquote>\n`)), 'unsupported-nesting-depth at /content/0/content/0 line 2 offset 13')
  let inline: unknown = { text: 'x', type: 'text' }
  for (let level = 0; level < largestNesting; level += 1) inline = { content: [inline], type: 'unknownInline' }
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', inline, '')}</p>\n`)), 'unsupported-nesting-depth at /content/0/content/0 line 1 offset 0')
})

test('reads back what adfToHtml writes for the documents its own tests write', () => {
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Run this:')), { attrs: { language: 'python' }, content: [text('if ready:\n    deploy()')], type: 'codeBlock' }], type: 'panel' }
  for (const written of [document(panel), document(paragraph(text('a'), text('b'), text('c', { type: 'em' }), text('d'), text('e'))), { type: 'doc' as const, version: 1 }]) {
    const html = adfToHtml(written)
    assert.ok(html.ok)
    assert.deepEqual(read(htmlToAdf(html.value)), written)
  }
})

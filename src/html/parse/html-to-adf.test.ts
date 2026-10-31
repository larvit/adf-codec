import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { ParseError, Result } from '../../result.ts'
import { adfToHtml, htmlToAdf } from '../../index.ts'

const ids = {
  item: '019ad5af-efd9-7f4e-a7c9-6aef16d4945f',
  list: '019d8e77-7df8-7a83-91ea-43a7ca2aae3b',
  mention: '0199f4c2-8b1e-7d03-9a6f-2c5e8d71b4a0',
  paragraph: '01957ad9-e3f7-70aa-a5f3-4c013274f488',
  quote: '019d2fe4-3e67-7b76-b40a-a776a8f76aea',
}

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function paragraph(...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { type: 'paragraph' } : { content, type: 'paragraph' }
}

function heading(level: number, ...content: AdfNode[]): AdfNode {
  return content.length === 0 ? { attrs: { level }, type: 'heading' } : { attrs: { level }, content, type: 'heading' }
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

function message(result: Result<AdfDocument, ParseError>): string {
  return result.ok ? 'read' : result.error.message
}

const documentCarry = carry('div', { type: 'doc', version: 1 }, '')
const mention: AdfNode = { attrs: { id: ids.mention, text: '@Mikael' }, type: 'mention' }
const panel: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Check the collation.'))], type: 'panel' }
const rule = JSON.stringify({ type: 'unknownBlock' }).replaceAll('"', '&quot;')

// The carry element of `node`, showing `shown`.
function carry(tag: 'div' | 'span', node: unknown, shown: string): string {
  return `<${tag} class="adf-carry" data-adf="${JSON.stringify(node).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')}">${shown}</${tag}>`
}

function nested(value: unknown, levels: number, wrap: (inner: unknown) => unknown): unknown {
  let wrapped = value
  for (let level = 0; level < levels; level += 1) wrapped = wrap(wrapped)
  return wrapped
}

test('reads an empty string as a document of no blocks, and the document\'s carry as one holding no content key', () => {
  assert.deepEqual(read(htmlToAdf('')), document())
  assert.deepEqual(read(htmlToAdf(`${documentCarry}\n`)), { type: 'doc', version: 1 })
})

test('reads paragraphs, headings and rules, a line feed after each', () => {
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

test('reads text as a browser\'s innerHTML spells it: a raw ", &nbsp; for a no-break space, and in an attribute a raw < or >', () => {
  assert.deepEqual(read(htmlToAdf('<p>a "b" &quot;c&quot;&nbsp;d e</p>\n')), document(paragraph(text('a "b" "c" d e'))))
  assert.deepEqual(read(htmlToAdf('<pre><code>say "a"&nbsp;b</code></pre>\n')), document({ content: [text('say "a" b')], type: 'codeBlock' }))
  const link: AdfMark = { attrs: { href: 'https://x.test/?a<b>c&d', title: 'a b' }, type: 'link' }
  assert.deepEqual(read(htmlToAdf('<p><a href="https://x.test/?a<b>c&amp;d" title="a&nbsp;b">x</a></p>\n')), document(paragraph(text('x', link))))
  assert.deepEqual(read(htmlToAdf('<p><a href="https://x.test/?a&lt;b&gt;c&amp;d" title="a&nbsp;b">x</a></p>\n')), document(paragraph(text('x', link))))
  assert.deepEqual(read(htmlToAdf('<hr data-style="a&nbsp;&quot;b">\n')), document({ attrs: { style: 'a "b' }, type: 'rule' }))
})

test('reads a line ending of CRLF as a line feed wherever the dialect has one, and keeps a lone carriage return refused', () => {
  const crlf = (html: string): string => html.replaceAll('\n', '\r\n')
  assert.deepEqual(read(htmlToAdf(crlf('<p>a\nb</p>\n<hr>\n<pre><code>c\n  d</code></pre>\n'))), document(paragraph(text('a\nb')), { type: 'rule' }, { content: [text('c\n  d')], type: 'codeBlock' }))
  assert.deepEqual(read(htmlToAdf(crlf('<blockquote>\n<ul>\n<li>Bolt\n<p>b</p>\n</li>\n</ul>\n</blockquote>\n'))), document({ content: [{ content: [item(paragraph(text('Bolt')), paragraph(text('b')))], type: 'bulletList' }], type: 'blockquote' }))
  assert.deepEqual(read(htmlToAdf(crlf(`${carry('div', panel, '<p>Check the collation.</p>')}\n`))), document(panel))
  assert.deepEqual(read(htmlToAdf(crlf(`${documentCarry}\n`))), { type: 'doc', version: 1 })
  assert.deepEqual(read(htmlToAdf('<hr data-style="a\r\nb">\n')), document({ attrs: { style: 'a\nb' }, type: 'rule' }))
  for (const html of ['<p>a\r</p>\n', '<p>a</p>\r', '<p>a</p>\r\r\n', '<p>a\r\r\nb</p>\n']) assert.equal(refusal(htmlToAdf(html)).startsWith('unmappable-html'), true, JSON.stringify(html))
})

test('places a refusal in HTML ending its lines in CRLF at the start of the line it stands on, counted in the HTML handed in', () => {
  assert.equal(refusal(htmlToAdf('<p>a</p>\r\n<b>x</b>\r\n')), 'unmappable-html at /content/1 line 2 offset 10')
  assert.equal(refusal(htmlToAdf('<p>a</p>\r\n<p>b</p>\r\n<p>c<b>d</b></p>\r\n')), 'unmappable-html at /content/2 line 3 offset 20')
  assert.equal(refusal(htmlToAdf('<p>a</p>\r\n<p>b</p>')), 'unmappable-html at / line 2 offset 10')
})

test('reads a carry element showing what a browser spells it as, in any mix with the spelling adfToHtml writes', () => {
  const said: AdfNode = { attrs: { id: ids.mention, text: 'Say "hi" now' }, type: 'mention' }
  for (const shown of ['Say &quot;hi&quot; now', 'Say "hi"&nbsp;now', 'Say "hi" now', 'Say &quot;hi&quot;&nbsp;now']) {
    assert.deepEqual(read(htmlToAdf(`<p>${carry('span', said, shown)}</p>\n`)), document(paragraph(said)), shown)
  }
  const underlined: AdfNode = text('a<b', { type: 'underline' }, { attrs: { href: 'https://x.test/?a<b&c>d', title: 'T" ' }, type: 'link' })
  for (const opener of ['<a href="https://x.test/?a&lt;b&amp;c&gt;d" title="T&quot; ">', '<a href="https://x.test/?a<b&amp;c>d" title="T&quot;&nbsp;">']) {
    assert.deepEqual(read(htmlToAdf(`<p>${carry('span', underlined, `${opener}a&lt;b</a>`)}</p>\n`)), document(paragraph(underlined)), opener)
  }
  const block: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('A "quote" here'))], type: 'panel' }
  assert.deepEqual(read(htmlToAdf(`${carry('div', block, '<p>A "quote"&nbsp;here</p>')}\r\n`)), document(block))
})

test('refuses an edit to what a carry element shows even where a browser would spell the same text so', () => {
  const said: AdfNode = { attrs: { id: ids.mention, text: 'Say "hi"' }, type: 'mention' }
  const underlined: AdfNode = text('a', { type: 'underline' }, { attrs: { href: 'x', title: 'T"' }, type: 'link' })
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', said, 'Say "hi')}</p>\n`)), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', said, 'Say &amp;quot;hi&amp;quot;')}</p>\n`)), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', underlined, '<a href="x" title="T"">a</a>')}</p>\n`)), 'unmappable-html at /content/0/content/0 line 1 offset 0')
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', underlined, '<a href="x" title="T&quot;">a</a>')}</p>\n`)), 'read')
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

test('reads a carry element from its data-adf, what it shows read back as adfToHtml writes it', () => {
  assert.deepEqual(read(htmlToAdf(`${carry('div', panel, '<p>Check the collation.</p>')}\n<p>Ask ${carry('span', mention, '@Mikael')}</p>\n`)), document(panel, paragraph(text('Ask '), mention)))
  assert.deepEqual(read(htmlToAdf(`<p>${carry('span', text('a\u0085b', { type: 'underline' }), 'ab').replace('\u0085', '\\u0085')}</p>\n`)), document(paragraph(text('a\u0085b', { type: 'underline' }))))
})

test('reads a carry element holding a node HTML writes as its own element as that node', () => {
  assert.deepEqual(read(htmlToAdf(`${carry('div', paragraph(text('x')), '<p>x</p>')}\n`)), document(paragraph(text('x'))))
  assert.deepEqual(read(htmlToAdf(`<p>a${carry('span', text('b'), 'b')}</p>\n`)), document(paragraph(text('a'), text('b'))))
  assert.deepEqual(read(htmlToAdf(`<ul>\n<li>\n${carry('div', paragraph(text('x')), '<p>x</p>')}\n</li>\n</ul>\n`)), document({ content: [item(paragraph(text('x')))], type: 'bulletList' }))
})

// Each group's cases, the HTML and its refusal.
const refusals: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  'refuses block shapes adfToHtml would not write': [
    ['<ul>\n<li><p>Bolt</p></li>\n</ul>\n', 'unmappable-html at /content/0/content/0/content/0 line 2 offset 5'],
    ['<ul>\n<li>\n<p>Bolt</p>\n</li>\n</ul>\n', 'unmappable-html at /content/0/content/0/content/0 line 3 offset 10'],
    [`<ul>\n<li>\n<p data-local-id="${ids.paragraph}"></p>\n</li>\n</ul>\n`, 'unmappable-html at /content/0/content/0/content/0 line 3 offset 10'],
    ['<ul>\n<li><hr></li>\n</ul>\n', 'unmappable-html at /content/0/content/0 line 2 offset 5'],
    ['<ul>\n<li>a</ul>\n', 'unmappable-html at /content/0/content/0 line 2 offset 5'],
    [`<ul>\n<li><p data-local-id="${ids.paragraph}">a</p></ul>\n`, 'unmappable-html at /content/0/content/0 line 2 offset 5'],
    ['<ul>\n<p>a</p>\n</ul>\n', 'unmappable-html at /content/0/content/0 line 2 offset 5'],
    ['<ul>\n</ul>\n', 'unmappable-html at /content/0/content/0 line 2 offset 5'],
    ['<ul><li>a</li></ul>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<blockquote>\n<p>a</p></blockquote>\n', 'unmappable-html at /content/0 line 2 offset 13'],
    ['<p>a</p><p>b</p>\n', 'unmappable-html at / line 1 offset 0'],
    ['<ol start="03">\n<li>a</li>\n</ol>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<ol start="1.5">\n<li>a</li>\n</ol>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<ol start="-0">\n<li>a</li>\n</ol>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<ol start="">\n<li>a</li>\n</ol>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<ol start="x">\n<li>a</li>\n</ol>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<ol start="9007199254740993">\n<li>a</li>\n</ol>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<pre><code class="lang-js">x</code></pre>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<pre><code class="language-">x</code></pre>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<pre><code class="language-js" id="x">x</code></pre>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<pre>x</pre>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<pre><code>a &bogus; b</code></pre>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<pre><code>x</code></pre\n', 'unmappable-html at /content/0 line 1 offset 0'],
  ],
  'refuses a carry element adfToHtml would not write': [
    [`<div data-adf="${rule}" class="adf-carry"></div>\n`, 'unmappable-html at /content/0 line 1 offset 0'],
    [`<div class="adf-carry" data-adf="${rule}" id="x"></div>\n`, 'unmappable-html at /content/0 line 1 offset 0'],
    [`<div class="carry" data-adf="${rule}"></div>\n`, 'unmappable-html at /content/0 line 1 offset 0'],
    [`<div class="adf-carry" data-adf="${rule}">\n`, 'unmappable-html at /content/0 line 1 offset 0'],
    ['<div class="adf-carry" data-adf="{"></div>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<div class="adf-carry" data-adf="{&quot;type&quot;:1e999}"></div>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<div class="adf-carry" data-adf="{ &quot;type&quot;:&quot;x&quot;}"></div>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<p><span class="adf-carry" data-adf="{&quot;text&quot;:&quot;a\u0085&quot;,&quot;type&quot;:&quot;text&quot;}"></span></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><span class="adf-carry" data-adf="{&quot;type&quot;:&quot;text&quot;,&quot;text&quot;:&quot;a&quot;}"></span></p>\n', 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<div class="adf-carry" data-adf="{&quot;type&quot;:5}"></div>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<p><span class="adf-carry" data-adf="[]"></span></p>\n', 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<p><span>a</span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
  ],
  'refuses a misspelled attribute value on the line of the character it names': [
    ['<ul>\n<li>see <a href="https://x.test/?a\nb&c">x</a></li>\n</ul>\n', 'unmappable-html at /content/0/content/0 line 3 offset 40'],
    ['<p><strong><a href="https://x.test/?a\nb&c">x</a></strong></p>\n', 'unmappable-html at /content/0/content/0 line 2 offset 38'],
  ],
  'refuses an edit to what a carry element shows': [
    [`<p>a</p>\n${carry('div', panel, '<p>Check the <b>collation</b>.</p>')}\n`, 'unmappable-html at /content/1 line 2 offset 9'],
    [`<p>Ask ${carry('span', mention, '')}</p>\n`, 'unmappable-html at /content/0/content/1 line 1 offset 0'],
  ],
  'refuses the document\'s carry anywhere but as the whole document, a line feed ending it': [
    [documentCarry, 'unmappable-html at / line 1 offset 0'],
    [`${documentCarry}\n\n`, `unmappable-html at / line 2 offset ${documentCarry.length + 1}`],
    [`${documentCarry}X`, 'unmappable-html at / line 1 offset 0'],
    [`${documentCarry}X<hr>\n`, 'unmappable-html at / line 1 offset 0'],
    [`${documentCarry.replace('></div>', '>x</div>')}\n`, 'unmappable-html at / line 1 offset 0'],
    [`${documentCarry}\n<hr>\n`, 'unsupported-node-shape at /content/0 line 1 offset 0'],
    [`<hr>\n${documentCarry}\n`, 'unsupported-node-shape at /content/1 line 2 offset 5'],
    [`<blockquote>\n${documentCarry}\n</blockquote>\n`, 'unsupported-node-shape at /content/0/content/0 line 2 offset 13'],
    [`${carry('div', { type: 'doc', version: 2 }, '')}\n`, 'unsupported-node-shape at /content/0 line 1 offset 0'],
  ],
  'refuses a data-* attribute out of the order adfToHtml writes as unmappable-html, and one no attribute of its node spells as unsupported-node-shape': [
    ['<hr data-style="a" data-color="b">\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<hr data-color="a" data-color="b">\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p data-color="x">a</p>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<h1 data-level="2">a</h1>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<ol data-order="2">\n<li>a</li>\n</ol>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<pre data-language="js"><code>x</code></pre>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<p data-localid="x">a</p>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<pre data-wrap="yes"><code>x</code></pre>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<pre data-wrap=" true"><code>x</code></pre>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<pre data-wrap="1"><code>x</code></pre>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<pre data-wrap="&quot;true&quot;"><code>x</code></pre>\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<hr data-weight="1.0">\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<hr data-weight="1e999">\n', 'unsupported-node-shape at /content/0 line 1 offset 0'],
    ['<ul>\n<li data-x="a">a</li>\n</ul>\n', 'unsupported-node-shape at /content/0/content/0 line 2 offset 5'],
    [`<blockquote data-local-id="${ids.quote}" data-x="b"></blockquote>\n`, 'unsupported-node-shape at /content/0 line 1 offset 0'],
  ],
  'refuses HTML adfToHtml does not write as unmappable-html, at the start of the line it stands on': [
    ['<p>x</p>', 'unmappable-html at / line 1 offset 0'],
    ['<p>x</p>X', 'unmappable-html at / line 1 offset 0'],
    ['<p>x</p>\n\n', 'unmappable-html at /content/1 line 2 offset 9'],
    ['\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p>a</p>\n<div>b</div>\n', 'unmappable-html at /content/1 line 2 offset 9'],
    ['<p>a</p>\n<P>b</P>\n', 'unmappable-html at /content/1 line 2 offset 9'],
    ['<h7>x</h7>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p class="x">a</p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p>a<b>b</b></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p>a<br/>b</p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p>it&#39;s</p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p>a > b</p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p>a\rb</p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a href="x" target="y">a</a></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><a title="t" href="x">a</a></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><a href="a"b">a</a></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p>a</p>\n<pre><code>b\nc</code></pre>\n<i>d</i>\n', 'unmappable-html at /content/2 line 4 offset 37'],
  ],
  'refuses an image adfToHtml would not write': [
    ['<p><img src="a" alt=""></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><img alt="b" src="a"></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><img src="a" alt="b" title="c"></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><img src="a">b</p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><a href="x" rel="y"><img src="a"></a></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    [`<p data-local-id="${ids.paragraph}"><img src="a"></p>\n`, 'unmappable-html at /content/0 line 1 offset 0'],
  ],
  'refuses marks adfToHtml would not write around text': [
    ['<p><em><em>a</em></em></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><em></em></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><em>a<strong>b</strong></em></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><em><strong>a</em></strong></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><em>a &bogus; b</em></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p>a<a href="x"><img src="y"></a></p>\n', 'unmappable-html at /content/0/content/1 line 1 offset 0'],
    ['<p><em>a', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p>a', 'unmappable-html at /content/0 line 1 offset 0'],
  ],
}

for (const [group, cases] of Object.entries(refusals)) {
  for (const [html, expected] of cases) test(`${group}: ${JSON.stringify(html)}`, () => assert.equal(refusal(htmlToAdf(html)), expected))
}

const notStrings: Readonly<Record<string, unknown>> = { null: null, number: 5, object: {}, undefined: undefined }

for (const [kind, value] of Object.entries(notStrings)) {
  test(`refuses a value that is not a string as not-a-string: ${kind}`, () => {
    // @ts-expect-error -- a caller without types can pass anything.
    assert.equal(refusal(htmlToAdf(value)), 'not-a-string at / line 1 offset 0')
  })
}

test('refuses a tag of three million attributes, past what one pattern over them all holds, as a value', () => {
  assert.equal(refusal(htmlToAdf(`<p${' a=""'.repeat(3_000_000)}>x</p>\n`)), 'unmappable-html at /content/0 line 1 offset 0')
})

const messages: readonly (readonly [string, string])[] = [
  ['<p>a<b>b</b></p>\n', '<b> as written here is no inline element of the dialect: found "<b>b</b></p>\\n"'],
  ['<p>a > b</p>\n', 'text escapes & as &amp;, < as &lt; and > as &gt;, and holds no character HTML cannot hold: found "> b</p>\\n"'],
  ['<p><a href="a"b">a</a></p>\n', '<a> holds its attributes as name="value", each value escaping & as &amp; and " as &quot;, then >: found "b\\">a</a></p>\\n"'],
  ['<p>&b</p>\n', 'text escapes & as &amp;, < as &lt; and > as &gt;, and holds no character HTML cannot hold: found "&b</p>\\n"'],
  ['<pre><code>a&b</code></pre>\n', 'text escapes & as &amp;, < as &lt; and > as &gt;, and holds no character HTML cannot hold: found "&b</code></pre>\\n"'],
  ['<p>a&nbsp</p>\n', 'text escapes & as &amp;, < as &lt; and > as &gt;, and holds no character HTML cannot hold: found "&nbsp</p>\\n"'],
  ['<pre><code>a</code></pre\n', 'a code block\'s text ends at </code></pre>: found "</code></pre\\n"'],
  ['<pre><code class="hljs language-js">x</code></pre>\n', '<code> as written here is no code element of the dialect, which writes <code> or <code class="language-…">: found "<code class=\\"hljs langua"…'],
  ['<ul>\n<li>a</ul>\n', 'an item\'s line ends at </li>, or at a line feed before the item\'s next block, and its text spells < as &lt;: found "</ul>\\n"'],
  ['<ul>\n<li>a<b>b</b></li>\n</ul>\n', '<b> as written here is no inline element of the dialect: found "<b>b</b></li>\\n</ul>\\n"'],
  ['<ul>\n<li>if a < b</li>\n</ul>\n', 'an item\'s line ends at </li>, or at a line feed before the item\'s next block, and its text spells < as &lt;: found "< b</li>\\n</ul>\\n"'],
  ['<ul>\n<li>see <a href="https://x.test/?a=1&b=2">x</a></li>\n</ul>\n', '<a> holds its attributes as name="value", each value escaping & as &amp; and " as &quot;, then >: found "&b=2\\">x</a></li>\\n</ul>\\n"'],
  ['<ul>\n<li><p>a</p><strong>x</strong></li>\n</ul>\n', 'an item\'s line ends at </li>, or at a line feed before the item\'s next block: found "<strong>x</strong></li>\\n"…'],
  ['<ul>\n<li>Bolt<ul>\n<li>a</li>\n</ul></li>\n</ul>\n', 'an item\'s line ends at </li>, or at a line feed before the item\'s next block: found "<ul>\\n<li>a</li>\\n</ul></l"…'],
  ['<ul>\n<li>a<li>b</li>\n</ul>\n', 'an item\'s line ends at </li>, or at a line feed before the item\'s next block: found "<li>b</li>\\n</ul>\\n"'],
  ['<ul>\n<li>a\n<li>b</li>\n</ul>\n', 'an item\'s line ends at </li>, or at a line feed before the item\'s next block: found "<li>b</li>\\n</ul>\\n"'],
  ['<p><strong><b>x</b></strong></p>\n', '<b> as written here is no mark element of the dialect, and a mark element holds text, or one other mark element around text: found "<b>x</b></strong></p>\\n"'],
  ['<p><strong><br>x</strong></p>\n', '<br> as written here is no mark element of the dialect, and a mark element holds text, or one other mark element around text: found "<br>x</strong></p>\\n"'],
  ['<p><em></em></p>\n', 'a mark element holds text, or one other mark element around text: found "</em></p>\\n"'],
  ['<p><strong><a href="https://x.test/?a=1&b=2">x</a></strong></p>\n', '<a> holds its attributes as name="value", each value escaping & as &amp; and " as &quot;, then >: found "&b=2\\">x</a></strong></p>"…'],
  [`<p>a</p>\n${carry('div', panel, '<p>Check the <b>collation</b>.</p>')}\n`, 'a carry element shows what adfToHtml writes for its node, as it or a browser spells it, then </div>; to change the node, edit its ADF and write the HTML again: found "<b>collation</b>.</p></d"…'],
  ['<p><span>a</span></p>\n', 'a <span> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone: found "<span>a</span></p>\\n"'],
  ['<div class="adf-carry" data-adf="{ &quot;type&quot;:&quot;x&quot;}"></div>\n', 'a carry element spells its node\'s JSON canonically: compact, keys sorted, each character HTML cannot hold spelled as a JSON escape: found "{ &quot;type&quot;:&quot"…'],
  [`${documentCarry}\n<hr>\n`, 'a carry element holding the document stands alone, as the whole document: found "\\n<hr>\\n"'],
  [`<hr>\n${documentCarry}\n`, 'a carry element holding the document stands alone, as the whole document: found "<div class=\\"adf-carry\\" d"…'],
  ['<ul>\n<li><p>Bolt</p></li>\n</ul>\n', 'an item\'s first paragraph holding content and no attribute stands bare on the item\'s line, as in <li>Bolt</li>: found "<p>Bolt</p></li>\\n</ul>\\n"'],
  ['<ul>\n<li><p></p></li>\n</ul>\n', 'an item\'s first paragraph holding neither content nor an attribute stands on a line of its own: found "<p></p></li>\\n</ul>\\n"'],
  ['<ul>\n<li>\n<p data-local-id="x"></p>\n</li>\n</ul>\n', 'an item\'s first paragraph holding an attribute stands as its <p> on the item\'s line, straight after <li>: found "<p data-local-id=\\"x\\"></p"…'],
  ['<p><img src="a">b</p>\n', 'an image stands alone in its paragraph as <img src="…" alt="…">, alt left out where it holds none, inside <a> where a link marks it: found "b</p>\\n"'],
  ['<p><img src="a" alt=""></p>\n', 'an image stands alone in its paragraph as <img src="…" alt="…">, alt left out where it holds none, inside <a> where a link marks it: found "<img src=\\"a\\" alt=\\"\\"></p>"…'],
  ['<ol start="03">\n<li>a</li>\n</ol>\n', 'an ordered list starts at an integer, written as JavaScript writes it: found "03\\">\\n<li>a</li>\\n</ol>\\n"'],
  ['<p class="x">a</p>\n', '<p> takes no class attribute'],
  ['<p data-color="x">a</p>\n', '<p> takes no data-color attribute'],
  ['<ol data-local-id="x" start="2">\n<li>a</li>\n</ol>\n', '<ol> takes start once, before its data-* attributes: found start after data-local-id'],
  ['<ol start="2" start="3">\n<li>a</li>\n</ol>\n', '<ol> takes start once, before its data-* attributes: found start after start'],
  ['<pre data-wrap="yes"><code>x</code></pre>\n', 'data-wrap holds no boolean written as compact JSON'],
]

for (const [html, expected] of messages) test(`names what it found where reading stopped, a character no one sees as its escape: ${JSON.stringify(html)}`, () => assert.equal(message(htmlToAdf(html)), expected))

test('reads blocks nested 500 levels, and refuses the next level, a list\'s items one level below it', () => {
  const quotes = (levels: number): string => `${'<blockquote>\n'.repeat(levels)}<p>x</p>${'\n</blockquote>'.repeat(levels)}\n`
  assert.equal(refusal(htmlToAdf(quotes(500))), 'read')
  assert.equal(refusal(htmlToAdf(quotes(501))).startsWith(`unsupported-nesting-depth at /${'content/0/'.repeat(501)}content/0 line ${502}`), true)
  assert.equal(message(htmlToAdf(quotes(501))), 'blocks nest deeper than 500 levels')
  const lists = (levels: number): string => `${'<ul>\n<li>x\n'.repeat(levels)}<hr>${'\n</li>\n</ul>'.repeat(levels)}\n`
  assert.equal(refusal(htmlToAdf(lists(500))), 'read')
  assert.equal(refusal(htmlToAdf(lists(501))).startsWith('unsupported-nesting-depth'), true)
  assert.equal(refusal(htmlToAdf('<blockquote>\n'.repeat(1_000_000))).startsWith('unsupported-nesting-depth'), true)
})

test('refuses a carried node whose JSON nests past the levels its depth leaves, and an inline carry past 500', () => {
  const carried = carry('div', { attrs: { a: nested(1, 498, (inner) => [inner]) }, type: 'unknownBlock' }, '')
  assert.equal(refusal(htmlToAdf(`${carried}\n`)), 'read')
  assert.equal(refusal(htmlToAdf(`<blockquote>\n${carried}\n</blockquote>\n`)), 'unsupported-nesting-depth at /content/0/content/0 line 2 offset 13')
  const inline = nested({ text: 'x', type: 'text' }, 500, (inner) => ({ content: [inner], type: 'unknownInline' }))
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', inline, '')}</p>\n`)), 'unsupported-nesting-depth at /content/0/content/0 line 1 offset 0')
})

// The documents adfToHtml's own tests write, by what each holds.
const written: Readonly<Record<string, AdfDocument>> = {
  'a panel holding a code block': document({ attrs: { panelType: 'info' }, content: [paragraph(text('Run this:')), { attrs: { language: 'python' }, content: [text('if ready:\n    deploy()')], type: 'codeBlock' }], type: 'panel' }),
  'adjacent unmarked text': document(paragraph(text('a'), text('b'), text('c', { type: 'em' }), text('d'), text('e'))),
  'no content key': { type: 'doc', version: 1 },
}

for (const [holding, adf] of Object.entries(written)) {
  test(`reads back what adfToHtml writes for a document holding ${holding}`, () => {
    const html = adfToHtml(adf)
    assert.ok(html.ok)
    assert.deepEqual(read(htmlToAdf(html.value)), adf)
  })
}

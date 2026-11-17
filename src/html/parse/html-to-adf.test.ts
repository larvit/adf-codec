import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { ParseError, Result } from '../../result.ts'
import { adfToHtml, htmlToAdf } from '../../index.ts'
import { dialectHtmlToAdf } from './html-to-adf.ts'

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

function names(result: Result<AdfDocument, ParseError>, ...facts: readonly string[]): void {
  const message = result.ok ? '' : result.error.message
  for (const fact of facts) assert.ok(message.includes(fact), `${JSON.stringify(message)} names ${fact}`)
}

const documentCarry = carry('div', { type: 'doc', version: 1 }, '')
const mention: AdfNode = { attrs: { id: ids.mention, text: '@Mikael' }, type: 'mention' }
const bodied: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Check the collation.'))], type: 'bodiedExtension' }
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

test('reads <del> as a strike mark', () => {
  assert.deepEqual(read(htmlToAdf('<p><del>old</del><strong><del> new</del></strong></p>\n')), document(paragraph(text('old', { type: 'strike' }), text(' new', { type: 'strong' }, { type: 'strike' }))))
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
  assert.deepEqual(read(htmlToAdf(crlf(`${carry('div', bodied, '<p>Check the collation.</p>')}\n`))), document(bodied))
  assert.deepEqual(read(htmlToAdf(crlf(`${documentCarry}\n`))), { type: 'doc', version: 1 })
  assert.deepEqual(read(htmlToAdf('<hr data-style="a\r\nb">\n')), document({ attrs: { style: 'a\nb' }, type: 'rule' }))
  for (const html of ['<p>a\r</p>\n', '<p>a</p>\r', '<p>a</p>\r\r\n', '<p>a\r\r\nb</p>\n']) assert.equal(refusal(dialectHtmlToAdf(html)).startsWith('unmappable-html'), true, JSON.stringify(html))
})

test('places a refusal in HTML ending its lines in CRLF at the start of the line it stands on, counted in the HTML handed in', () => {
  assert.equal(refusal(dialectHtmlToAdf('<p>a</p>\r\n<b>x</b>\r\n')), 'unmappable-html at /content/1 line 2 offset 10')
  assert.equal(refusal(dialectHtmlToAdf('<p>a</p>\r\n<p>b</p>\r\n<p>c<b>d</b></p>\r\n')), 'unmappable-html at /content/2 line 3 offset 20')
  assert.equal(refusal(dialectHtmlToAdf('<p>a</p>\r\n<p>b</p>')), 'unmappable-html at / line 2 offset 10')
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
  const block: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('A "quote" here'))], type: 'bodiedExtension' }
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

test('reads a figure back: its media from the image, its caption from the figcaption, a link around the image as a mark', () => {
  const external: AdfNode = { attrs: { alt: 'The moon', height: 600, type: 'external', url: 'https://example.com/moon.jpg', width: 800 }, type: 'media' }
  const caption: AdfNode = { attrs: { localId: ids.item }, content: [text('The moon, '), text('at night', { type: 'em' })], type: 'caption' }
  const figure = `<figure class="adf-media-single" data-layout="center" data-local-id="${ids.list}" data-width="50" data-width-type="pixel"><img src="https://example.com/moon.jpg" alt="The moon" height="600" width="800"><figcaption data-local-id="${ids.item}">The moon, <em>at night</em></figcaption></figure>\n`
  assert.deepEqual(read(htmlToAdf(figure)), document({ attrs: { layout: 'center', localId: ids.list, width: 50, widthType: 'pixel' }, content: [external, caption], type: 'mediaSingle' }))
  assert.deepEqual(read(htmlToAdf('<figure class="adf-media-single"><img src="https://example.com/moon.jpg" alt=""><figcaption></figcaption></figure>\n')), document({ content: [{ attrs: { alt: '', type: 'external', url: 'https://example.com/moon.jpg' }, type: 'media' }, { type: 'caption' }], type: 'mediaSingle' }))
  const linked: AdfNode = { attrs: { type: 'external', url: 'https://example.com/moon.jpg' }, marks: [{ attrs: { href: 'https://example.com/', title: 'Home' }, type: 'link' }], type: 'media' }
  assert.deepEqual(read(htmlToAdf('<figure class="adf-media-single" data-layout="wide"><a href="https://example.com/" title="Home"><img src="https://example.com/moon.jpg"></a></figure>\n')), document({ attrs: { layout: 'wide' }, content: [linked], type: 'mediaSingle' }))
  const file: AdfNode = { attrs: { alt: 'Launch photo', collection: ids.list, height: 600, id: ids.item, occurrenceKey: ids.paragraph, type: 'file', width: 800 }, type: 'media' }
  assert.deepEqual(read(htmlToAdf(`<figure class="adf-media-single"><img class="adf-media" alt="Launch photo" height="600" width="800" data-collection="${ids.list}" data-id="${ids.item}" data-occurrence-key="${ids.paragraph}" data-type="file"></figure>\n`)), document({ content: [file], type: 'mediaSingle' }))
  assert.deepEqual(read(htmlToAdf('<figure class="adf-media-single"><img src="https://example.com/moon.jpg" data-type="file"></figure>\n')), document({ content: [{ attrs: { type: 'file', url: 'https://example.com/moon.jpg' }, type: 'media' }], type: 'mediaSingle' }))
  assert.deepEqual(read(htmlToAdf('<figure class="adf-media-single"><img class="adf-media"></figure>\n')), document({ content: [{ type: 'media' }], type: 'mediaSingle' }))
})

test('reads a media group back from its spans', () => {
  const group = `<div class="adf-media-group"><span class="adf-file" data-collection="${ids.list}" data-id="${ids.item}" data-type="file"></span><span class="adf-file" data-alt="Moon" data-height="600" data-type="external" data-url="https://example.com/moon.jpg"></span></div>\n`
  assert.deepEqual(read(htmlToAdf(group)), document({ content: [{ attrs: { collection: ids.list, id: ids.item, type: 'file' }, type: 'media' }, { attrs: { alt: 'Moon', height: 600, type: 'external', url: 'https://example.com/moon.jpg' }, type: 'media' }], type: 'mediaGroup' }))
  assert.deepEqual(read(htmlToAdf('<div class="adf-media-group"></div>\n')), document({ type: 'mediaGroup' }))
  assert.deepEqual(read(htmlToAdf('<div class="adf-media-group"><span class="adf-file"></span></div>\n')), document({ content: [{ type: 'media' }], type: 'mediaGroup' }))
})

test('refuses a figure, an image or a media group the writer does not write', () => {
  const figure = (inner: string, attributes = ' class="adf-media-single"'): string => `<figure${attributes}>${inner}</figure>\n`
  const refused = (html: string, ...facts: readonly string[]): void => names(dialectHtmlToAdf(html), ...facts)
  refused(figure('<img src="a">', ''), 'figure')
  refused(figure('<img src="a">', ' data-layout="wide" class="adf-media-single"'), 'figure')
  refused(figure('<img src="a">', ' class="adf-media-single" data-colour="red"'), 'data-colour')
  refused(figure(''), 'img')
  refused(figure('<img class="adf-media" src="a">'), 'both')
  refused(figure('<img>'), 'src')
  refused(figure('<img class="photo">'), 'class')
  refused(figure('<img src="a" height="0">'), 'height')
  refused(figure('<img src="a" width="08">'), 'width')
  refused(figure('<img src="a" width="9007199254740993">'), 'width')
  refused(figure('<img src="a" data-type="external">'), 'external')
  refused(figure('<img src="a" data-colour="red">'), 'data-colour')
  refused(figure('<img src="a" alt="x" alt="y">'), 'alt')
  refused(figure('<img src="a"><figcaption>x</figcaption><figcaption>y</figcaption>'), '</figure>')
  refused(figure('<img src="a"><p>x</p>'), '</figure>')
  refused(figure('<a href="b"><img src="a"></figure>'), '</a>')
  refused(figure('<a href="b" class="c"><img src="a"></a>'), 'img')
  refused(figure('<img src="a"><figcaption>x</p></figcaption>'), 'figcaption')
  refused('<div class="adf-media-group"><img src="a"></div>\n', 'adf-file')
  refused('<div class="adf-media-group"><span class="adf-file" data-colour="red"></span></div>\n', 'data-colour')
  refused('<div class="adf-media-group"><span class="adf-file">x</span></div>\n', '</span>')
  refused('<div class="adf-media-group" data-id="x"></div>\n', 'adf-media-group')
  refused('<div class="adf-media-group">\n</div>\n', 'adf-file')
  refused('<div class="adf-media-group"><span class="adf-file">', 'adf-file')
  refused('<div class="photo"></div>\n', 'div')
})

test('reads underline, subscript, superscript and the two colours from their elements', () => {
  const marked = (inner: string): AdfDocument | string => read(htmlToAdf(`<p>${inner}</p>\n`))
  assert.deepEqual(marked('<u>x</u>'), document(paragraph(text('x', { type: 'underline' }))))
  assert.deepEqual(marked('<sub>x</sub>'), document(paragraph(text('x', { attrs: { type: 'sub' }, type: 'subsup' }))))
  assert.deepEqual(marked('<sup>x</sup>'), document(paragraph(text('x', { attrs: { type: 'sup' }, type: 'subsup' }))))
  assert.deepEqual(marked('<span data-text-color="#ff5630">x</span>'), document(paragraph(text('x', { attrs: { color: '#ff5630' }, type: 'textColor' }))))
  assert.deepEqual(marked('<mark data-background-color="#fffae6">x</mark>'), document(paragraph(text('x', { attrs: { color: '#fffae6' }, type: 'backgroundColor' }))))
  assert.deepEqual(marked('<strong><u><span data-text-color="red">x</span></u></strong>'), document(paragraph(text('x', { type: 'strong' }, { type: 'underline' }, { attrs: { color: 'red' }, type: 'textColor' }))))
  assert.deepEqual(marked('a<span data-text-color="red">b</span>'), document(paragraph(text('a'), text('b', { attrs: { color: 'red' }, type: 'textColor' }))))
})

test('refuses a mark element the writer does not write', () => {
  for (const inner of ['<span style="color:red">x</span>', '<mark style="background-color:red">x</mark>', '<span data-background-color="red">x</span>', '<mark data-text-color="red">x</mark>', '<mark>x</mark>', '<span data-text-color="red" class="c">x</span>', '<span data-text-color="red" data-background-color="red">x</span>', '<u class="c">x</u>', '<sub data-text-color="red">x</sub>', '<span data-text-color="red"><span data-text-color="blue">x</span></span>']) {
    assert.notEqual(refusal(dialectHtmlToAdf(`<p>${inner}</p>\n`)), 'read', inner)
  }
})

test('reads a paragraph or heading with a data-indent-level attribute as indented', () => {
  const indentation = (level: number): AdfMark => ({ attrs: { level }, type: 'indentation' })
  assert.deepEqual(read(htmlToAdf('<p data-indent-level="2">x</p>\n')), document({ content: [text('x')], marks: [indentation(2)], type: 'paragraph' }))
  assert.deepEqual(read(htmlToAdf('<h2 data-indent-level="6">x</h2>\n')), document({ attrs: { level: 2 }, content: [text('x')], marks: [indentation(6)], type: 'heading' }))
  assert.deepEqual(read(htmlToAdf(`<p data-indent-level="1" data-local-id="${ids.paragraph}"></p>\n`)), document({ attrs: { localId: ids.paragraph }, marks: [indentation(1)], type: 'paragraph' }))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li><p data-indent-level="3">x</p></li>\n</ul>\n')), document({ content: [item({ content: [text('x')], marks: [indentation(3)], type: 'paragraph' })], type: 'bulletList' }))
})

test('reads a paragraph or heading with a data-align attribute as aligned', () => {
  const alignment = (align: string): AdfMark => ({ attrs: { align }, type: 'alignment' })
  assert.deepEqual(read(htmlToAdf('<p data-align="center">x</p>\n')), document({ content: [text('x')], marks: [alignment('center')], type: 'paragraph' }))
  assert.deepEqual(read(htmlToAdf('<h2 data-align="end">x</h2>\n')), document({ attrs: { level: 2 }, content: [text('x')], marks: [alignment('end')], type: 'heading' }))
  assert.deepEqual(read(htmlToAdf(`<p data-align="end" data-local-id="${ids.paragraph}"></p>\n`)), document({ attrs: { localId: ids.paragraph }, marks: [alignment('end')], type: 'paragraph' }))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li><p data-align="center">x</p></li>\n</ul>\n')), document({ content: [item({ content: [text('x')], marks: [alignment('center')], type: 'paragraph' })], type: 'bulletList' }))
  for (const html of ['<p style="text-align:center">x</p>\n', '<p data-align="left">x</p>\n', '<p data-align="right">x</p>\n', '<p data-align="">x</p>\n', `<p data-local-id="${ids.paragraph}" data-align="center">x</p>\n`, '<p data-align="center" data-align="end">x</p>\n', '<figure class="adf-media-single" data-align="center"><img src="a"></figure>\n', '<blockquote data-align="center">\n<p>x</p>\n</blockquote>\n']) {
    assert.notEqual(refusal(dialectHtmlToAdf(html)), 'read', html)
  }
})

test('refuses a carry element holding an inline card a link marks, at any depth in the node it carries', () => {
  const card = { attrs: { url: 'https://e.com/r' }, marks: [{ attrs: { href: 'https://e.com/' }, type: 'link' }], type: 'inlineCard' }
  for (const html of [`<p>${carry('span', card, '')}</p>\n`, `${carry('div', { content: [{ content: [card], type: 'futureNode' }], type: 'futureBlock' }, '')}\n`]) {
    names(htmlToAdf(html), 'data-adf', 'every writer refuses', 'inlineCard', 'link mark')
  }
})

test('refuses a carry element holding a shape every writer refuses, at any depth in the node it carries', () => {
  const shapes = [
    { facts: ['panel', 'no text key'], node: { text: 'x', type: 'panel' } },
    { facts: ['rule', 'no content'], node: { content: [{ type: 'paragraph' }], type: 'rule' } },
    { facts: ['status', 'neither content nor text', 'holds text'], node: { text: 'x', type: 'status' } },
  ]
  for (const { facts, node } of shapes) {
    for (const carried of [node, { content: [node], type: 'futureBlock' }]) {
      names(htmlToAdf(`${carry('div', carried, '')}\n`), 'data-adf', 'every writer refuses', ...facts)
    }
  }
})

test('reads a table back, its rows, cells and attributes as adfToHtml writes them', () => {
  const row = (...content: AdfNode[]): AdfNode => ({ content, type: 'tableRow' })
  const body = '<tr><td>Bolt M8</td></tr>'
  const boltRow = row({ content: [paragraph(text('Bolt M8'))], type: 'tableCell' })
  const partRow = row({ content: [paragraph(text('Part'))], type: 'tableHeader' })
  assert.deepEqual(read(htmlToAdf(`<table>\n<thead>\n<tr><th>Part</th></tr>\n</thead>\n<tbody>\n${body}\n${body}\n</tbody>\n</table>\n`)), document({ content: [partRow, boltRow, boltRow], type: 'table' }))
  assert.deepEqual(read(htmlToAdf('<table>\n<thead>\n<tr><th>Part</th></tr>\n</thead>\n</table>\n')), document({ content: [partRow], type: 'table' }))
  assert.deepEqual(read(htmlToAdf(`<table>\n<tbody>\n${body}\n<tr><th>Part</th></tr>\n</tbody>\n</table>\n`)), document({ content: [boltRow, partRow], type: 'table' }))
  assert.deepEqual(read(htmlToAdf('<table></table>\n')), document({ type: 'table' }))
  assert.deepEqual(read(htmlToAdf('<table>\n<tbody>\n<tr></tr>\n</tbody>\n</table>\n')), document({ content: [{ type: 'tableRow' }], type: 'table' }))
  assert.deepEqual(read(htmlToAdf('<table>\n<tbody>\n<tr><td></td><th></th></tr>\n</tbody>\n</table>\n')), document({ content: [row({ type: 'tableCell' }, { type: 'tableHeader' })], type: 'table' }))
  assert.deepEqual(read(htmlToAdf('<table>\n<tbody>\n<tr><td>a\n<p>b</p>\n</td><td>\n<hr>\n</td></tr>\n</tbody>\n</table>\n')), document({ content: [row({ content: [paragraph(text('a')), paragraph(text('b'))], type: 'tableCell' }, { content: [{ type: 'rule' }], type: 'tableCell' })], type: 'table' }))
  assert.deepEqual(
    read(htmlToAdf('<table data-layout="wide" data-width="760">\n<tbody>\n<tr data-local-id="r1"><td colspan="2" rowspan="3" data-background-color="#fffae6" data-colwidth="120,80" data-local-id="c1" data-valign="top">x</td></tr>\n</tbody>\n</table>\n')),
    document({ attrs: { layout: 'wide', width: 760 }, content: [{ attrs: { localId: 'r1' }, content: [{ attrs: { background: '#fffae6', colspan: 2, colwidth: [120, 80], localId: 'c1', rowspan: 3, valign: 'top' }, content: [paragraph(text('x'))], type: 'tableCell' }], type: 'tableRow' }], type: 'table' }),
  )
  assert.deepEqual(read(htmlToAdf('<table>\n<tbody>\n<tr><td colspan="2" style="background-color:yellow" data-colwidth="120">x</td></tr>\n</tbody>\n</table>\n')), document({ content: [row({ attrs: { background: 'yellow', colspan: 2, colwidth: [120] }, content: [paragraph(text('x'))], type: 'tableCell' })], type: 'table' }))
  assert.deepEqual(read(htmlToAdf('<ul>\n<li>\n<table></table>\n</li>\n</ul>\n')), document({ content: [item({ type: 'table' })], type: 'bulletList' }))
})

const tableRefusals: readonly (readonly [string, string])[] = [
  ['<table><tr></tr></table>\n', 'unmappable-html'],
  ['<table>\n<tr></tr>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<thead>\n</thead>\n</table>\n', 'unmappable-html'],
  ['<table>\n<thead>\n<tr></tr>\n</thead>\n</table>\n', 'unmappable-html'],
  ['<table>\n<thead>\n<tr><td>a</td></tr>\n</thead>\n</table>\n', 'unmappable-html'],
  ['<table>\n<thead>\n<tr><th>a</th><td>b</td></tr>\n</thead>\n</table>\n', 'unmappable-html'],
  ['<table>\n<thead>\n<tr><th>a</th></tr>\n<tr><th>b</th></tr>\n</thead>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><th>a</th></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<td>a</td>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><p>a</p></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td>a</td>\n<td>b</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td><p>a</p></td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td rowspan="2" colspan="2">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td colspan="2" colspan="2">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td data-local-id="c" colspan="2">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td data-local-id="c" data-colwidth="1">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td colspan="0">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td colspan="02">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td rowspan="x">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td style="color:red">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td style="x background-color:red">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td style="background-color:url(x)">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td style="background-color:red" data-background-color="red">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td data-colwidth="1" data-background-color="red">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td data-colwidth="[1]">a</td></tr>\n</tbody>\n</table>\n', 'unsupported-node-shape'],
  ['<table>\n<tbody>\n<tr><td data-colwidth="01">a</td></tr>\n</tbody>\n</table>\n', 'unsupported-node-shape'],
  ['<table data-size="big"></table>\n', 'unsupported-node-shape'],
  ['<table>\n<tbody>\n<tr data-size="big"></tr>\n</tbody>\n</table>\n', 'unsupported-node-shape'],
  ['<table>\n<tbody>\n<tr><td data-size="big"></td></tr>\n</tbody>\n</table>\n', 'unsupported-node-shape'],
  ['<table>\n<tfoot>\n<tr></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<thead>\n<tr><th>a</th></tr>\n</tfoot>\n<tbody>\n<tr></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td colspan="2x">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td data-background-color="red" data-background-color="red">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
  ['<table>\n<tbody>\n<tr><td>a<hr>\n</td></tr>\n</tbody>\n</table>\n', 'unmappable-html'],
]

for (const [html, code] of tableRefusals) {
  test(`refuses a table not written as adfToHtml writes it: ${JSON.stringify(html)}`, () => {
    assert.equal(refusal(dialectHtmlToAdf(html)).split(' ')[0], code)
  })
}

test('refuses a character between a list item\'s tag and its first block', () => {
  assert.equal(refusal(dialectHtmlToAdf('<ul>\n<li>a<hr>\n</li>\n</ul>\n')).split(' ')[0], 'unmappable-html')
})

test('counts a table and its rows each a level, and a cell none, as adfToHtml does', () => {
  const holding = (levels: number, inner: string): string => `${'<blockquote>\n'.repeat(levels)}${inner}${'\n</blockquote>'.repeat(levels)}\n`
  const row = '<table>\n<tbody>\n<tr></tr>\n</tbody>\n</table>'
  const cell = '<table>\n<tbody>\n<tr><td>x</td></tr>\n</tbody>\n</table>'
  assert.equal(htmlToAdf(holding(499, row)).ok, true)
  assert.equal(refusal(htmlToAdf(holding(500, row))).split(' ')[0], 'unsupported-nesting-depth')
  assert.equal(htmlToAdf(holding(500, '<table></table>')).ok, true)
  assert.equal(htmlToAdf(holding(498, cell)).ok, true)
  assert.equal(refusal(htmlToAdf(holding(499, cell))).split(' ')[0], 'unsupported-nesting-depth')
})

test('reads a carry element from its data-adf, what it shows read back as adfToHtml writes it', () => {
  assert.deepEqual(read(htmlToAdf(`${carry('div', bodied, '<p>Check the collation.</p>')}\n<p>Ask ${carry('span', mention, '@Mikael')}</p>\n`)), document(bodied, paragraph(text('Ask '), mention)))
  assert.deepEqual(read(htmlToAdf(`<p>${carry('span', text('a\u0085b', { type: 'underline' }), 'ab').replace('\u0085', '\\u0085')}</p>\n`)), document(paragraph(text('a\u0085b', { type: 'underline' }))))
})

test('reads a carry element holding a node HTML writes as its own element as that node', () => {
  assert.deepEqual(read(htmlToAdf(`${carry('div', paragraph(text('x')), '<p>x</p>')}\n`)), document(paragraph(text('x'))))
  assert.deepEqual(read(htmlToAdf(`<p>a${carry('span', text('b'), 'b')}</p>\n`)), document(paragraph(text('a'), text('b'))))
  assert.deepEqual(read(htmlToAdf(`<ul>\n<li>\n${carry('div', paragraph(text('x')), '<p>x</p>')}\n</li>\n</ul>\n`)), document({ content: [item(paragraph(text('x')))], type: 'bulletList' }))
})

test('reads an emoji, mention, status, date and card from their elements', () => {
  const inline = (node: AdfNode): AdfDocument | string => read(htmlToAdf(adfToHtmlText(document(paragraph(text('See '), node)))))
  const nodes: AdfNode[] = [
    { attrs: { id: '1f389', localId: 'e1', shortName: ':tada:', text: '🎉' }, type: 'emoji' },
    { attrs: { text: '<3 &' }, type: 'emoji' },
    { attrs: { color: 'yellow', localId: 's1', style: 'bold', text: 'In "review"' }, type: 'status' },
    { attrs: { localId: 'd1', timestamp: '1756080000000' }, type: 'date' },
    { attrs: { localId: 'c1', url: 'https://example.com/spec?a=1&b=2' }, type: 'inlineCard' },
    { attrs: { text: ' ' }, type: 'emoji' },
    { attrs: { text: ' ' }, type: 'status' },
    { attrs: { url: ' ' }, type: 'inlineCard' },
    { attrs: { accessLevel: 'CONTAINER', id: ids.mention, localId: 'm1', text: '@Mikael', userType: 'DEFAULT' }, type: 'mention' },
    { attrs: { text: ' ' }, type: 'mention' },
    { attrs: { data: { name: 'Release plan', url: 'https://example.com/plan?a=1&b=2' }, localId: 'c2' }, type: 'inlineCard' },
    { attrs: { data: { url: 'https://example.com/plan' } }, type: 'inlineCard' },
    { attrs: { data: { name: 'https://example.com/plan', url: 'https://example.com/plan' } }, type: 'inlineCard' },
  ]
  for (const node of nodes) assert.deepEqual(inline(node), document(paragraph(text('See '), node)))
  assert.deepEqual(read(htmlToAdf('<p><span class="adf-emoji">a&nbsp;&quot;b</span></p>\n')), document(paragraph({ attrs: { text: 'a\u00a0"b' }, type: 'emoji' })))
})

test('reads a carry element holding an emoji, status, date or card holding a URL as that node', () => {
  const emoji: AdfNode = { attrs: { text: '🎉' }, type: 'emoji' }
  assert.deepEqual(read(htmlToAdf(`<p>${carry('span', emoji, '🎉')}</p>\n`)), document(paragraph(emoji)))
})

function adfToHtmlText(doc: AdfDocument): string {
  const written = adfToHtml(doc)
  return written.ok ? written.value : written.error.message
}

// Each group's cases, the HTML and its refusal.
const planData = '{&quot;name&quot;:&quot;Plan&quot;,&quot;url&quot;:&quot;https://example.com/plan&quot;}'

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
    [`<p>a</p>\n${carry('div', bodied, '<p>Check the <b>collation</b>.</p>')}\n`, 'unmappable-html at /content/1 line 2 offset 9'],
    [`<p>Ask ${carry('span', mention, '')}</p>\n`, 'unmappable-html at /content/0/content/1 line 1 offset 0'],
  ],
  'refuses an emoji, status, date or card holding a URL element that is not as adfToHtml writes it': [
    ['<p><span class="adf-emoji"></span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji">a<b>b</b></span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji">a</p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji">a&b</span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji" data-short-name=":a:" data-id="1">a</span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji" data-size="big">a</span></p>\n', 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji" data-text="a">a</span></p>\n', 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-emoji" id="x">a</span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-status" class="adf-status">a</span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time class="adf-date" data-timestamp="1756080000000">2025-08-25</time></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time class="adf-date" datetime="2025-08-26" data-timestamp="1756080000000">2025-08-26</time></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time class="adf-date" datetime="2025-08-25" data-timestamp="1756080000000">Today</time></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time class="adf-date" datetime="2025-08-25">2025-08-25</time></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time class="adf-date" datetime="x" data-timestamp="x">x</time></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time class="adf-date" datetime="+010000-01-01" data-timestamp="253402300800000">+010000-01-01</time></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><time datetime="2025-08-25">2025-08-25</time></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card" href="https://example.com/">Spec</a></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card">https://example.com/</a></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-status">x</a></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><time class="adf-emoji">x</time></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card" data-local-id="x">x</a></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card" href="">a</a></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card" href="https://example.com/" title="t">https://example.com/</a></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card" href="https://example.com/" data-data="{}">https://example.com/</a></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    [`<p><a class="adf-inline-card" href="https://example.org/plan" data-data="${planData}">Plan</a></p>\n`, 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    [`<p><a class="adf-inline-card" href="https://example.com/plan" data-data="${planData}">Roadmap</a></p>\n`, 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    [`<p><a class="adf-inline-card" data-data="${planData}">Plan</a></p>\n`, 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    [`<p><a class="adf-inline-card" href="https://example.com/plan" data-data="${planData}" data-url="https://example.com/plan">Plan</a></p>\n`, 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-inline-card" href="https://example.com/plan" data-data="{ &quot;name&quot;:&quot;Plan&quot;}">Plan</a></p>\n', 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-mention"></span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-mention" data-text="x">x</span></p>\n', 'unsupported-node-shape at /content/0/content/0 line 1 offset 0'],
    ['<p><span class="adf-mention" data-user-type="DEFAULT" data-id="x">x</span></p>\n', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
    ['<p><a class="adf-mention">x</a></p>\n', 'unmappable-html at /content/0 line 1 offset 0'],
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
  for (const [html, expected] of cases) test(`${group}: ${JSON.stringify(html)}`, () => assert.equal(refusal(dialectHtmlToAdf(html)), expected))
}

const notStrings: Readonly<Record<string, unknown>> = { null: null, number: 5, object: {}, undefined: undefined }

for (const [kind, value] of Object.entries(notStrings)) {
  test(`refuses a value that is not a string as not-a-string: ${kind}`, () => {
    // @ts-expect-error -- a caller without types can pass anything.
    assert.equal(refusal(htmlToAdf(value)), 'not-a-string at / line 1 offset 0')
    // @ts-expect-error -- a caller without types can pass anything.
    names(htmlToAdf(value), 'HTML is a string')
  })
}

test('refuses a tag of three million attributes, past what one pattern over them all holds, as a value', () => {
  assert.equal(refusal(dialectHtmlToAdf(`<p${' a=""'.repeat(3_000_000)}>x</p>\n`)), 'unmappable-html at /content/0 line 1 offset 0')
})

const messages: readonly (readonly [string, readonly string[]])[] = [
  ['<p>a<b>b</b></p>\n', ['<b> as written here is no inline element of the dialect', 'found "<b>b</b></p>\\n"']],
  ['<p>a > b</p>\n', ['text escapes & as &amp;', '> as &gt;', 'found "> b</p>\\n"']],
  ['<p><a href="a"b">a</a></p>\n', ['<a> holds its attributes as name="value"', '" as &quot;', 'found "b\\">a</a></p>\\n"']],
  ['<p>&b</p>\n', ['text escapes & as &amp;', 'found "&b</p>\\n"']],
  ['<pre><code>a&b</code></pre>\n', ['text escapes & as &amp;', 'found "&b</code></pre>\\n"']],
  ['<p>a&nbsp</p>\n', ['text escapes & as &amp;', 'found "&nbsp</p>\\n"']],
  ['<pre><code>a</code></pre\n', ['a code block\'s text ends at </code></pre>', 'found "</code></pre\\n"']],
  ['<pre><code class="hljs language-js">x</code></pre>\n', ['<code> as written here is no code element of the dialect', 'found "<code class=\\"hljs langua"…']],
  ['<ul>\n<li>a</ul>\n', ['the line ends at </li>', '< as &lt;', 'found "</ul>\\n"']],
  ['<ul>\n<li>a<b>b</b></li>\n</ul>\n', ['<b> as written here is no inline element of the dialect', 'found "<b>b</b></li>\\n</ul>\\n"']],
  ['<ul>\n<li>if a < b</li>\n</ul>\n', ['the line ends at </li>', '< as &lt;', 'found "< b</li>\\n</ul>\\n"']],
  ['<ul>\n<li>see <a href="https://x.test/?a=1&b=2">x</a></li>\n</ul>\n', ['<a> holds its attributes as name="value"', '& as &amp;', '" as &quot;', 'found "&b=2\\">x</a></li>\\n</ul>\\n"']],
  ['<ul>\n<li><p>a</p><strong>x</strong></li>\n</ul>\n', ['the line ends at </li>', 'found "<strong>x</strong></li>\\n"…']],
  ['<ul>\n<li>Bolt<ul>\n<li>a</li>\n</ul></li>\n</ul>\n', ['the line ends at </li>', 'found "<ul>\\n<li>a</li>\\n</ul></l"…']],
  ['<ul>\n<li>a<li>b</li>\n</ul>\n', ['the line ends at </li>', 'found "<li>b</li>\\n</ul>\\n"']],
  ['<ul>\n<li>a\n<li>b</li>\n</ul>\n', ['the line ends at </li>', 'found "<li>b</li>\\n</ul>\\n"']],
  ['<p><strong><b>x</b></strong></p>\n', ['<b> as written here is no mark element of the dialect', 'found "<b>x</b></strong></p>\\n"']],
  ['<p><strong><br>x</strong></p>\n', ['<br> as written here is no mark element of the dialect', 'found "<br>x</strong></p>\\n"']],
  ['<p><em></em></p>\n', ['a mark element holds text', 'found "</em></p>\\n"']],
  ['<p><strong><a href="https://x.test/?a=1&b=2">x</a></strong></p>\n', ['<a> holds its attributes as name="value"', '& as &amp;', '" as &quot;', 'found "&b=2\\">x</a></strong></p>"…']],
  [`<p>a</p>\n${carry('div', bodied, '<p>Check the <b>collation</b>.</p>')}\n`, ['a carry element shows what adfToHtml writes for its node', 'to change the node, edit its ADF and write the HTML again', 'found "<b>collation</b>.</p></d"…']],
  ['<p><span>a</span></p>\n', ['a <span> of the dialect is a carry element', 'found "<span>a</span></p>\\n"']],
  ['<div class="adf-carry" data-adf="{ &quot;type&quot;:&quot;x&quot;}"></div>\n', ['a carry element spells its node\'s JSON canonically', 'found "{ &quot;type&quot;:&quot"…']],
  [`${documentCarry}\n<hr>\n`, ['a carry element holding the document stands alone', 'found "\\n<hr>\\n"']],
  [`<hr>\n${documentCarry}\n`, ['a carry element holding the document stands alone', 'found "<div class=\\"adf-carry\\" d"…']],
  ['<ul>\n<li><p>Bolt</p></li>\n</ul>\n', ['an item\'s or cell\'s first paragraph holding content and no attribute stands bare on the line of the item\'s or cell\'s start tag', 'found "<p>Bolt</p></li>\\n</ul>\\n"']],
  ['<ul>\n<li><p></p></li>\n</ul>\n', ['an item\'s or cell\'s first paragraph holding neither content nor an attribute stands on a line of its own', 'found "<p></p></li>\\n</ul>\\n"']],
  ['<ul>\n<li>\n<p data-local-id="x"></p>\n</li>\n</ul>\n', ['an item\'s or cell\'s first paragraph holding an attribute stands as its <p> straight after the item\'s or cell\'s start tag', 'found "<p data-local-id=\\"x\\"></p"…']],
  ['<p><img src="a">b</p>\n', ['an image stands alone in its paragraph as <img src="…" alt="…">', 'found "b</p>\\n"']],
  ['<p><img src="a" alt=""></p>\n', ['an image stands alone in its paragraph as <img src="…" alt="…">', 'found "<img src=\\"a\\" alt=\\"\\"></p>"…']],
  ['<ol start="03">\n<li>a</li>\n</ol>\n', ['an ordered list starts at an integer', 'found "03\\">\\n<li>a</li>\\n</ol>\\n"']],
  ['<p class="x">a</p>\n', ['<p>', 'no class attribute']],
  ['<p data-color="x">a</p>\n', ['<p>', 'no data-color attribute']],
  ['<ol data-local-id="x" start="2">\n<li>a</li>\n</ol>\n', ['<ol> takes start once', 'found start after data-local-id']],
  ['<ol start="2" start="3">\n<li>a</li>\n</ol>\n', ['<ol> takes start once', 'found start after start']],
  ['<ol start="2" data-bogus="1" start="3">\n<li>a</li>\n</ol>\n', ['<ol>', 'no data-bogus attribute']],
  ['<pre data-wrap="yes"><code>x</code></pre>\n', ['data-wrap', 'boolean']],
  ['<p><span class="adf-emoji"></span></p>\n', ['<span class="adf-emoji"> holds its text', 'found "</span></p>\\n"']],
  ['<p><a class="adf-inline-card" href="https://example.com/">Spec</a></p>\n', ['<a class="adf-inline-card"> holds one URL', 'to change the card, change them together', 'found "Spec</a></p>\\n"']],
  [`<p><a class="adf-inline-card" href="https://example.org/plan" data-data="${planData}">Plan</a></p>\n`, ['<a class="adf-inline-card"> holds one URL', 'to change the card, change them together', 'found "Plan</a></p>\\n"']],
  ['<p><time class="adf-date" datetime="2025-08-26" data-timestamp="1756080000000">x</time></p>\n', ['<time class="adf-date"> shows the day its data-timestamp names', 'to change the date, change all three', 'found "x</time></p>\\n"']],
  ['<p><span class="adf-emoji" data-size="big">a</span></p>\n', ['<span class="adf-emoji">', 'no data-size attribute']],
  ['<p><span class="adf-status">a&b</span></p>\n', ['text escapes & as &amp;', 'found "&b</span></p>\\n"']],
]

for (const [html, facts] of messages) test(`names what it found where reading stopped, a character no one sees as its escape: ${JSON.stringify(html)}`, () => names(dialectHtmlToAdf(html), ...facts))

test('reads blocks nested 500 levels, and refuses the next level, a list\'s items one level below it', () => {
  const quotes = (levels: number): string => `${'<blockquote>\n'.repeat(levels)}<p>x</p>${'\n</blockquote>'.repeat(levels)}\n`
  assert.equal(refusal(htmlToAdf(quotes(500))), 'read')
  assert.equal(refusal(dialectHtmlToAdf(quotes(501))).startsWith(`unsupported-nesting-depth at /${'content/0/'.repeat(501)}content/0 line ${502}`), true)
  names(dialectHtmlToAdf(quotes(501)), 'blocks', '500 levels')
  const lists = (levels: number): string => `${'<ul>\n<li>x\n'.repeat(levels)}<hr>${'\n</li>\n</ul>'.repeat(levels)}\n`
  assert.equal(refusal(htmlToAdf(lists(500))), 'read')
  assert.equal(refusal(htmlToAdf(lists(501))).startsWith('unsupported-nesting-depth'), true)
  assert.equal(refusal(htmlToAdf('<blockquote>\n'.repeat(1_000_000))).startsWith('unsupported-nesting-depth'), true)
})

test('reads panels, expands and nested expands nested 500 levels, and refuses the next level', () => {
  const panels = (levels: number): string => `${'<div class="adf-panel">\n'.repeat(levels)}<p>x</p>${'\n</div>'.repeat(levels)}\n`
  const expands = (levels: number): string => `${'<details class="adf-expand">\n<summary>t</summary>\n'.repeat(levels)}<p>x</p>${'\n</details>'.repeat(levels)}\n`
  const bare = (levels: number): string => `${'<details class="adf-nested-expand">\n'.repeat(levels)}<p>x</p>${'\n</details>'.repeat(levels)}\n`
  for (const build of [panels, expands, bare]) {
    assert.equal(refusal(htmlToAdf(build(500))), 'read')
    assert.equal(refusal(htmlToAdf(build(501))).startsWith('unsupported-nesting-depth'), true)
  }
})

test('reads a task or decision list nested 499 levels, its items one level below it, and refuses the next level', () => {
  const lists = [
    '<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled=""> x</li>\n</ul>',
    '<ul class="adf-decision-list">\n<li class="adf-decision" data-state="DECIDED">x</li>\n</ul>',
  ]
  const panels = (levels: number, list: string): string => `${'<div class="adf-panel">\n'.repeat(levels)}${list}${'\n</div>'.repeat(levels)}\n`
  for (const list of lists) {
    assert.equal(refusal(htmlToAdf(panels(499, list))), 'read')
    assert.equal(refusal(htmlToAdf(panels(500, list))).startsWith('unsupported-nesting-depth'), true)
  }
})

test('reads a media of no url as an <img> of class adf-media', () => {
  const single = htmlToAdf('<figure class="adf-media-single"><img class="adf-media" data-type="external"></figure>\n')
  assert.deepEqual(read(single), document({ content: [{ attrs: { type: 'external' }, type: 'media' }], type: 'mediaSingle' }))
})

test('refuses a carried node whose JSON nests past the levels its depth leaves, and an inline carry past 500', () => {
  const carried = carry('div', { attrs: { a: nested(1, 498, (inner) => [inner]) }, type: 'unknownBlock' }, '')
  assert.equal(refusal(htmlToAdf(`${carried}\n`)), 'read')
  assert.equal(refusal(htmlToAdf(`<blockquote>\n${carried}\n</blockquote>\n`)), 'unsupported-nesting-depth at /content/0/content/0 line 2 offset 13')
  const inline = nested({ text: 'x', type: 'text' }, 500, (inner) => ({ content: [inner], type: 'unknownInline' }))
  assert.equal(refusal(htmlToAdf(`<p>${carry('span', inline, '')}</p>\n`)), 'unsupported-nesting-depth at /content/0/content/0 line 1 offset 0')
})

// Each refusal of the blocks and marks adfToHtml writes as HTML, by its code, path and message: the faults of one line share a position.
const pinnedRefusals: readonly (readonly [string, string])[] = [
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="DONE"><input type="checkbox" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" checked="" disabled="">, checked where its data-state is DONE: found "<input type=\\"checkbox\\" d"…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" checked="" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<input type=\\"checkbox\\" c"…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="MAYBE"><input type="checkbox" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: an <li> of a task list has data-state="DONE" or data-state="TODO"'],
  ['<ul class="adf-task-list">\n<li class="adf-task"><input type="checkbox" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: an <li> of a task list has data-state="DONE" or data-state="TODO"'],
  ['<ul class="adf-task-list">\n<li data-state="TODO"><input type="checkbox" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: an <li> of this list has class="adf-task" first'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled="">a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item\'s text stands a space after its checkbox: found "a</li>\\n</ul>\\n"'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled=""> </li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item holds text where a space follows its checkbox: found "</li>\\n</ul>\\n"'],
  ['<ul class="adf-decision-list">\n<li class="adf-decision" data-state="DECIDED"><p>a</p></li>\n</ul>\n', 'unmappable-html at /content/0/content/0: <p> as written here is no inline element of the dialect: found "<p>a</p></li>\\n</ul>\\n"'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO">a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "a</li>\\n</ul>\\n"'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox"> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<input type=\\"checkbox\\"> "…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="radio" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<input type=\\"radio\\" disa"…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled="x"> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<input type=\\"checkbox\\" d"…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" required="" disabled=""> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<input type=\\"checkbox\\" r"…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input disabled="" type="checkbox"> a</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<input disabled=\\"\\" type="…'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><b>x</b></li>\n</ul>\n', 'unmappable-html at /content/0/content/0: a task item starts with <input type="checkbox" disabled="">, checked where its data-state is DONE: found "<b>x</b></li>\\n</ul>\\n"'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled=""> a\n<p>b</p></li>\n</ul>\n', 'unmappable-html at /content/0/content/0: <p> as written here is no inline element of the dialect: found "<p>b</p></li>\\n</ul>\\n"'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO" data-extra="1"><input type="checkbox" disabled=""> a</li>\n</ul>\n', 'unsupported-node-shape at /content/0/content/0: <li> takes no data-extra attribute'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled=""> a</li>\n<li class="adf-decision" data-state="DECIDED">b</li>\n</ul>\n', 'unmappable-html at /content/0/content/1: an <li> of this list has class="adf-task" first'],
  ['<ul class="adf-decision-list">\n<li class="adf-decision" data-state="DECIDED">a</li>\n<li>b</li>\n</ul>\n', 'unmappable-html at /content/0/content/1: an <li> of this list has class="adf-decision" first'],
  ['<ul class="adf-decision-list">\n<li class="adf-decision" data-state="DECIDED" data-extra="1">a</li>\n</ul>\n', 'unsupported-node-shape at /content/0/content/0: <li> takes no data-extra attribute'],
  ['<ul class="adf-task-list" data-extra="1"></ul>\n', 'unsupported-node-shape at /content/0: <ul> takes no data-extra attribute'],
  ['<ul class="adf-task-list">\n</ul>\n', 'unmappable-html at /content/0/content/0: a list holds <li> items, one to a line: found "</ul>\\n"'],
  ['<div class="adf-panel" data-panel-type="info" data-extra="1">\n<p>a</p>\n</div>\n', 'unsupported-node-shape at /content/0: <div> takes no data-extra attribute'],
  ['<div class="adf-panel" data-panel-type="info" data-local-id="p">\n<p>a</p>\n</div>\n', 'unmappable-html at /content/0: the data-* attributes stand once each, sorted by the attribute they name: found data-local-id after data-panel-type'],
  ['<div class="adf-panel" data-panel-type="info">\n</div>\n', 'unmappable-html at /content/0/content/0: a block element of the dialect stands here: found "</div>\\n"'],
  ['<div class="adf-panel" data-panel-type="info"><p>a</p></div>\n', 'unmappable-html at /content/0: <div> holds </div> straight after it, or a line feed and its first block: found "<p>a</p></div>\\n"'],
  ['<div id="x" class="adf-panel">\n<p>a</p>\n</div>\n', 'unmappable-html at /content/0: a <div> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone, or opens with class="adf-media-group" or "adf-panel": found "<div id=\\"x\\" class=\\"adf-p"…'],
  ['<details class="adf-expand" open="x">\n<p>a</p>\n</details>\n', 'unmappable-html at /content/0: <details> takes open="" once, after its other attributes'],
  ['<details class="adf-expand" data-title="a">\n<p>a</p>\n</details>\n', 'unsupported-node-shape at /content/0: <details> takes no data-title attribute'],
  ['<details>\n<p>a</p>\n</details>\n', 'unmappable-html at /content/0: <details> starts with class="adf-expand" or class="adf-nested-expand": found "<details>\\n<p>a</p>\\n</det"…'],
  ['<details class="adf-expand">\n</details>\n', 'unmappable-html at /content/0/content/0: a block element of the dialect stands here: found "</details>\\n"'],
  ['<details class="adf-expand">\n<summary>a<b>x</b></summary>\n<p>a</p>\n</details>\n', 'unmappable-html at /content/0: text escapes & as &amp;, < as &lt; and > as &gt;, and holds no character HTML cannot hold: found "<b>x</b></summary>\\n<p>a<"…'],
  ['<details class="adf-expand">\n<summary>a</summary><p>a</p>\n</details>\n', 'unmappable-html at /content/0: <summary> holds the title, then a line feed and the first block, or a line feed and </details>: found "<p>a</p>\\n</details>\\n"'],
  ['<details class="adf-expand">\n<summary>a</summary>\n<summary>b</summary>\n</details>\n', 'unmappable-html at /content/0/content/0: <summary> as written here is no block element of the dialect: found "<summary>b</summary>\\n</d"…'],
  ['<details class="adf-expand"><summary>a</summary></details>\n', 'unmappable-html at /content/0: <details> holds </details> straight after it, or a line feed and its first block: found "<summary>a</summary></de"…'],
  ['<figure>\n</figure>\n', 'unmappable-html at /content/0: <figure> starts with class="adf-media-single": found "<figure>\\n</figure>\\n"'],
  ['<figure class="x"><img src="u"></figure>\n', 'unmappable-html at /content/0: <figure> starts with class="adf-media-single": found "<figure class=\\"x\\"><img s"…'],
  ['<figure class="adf-media-single" data-extra="1"><img src="u"></figure>\n', 'unsupported-node-shape at /content/0: <figure> takes no data-extra attribute'],
  ['<figure class="adf-media-single"><p>x</p></figure>\n', 'unmappable-html at /content/0/content/0: a <figure> holds an <img>, inside <a href="…"> where a link marks it: found "<p>x</p></figure>\\n"'],
  ['<figure class="adf-media-single"><a><img src="u"></a></figure>\n', 'unmappable-html at /content/0/content/0: a <figure> holds an <img>, inside <a href="…"> where a link marks it: found "<a><img src=\\"u\\"></a></fi"…'],
  ['<figure class="adf-media-single"><a href="u"><img src="u">x</a></figure>\n', 'unmappable-html at /content/0/content/0: <a> around an image ends at </a>: found "x</a></figure>\\n"'],
  ['<figure class="adf-media-single"><img src="u" height="12a"></figure>\n', 'unmappable-html at /content/0/content/0: height on <img> holds a positive whole number written as JavaScript writes it'],
  ['<figure class="adf-media-single"><img src="u" height="0"></figure>\n', 'unmappable-html at /content/0/content/0: height on <img> holds a positive whole number written as JavaScript writes it'],
  ['<figure class="adf-media-single"><img src="u">x</figure>\n', 'unmappable-html at /content/0: <figure> holds its image, then its <figcaption>, then </figure>: found "x</figure>\\n"'],
  ['<figure class="adf-media-single"><img src="u"><figcaption>c</figcaption>x</figure>\n', 'unmappable-html at /content/0: <figure> holds its image, then its <figcaption>, then </figure>: found "x</figure>\\n"'],
  ['<figure class="adf-media-single"><img src="u"><figcaption data-bogus="1">c</figcaption></figure>\n', 'unsupported-node-shape at /content/0/content/1: <figcaption> takes no data-bogus attribute'],
  ['<figure class="adf-media-single"><img src="u"><figcaption style="text-align:center">c</figcaption></figure>\n', 'unmappable-html at /content/0/content/1: <figcaption> takes no style attribute'],
  ['<figure class="adf-media-single"><img src="u"><figcaption>c<p>d</p></figcaption></figure>\n', 'unmappable-html at /content/0/content/1: <p> as written here is no inline element of the dialect: found "<p>d</p></figcaption></f"…'],
  ['<figure class="adf-media-single"><img src="u" class="adf-media"></figure>\n', 'unmappable-html at /content/0/content/0: <img> takes no class attribute'],
  ['<figure class="adf-media-single"><img></figure>\n', 'unmappable-html at /content/0/content/0: an <img> holds src, or class="adf-media" where its media holds no url, and never both'],
  ['<figure class="adf-media-single"><img class="x"></figure>\n', 'unmappable-html at /content/0/content/0: an <img> in the dialect has class="adf-media" or none'],
  ['<figure class="adf-media-single"><img src="u" data-type="external"></figure>\n', 'unmappable-html at /content/0/content/0: an <img> with src leaves out data-type where its media is external'],
  ['<figure class="adf-media-single"><img src="u" data-bogus="1"></figure>\n', 'unsupported-node-shape at /content/0/content/0: <img> takes no data-bogus attribute'],
  ['<div class="adf-media-group" data-x="1"></div>\n', 'unmappable-html at /content/0: <div class="adf-media-group"> takes no other attribute: found "<div class=\\"adf-media-gr"…'],
  ['<div class="adf-media-group"><span></span></div>\n', 'unmappable-html at /content/0/content/0: a media group holds <span class="adf-file"> files: found "<span></span></div>\\n"'],
  ['<div class="adf-media-group"><span class="x"></span></div>\n', 'unmappable-html at /content/0/content/0: a media group holds <span class="adf-file"> files: found "<span class=\\"x\\"></span><"…'],
  ['<div class="adf-media-group"><span class="adf-file" data-id="a" data-type="file"></span><span class="adf-file" data-bogus="1"></span></div>\n', 'unsupported-node-shape at /content/0/content/1: <span> takes no data-bogus attribute'],
  ['<div class="adf-media-group"><span class="adf-file" data-id="a" data-type="file">x</span></div>\n', 'unmappable-html at /content/0/content/0: <span class="adf-file"> holds nothing, and ends at </span>: found "x</span></div>\\n"'],
  ['<div class="adf-media-group"><span class="adf-file" data-id="a" data-type="file"></span>x</div>\n', 'unmappable-html at /content/0: <div> holds its <span class="adf-file"> files, then </div>: found "x</div>\\n"'],
  ['<p data-align="left">a</p>\n', 'unmappable-html at /content/0: data-align on <p> holds center or end'],
  ['<p style="text-align:center">a</p>\n', 'unmappable-html at /content/0: <p> takes no style attribute'],
  ['<h1 data-align="right">a</h1>\n', 'unmappable-html at /content/0: data-align on <h1> holds center or end'],
  ['<p data-indent-level="7">a</p>\n', 'unmappable-html at /content/0: data-indent-level on <p> holds a whole number from 1 to 6'],
  ['<p data-indent-level="0">a</p>\n', 'unmappable-html at /content/0: data-indent-level on <p> holds a whole number from 1 to 6'],
  ['<p data-indent-level="02">a</p>\n', 'unmappable-html at /content/0: data-indent-level on <p> holds a whole number from 1 to 6'],
  ['<p data-indent-level="1.5">a</p>\n', 'unmappable-html at /content/0: data-indent-level on <p> holds a whole number from 1 to 6'],
  ['<p data-indent-level="2" data-align="center">a</p>\n', 'unmappable-html at /content/0: <p> holds at most one of data-align and data-indent-level, as its first attribute'],
  ['<blockquote data-indent-level="2">\n<p>a</p>\n</blockquote>\n', 'unsupported-node-shape at /content/0: <blockquote> takes no data-indent-level attribute'],
  ['<h3 data-indent-level="">a</h3>\n', 'unmappable-html at /content/0: data-indent-level on <h3> holds a whole number from 1 to 6'],
  ['<p data-local-id="p1" data-indent-level="2">a</p>\n', 'unmappable-html at /content/0: <p> holds at most one of data-align and data-indent-level, as its first attribute'],
  ['<p data-indent-level="2" data-indent-level="2">a</p>\n', 'unmappable-html at /content/0: <p> holds at most one of data-align and data-indent-level, as its first attribute'],
  ['<p data-align="center" data-indent-level="2">a</p>\n', 'unmappable-html at /content/0: <p> holds at most one of data-align and data-indent-level, as its first attribute'],
  ['<details class="adf-expand" open="" open="">\n<p>a</p>\n</details>\n', 'unmappable-html at /content/0: <details> takes open="" once, after its other attributes'],
  ['<p>a <span title="color:red">b</span></p>\n', 'unmappable-html at /content/0/content/1: a <span> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone, opens with class="adf-emoji", "adf-mention" or "adf-status", or holds data-text-color alone: found "<span title=\\"color:red\\">"…'],
  ['<p>a <span style="color:red">b</span></p>\n', 'unmappable-html at /content/0/content/1: a <span> of the dialect is a carry element, holding class="adf-carry" and then data-adf alone, opens with class="adf-emoji", "adf-mention" or "adf-status", or holds data-text-color alone: found "<span style=\\"color:red\\">"…'],
  ['<p>a <mark style="background-color:red">b</mark></p>\n', 'unmappable-html at /content/0/content/1: a <mark> of the dialect holds data-background-color alone: found "<mark style=\\"background-"…'],
  ['<table>\n<tbody>\n<tr><td rowspan="x">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html at /content/0/content/0/content/0: rowspan on <td> spells no value adfToHtml writes there'],
  ['<table>\n<tbody>\n<tr><td style="background-color:url(x)">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html at /content/0/content/0/content/0: style on <td> holds background-color:, then letters and digits after an optional #, as 0.3.1 wrote it; adfToHtml writes data-background-color'],
  ['<table>\n<tbody>\n<tr><td data-colwidth="1" data-background-color="red">a</td></tr>\n</tbody>\n</table>\n', 'unmappable-html at /content/0/content/0/content/0: <td> takes colspan, rowspan, data-background-color and data-colwidth first, each once and in that order: found data-background-color out of place'],
  ['<p>a <mark>b</mark></p>\n', 'unmappable-html at /content/0/content/1: a <mark> of the dialect holds data-background-color alone: found "<mark>b</mark></p>\\n"'],
  ['<blockquote><p>a</p></blockquote>\n', 'unmappable-html at /content/0: <blockquote> holds </blockquote> straight after it, or a line feed and its first block: found "<p>a</p></blockquote>\\n"'],
  ['<ul><li>a</li></ul>\n', 'unmappable-html at /content/0: <ul> holds </ul> straight after it, or a line feed and its first item: found "<li>a</li></ul>\\n"'],
  ['<details class="adf-expand">\n<summary>a\n</details>\n', 'unmappable-html at /content/0: <summary> ends at </summary>: found "a\\n</details>\\n"'],
  ['<p>a < b</p>\n', 'unmappable-html at /content/0: </p> ends the paragraph, and its text spells < as &lt;: found "< b</p>\\n"'],
  ['<ul class="adf-task-list">\n<b>x</b>\n</ul>\n', 'unmappable-html at /content/0/content/0: <b> as written here is no list item of the dialect: found "<b>x</b>\\n</ul>\\n"'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled=""> a<b>x</b></li>\n</ul>\n', 'unmappable-html at /content/0/content/0: <b> as written here is no inline element of the dialect: found "<b>x</b></li>\\n</ul>\\n"'],
  ['<figure class="adf-media-single"><img src="u" height="1e2"></figure>\n', 'unmappable-html at /content/0/content/0: height on <img> holds a positive whole number written as JavaScript writes it'],
  ['<figure class="adf-media-single"><img src="u" width="12 "></figure>\n', 'unmappable-html at /content/0/content/0: width on <img> holds a positive whole number written as JavaScript writes it'],
  ['<ul class="adf-task-list">\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled=""> a < b</li>\n</ul>\n', 'unmappable-html at /content/0/content/0: an item holds inline content, then </li>, as one line: found "< b</li>\\n</ul>\\n"'],
]

for (const [html, expected] of pinnedRefusals) {
  test(`refuses with its code, path and message: ${JSON.stringify(html)}`, () => {
    const result = dialectHtmlToAdf(html)
    assert.equal(result.ok ? 'read' : `${result.error.code} at /${result.error.path.join('/')}: ${result.error.message}`, expected)
  })
}

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

test('reads a panel back from its div, the panel type and other attributes from its data-* attributes, its blocks a line each', () => {
  const nestedPanel: AdfNode = { attrs: { panelType: 'warning' }, content: [paragraph(text('b'))], type: 'panel' }
  assert.deepEqual(read(htmlToAdf('<div class="adf-panel" data-local-id="p1" data-panel-color="#fff" data-panel-type="custom">\n<p>a</p>\n<p>b</p>\n</div>\n')), document({ attrs: { localId: 'p1', panelColor: '#fff', panelType: 'custom' }, content: [paragraph(text('a')), paragraph(text('b'))], type: 'panel' }))
  assert.deepEqual(read(htmlToAdf('<div class="adf-panel" data-panel-type="note"></div>\n')), document({ attrs: { panelType: 'note' }, type: 'panel' }))
  assert.deepEqual(read(htmlToAdf('<div class="adf-panel">\n<p>a</p>\n</div>\n')), document({ content: [paragraph(text('a'))], type: 'panel' }))
  assert.deepEqual(read(htmlToAdf('<div class="adf-panel" data-panel-type="info">\n<div class="adf-panel" data-panel-type="warning">\n<p>b</p>\n</div>\n<ul>\n<li>c</li>\n</ul>\n</div>\n')), document({ attrs: { panelType: 'info' }, content: [nestedPanel, { content: [item(paragraph(text('c')))], type: 'bulletList' }], type: 'panel' }))
})

test('refuses a panel the writer does not write', () => {
  const refused = (source: string): string => refusal(htmlToAdf(source))
  assert.equal(refused('<div class="adf-panel" data-panel-type="info" data-extra="1">\n<p>a</p>\n</div>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<div class="adf-panel" data-panel-type="info" data-local-id="p">\n<p>a</p>\n</div>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<div class="adf-panel" data-panel-type="info">\n</div>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 47')
  assert.equal(refused('<div class="adf-panel" data-panel-type="info"><p>a</p></div>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<div id="x" class="adf-panel">\n<p>a</p>\n</div>\n'), 'unmappable-html at /content/0 line 1 offset 0')
})

test('reads an expand and a nested expand back from their details, the title from the summary', () => {
  const expand = (source: string): AdfDocument | string => read(htmlToAdf(source))
  assert.deepEqual(expand('<details class="adf-expand" data-local-id="x1">\n<summary>Details &amp; more</summary>\n<p>Inside</p>\n</details>\n'), document({ attrs: { localId: 'x1', title: 'Details & more' }, content: [paragraph(text('Inside'))], type: 'expand' }))
  assert.deepEqual(expand('<details class="adf-nested-expand">\n<summary>T</summary>\n<p>Inside</p>\n</details>\n'), document({ attrs: { title: 'T' }, content: [paragraph(text('Inside'))], type: 'nestedExpand' }))
  assert.deepEqual(expand('<details class="adf-expand">\n<p>Inside</p>\n</details>\n'), document({ content: [paragraph(text('Inside'))], type: 'expand' }))
  assert.deepEqual(expand('<details class="adf-expand" data-local-id="x1" open="">\n<summary>T</summary>\n<p>Inside</p>\n</details>\n'), document({ attrs: { localId: 'x1', title: 'T' }, content: [paragraph(text('Inside'))], type: 'expand' }))
  assert.deepEqual(expand('<details class="adf-nested-expand" open="">\n<p>Inside</p>\n</details>\n'), document({ content: [paragraph(text('Inside'))], type: 'nestedExpand' }))
  assert.deepEqual(expand('<details class="adf-expand">\n<summary></summary>\n<p>Inside</p>\n</details>\n'), document({ attrs: { title: '' }, content: [paragraph(text('Inside'))], type: 'expand' }))
  assert.deepEqual(expand('<details class="adf-expand">\n<summary>T</summary>\n</details>\n'), document({ attrs: { title: 'T' }, type: 'expand' }))
  assert.deepEqual(expand('<details class="adf-expand"></details>\n'), document({ type: 'expand' }))
  assert.deepEqual(expand('<details class="adf-expand">\n<summary>a\nb</summary>\n<p>x</p>\n</details>\n'), document({ attrs: { title: 'a\nb' }, content: [paragraph(text('x'))], type: 'expand' }))
})

test('refuses an expand the writer does not write', () => {
  const refused = (source: string): string => refusal(dialectHtmlToAdf(source))
  assert.equal(refused('<details class="adf-expand" open="x">\n<p>a</p>\n</details>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<details class="adf-expand" open="" data-local-id="x1">\n<p>a</p>\n</details>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<details class="adf-expand" open="" open="">\n<p>a</p>\n</details>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<details class="adf-expand" data-title="a">\n<p>a</p>\n</details>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<details>\n<p>a</p>\n</details>\n'), 'unmappable-html at /content/0 line 1 offset 0')
  assert.equal(refused('<details class="adf-expand">\n</details>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 29')
  assert.equal(refused('<details class="adf-expand">\n<summary>a<b>x</b></summary>\n<p>a</p>\n</details>\n'), 'unmappable-html at /content/0 line 2 offset 29')
  assert.equal(refused('<details class="adf-expand">\n<summary>a</summary><p>a</p>\n</details>\n'), 'unmappable-html at /content/0 line 2 offset 29')
  assert.equal(refused('<details class="adf-expand">\n<summary>a</summary>\n<summary>b</summary>\n</details>\n'), 'unmappable-html at /content/0/content/0 line 3 offset 50')
  assert.equal(refused('<details class="adf-expand"><summary>a</summary></details>\n'), 'unmappable-html at /content/0 line 1 offset 0')
})

test('reads a task list back, each item\'s checkbox giving its state, and a decision list', () => {
  const tasks = '<ul class="adf-task-list" data-local-id="l1">\n<li class="adf-task" data-local-id="t1" data-state="DONE"><input type="checkbox" checked="" disabled=""> Ship <strong>it</strong></li>\n<li class="adf-task" data-local-id="t2" data-state="TODO"><input type="checkbox" disabled=""></li>\n<li class="adf-task" data-state="TODO"><input type="checkbox" disabled="">  &lt;a&gt;</li>\n</ul>\n'
  const done: AdfNode = { attrs: { localId: 't1', state: 'DONE' }, content: [text('Ship '), text('it', { type: 'strong' })], type: 'taskItem' }
  const todo: AdfNode = { attrs: { localId: 't2', state: 'TODO' }, type: 'taskItem' }
  assert.deepEqual(read(htmlToAdf(tasks)), document({ attrs: { localId: 'l1' }, content: [done, todo, { attrs: { state: 'TODO' }, content: [text(' <a>')], type: 'taskItem' }], type: 'taskList' }))
  assert.deepEqual(read(htmlToAdf('<ul class="adf-task-list"></ul>\n')), document({ type: 'taskList' }))
  const decisions = '<ul class="adf-decision-list" data-local-id="d1">\n<li class="adf-decision" data-local-id="d2" data-state="DECIDED">Use HTML</li>\n<li class="adf-decision" data-state="UNDECIDED"></li>\n</ul>\n'
  assert.deepEqual(read(htmlToAdf(decisions)), document({ attrs: { localId: 'd1' }, content: [{ attrs: { localId: 'd2', state: 'DECIDED' }, content: [text('Use HTML')], type: 'decisionItem' }, { attrs: { state: 'UNDECIDED' }, type: 'decisionItem' }], type: 'decisionList' }))
  assert.deepEqual(read(htmlToAdf('<ul class="adf-decision-list"></ul>\n')), document({ type: 'decisionList' }))
})

test('refuses a task or decision list the writer does not write', () => {
  const refused = (source: string): string => refusal(htmlToAdf(source))
  const box = '<input type="checkbox" disabled="">'
  const list = (...items: string[]): string => `<ul class="adf-task-list">\n${items.join('\n')}\n</ul>\n`
  assert.equal(refused(list(`<li class="adf-task" data-state="DONE">${box} a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO"><input type="checkbox" checked="" disabled=""> a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="MAYBE">${box} a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task">${box} a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li data-state="TODO">${box} a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list('<li data-state="TODO">a</li>')), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO">${box}a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO">${box} </li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO">a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO"><input type="checkbox"> a</li>`)), 'unmappable-html at /content/0/content/0 line 2 offset 27')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO">${box} a</li>\n<li class="adf-decision" data-state="DECIDED">b</li>`)), 'unmappable-html at /content/0/content/1 line 3 offset 109')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO">${box} a\n<p>b</p></li>`)), 'unmappable-html at /content/0/content/0 line 3 offset 104')
  assert.equal(refused(list(`<li class="adf-task" data-state="TODO" data-extra="1">${box} a</li>`)), 'unsupported-node-shape at /content/0/content/0 line 2 offset 27')
  assert.equal(refused('<ul class="adf-task-list" data-extra="1"></ul>\n'), 'unsupported-node-shape at /content/0 line 1 offset 0')
  assert.equal(refused('<ul class="adf-decision-list">\n<li class="adf-decision">a</li>\n<li>b</li>\n</ul>\n'), 'unmappable-html at /content/0/content/1 line 3 offset 63')
  assert.equal(refused('<ul class="adf-task-list">\n</ul>\n'), 'unmappable-html at /content/0/content/0 line 2 offset 27')
})

function link(href: string, title?: string): AdfMark {
  return { attrs: title === undefined ? { href } : { href, title }, type: 'link' }
}

function image(url: string, alt: string, ...rest: AdfNode[]): AdfNode {
  return { attrs: { layout: 'center' }, content: [{ attrs: alt === '' ? { type: 'external', url } : { alt, type: 'external', url }, type: 'media' }, ...rest], type: 'mediaSingle' }
}

function list(type: 'bulletList' | 'orderedList', ...content: AdfNode[]): AdfNode {
  return { content, type }
}

function table(...rows: AdfNode[][]): AdfNode {
  return { content: rows.map((content) => ({ content, type: 'tableRow' })), type: 'table' }
}

function cell(type: 'tableCell' | 'tableHeader', ...content: AdfNode[]): AdfNode {
  return { content, type }
}

const strong: AdfMark = { type: 'strong' }
const em: AdfMark = { type: 'em' }
const hardBreak: AdfNode = { type: 'hardBreak' }

const foreign: Readonly<Record<string, readonly [string, AdfDocument]>> = {
  'a container ADF has no node for as its children, its attributes dropped': ['<div align="center">text</div>', document(paragraph(text('text')))],
  'containers inside each other as the blocks they hold': ['<html><body><main><section><h1 id="t">Title</h1><div><p class="lead">One</p><p>Two</p></div></section></main></body></html>', document(heading(1, text('Title')), paragraph(text('One')), paragraph(text('Two')))],
  'text standing in no paragraph as a paragraph, parted where a block stands': ['one<div>two</div>three<p>four</p>five', document(paragraph(text('one')), paragraph(text('two')), paragraph(text('three')), paragraph(text('four')), paragraph(text('five')))],
  'a script, a style, a comment, a doctype and a processing instruction as nothing': ['<!DOCTYPE html><?xml version="1.0"?><p>a<!-- <p>b</p> --></p><script>if (a < b) document.write("<p>c</p>")</script><STYLE type="text/css">p > a { color: red }</STYLE><!--[if mso]><p>d</p><![endif]-->', document(paragraph(text('a')))],
  'an element a browser shows nothing of as nothing, with all it holds, and a <noscript> as its content': ['<head><title>T</title></head><p>a<template><b>b</b></template></p><p hidden>c<br></p><datalist><option>d</option></datalist><noscript><p>e</p></noscript>', document(paragraph(text('a')), paragraph(text('e')))],
  'an unclosed comment as the end of the HTML': ['<p>a</p><!-- b', document(paragraph(text('a')))],
  'an unclosed script as the end of the HTML': ['<p>a</p><script>b', document(paragraph(text('a')))],
  'an unclosed tag as the end of the HTML': ['<p>a</p><p class="b', document(paragraph(text('a')))],
  'an unclosed declaration as the end of the HTML': ['<p>a</p><!DOCTYPE', document(paragraph(text('a')))],
  'the marks of the elements a browser shows as bold, italic, struck, underlined, code, subscript and superscript': [
    '<p><b>a</b><strong>b</strong> <i>c</i><em>d</em><cite>e</cite><dfn>f</dfn><var>g</var> <s>h</s><strike>i</strike><del>j</del> <u>k</u><ins>l</ins> <code>m</code><kbd>n</kbd><samp>o</samp><tt>p</tt> <sub>q</sub> <sup>r</sup></p>',
    document(paragraph(text('ab', strong), text(' '), text('cdefg', em), text(' '), text('hij', { type: 'strike' }), text(' '), text('kl', { type: 'underline' }), text(' '), text('mnop', { type: 'code' }), text(' '), text('q', { attrs: { type: 'sub' }, type: 'subsup' }), text(' '), text('r', { attrs: { type: 'sup' }, type: 'subsup' }))),
  ],
  'marks one inside the other, the outermost first, each type once, and an element of no mark as its text': ['<p><b><i>a<b>b</b></i></b><span style="color:red">c</span><font color="red">d</font><sub><sup>e</sup></sub></p>', document(paragraph(text('ab', strong, em), text('cd'), text('e', { attrs: { type: 'sub' }, type: 'subsup' })))],
  'a mark left open as marking the text to the end of its block': ['<p><b>a<i>b</p><p>c</p>', document(paragraph(text('a', strong), text('b', strong, em)), paragraph(text('c')))],
  'a link from its href and title, and an anchor of no href as its text': ['<p><a href="https://example.com/a?b=1&amp;c=2" title="T" target="_blank" rel="noopener">x</a> <a name="n">y</a> <a href="z" title="">z</a></p>', document(paragraph(text('x', link('https://example.com/a?b=1&c=2', 'T')), text(' y '), text('z', link('z'))))],
  'a link inside a link as the outer link': ['<p><a href="a">x<a href="b">y</a></a></p>', document(paragraph(text('xy', link('a'))))],
  'character references as their characters, and an ampersand opening none as itself': ['<p title="a&amp;b">&lt;p&gt; &amp; &copy; &#169; &#xA9; &bogus; &amp;amp; AT&T</p>', document(paragraph(text('<p> & © © © &bogus; &amp; AT&T')))],
  'white space as a browser shows it: runs as one space, none at the edges of a line': ['<p>\n  one\t\ttwo \n <b> three </b> <i> four</i>\n</p>\n\n<p> </p>\n', document(paragraph(text('one two '), text('three ', strong), text('four', em)))],
  'a <br> as a hard break, the spaces beside it and a break ending the block dropped': ['<p>a <br> b<br/>c<BR><br></p><p><br></p>', document(paragraph(text('a'), hardBreak, text('b'), hardBreak, text('c')))],
  'a block inside a paragraph or heading as a line of it': ['<h2>a<div>b</div>c</h2><p><span>d<address>e</address></span></p>', document(heading(2, text('a'), hardBreak, text('b'), hardBreak, text('c')), paragraph(text('d'), hardBreak, text('e')))],
  'headings by their level, an <h7> as its text': ['<h1>a</h1><h6>b</h6><h7>c</h7><h3></h3>', document(heading(1, text('a')), heading(6, text('b')), paragraph(text('c')))],
  'a paragraph ended by the block that follows it': ['<p>a<p>b<h2>c</h2><p>d<ul><li>e</ul>f</p>', document(paragraph(text('a')), paragraph(text('b')), heading(2, text('c')), paragraph(text('d')), list('bulletList', item(paragraph(text('e')))), paragraph(text('f')))],
  'a heading ended by the block that follows it': ['<h1>a<p>b</p>c</h1>', document(heading(1, text('a')), paragraph(text('b')), paragraph(text('c')))],
  'an end tag closing no open element as nothing': ['<p>a</b></div></p></p>b', document(paragraph(text('a')), paragraph(text('b')))],
  'a quote, its loose text as a paragraph, and an empty one as nothing': ['<blockquote cite="x">a<p>b</p></blockquote><blockquote> </blockquote>', document({ content: [paragraph(text('a')), paragraph(text('b'))], type: 'blockquote' })],
  'lists, an item ended by the next, an ordered list\'s start as its order': [
    '<ul class="x"><li>a<li><p>b</p><p>c</p></li></ul><ol start="3" type="a"><li>d</li></ol><ol start="x"><li>e</li><li></li></ol><ul></ul>',
    document(list('bulletList', item(paragraph(text('a'))), item(paragraph(text('b')), paragraph(text('c')))), { attrs: { order: 3 }, content: [item(paragraph(text('d')))], type: 'orderedList' }, list('orderedList', item(paragraph(text('e'))), item(paragraph()))),
  ],
  'a list inside an item, the items of each ended inside their own list': ['<ul><li>a<ol><li>b<li>c</ol><li>d</ul>', document(list('bulletList', item(paragraph(text('a')), list('orderedList', item(paragraph(text('b'))), item(paragraph(text('c'))))), item(paragraph(text('d')))))],
  'a list standing straight in a list, or text between two items, as part of the item before it, or an item of its own where none is': ['<ul><li>a</li><ul><li>b</li></ul>c</ul><ol>d<li>e</li></ol>', document(list('bulletList', item(paragraph(text('a')), list('bulletList', item(paragraph(text('b')))), paragraph(text('c')))), list('orderedList', item(paragraph(text('d'))), item(paragraph(text('e')))))],
  'an item outside a list, a cell outside a table and a row outside one as their content': ['<li>a</li><td>b</td><tr><th>c</th></tr><summary>d</summary>', document(paragraph(text('a')), paragraph(text('b')), paragraph(text('c')), paragraph(text('d')))],
  'a code block as its text, its language from its <code>, the line feed opening it dropped': ['<pre>\n<code class="hljs language-js other">if (a &lt; b) {\n  <span class="k">return</span>\n}</code></pre><pre class="x">a  b<br>c\n</pre><pre></pre><pre><code class="language-"><code class="language-py">x</code></code></pre>', document({ attrs: { language: 'js' }, content: [text('if (a < b) {\n  return\n}')], type: 'codeBlock' }, { content: [text('a  b\nc\n')], type: 'codeBlock' }, { type: 'codeBlock' }, { attrs: { language: 'py' }, content: [text('x')], type: 'codeBlock' })],
  'a code block left open as holding the rest': ['<pre>a</p><p>b', document({ content: [text('ab')], type: 'codeBlock' })],
  'a rule, ending the paragraph it stands in': ['<p>a<hr class="x">b</p><hr/>', document(paragraph(text('a')), { type: 'rule' }, paragraph(text('b')), { type: 'rule' })],
  'a table, its sections and captions unwrapped, a row or cell ended by the next': [
    '<table border="1"><caption>T</caption><colgroup><col width="10"></colgroup><thead><tr><th colspan="2">a<th>b<tbody><tr><td>c</td><td><p>d</p><p>e</p></td><tr><td></td></tr></tbody></table><table></table><table><tr></tr></table>',
    document(table([cell('tableCell', paragraph(text('T')))], [cell('tableHeader', paragraph(text('a'))), cell('tableHeader', paragraph(text('b')))], [cell('tableCell', paragraph(text('c'))), cell('tableCell', paragraph(text('d')), paragraph(text('e')))], [cell('tableCell', paragraph())])),
  ],
  'cells standing straight in a table as a row of their own, and a block straight in a row as a cell': ['<table><td>a</td><th>b</th><tr><p>c</p><td>d</td></tr></table>', document(table([cell('tableCell', paragraph(text('a'))), cell('tableHeader', paragraph(text('b')))], [cell('tableCell', paragraph(text('c'))), cell('tableCell', paragraph(text('d')))]))],
  'a table inside a cell, the end tags inside it closing nothing around it, and no mark reaching into a cell': ['<table><tr><td><b>a<table><tr><td>b</td></tr></td></tr></p></table>c</b></td></tr></table>', document(table([cell('tableCell', paragraph(text('a', strong)), table([cell('tableCell', paragraph(text('b')))]), paragraph(text('c', strong)))]))],
  'a <details> as an expand titled by its summary, a nestedExpand inside another, an empty one holding an empty paragraph': [
    '<details open><summary>The <b>title</b><br>here</summary>a<p>b</p><details><summary>In</summary></details><details><p>c</p><summary>d</summary></details></details><details></details>',
    document({ attrs: { title: 'The title here' }, content: [paragraph(text('a')), paragraph(text('b')), { attrs: { title: 'In' }, content: [paragraph()], type: 'nestedExpand' }, { attrs: { title: 'd' }, content: [paragraph(text('c'))], type: 'nestedExpand' }], type: 'expand' }, { content: [paragraph()], type: 'expand' }),
  ],
  'a summary ended by the block that follows it, and a second summary as its text': ['<details><summary>a<p>b</p></summary><summary>c</summary></details>', document({ attrs: { title: 'a' }, content: [paragraph(text('b')), paragraph(text('c'))], type: 'expand' })],
  'an image alone in its paragraph as the image, its title its caption, a link around it marking it': [
    '<p><img src="https://example.com/a.png" alt="A" width="10"></p><p> <img alt="" title="Cap" src="b.png"> </p><a href="https://example.com/"><img src="c.png" alt="C"></a><p><a href="c.png"><img src="c.png"></a></p>',
    document(image('https://example.com/a.png', 'A'), image('b.png', '', { content: [text('Cap')], type: 'caption' }), { attrs: { layout: 'center' }, content: [{ attrs: { alt: 'C', type: 'external', url: 'c.png' }, marks: [link('https://example.com/')], type: 'media' }], type: 'mediaSingle' }, { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: 'c.png' }, marks: [link('c.png')], type: 'media' }], type: 'mediaSingle' }),
  ],
  'an image beside other content as its alt text, its URL where it has none, linked to the image': ['<p>See <img src="a.png" alt="the chart" title="T"> and <b><img src="b.png"></b></p><p><img src="c.png" alt="C"><br>d</p>', document(paragraph(text('See '), text('the chart', link('a.png', 'T')), text(' and '), text('b.png', strong, link('b.png'))), paragraph(text('C', link('c.png')), hardBreak, text('d')))],
  'an image inside a link beside other content as the link\'s text, then (image) linked to the image unless the link reaches it': ['<p>Go <a href="x">to <img src="a.png" alt="A"> it</a>. <a href="b.png">w <img src="b.png" alt="B"></a></p>', document(paragraph(text('Go '), text('to A it', link('x')), text(' ('), text('image', link('a.png')), text('). '), text('w B', link('b.png'))))],
  'two images in a paragraph as their alt texts': ['<p><img src="a.png" alt="A"><img src="b.png" alt="B"></p>', document(paragraph(text('A', link('a.png')), text('B', link('b.png'))))],
  'an image of no src as its alt text, and as nothing without one': ['<p>a <img alt="b"><img></p>', document(paragraph(text('a b')))],
  'an image alone in a heading or after an earlier line as its alt text': ['<h1><img src="a.png" alt="A"></h1><p>x<div><img src="b.png" alt="B"></div></p>', document(heading(1, text('A', link('a.png'))), paragraph(text('x'), hardBreak, text('B', link('b.png'))))],
  'tag and attribute names in any case, attribute values quoted either way or not at all, the first of two attributes of a name': ['<P><A HREF=x title=\'a "b"\' href="y" disabled>z</A ></P >', document(paragraph(text('z', link('x', 'a "b"'))))],
  'a < opening no tag as text': ['a < b, 1<2 and </> and <', document(paragraph(text('a < b, 1<2 and </> and <')))],
  'an element of the dialect standing in foreign HTML as the dialect reads it': [
    `<div><p>a <span class="adf-status" data-color="green">Done</span></p>${carry('div', { type: 'unknownBlock' }, '')}<blockquote><div class="adf-panel" data-panel-type="info">\n<p data-align="center">b</p>\n</div></blockquote></div>`,
    document(paragraph(text('a '), { attrs: { color: 'green', text: 'Done' }, type: 'status' }), { type: 'unknownBlock' }, { content: [{ attrs: { panelType: 'info' }, content: [{ content: [text('b')], marks: [{ attrs: { align: 'center' }, type: 'alignment' }], type: 'paragraph' }], type: 'panel' }], type: 'blockquote' }),
  ],
  'an attribute of the dialect on an element not claiming it as dropped': ['<p data-align="left">a</p><table><tr><td colspan="0">b</td></tr></table>', document(paragraph(text('a')), table([cell('tableCell', paragraph(text('b')))]))],
  'HTML that is nothing a reader sees as a document of no blocks': [' <!-- a -->\n<div> </div><p></p>', document()],
  'a comment ending where a browser ends it, <!--> and <!---> each a whole comment': ['a<!-->b-->c<!--->d', document(paragraph(text('ab-->cd')))],
  'an end tag inside a cell as nothing where its element opened outside the table': ['<div>a<table><tr><td><i>b</i><i>c</i></div>d</td></tr></table>e</div>f', document(paragraph(text('a')), table([cell('tableCell', paragraph(text('bc', em), text('d')))]), paragraph(text('e')), paragraph(text('f')))],
  'an end tag between a table and its first row as nothing': ['<div><table></div><tr><td>a</td></tr></table>b</div>c', document(table([cell('tableCell', paragraph(text('a')))]), paragraph(text('b')), paragraph(text('c')))],
  'an end tag inside a table in a cell as nothing where its element opened in the outer cell': ['<table><tr><td><div>a<table><tr><td>b</div>c</td></tr></table>d</div>e</td></tr></table>', document(table([cell('tableCell', paragraph(text('a')), table([cell('tableCell', paragraph(text('bc')))]), paragraph(text('d')), paragraph(text('e')))]))],
  'the end tag of a mark inside a <pre> as no end of the code block': ['<b>x<pre>a</b>b</pre>', document(paragraph(text('x', strong)), { content: [text('ab')], type: 'codeBlock' })],
  'the end tag of a block around a <pre> as the end of both': ['<div><pre>a</div>b</pre><table><tr><td><pre>c</td><td>d</pre></td></tr></table>', document({ content: [text('a')], type: 'codeBlock' }, paragraph(text('b')), table([cell('tableCell', { content: [text('c')], type: 'codeBlock' }), cell('tableCell', paragraph(text('d')))]))],
  'tags in the text of a <script> or <style> as that text, which ends at its end tag in any case': ['<p>a<script>x = "</p><p>b"</script>c<style>d</STYLE>e</p>', document(paragraph(text('ace')))],
  'an element a browser shows nothing of and that takes no end tag as nothing, the text after it kept': ['<p>a<meta>b<link>c<base>d<area>e<param>f<basefont>g<br hidden>h</p>', document(paragraph(text('abcdefgh')))],
  'a language only from a <code>, the first one, and only from a language- class': ['<pre><span class="language-x">a</span></pre><pre><code class="language-a"><code class="language-b">b</code></code></pre><pre><code class="highlight-source">c</code></pre>', document({ content: [text('a')], type: 'codeBlock' }, { attrs: { language: 'a' }, content: [text('b')], type: 'codeBlock' }, { content: [text('c')], type: 'codeBlock' })],
  'an href on an element that is no <a>, and a start on a <ul>, as dropped': ['<b href="u">x</b><ul start="3"><li>a</li></ul>', document(paragraph(text('x', strong)), list('bulletList', { content: [paragraph(text('a'))], type: 'listItem' }))],
  'an image inside an element in a link as the link text, its (image) after the link': ['<a href="u"><span><img src="i" alt="x"></span> y</a>', document(paragraph(text('x y', link('u')), text(' ('), text('image', link('i')), text(')')))],
  'an image in a link leading to it as the link text alone, unless its title is another than the link holds': ['<p><a href="i" title="t"><img src="i" alt="x" title="t"> y</a></p><p><a href="i" title="t"><img src="i" alt="x"> y</a></p><p><a href="i" title="t"><img src="i" alt="x" title="u"> y</a></p><p><a href="i"><img src="i" alt="x" title="u"> y</a></p>', document(paragraph(text('x y', link('i', 't'))), paragraph(text('x y', link('i', 't'))), paragraph(text('x y', link('i', 't')), text(' ('), text('image', link('i', 'u')), text(')')), paragraph(text('x y', link('i')), text(' ('), text('image', link('i', 'u')), text(')')))],
  'an image alone in its line inside a link holding blocks as the linked image, with no (image) after it': ['<a href="u"><img src="i" alt="x"><p>y</p></a>', document({ attrs: { layout: 'center' }, content: [{ attrs: { alt: 'x', type: 'external', url: 'i' }, marks: [link('u')], type: 'media' }], type: 'mediaSingle' }, paragraph(text('y', link('u'))))],
  'a space after an inline node of the dialect as kept': ['<p>a<span class="adf-status" data-color="yellow">S</span> b</p>', document(paragraph(text('a'), { attrs: { color: 'yellow', text: 'S' }, type: 'status' }, text(' b')))],
  'the end tag of a row or a table inside a cell as the end of the cell too': ['<table><tr><td>a</tr><td>b</td></tr></table><table><tr><td>c</table>d', document(table([cell('tableCell', paragraph(text('a')))], [cell('tableCell', paragraph(text('b')))]), table([cell('tableCell', paragraph(text('c')))]), paragraph(text('d')))],
  'an attribute spelled without quotes as its whole value, and one without a value as empty': ['<a title href=url>x</a>', document(paragraph(text('x', link('url'))))],
  'attributes parted by any run of white space, or by none after a quoted value': ['<a  href="u"\n\ttitle=\'t\'class="c">x</a>', document(paragraph(text('x', link('u', 't'))))],
  'an end tag the HTML ends inside as an end tag': ['<b>a</b', document(paragraph(text('a', strong)))],
  'the text of a <style> as nothing, a start tag it leaves open included': ['<p>a<style>b<i</style>c</p>', document(paragraph(text('ac')))],
  'an image inside a mark in a link as the link text, its (image) after the link': ['<a href="u"><b><img src="i" alt="x"></b> y</a>', document(paragraph(text('x', link('u'), strong), text(' y', link('u')), text(' ('), text('image', link('i')), text(')')))],
  'the (image) of an image sharing its line as kept where a later image in the link stands alone': ['<a href="i"><img src="j" alt="x"> t<p><img src="i" alt="y"></p>z</a>', document(paragraph(text('x t', link('i'))), { attrs: { layout: 'center' }, content: [{ attrs: { alt: 'y', type: 'external', url: 'i' }, marks: [link('i')], type: 'media' }], type: 'mediaSingle' }, paragraph(text('z', link('i')), text(' ('), text('image', link('j')), text(')')))],
  'a block of the dialect as the end of the paragraph it starts in': ['<p>x<details class="adf-expand">\n<p>a</p>\n</details>', document(paragraph(text('x')), { content: [paragraph(text('a'))], type: 'expand' })],
}

for (const [reading, [html, adf]] of Object.entries(foreign)) {
  test(`reads foreign HTML best effort: ${reading}`, () => {
    assert.deepEqual(read(htmlToAdf(html)), adf)
    assert.deepEqual(read(htmlToAdf(html.replaceAll('\n', '\r\n'))), adf)
    assert.equal(dialectHtmlToAdf(html).ok, false)
  })
}

for (const name of ['address', 'article', 'aside', 'body', 'caption', 'center', 'colgroup', 'dd', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'header', 'hgroup', 'html', 'legend', 'listing', 'main', 'menu', 'nav', 'optgroup', 'option', 'plaintext', 'search', 'section', 'tbody', 'tfoot', 'thead', 'xmp']) {
  test(`reads foreign HTML parting the text around <${name}>, which a browser shows as a block`, () => {
    assert.deepEqual(read(htmlToAdf(`a<${name}>b</${name}>c`)), document(paragraph(text('a')), paragraph(text('b')), paragraph(text('c'))))
  })
}

for (const name of ['datalist', 'head', 'noembed', 'noframes', 'rp', 'script', 'style', 'template', 'title']) {
  test(`reads foreign HTML dropping <${name}>, which a browser shows nothing of, with all it holds`, () => {
    assert.deepEqual(read(htmlToAdf(`<p>a<${name}>b<i>c</i></${name}>d</p>`)), document(paragraph(text('ad'))))
  })
}

test('reads the dialect as the document written, whatever foreign HTML would make of it', () => {
  assert.deepEqual(read(htmlToAdf('<p data-align="center">a</p>\n')), document({ content: [text('a')], marks: [{ attrs: { align: 'center' }, type: 'alignment' }], type: 'paragraph' }))
  assert.deepEqual(read(htmlToAdf('<p> a  b </p>\n')), document(paragraph(text(' a  b '))))
  assert.deepEqual(read(htmlToAdf('<p> a  b </p>')), document(paragraph(text('a b'))))
})

const claimedRefusals: readonly (readonly [string, string])[] = [
  ['<p>a</p><p>b</p><details class="adf-expand" data-x="1">\n<p>c</p>\n</details>', 'unsupported-node-shape at /content/2 line 1 offset 0'],
  ['<div><span class="adf-nope">x</span></div>', 'unmappable-html at /content/0/content/0 line 1 offset 0'],
  ['<p>a</p>\n<p>b <a class="adf-mention" href="x">c</a></p>', 'unmappable-html at /content/1/content/1 line 2 offset 9'],
  [`<div>\n${carry('div', { type: 'unknownBlock' }, 'edited')}</div>`, 'unmappable-html at /content/0 line 2 offset 6'],
  ['<ul><li>a</li><li><div class="adf-panel">\n<p>b<b>c</b></p>\n</div></li></ul>', 'unmappable-html at /content/0/content/1/content/0/content/0 line 2 offset 42'],
  ['<p>a</p><section data-adf="x">b</section>', 'unmappable-html at /content/1/content/0 line 1 offset 0'],
  ['<p>a <i class="x adf-y">b</i></p>', 'unmappable-html at /content/0/content/1 line 1 offset 0'],
  ['<p>a</p><div class="adf-panel"', 'read'],
  ['<p hidden><span class="adf-status">x</span></p><script><span class="adf-status">x</span></script><pre><span class="adf-status">x</span></pre>', 'read'],
]

for (const [html, expected] of claimedRefusals) test(`reads an element claiming the dialect only as the dialect: ${JSON.stringify(html)}`, () => assert.equal(refusal(htmlToAdf(html)), expected))

test('names the element claiming the dialect that is none of its elements', () => {
  names(htmlToAdf('<section class="adf-box">a</section>'), '<section>', 'data-adf', 'adf- class', 'found "<section class=\\"adf-box\\""')
})

test('reads foreign HTML nested 500 levels, and refuses the next level, a list\'s items and a table\'s cells one level below it', () => {
  const nestedIn = (opener: string, closer: string, levels: number): string => `${opener.repeat(levels)}<p>a</p>${closer.repeat(levels)}`
  assert.equal(refusal(htmlToAdf(nestedIn('<blockquote>', '</blockquote>', 500))), 'read')
  assert.equal(refusal(htmlToAdf(nestedIn('<blockquote>', '</blockquote>', 501))), `unsupported-nesting-depth at /${'content/0/'.repeat(500)}content/0 line 1 offset 0`)
  names(htmlToAdf(nestedIn('<blockquote>', '</blockquote>', 501)), 'blocks', '500 levels')
  assert.equal(refusal(htmlToAdf(nestedIn('<ul><li>', '</li></ul>', 500))), 'read')
  assert.equal(refusal(htmlToAdf(nestedIn('<ul><li>', '</li></ul>', 501))).split(' ')[0], 'unsupported-nesting-depth')
  assert.equal(refusal(htmlToAdf(nestedIn('<table><tr><td>', '</td></tr></table>', 250))), 'read')
  assert.equal(refusal(htmlToAdf(nestedIn('<table><td>', '</td></table>', 250))), 'read')
  assert.equal(refusal(htmlToAdf(nestedIn('<table><tr><td>', '</td></tr></table>', 251))).split(' ')[0], 'unsupported-nesting-depth')
  assert.equal(refusal(htmlToAdf(nestedIn('<table><td>', '</td></table>', 251))).split(' ')[0], 'unsupported-nesting-depth')
  assert.equal(refusal(htmlToAdf(nestedIn('<details>', '</details>', 501))).split(' ')[0], 'unsupported-nesting-depth')
  assert.equal(refusal(htmlToAdf(`${'<div><span><b>'.repeat(100_000)}a`)), 'read')
  assert.equal(refusal(htmlToAdf('<blockquote>'.repeat(1_000_000))).split(' ')[0], 'unsupported-nesting-depth')
})

test('reads foreign HTML of a hundred thousand elements, open, closed or never closed, in time linear in its length', () => {
  for (const html of ['<p>a</p>'.repeat(100_000), '<li>a'.repeat(100_000), `<ul>${'<li>a'.repeat(100_000)}`, `<table>${'<tr><td>a'.repeat(50_000)}`, `${'<b>'.repeat(100_000)}a${'</i>'.repeat(100_000)}`, '</p>'.repeat(100_000), `<p${' a="b"'.repeat(100_000)}>x`, `<p>${'<img src="a" alt="b">'.repeat(50_000)}`]) assert.equal(refusal(htmlToAdf(html)), 'read')
})

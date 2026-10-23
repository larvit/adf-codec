import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { adfToHtml } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'

const ids = {
  collection: '019fa884-c105-7043-ba0c-2992cfbda729',
  file: '01a0be1b-33b1-7324-b77d-9c2d49dacde7',
  item: '019ad5af-efd9-7f4e-a7c9-6aef16d4945f',
  list: '019d8e77-7df8-7a83-91ea-43a7ca2aae3b',
  paragraph: '01957ad9-e3f7-70aa-a5f3-4c013274f488',
  quote: '019d2fe4-3e67-7b76-b40a-a776a8f76aea',
  resource: '019695b0-e8cc-7bf7-8c1d-855237b7a090',
}

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function html(result: Result<string>): string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
}

function refusal(result: Result<string>): string {
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

function nested(type: string, levels: number, inner: AdfNode): AdfNode {
  let node = inner
  for (let level = 0; level < levels; level += 1) node = { content: [node], type }
  return node
}

function carriedBlock(node: AdfNode): boolean {
  return html(adfToHtml(document(node))).startsWith('<div class="adf-carry"')
}

function carriedSpans(...content: AdfNode[]): number {
  return html(adfToHtml(document(paragraph(...content)))).split('<span class="adf-carry"').length - 1
}

// What the one carry element written shows: its content after the opening tag, whose `data-adf` holds no `"`.
function shown(written: string): string {
  return written.slice(written.indexOf('">') + 2).replace(/<\/(?:div|span)>(?:<\/p>)?\n$/, '')
}

test('writes paragraphs, headings and rules as their elements, one block a line', () => {
  const heading = (level: number): AdfNode => ({ attrs: { level }, content: [text(`Level ${level}`)], type: 'heading' })
  assert.equal(html(adfToHtml(document(heading(1), paragraph(text('Read the manual.')), { type: 'rule' }, heading(6)))), '<h1>Level 1</h1>\n<p>Read the manual.</p>\n<hr>\n<h6>Level 6</h6>\n')
  assert.equal(html(adfToHtml(document(paragraph(), { attrs: { level: 2 }, type: 'heading' }))), '<p></p>\n<h2></h2>\n')
})

test('writes the marks CommonMark spells, the first mark outermost', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/a?b=1&c=2', title: 'The "A" page' }, type: 'link' }
  const line = paragraph(text('Read '), text('the', { type: 'em' }), text(' '), text('manual', { type: 'strong' }, { type: 'em' }), text(': '), text('npm ci', { type: 'code' }, link), text(' or '), text('this', link))
  assert.equal(
    html(adfToHtml(document(line))),
    '<p>Read <em>the</em> <strong><em>manual</em></strong>: <code><a href="https://example.com/a?b=1&amp;c=2" title="The &quot;A&quot; page">npm ci</a></code> or <a href="https://example.com/a?b=1&amp;c=2" title="The &quot;A&quot; page">this</a></p>\n',
  )
  assert.equal(html(adfToHtml(document(paragraph(text('Line one'), { type: 'hardBreak' }, text('Line two'))))), '<p>Line one<br>Line two</p>\n')
})

test('escapes text and attribute values, and keeps tabs, line feeds and form feeds', () => {
  assert.equal(html(adfToHtml(document(paragraph(text('a < b && c > "d" \'e\'\tf\ng\fh'))))), '<p>a &lt; b &amp;&amp; c &gt; &quot;d&quot; \'e\'\tf\ng\fh</p>\n')
})

test('carries text holding a character HTML text cannot hold, escaping it in the JSON', () => {
  for (const value of ['a\r\nb', 'a\0b', 'a\u0001b', 'a\u007fb', 'a\u0085b', 'a﷐b', 'a￿b', 'a🿾b', 'a\ud800b', 'a\udc00b']) {
    assert.equal(carriedSpans(text(value)), 1, JSON.stringify(value))
  }
  assert.equal(carriedSpans(text('😄 a b')), 0)
  assert.equal(html(adfToHtml(document(paragraph(text('a\u0085﷐b', { type: 'underline' }))))).includes('&quot;text&quot;:&quot;a\\u0085\\ufdd0b&quot;'), true)
  assert.equal(html(adfToHtml(document(paragraph(text('a\u{1fffe}b', { type: 'underline' }))))).includes('&quot;text&quot;:&quot;a\\ud83f\\udffeb&quot;'), true)
})

test('writes lists tight, an item holding more than one paragraph or a list in elements after the first', () => {
  assert.equal(html(adfToHtml(document({ content: [item(paragraph(text('Bolt'))), item(paragraph(text('Nut')))], type: 'bulletList' }))), '<ul>\n<li>Bolt</li>\n<li>Nut</li>\n</ul>\n')
  const listed: AdfNode = { attrs: { order: 3 }, content: [item(paragraph(text('Bolt')), { content: [item(paragraph(text('M8')))], type: 'bulletList' }), item(paragraph(text('a')), paragraph(text('b')))], type: 'orderedList' }
  assert.equal(html(adfToHtml(document(listed))), '<ol start="3">\n<li>Bolt\n<ul>\n<li>M8</li>\n</ul>\n</li>\n<li>a\n<p>b</p>\n</li>\n</ol>\n')
  assert.equal(html(adfToHtml(document({ content: [item({ type: 'rule' }), { type: 'listItem' }], type: 'orderedList' }))), '<ol>\n<li>\n<hr>\n</li>\n<li></li>\n</ol>\n')
  assert.equal(html(adfToHtml(document({ content: [item(paragraph())], type: 'bulletList' }))), '<ul>\n<li>\n<p></p>\n</li>\n</ul>\n')
})

test('writes an item\'s first paragraph as its element on the item\'s line where it holds an attribute, and as its carry where it holds a mark', () => {
  const listed = (...blocks: AdfNode[]): string => html(adfToHtml(document({ content: [item(...blocks)], type: 'bulletList' })))
  const held: AdfNode = { attrs: { localId: ids.paragraph }, content: [text('Bolt')], type: 'paragraph' }
  assert.equal(listed(held), `<ul>\n<li><p data-local-id="${ids.paragraph}">Bolt</p></li>\n</ul>\n`)
  assert.equal(listed(held, { content: [item(paragraph(text('M8')))], type: 'bulletList' }), `<ul>\n<li><p data-local-id="${ids.paragraph}">Bolt</p>\n<ul>\n<li>M8</li>\n</ul>\n</li>\n</ul>\n`)
  assert.equal(listed({ attrs: { localId: ids.paragraph }, type: 'paragraph' }), `<ul>\n<li><p data-local-id="${ids.paragraph}"></p></li>\n</ul>\n`)
  assert.equal(listed({ content: [text('Bolt')], marks: [{ attrs: { align: 'center' }, type: 'alignment' }], type: 'paragraph' }).startsWith('<ul>\n<li>\n<div class="adf-carry"'), true)
})

test('writes the attributes an element cannot express as data-* attributes on it, sorted, a value that is no string as JSON', () => {
  const localId = { localId: ids.paragraph }
  assert.equal(html(adfToHtml(document({ attrs: localId, content: [text('x')], type: 'paragraph' }))), `<p data-local-id="${ids.paragraph}">x</p>\n`)
  assert.equal(html(adfToHtml(document({ attrs: { level: 2, ...localId }, content: [text('x')], type: 'heading' }))), `<h2 data-local-id="${ids.paragraph}">x</h2>\n`)
  assert.equal(html(adfToHtml(document({ attrs: { localId: ids.quote }, content: [paragraph(text('x'))], type: 'blockquote' }))), `<blockquote data-local-id="${ids.quote}">\n<p>x</p>\n</blockquote>\n`)
  const listed: AdfNode = { attrs: { localId: ids.list, order: 3 }, content: [{ attrs: { localId: ids.item }, content: [{ attrs: localId, content: [text('Bolt')], type: 'paragraph' }], type: 'listItem' }], type: 'orderedList' }
  assert.equal(html(adfToHtml(document(listed))), `<ol start="3" data-local-id="${ids.list}">\n<li data-local-id="${ids.item}"><p data-local-id="${ids.paragraph}">Bolt</p></li>\n</ol>\n`)
  const code: AdfNode = { attrs: { wrap: true, language: 'js', hideLineNumbers: false, ...localId }, content: [text('x')], type: 'codeBlock' }
  assert.equal(html(adfToHtml(document(code))), `<pre data-hide-line-numbers="false" data-local-id="${ids.paragraph}" data-wrap="true"><code class="language-js">x</code></pre>\n`)
  assert.equal(html(adfToHtml(document({ attrs: { weight: -0, color: '#ccc', style: 'a"b' }, type: 'rule' }))), '<hr data-color="#ccc" data-style="a&quot;b" data-weight="-0">\n')
})

test('writes quotes and code blocks, the language a class', () => {
  assert.equal(html(adfToHtml(document({ content: [paragraph(text('Quoted'))], type: 'blockquote' }))), '<blockquote>\n<p>Quoted</p>\n</blockquote>\n')
  assert.equal(html(adfToHtml(document({ attrs: { language: 'javascript' }, content: [text('if (a < b)\n  run()')], type: 'codeBlock' }))), '<pre><code class="language-javascript">if (a &lt; b)\n  run()</code></pre>\n')
  assert.equal(html(adfToHtml(document({ content: [text('plain')], type: 'codeBlock' }, { type: 'codeBlock' }))), '<pre><code>plain</code></pre>\n<pre><code></code></pre>\n')
})

test('writes an external image standing alone in a paragraph, a link around it where one marks it', () => {
  const image = (media: AdfNode): AdfNode => ({ attrs: { layout: 'center' }, content: [media], type: 'mediaSingle' })
  assert.equal(html(adfToHtml(document(image({ attrs: { alt: 'The moon', type: 'external', url: 'https://example.com/moon.jpg' }, type: 'media' })))), '<p><img src="https://example.com/moon.jpg" alt="The moon"></p>\n')
  const linked = image({ attrs: { type: 'external', url: 'https://example.com/moon.jpg' }, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'media' })
  assert.equal(html(adfToHtml(document(linked))), '<p><a href="https://example.com/"><img src="https://example.com/moon.jpg"></a></p>\n')
})

test('carries every other node in an adf-carry element holding its JSON', () => {
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Check the collation.'))], type: 'panel' }
  assert.equal(
    html(adfToHtml(document(panel))),
    '<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelType&quot;:&quot;info&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;Check the collation.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;}],&quot;type&quot;:&quot;panel&quot;}"><p>Check the collation.</p></div>\n',
  )
  const mention: AdfNode = { attrs: { id: '5b10a2', text: '@Mikael' }, type: 'mention' }
  assert.equal(html(adfToHtml(document(paragraph(text('Ask '), mention)))), '<p>Ask <span class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;id&quot;:&quot;5b10a2&quot;,&quot;text&quot;:&quot;@Mikael&quot;},&quot;type&quot;:&quot;mention&quot;}">@Mikael</span></p>\n')
})

test('shows each block a carried node holds as a paragraph in a div', () => {
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Check the collation.')), paragraph(text('Then import.'))], type: 'panel' }
  assert.equal(shown(html(adfToHtml(document(panel)))), '<p>Check the collation.</p><p>Then import.</p>')
})

test('shows a carried node\'s content after a block it holds as a paragraph of its own', () => {
  assert.equal(shown(html(adfToHtml(document({ content: [paragraph(text('a')), text('b')], type: 'panel' })))), '<p>a</p><p>b</p>')
})

test('shows text a link marks in a carried node as a link', () => {
  const link: AdfMark = { attrs: { href: 'https://spec.commonmark.org/', title: 'The spec' }, type: 'link' }
  const panel: AdfNode = { content: [paragraph(text('Read the '), text('CommonMark spec', link), text(' first.'))], type: 'panel' }
  assert.equal(shown(html(adfToHtml(document(panel)))), '<p>Read the <a href="https://spec.commonmark.org/" title="The spec">CommonMark spec</a> first.</p>')
  assert.equal(shown(html(adfToHtml(document(paragraph(text('x', { type: 'underline' }, link)))))), '<a href="https://spec.commonmark.org/" title="The spec">x</a>')
})

test('shows a hard break, and a line feed in carried text outside a code block, as a line break', () => {
  assert.equal(shown(html(adfToHtml(document({ content: [paragraph(text('Then'), { type: 'hardBreak' }, text('import.'))], type: 'panel' })))), '<p>Then<br>import.</p>')
  assert.equal(shown(html(adfToHtml(document({ content: [paragraph(text('Then\nimport.'))], type: 'panel' })))), '<p>Then<br>import.</p>')
  assert.equal(shown(html(adfToHtml(document(paragraph(text('a\nb', { type: 'underline' })))))), 'a<br>b')
})

test('shows an expand\'s title as a paragraph of its own', () => {
  assert.equal(shown(html(adfToHtml(document({ attrs: { title: 'Details' }, content: [paragraph(text('Inside'))], type: 'expand' })))), '<p>Details</p><p>Inside</p>')
})

test('parts the blocks a span carry shows with line breaks', () => {
  assert.equal(shown(html(adfToHtml(document(paragraph({ content: [paragraph(text('a')), paragraph(text('b'))], type: 'panel' }))))), 'a<br>b')
})

test('drops from what a carry element shows the characters HTML cannot hold, and the link of a URL holding one', () => {
  assert.equal(shown(html(adfToHtml(document(paragraph(text('a\u0001b\r', { type: 'underline' }, { attrs: { href: 'https://example.com/\u0001' }, type: 'link' })))))), 'ab')
})

test('shows a code block in a div carry as pre and code, keeping its line feeds and spaces', () => {
  const code: AdfNode = { attrs: { language: 'python' }, content: [text('if ready:\n    deploy()')], type: 'codeBlock' }
  assert.equal(shown(html(adfToHtml(document({ attrs: { panelType: 'info' }, content: [paragraph(text('Run this:')), code], type: 'panel' })))), '<p>Run this:</p><pre><code class="language-python">if ready:\n    deploy()</code></pre>')
  assert.equal(shown(html(adfToHtml(document({ content: [text('a\r\n  b'), text('c')], type: 'codeBlock' })))), '<pre><code>a\n  bc</code></pre>')
})

test('gives a code block in a div carry the class its element takes, and none where its language is no class token', () => {
  const carried = (language: AdfAttributes[string]): string => shown(html(adfToHtml(document({ attrs: { language }, content: [text('x')], marks: [{ attrs: { mode: 'wide' }, type: 'breakout' }], type: 'codeBlock' }))))
  assert.equal(carried('js'), '<pre><code class="language-js">x</code></pre>')
  assert.equal(carried('c sharp'), '<pre><code>x</code></pre>')
  assert.equal(carried(5), '<pre><code>x</code></pre>')
})

test('shows a code block in a span carry as text, its line feeds line breaks', () => {
  assert.equal(shown(html(adfToHtml(document(paragraph({ attrs: { language: 'python' }, content: [text('if ready:\n    deploy()')], type: 'codeBlock' }))))), 'if ready:<br>    deploy()')
})

test('shows the content a carried node holds in an attribute, a link to what it links to', () => {
  const inline = (node: AdfNode): string => shown(html(adfToHtml(document(paragraph(node)))))
  assert.equal(inline({ attrs: { timestamp: '1700000000000' }, type: 'date' }), '2023-11-14')
  assert.equal(inline({ attrs: { shortName: ':smile:', text: '😄' }, type: 'emoji' }), '😄')
  assert.equal(inline({ attrs: { id: '5b10a2' }, type: 'mention' }), '@5b10a2')
  assert.equal(inline({ attrs: { color: 'green', text: 'Done' }, type: 'status' }), 'Done')
  assert.equal(inline({ attrs: { url: 'https://example.com/<card>' }, type: 'inlineCard' }), '<a href="https://example.com/&lt;card&gt;">https://example.com/&lt;card&gt;</a>')
  assert.equal(inline({ attrs: { data: { name: 'Roadmap' } }, type: 'inlineCard' }), 'Roadmap')
  assert.equal(inline(text('underlined', { type: 'underline' })), 'underlined')
  const image = (media: AdfNode): string => shown(html(adfToHtml(document({ attrs: { layout: 'wide' }, content: [media], type: 'mediaSingle' }))))
  assert.equal(image({ attrs: { alt: 'The moon', type: 'external', url: 'https://example.com/moon.jpg' }, type: 'media' }), '<p><a href="https://example.com/moon.jpg">The moon</a></p>')
  assert.equal(image({ attrs: { type: 'external', url: 'https://example.com/moon.jpg' }, type: 'media' }), '<p><a href="https://example.com/moon.jpg">https://example.com/moon.jpg</a></p>')
  assert.equal(image({ attrs: { alt: 'The moon', type: 'external', url: 'https://example.com/moon.jpg' }, marks: [{ attrs: { title: 'No target' }, type: 'link' }], type: 'media' }), '<p><a href="https://example.com/moon.jpg">The moon</a></p>')
})

test('shows a carried image a link to another target marks as that link, then a link to the image reading image', () => {
  const link: AdfMark = { attrs: { href: 'https://example.com/' }, type: 'link' }
  const image = (attrs: AdfAttributes): string => shown(html(adfToHtml(document({ attrs: { layout: 'wide' }, content: [{ attrs, marks: [link], type: 'media' }], type: 'mediaSingle' }))))
  assert.equal(image({ alt: 'The moon', type: 'external', url: 'https://example.com/moon.jpg' }), '<p><a href="https://example.com/">The moon</a> (<a href="https://example.com/moon.jpg">image</a>)</p>')
  assert.equal(image({ type: 'external', url: 'https://example.com/moon.jpg' }), '<p><a href="https://example.com/">https://example.com/</a> (<a href="https://example.com/moon.jpg">image</a>)</p>')
  assert.equal(image({ alt: 'The moon', type: 'external', url: 'https://example.com/' }), '<p><a href="https://example.com/">The moon</a></p>')
  const blank = shown(html(adfToHtml(document({ attrs: { layout: 'wide' }, content: [{ attrs: { type: 'external', url: 'https://example.com/moon.jpg' }, marks: [{ attrs: { href: ' ' }, type: 'link' }], type: 'media' }], type: 'mediaSingle' }))))
  assert.equal(blank, '<p><a href=" ">https://example.com/moon.jpg</a> (<a href="https://example.com/moon.jpg">image</a>)</p>')
  const inline: AdfNode = { attrs: { alt: 'The moon', type: 'external', url: 'https://example.com/moon.jpg' }, marks: [link], type: 'mediaInline' }
  assert.equal(shown(html(adfToHtml(document(paragraph(inline))))), '<a href="https://example.com/">The moon</a> (<a href="https://example.com/moon.jpg">image</a>)')
})

test('links a carried card a link marks to that link\'s target alone', () => {
  const card: AdfNode = { attrs: { url: 'https://example.com/roadmap' }, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'inlineCard' }
  assert.equal(shown(html(adfToHtml(document(paragraph(card))))), '<a href="https://example.com/">https://example.com/roadmap</a>')
})

test('shows a note naming what a carried node references where it shows no text, linked where a link marks the node', () => {
  const inline = (node: AdfNode): string => shown(html(adfToHtml(document(paragraph(node)))))
  const stored = { collection: ids.collection, id: ids.file, type: 'file' }
  assert.equal(inline({ attrs: stored, type: 'mediaInline' }), '<em>(image)</em>')
  assert.equal(inline({ attrs: stored, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'mediaInline' }), '<a href="https://example.com/"><em>(image)</em></a>')
  assert.equal(inline({ attrs: {}, type: 'inlineCard' }), '<em>(link card)</em>')
  assert.equal(inline({ attrs: { extensionKey: 'jira-issues' }, type: 'inlineExtension' }), '<em>(jira-issues)</em>')
  assert.equal(inline({ attrs: { extensionType: 'com.example' }, type: 'inlineExtension' }), '<em>(extension)</em>')
  assert.equal(shown(html(adfToHtml(document({ attrs: { resourceId: ids.resource }, type: 'syncBlock' })))), '<p><em>(synced block)</em></p>')
})

test('carries a node holding what its element cannot', () => {
  assert.equal(carriedBlock({ attrs: { localId: 7 }, content: [text('x')], type: 'paragraph' }), true)
  assert.equal(carriedBlock({ attrs: { layout: 'wide' }, content: [text('x')], type: 'paragraph' }), true)
  assert.equal(carriedBlock({ content: [], type: 'paragraph' }), true)
  assert.equal(carriedBlock({ attrs: {}, type: 'rule' }), true)
  assert.equal(carriedBlock({ content: [text('x')], type: 'rule' }), true)
  assert.equal(carriedBlock({ attrs: { color: 'a\u0001' }, type: 'rule' }), true)
  assert.equal(carriedBlock({ attrs: { level: 1 }, type: 'rule' }), true)
  assert.equal(carriedBlock({ type: 'unknownBlock' }), true)
  for (const level of [0, 1.5, 7]) assert.equal(carriedBlock({ attrs: { level }, content: [text('x')], type: 'heading' }), true, String(level))
  assert.equal(carriedBlock({ marks: [{ attrs: { level: 1 }, type: 'indentation' }], type: 'blockquote' }), true)
  for (const order of [1.5, -0]) assert.equal(carriedBlock({ attrs: { order }, content: [item(paragraph(text('x')))], type: 'orderedList' }), true, String(order))
  assert.equal(carriedBlock({ attrs: { localId: 7 }, content: [item(paragraph(text('x')))], type: 'orderedList' }), true)
  assert.equal(carriedBlock({ content: [item(paragraph(text('x'))), paragraph(text('y'))], type: 'bulletList' }), true)
  assert.equal(carriedBlock({ content: [{ attrs: {}, content: [paragraph(text('x'))], type: 'listItem' }], type: 'bulletList' }), true)
  assert.equal(carriedBlock({ content: [{ content: [paragraph(text('x'))], text: 'y', type: 'listItem' }], type: 'bulletList' }), true)
  assert.equal(carriedBlock({ content: [], type: 'bulletList' }), true)
  assert.equal(carriedBlock({ attrs: { language: 'c sharp' }, content: [text('x')], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ attrs: { language: 5 }, content: [text('x')], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ attrs: { localId: 7 }, content: [text('x')], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ content: [text('x')], marks: [{ attrs: { mode: 'wide' }, type: 'breakout' }], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ attrs: { language: 'a\0b' }, content: [text('x')], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ content: [text('a'), text('b')], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ content: [text('x', { type: 'code' })], type: 'codeBlock' }), true)
  assert.equal(carriedBlock({ content: [text('x\0')], type: 'codeBlock' }), true)
  assert.equal(carriedBlock(item(paragraph(text('x')))), true)
  assert.equal(carriedBlock(text('x')), true)
  assert.equal(carriedBlock({ attrs: { layout: 'wide' }, content: [{ attrs: { type: 'external', url: 'https://example.com/a.png' }, type: 'media' }], type: 'mediaSingle' }), true)
  assert.equal(carriedBlock({ attrs: { layout: 'center' }, content: [{ attrs: { alt: '', type: 'external', url: 'https://example.com/a.png' }, type: 'media' }], type: 'mediaSingle' }), true)
})

test('carries inline what its element cannot hold, and a text node an unmarked one before it would join', () => {
  assert.equal(carriedSpans(text('a'), text('b')), 1)
  assert.equal(carriedSpans(text('a'), text('b'), text('c')), 1)
  assert.equal(carriedSpans(text('a'), text('b', { type: 'em' }), text('c')), 0)
  assert.equal(carriedSpans(text('')), 1)
  assert.equal(carriedSpans({ type: 'text' }), 1)
  assert.equal(carriedSpans(text('x', { type: 'em' }, { type: 'em' })), 1)
  assert.equal(carriedSpans({ marks: [], text: 'x', type: 'text' }), 1)
  assert.equal(carriedSpans(text('x', { attrs: {}, type: 'em' })), 1)
  assert.equal(carriedSpans(text('x', { attrs: { href: 'https://example.com/' }, type: 'underline' })), 1)
  assert.equal(carriedSpans(text('x', { attrs: { href: 'https://example.com/', id: ids.item }, type: 'link' })), 1)
  assert.equal(carriedSpans({ attrs: { text: '\n' }, type: 'hardBreak' }), 1)
  assert.equal(carriedSpans({ content: [text('x')], type: 'hardBreak' }), 1)
  assert.equal(carriedSpans(paragraph(text('x'))), 1)
})

test('writes every URL as the ADF holds it, escaped, whatever its scheme', () => {
  const linked = (href: string): string => html(adfToHtml(document(paragraph(text('x', { attrs: { href }, type: 'link' })))))
  assert.equal(linked('javascript:alert("x")'), '<p><a href="javascript:alert(&quot;x&quot;)">x</a></p>\n')
  assert.equal(linked('data:text/html,<b>x</b>'), '<p><a href="data:text/html,&lt;b&gt;x&lt;/b&gt;">x</a></p>\n')
  const image: AdfNode = { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: 'vbscript:x' }, type: 'media' }], type: 'mediaSingle' }
  assert.equal(html(adfToHtml(document(image))), '<p><img src="vbscript:x"></p>\n')
  assert.equal(shown(html(adfToHtml(document(paragraph({ attrs: { url: 'javascript:alert(1)' }, type: 'inlineCard' }))))), '<a href="javascript:alert(1)">javascript:alert(1)</a>')
})

test('writes a container holding no content key as its element holding nothing', () => {
  assert.equal(html(adfToHtml(document({ type: 'blockquote' }, { type: 'bulletList' }, { type: 'orderedList' }))), '<blockquote></blockquote>\n<ul></ul>\n<ol></ol>\n')
})

test('carries a link or image holding a value its element cannot', () => {
  const carried = (mark: AdfMark): boolean => html(adfToHtml(document(paragraph(text('x', mark))))).startsWith('<p><span class="adf-carry"')
  assert.equal(carried({ attrs: { title: 'No target' }, type: 'link' }), true)
  assert.equal(carried({ attrs: { href: 'https://example.com/\0' }, type: 'link' }), true)
  assert.equal(carried({ attrs: { href: 'https://example.com/', title: 'x\0' }, type: 'link' }), true)
  const linked = (attrs: AdfAttributes): AdfNode => ({ attrs: { type: 'external', url: 'https://example.com/a.png' }, marks: [{ attrs, type: 'link' }], type: 'media' })
  const image = (media: AdfNode): AdfNode => ({ attrs: { layout: 'center' }, content: [media], type: 'mediaSingle' })
  assert.equal(carriedBlock(image(linked({ href: 'https://example.com/\0' }))), true)
  assert.equal(carriedBlock(image(linked({ href: 'https://example.com/', title: 'x\0' }))), true)
  assert.equal(carriedBlock(image({ attrs: { type: 'external', url: 'https://example.com/\0.png' }, type: 'media' })), true)
  assert.equal(carriedBlock(image({ attrs: { alt: 'The\0moon', type: 'external', url: 'https://example.com/a.png' }, type: 'media' })), true)
})

test('writes an empty document as nothing, and one holding no content key as its carry', () => {
  assert.equal(html(adfToHtml(document())), '')
  assert.equal(html(adfToHtml({ type: 'doc', version: 1 })), '<div class="adf-carry" data-adf="{&quot;type&quot;:&quot;doc&quot;,&quot;version&quot;:1}"></div>\n')
})

test('refuses what is no document, and a version HTML cannot carry', () => {
  assert.equal(refusal(adfToHtml({ type: 'doc', version: Number.NaN })), 'not-an-adf-document at /')
  assert.equal(refusal(adfToHtml({ type: 'doc', version: 2 })), 'unsupported-document-version at /')
})

test('writes blocks nested 500 levels, and refuses the next level, a list\'s items one level below it', () => {
  assert.equal(refusal(adfToHtml(document(nested('blockquote', largestNesting, paragraph(text('x')))))), 'written')
  const deep = adfToHtml(document(nested('blockquote', largestNesting + 1, paragraph(text('x')))))
  assert.equal(refusal(deep).startsWith('unsupported-nesting-depth at /'), true)
  assert.equal(!deep.ok && deep.error.message.includes('500'), true)
  let items: AdfNode = paragraph(text('x'))
  for (let level = 0; level < largestNesting; level += 1) items = { content: [item(items)], type: 'bulletList' }
  assert.equal(refusal(adfToHtml(document(items))), 'written')
  assert.equal(refusal(adfToHtml(document({ content: [item(items)], type: 'bulletList' }))).startsWith('unsupported-nesting-depth at /'), true)
})

test('refuses a carried block whose JSON nests past the levels its depth leaves, and an inline carry past 500', () => {
  let value: AdfAttributes[string] = 1
  for (let level = 0; level < largestNesting - 2; level += 1) value = [value]
  const carried: AdfNode = { attrs: { a: value }, type: 'unknownBlock' }
  assert.equal(refusal(adfToHtml(document(carried))), 'written')
  assert.equal(refusal(adfToHtml(document({ content: [carried], type: 'blockquote' }))), 'unsupported-nesting-depth at /content/0/content/0')
  const deep = nested('unknownInline', largestNesting, text('x'))
  assert.equal(refusal(adfToHtml(document(paragraph(deep)))), 'unsupported-nesting-depth at /content/0/content/0')
  assert.equal(refusal(adfToHtml(document({ attrs: { level: 1 }, content: [deep], type: 'heading' }))), 'unsupported-nesting-depth at /content/0/content/0')
  assert.equal(refusal(adfToHtml(document({ content: [item(paragraph(deep))], type: 'bulletList' }))), 'unsupported-nesting-depth at /content/0/content/0/content/0/content/0')
  assert.equal(refusal(adfToHtml(document({ content: [item({ attrs: { localId: ids.paragraph }, content: [deep], type: 'paragraph' })], type: 'bulletList' }))), 'unsupported-nesting-depth at /content/0/content/0/content/0/content/0')
  assert.equal(refusal(adfToHtml(document({ content: [item(paragraph(text('a')), paragraph(deep)), item(paragraph(deep))], type: 'bulletList' }))), 'unsupported-nesting-depth at /content/0/content/0/content/1/content/0')
})

test('refuses HTML past V8\'s longest string, at the block passing it', () => {
  const long = 'a'.repeat(2 ** 28)
  const tooLong = (result: Result<string>): boolean => !result.ok && result.error.code === 'unsupported-node-shape' && result.error.message.includes('536870888')
  assert.equal(tooLong(adfToHtml(document(paragraph(text(long), text(long, { type: 'em' }), text(long))))), true)
  // The two code blocks' text is the bound exactly, so only what their elements add passes it, before the too-deep block after them.
  const code: AdfNode = { content: [text('a'.repeat(536870888 / 2))], type: 'codeBlock' }
  assert.equal(tooLong(adfToHtml(document(code, code, nested('blockquote', largestNesting + 1, { type: 'rule' })))), true)
})

test('writes HTML exactly as long as V8\'s longest string', () => {
  // Eight paragraphs, each `<p>`, its text, `</p>` and a line feed, make the bound exactly.
  const block = paragraph(text('a'.repeat(536870888 / 8 - 8)))
  const written = adfToHtml(document(block, block, block, block, block, block, block, block))
  assert.equal(written.ok && written.value.length, 536870888)
})

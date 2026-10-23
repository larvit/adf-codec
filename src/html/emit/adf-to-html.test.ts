import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfDocument, AdfMark, AdfNode } from '../../adf/document.ts'
import type { Result } from '../../result.ts'
import { adfToHtml } from '../../index.ts'
import { largestNesting } from '../../nesting.ts'

function document(...content: AdfNode[]): AdfDocument {
  return { content, type: 'doc', version: 1 }
}

function html(result: Result<string>): string {
  return result.ok ? result.value : `${result.error.code}: ${result.error.message}`
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

test('escapes text and attribute values, and a carriage return so an HTML parser keeps it', () => {
  assert.equal(html(adfToHtml(document(paragraph(text('a < b && c > "d" \'e\'\r\nf'))))), '<p>a &lt; b &amp;&amp; c &gt; &quot;d&quot; \'e\'&#13;\nf</p>\n')
})

test('writes lists tight, an item holding more than one paragraph or a list in elements after the first', () => {
  assert.equal(html(adfToHtml(document({ content: [item(paragraph(text('Bolt'))), item(paragraph(text('Nut')))], type: 'bulletList' }))), '<ul>\n<li>Bolt</li>\n<li>Nut</li>\n</ul>\n')
  const nested: AdfNode = { attrs: { order: 3 }, content: [item(paragraph(text('Bolt')), { content: [item(paragraph(text('M8')))], type: 'bulletList' }), item(paragraph(text('a')), paragraph(text('b')))], type: 'orderedList' }
  assert.equal(html(adfToHtml(document(nested))), '<ol start="3">\n<li>Bolt\n<ul>\n<li>M8</li>\n</ul>\n</li>\n<li>a\n<p>b</p>\n</li>\n</ol>\n')
  assert.equal(html(adfToHtml(document({ content: [item({ type: 'rule' }), { type: 'listItem' }], type: 'orderedList' }))), '<ol>\n<li>\n<hr>\n</li>\n<li></li>\n</ol>\n')
  assert.equal(html(adfToHtml(document({ content: [item(paragraph())], type: 'bulletList' }))), '<ul>\n<li>\n<p></p>\n</li>\n</ul>\n')
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

test('carries every other node in an adf-carry element holding its JSON and showing its text', () => {
  const panel: AdfNode = { attrs: { panelType: 'info' }, content: [paragraph(text('Check the collation.')), paragraph(text('Then import.'))], type: 'panel' }
  assert.equal(
    html(adfToHtml(document(panel))),
    '<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelType&quot;:&quot;info&quot;},&quot;content&quot;:[{&quot;content&quot;:[{&quot;text&quot;:&quot;Check the collation.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;},{&quot;content&quot;:[{&quot;text&quot;:&quot;Then import.&quot;,&quot;type&quot;:&quot;text&quot;}],&quot;type&quot;:&quot;paragraph&quot;}],&quot;type&quot;:&quot;panel&quot;}">Check the collation.\nThen import.</div>\n',
  )
  const mention: AdfNode = { attrs: { id: '5b10a2', text: '@Mikael' }, type: 'mention' }
  assert.equal(html(adfToHtml(document(paragraph(text('Ask '), mention)))), '<p>Ask <span class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;id&quot;:&quot;5b10a2&quot;,&quot;text&quot;:&quot;@Mikael&quot;},&quot;type&quot;:&quot;mention&quot;}">@Mikael</span></p>\n')
})

test('shows the content a carried node holds in an attribute', () => {
  const shown = (node: AdfNode): string => {
    const written = html(adfToHtml(document(paragraph(node))))
    return written.slice(written.indexOf('">') + 2, written.indexOf('</span>'))
  }
  assert.equal(shown({ attrs: { timestamp: '1700000000000' }, type: 'date' }), '2023-11-14')
  assert.equal(shown({ attrs: { shortName: ':smile:', text: '😄' }, type: 'emoji' }), '😄')
  assert.equal(shown({ attrs: { id: '5b10a2' }, type: 'mention' }), '@5b10a2')
  assert.equal(shown({ attrs: { color: 'green', text: 'Done' }, type: 'status' }), 'Done')
  assert.equal(shown({ attrs: { url: 'https://example.com/<card>' }, type: 'inlineCard' }), 'https://example.com/&lt;card&gt;')
  assert.equal(shown(text('underlined', { type: 'underline' })), 'underlined')
  assert.equal(html(adfToHtml(document({ attrs: { title: 'Details' }, content: [paragraph(text('Inside'))], type: 'expand' }))).endsWith('">Details\nInside</div>\n'), true)
})

test('carries a node holding what its element cannot', () => {
  const carried = (node: AdfNode): boolean => html(adfToHtml(document(node))).startsWith('<div class="adf-carry"')
  assert.equal(carried({ attrs: { localId: 'p1' }, content: [text('x')], type: 'paragraph' }), true)
  assert.equal(carried({ content: [], type: 'paragraph' }), true)
  assert.equal(carried({ attrs: {}, type: 'rule' }), true)
  assert.equal(carried({ attrs: { level: 7 }, content: [text('x')], type: 'heading' }), true)
  assert.equal(carried({ attrs: { order: 1.5 }, content: [item(paragraph(text('x')))], type: 'orderedList' }), true)
  assert.equal(carried({ content: [item(paragraph(text('x'))), paragraph(text('y'))], type: 'bulletList' }), true)
  assert.equal(carried({ content: [], type: 'bulletList' }), true)
  assert.equal(carried({ attrs: { language: 'c sharp' }, content: [text('x')], type: 'codeBlock' }), true)
  assert.equal(carried({ content: [text('a'), text('b')], type: 'codeBlock' }), true)
  assert.equal(carried({ content: [text('x\0')], type: 'codeBlock' }), true)
  assert.equal(carried(item(paragraph(text('x')))), true)
  assert.equal(carried(text('x')), true)
  assert.equal(carried({ attrs: { layout: 'wide' }, content: [{ attrs: { type: 'external', url: 'https://example.com/a.png' }, type: 'media' }], type: 'mediaSingle' }), true)
  assert.equal(carried({ attrs: { layout: 'center' }, content: [{ attrs: { alt: '', type: 'external', url: 'https://example.com/a.png' }, type: 'media' }], type: 'mediaSingle' }), true)
})

test('carries inline what its element cannot hold, and a text node an unmarked one before it would join', () => {
  const carriedSpans = (...content: AdfNode[]): number => html(adfToHtml(document(paragraph(...content)))).split('<span class="adf-carry"').length - 1
  assert.equal(carriedSpans(text('a'), text('b')), 1)
  assert.equal(carriedSpans(text('a'), text('b', { type: 'em' }), text('c')), 0)
  assert.equal(carriedSpans(text('')), 1)
  assert.equal(carriedSpans(text('x\0y')), 1)
  assert.equal(carriedSpans(text('x', { type: 'em' }, { type: 'em' })), 1)
  assert.equal(carriedSpans({ marks: [], text: 'x', type: 'text' }), 1)
  assert.equal(carriedSpans(text('x', { attrs: {}, type: 'em' })), 1)
  assert.equal(carriedSpans(text('x', { attrs: { href: 'https://example.com/', id: 'a1' }, type: 'link' })), 1)
  assert.equal(carriedSpans({ attrs: { text: '\n' }, type: 'hardBreak' }), 1)
  assert.equal(carriedSpans(paragraph(text('x'))), 1)
})

test('writes a link\'s or image\'s URL as the ADF holds it, escaped, whatever its scheme', () => {
  const linked = (href: string): string => html(adfToHtml(document(paragraph(text('x', { attrs: { href }, type: 'link' })))))
  assert.equal(linked('javascript:alert("x")'), '<p><a href="javascript:alert(&quot;x&quot;)">x</a></p>\n')
  assert.equal(linked('data:text/html,<b>x</b>'), '<p><a href="data:text/html,&lt;b&gt;x&lt;/b&gt;">x</a></p>\n')
  const image: AdfNode = { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: 'vbscript:x' }, type: 'media' }], type: 'mediaSingle' }
  assert.equal(html(adfToHtml(document(image))), '<p><img src="vbscript:x"></p>\n')
})

test('writes a container holding no content key as its element holding nothing', () => {
  assert.equal(html(adfToHtml(document({ type: 'blockquote' }, { type: 'bulletList' }, { type: 'orderedList' }))), '<blockquote></blockquote>\n<ul></ul>\n<ol></ol>\n')
})

test('carries a link or image whose target the anchor cannot hold', () => {
  const carried = (mark: AdfMark): boolean => html(adfToHtml(document(paragraph(text('x', mark))))).startsWith('<p><span class="adf-carry"')
  assert.equal(carried({ attrs: { title: 'No target' }, type: 'link' }), true)
  assert.equal(carried({ attrs: { href: 'https://example.com/\0' }, type: 'link' }), true)
  assert.equal(carried({ attrs: { href: 'https://example.com/', title: 'x\0' }, type: 'link' }), true)
  const image: AdfNode = { attrs: { layout: 'center' }, content: [{ attrs: { type: 'external', url: 'https://example.com/a.png' }, marks: [{ attrs: { href: 'https://example.com/\0' }, type: 'link' }], type: 'media' }], type: 'mediaSingle' }
  assert.equal(html(adfToHtml(document(image))).startsWith('<div class="adf-carry"'), true)
})

test('refuses an inline carry nesting past 500 levels, in a paragraph, a heading and a list item', () => {
  let deep: AdfNode = text('x')
  for (let level = 0; level < largestNesting; level += 1) deep = { content: [deep], type: 'unknownInline' }
  const refused = (block: AdfNode): string => {
    const result = adfToHtml(document(block))
    return result.ok ? 'written' : `${result.error.code} at ${result.error.path.join('/')}`
  }
  assert.equal(refused(paragraph(deep)), 'unsupported-nesting-depth at content/0/content/0')
  assert.equal(refused({ attrs: { level: 1 }, content: [deep], type: 'heading' }), 'unsupported-nesting-depth at content/0/content/0')
  assert.equal(refused({ content: [item(paragraph(deep))], type: 'bulletList' }), 'unsupported-nesting-depth at content/0/content/0/content/0/content/0')
})

test('refuses text past V8\'s longest string', () => {
  const long = 'a'.repeat(2 ** 28)
  assert.equal(html(adfToHtml(document(paragraph(text(long), text(long, { type: 'em' }), text(long))))), 'unsupported-node-shape: the markdown or HTML for this document, or a directive\'s plain CommonMark, would be longer than 536870888 characters, the longest this library writes')
})

test('writes an empty document as nothing, and one holding no content key as its carry', () => {
  assert.equal(html(adfToHtml(document())), '')
  assert.equal(html(adfToHtml({ type: 'doc', version: 1 })), '<div class="adf-carry" data-adf="{&quot;type&quot;:&quot;doc&quot;,&quot;version&quot;:1}"></div>\n')
})

test('refuses what is no document, a version HTML cannot carry, and nesting past the levels a reader reads', () => {
  assert.equal(html(adfToHtml({ type: 'doc', version: Number.NaN })), 'not-an-adf-document: an ADF document holds a version number: found NaN')
  assert.equal(html(adfToHtml({ type: 'doc', version: 2 })), 'unsupported-document-version: no HTML spelling carries ADF version 2')
  let deep: AdfNode = paragraph(text('x'))
  for (let level = 0; level <= largestNesting; level += 1) deep = { content: [deep], type: 'blockquote' }
  const refused = adfToHtml(document(deep))
  assert.equal(refused.ok ? 'written' : refused.error.code, 'unsupported-nesting-depth')
  let fits: AdfNode = paragraph(text('x'))
  for (let level = 1; level < largestNesting; level += 1) fits = { content: [fits], type: 'blockquote' }
  assert.equal(adfToHtml(document(fits)).ok, true)
  let items: AdfNode = paragraph(text('x'))
  for (let level = 0; level <= largestNesting; level += 1) items = { content: [item(items)], type: 'bulletList' }
  const listed = adfToHtml(document(items))
  assert.equal(listed.ok ? 'written' : listed.error.code, 'unsupported-nesting-depth')
  let carried: AdfNode = paragraph(text('x'))
  for (let level = 1; level < largestNesting; level += 1) carried = { content: [carried], type: 'panel' }
  const json = adfToHtml(document(carried))
  assert.equal(json.ok ? 'written' : json.error.code, 'unsupported-nesting-depth')
})

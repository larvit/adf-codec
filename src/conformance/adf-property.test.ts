import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import type { AdfAttributes, AdfDocument, AdfMark, AdfNode } from '../adf/document.ts'
import { adfDocument, blockTaskItemChildren, propertyRuns, propertyTimeout } from './property-harness.ts'
import { adfToHtml } from '../html/emit/adf-to-html.ts'
import { adfToLosslessMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { adfToPortableMarkdown, reduceToPortable } from '../markdown/portable/adf-to-portable-markdown.ts'
import { centeredImage, externalMedia } from '../adf/plain-image.ts'
import { htmlToAdf } from '../html/parse/html-to-adf.ts'
import { losslessMarkdownToAdf } from '../markdown/parse/markdown-to-adf.ts'
import { portableMarkdownToAdf } from '../markdown/portable/portable-markdown-to-adf.ts'
import { toEditorNormal } from '../markdown/portable/editor-normal.ts'

const gateRuns = 1600
const htmlPieces = fc.constantFrom('<', '>', '&', '"', '\n', '\r', '\0', '&amp;', '&quot;', '&#39;', '<p>', '</p>', '<li>', '</li>', '<ul>\n', '\n</ul>', '<br>', '<em>', '</em>', '<a href="x">', '</span>', '</div>', ' data-local-id="01a17eec-5ed2-75cf-904d-f4af6746ac07"', ' start="2"', '<div class="adf-carry" data-adf="{&quot;type&quot;:&quot;x&quot;}">', '<img src="x">', 'é🎉')
// What HTML text cannot hold (WHATWG HTML §13.1.3), and the line feed a carry element shows as a line break.
const unshown = /\n|(?![\t\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/gu

const depthIdentifier = fc.createDepthIdentifier()
const elementAttributes = [' alt=""', ' alt="y"', ' class="language-x"', ' data-local-id="01a17e97-ca82-785e-9333-6e8199f3b098"', ' start="2"', ' title="t"']
const elementInlinePieces = ['\n', '&amp;', '</p>', '<a href="x">a</a>', '<br>', '<code>c</code>', '<em>a</em>', '<img src="x">', '<p>', '<strong>b</strong>', 'a']
const elementLines = ['<blockquote>\n<p>a</p>\n</blockquote>\n', '<hr>\n', '<li>\n<p></p>\n</li>\n', '<li>\n<p>a</p>\n</li>\n', '<li><p>a</p></li>\n', '<li>a</li>\n', '<p></p>\n', '<p><img src="x" alt=""></p>\n', '<p><img src="x"></p>\n', '<p>a</p>\n', '<pre><code>a</code></pre>\n', '<ul>\n<li>a</li>\n</ul>\n']
const elementText = fc.string({ maxLength: 4, minLength: 1, unit: fc.constantFrom('\n', ' ', '"', '&', '<', 'a', 'é') })
const elementInline = fc.oneof(
  { arbitrary: fc.record({ marks: fc.subarray<AdfMark>([{ type: 'strong' }, { type: 'em' }, { type: 'code' }, { attrs: { href: 'x' }, type: 'link' }]), text: elementText }).map(({ marks, text }): AdfNode => (marks.length === 0 ? { text, type: 'text' } : { marks, text, type: 'text' })), weight: 4 },
  { arbitrary: fc.constant<AdfNode>({ type: 'hardBreak' }), weight: 1 },
)
const localId = fc.record({ localId: fc.constantFrom('01a17c28-f53a-7ae4-90e8-e3a686cc94e8', '01a17fb9-4022-7162-a34a-627985fb16cc') }, { noNullPrototype: true, requiredKeys: [] })
// The nodes `adfToHtml` writes as their own elements, so a document holding these alone writes no carry element, short of adjacent unmarked text.
const { elementBlock } = fc.letrec<{ elementBlock: AdfNode }>((tie) => {
  const blocks = fc.array(tie('elementBlock'), { depthIdentifier, maxLength: 3 })
  const inline = fc.array(elementInline, { maxLength: 3 })
  const items = fc.array(fc.record({ attrs: localId, content: blocks }).map(({ attrs, content }) => element('listItem', attrs, content)), { depthIdentifier, maxLength: 3 })
  const language = fc.record({ language: fc.constantFrom('c', 'js') }, { noNullPrototype: true, requiredKeys: [] })
  const order = fc.record({ order: fc.integer({ max: 3, min: -1 }) }, { noNullPrototype: true, requiredKeys: [] })
  return {
    elementBlock: fc.oneof(
      { depthIdentifier, depthSize: 'small', maxDepth: 3 },
      { arbitrary: fc.record({ attrs: localId, content: inline }).map(({ attrs, content }) => element('paragraph', attrs, content)), weight: 6 },
      fc.record({ attrs: localId, content: inline, level: fc.integer({ max: 6, min: 1 }) }).map(({ attrs, content, level }) => element('heading', { ...attrs, level }, content)),
      fc.record({ attrs: language, text: fc.option(elementText, { nil: undefined }) }).map(({ attrs, text }) => element('codeBlock', attrs, text === undefined ? [] : [{ text, type: 'text' }])),
      localId.map((attrs) => element('rule', attrs, [])),
      fc.record({ alt: fc.option(elementText, { nil: undefined }), linked: fc.boolean(), url: elementText }).map(({ alt, linked, url }) => centeredImage([externalMedia(alt ?? '', url, linked ? { href: 'x' } : undefined)])),
      { arbitrary: fc.record({ attrs: localId, content: blocks }).map(({ attrs, content }) => element('blockquote', attrs, content)), weight: 2 },
      { arbitrary: fc.record({ attrs: localId, content: items }).map(({ attrs, content }) => element('bulletList', attrs, content)), weight: 2 },
      { arbitrary: fc.record({ attrs: order, content: items }).map(({ attrs, content }) => element('orderedList', attrs, content)), weight: 2 },
    ),
  }
})
const elementDocument = fc.array(elementBlock, { maxLength: 4 }).map((content): AdfDocument => ({ content, type: 'doc', version: 1 }))

// A node holding `attrs` and `content` only where it holds any, as a node `adfToHtml` writes as its element.
function element(type: string, attrs: AdfAttributes, content: AdfNode[]): AdfNode {
  return { ...(Object.keys(attrs).length === 0 ? {} : { attrs }), ...(content.length === 0 ? {} : { content }), type }
}

// An attribute goes inside a start tag, a line at the start of any line, and any other piece between two of the HTML's tags, text runs and line feeds, in place of up to `removed` of them.
function edited(html: string, [at, removed, piece]: readonly [number, number, string]): string {
  if (piece.startsWith(' ')) {
    const tags = [...html.matchAll(/<[a-z][^>]*>/g)]
    const tag = tags[at % Math.max(tags.length, 1)]
    if (tag === undefined) return html
    const end = tag.index + tag[0].length - 1
    return `${html.slice(0, end)}${piece}${html.slice(end)}`
  }
  const tokens = html.split(/(<[^>]*>|\n)/).filter((token) => token !== '')
  if (!elementLines.includes(piece)) {
    tokens.splice(at % (tokens.length + 1), removed, piece)
    return tokens.join('')
  }
  const lineStarts = [0, ...tokens.flatMap((token, index) => (token === '\n' ? [index + 1] : []))]
  tokens.splice(lineStarts[at % lineStarts.length] ?? 0, 0, piece)
  return tokens.join('')
}

// Without a carry element, HTML spells the document it reads one way, so writing that document gives back the very HTML read.
function assertReadsBack(html: string): void {
  const read = htmlToAdf(html)
  if (!read.ok) return
  const rewritten = adfToHtml(read.value)
  assert.ok(rewritten.ok, rewritten.ok ? '' : `${rewritten.error.code}: ${rewritten.error.message} — reading ${JSON.stringify(html)}`)
  if (!html.includes('class="adf-carry"')) assert.equal(rewritten.value, html, `reading ${JSON.stringify(html)}`)
  assert.deepEqual(htmlToAdf(rewritten.value), { ok: true, value: read.value }, `reading ${JSON.stringify(html)}`)
}

// Every text node's text in document order.
function documentTexts(nodes: readonly AdfNode[]): string[] {
  const texts: string[] = []
  const pending = [...nodes].reverse()
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.text !== undefined) texts.push(node.text)
    for (const child of [...(node.content ?? [])].reverse()) pending.push(child)
  }
  return texts
}

// Each block's text, an expand's title and an image's alt and url, in document order: what the portable pair keeps.
function shownText(nodes: readonly AdfNode[]): string[] {
  const shown: string[] = []
  for (const node of nodes) {
    const attrs = node.attrs ?? {}
    if ((node.type === 'expand' || node.type === 'nestedExpand') && typeof attrs['title'] === 'string') shown.push(attrs['title'])
    if (node.type === 'media') shown.push(`${JSON.stringify(attrs['alt'] ?? '')} ${JSON.stringify(attrs['url'])}`)
    const content = node.content ?? []
    if (content.some((child) => child.type === 'text' || child.type === 'hardBreak')) shown.push(content.map((child) => child.text ?? '\n').join(''))
    else for (const text of shownText(content)) shown.push(text)
  }
  return shown.filter((text) => text !== '')
}

test('a generated document emits markdown that reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const emitted = adfToLosslessMarkdown(document)
      assert.ok(emitted.ok, emitted.ok ? '' : `${emitted.error.code}: ${emitted.error.message}`)
      const read = losslessMarkdownToAdf(emitted.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(emitted.value)}`)
      assert.deepEqual(read.value, document, `reading ${JSON.stringify(emitted.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes portable markdown refusing only what the guard refuses, and that markdown reads back to its text, to itself and to block task items of paragraphs alone', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToPortableMarkdown(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      const read = portableMarkdownToAdf(written.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(blockTaskItemChildren(read.value.content ?? []).filter((type) => type !== 'paragraph'), [], `reading ${JSON.stringify(written.value)}`)
      const reduced = reduceToPortable(document)
      assert.deepEqual(shownText(read.value.content ?? []), reduced.ok ? shownText(reduced.value.content ?? []) : reduced, `reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(adfToPortableMarkdown(read.value), written, `reading ${JSON.stringify(written.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes HTML holding no character HTML cannot hold, and showing every text node\'s text in document order', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToHtml(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      assert.ok(!/(?![\t\n\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/u.test(written.value), `writing ${JSON.stringify(document)}`)
      const page = written.value.replace(/<[^>]*>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&').replace(unshown, '')
      let from = 0
      for (const text of documentTexts(document.content ?? [])) {
        const shown = text.replace(unshown, '')
        const at = page.indexOf(shown, from)
        assert.ok(at >= 0, `writing ${JSON.stringify(document)}: ${JSON.stringify(shown)} is not shown after ${from}`)
        from = at + shown.length
      }
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes HTML that reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToHtml(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      const read = htmlToAdf(written.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(read.value, document, `reading ${JSON.stringify(written.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('HTML edited anywhere reads, if at all, to a document whose HTML reads back to it', { timeout: propertyTimeout }, () => {
  const edits = fc.array(fc.tuple(fc.nat(), fc.nat({ max: 3 }), htmlPieces), { maxLength: 4, minLength: 1 })
  fc.assert(
    fc.property(adfDocument, edits, (document, cuts) => {
      const written = adfToHtml(document)
      assert.ok(written.ok)
      let html = written.value
      for (const [at, removed, piece] of cuts) html = `${html.slice(0, at % (html.length + 1))}${piece}${html.slice((at % (html.length + 1)) + removed)}`
      assertReadsBack(html)
    }),
    propertyRuns(gateRuns),
  )
})

test('HTML of the dialect\'s own elements, edited, reads only if adfToHtml writes it', { timeout: propertyTimeout }, () => {
  const edits = fc.array(fc.tuple(fc.nat(), fc.nat({ max: 1 }), fc.constantFrom(...elementAttributes, ...elementInlinePieces, ...elementLines)), { maxLength: 2, minLength: 1 })
  fc.assert(
    fc.property(elementDocument, edits, (document, cuts) => {
      const written = adfToHtml(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      assertReadsBack(cuts.reduce(edited, written.value))
    }),
    propertyRuns(gateRuns),
  )
})

test('a generated document writes the portable markdown its editor-normal form writes', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      assert.deepEqual(adfToPortableMarkdown(document), adfToPortableMarkdown(toEditorNormal(document)))
    }),
    propertyRuns(gateRuns),
  )
})

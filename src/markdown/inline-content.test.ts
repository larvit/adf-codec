import assert from 'node:assert/strict'
import test from 'node:test'

import type { AdfNode } from '../adf/document.ts'
import type { Result } from '../result.ts'
import type { InlineContent, OutermostContent } from './inline-content.ts'
import { parseInlineContent, spellableLink } from './inline-content.ts'

function read(source: string): Result<OutermostContent> {
  return parseInlineContent(source, new Map(), [], 'paragraph', 'lossless')
}

function nodes(result: Result<InlineContent>): AdfNode[] | string {
  return result.ok ? result.value.nodes : result.error.code
}

test('reports a directive link that CommonMark could spell opening the line', () => {
  const opening = read('!adf:link[a]{href="/u"}')
  assert.equal(opening.ok && opening.value.openingSpellableLink, true)
  assert.deepEqual(nodes(opening), [{ marks: [{ attrs: { href: '/u' }, type: 'link' }], text: 'a', type: 'text' }])
})

test('reports no spellable opening link where the line opens with text', () => {
  const text = read('See a')
  assert.equal(text.ok && text.value.openingSpellableLink, false)
})

// A node as its text or `type{attrs}[content]`, then `<its marks>`.
function spelled(node: AdfNode): string {
  const marks = (node.marks ?? []).map((mark) => (mark.type === 'link' ? ['link', mark.attrs?.['href'], mark.attrs?.['title']].filter((part) => part !== undefined).join(':') : mark.type))
  const held = node.type === 'text' ? (node.text ?? '') : `${node.type}${JSON.stringify(node.attrs ?? {})}[${(node.content ?? []).map(spelled).join(' ')}]`
  return marks.length === 0 ? held : `${held}<${marks.join(', ')}>`
}

function reading(source: string, flavour: 'lossless' | 'portable' = 'lossless'): string[] {
  const read = parseInlineContent(source, new Map([['ref', { destination: '/r', title: 't' }]]), [], 'paragraph', flavour)
  if (!read.ok) return [read.error.message]
  const { image, nodes: held, openingSpellableLink } = read.value
  return [...(openingSpellableLink ? ['opens with a spellable link'] : []), ...(image === undefined ? [] : [spelled(image)]), ...held.map(spelled)]
}

const readings: [string, string[]][] = [
  ['==[![](i)]()==', ['== (', 'image<link:i>', ')==']],
  ['![ !adf:underline[[![a](i)](h)] ](j)', ['mediaSingle{"layout":"center"}[media{"alt":" a ","type":"external","url":"j"}[]]', ' a <link:j>']],
  ['!adf:link[ [!adf:underline[![a](i)]](h) ]{href="/k"}', ['opens with a spellable link', ' [<link:/k>', 'a<link:/k, underline>', '](h) <link:/k>', ' (', 'image<link:i>', ')']],
  ['!adf:link[![](i)]{href="/k"}', ['the link mark wraps the [content] it marks: this one wraps none']],
  ['!adf:link[a ![p](i) !adf:underline[![q](j "t")]]{href="/k"}', ['opens with a spellable link', 'a p <link:/k>', 'q<link:/k, underline>', ' (', 'image<link:i>', ') (', 'image<link:j:t>', ')']],
  ['[![](i)![](j)](h)', ['h<link:h>', ' (', 'image<link:i>', ') (', 'image<link:j>', ')']],
  ['[![x](i)](h)[b](i)', ['x<link:h>', ' (', 'image<link:i>', ')', 'b<link:i>']],
  ['*[![a](i)](h)* z', ['a<em, link:h>', ' (<em>', 'image<em, link:i>', ')<em>', ' z']],
  ['[*![a](i)*](h) z', ['a<link:h, em>', ' (', 'image<link:i>', ') z']],
  ['a [x ![p](i) y](h) b', ['a ', 'x p y<link:h>', ' (', 'image<link:i>', ') b']],
  ['!adf:underline[a [x ![p](i)](h)] b', ['a <underline>', 'x p<underline, link:h>', ' (<underline>', 'image<underline, link:i>', ')<underline>', ' b']],
  ['==a [![p](i) q](h) b==', ['==a ', 'p q<link:h>', ' (', 'image<link:i>', ') b==']],
  ['==a [![p](i)](h) b== c', ['==a ', 'p<link:h>', ' (', 'image<link:i>', ') b== c']],
  ['![a [b ![c](i)](h) d](j) tail', ['a b c d<link:j>', ' tail']],
  ['[[x ![p](i)](h)](k)', ['[', 'x p<link:h>', ' (', 'image<link:i>', ')](k)']],
  ['[a !adf:underline[[![p](i) x](h)]](k)', ['[a ', 'p x<underline, link:h>', ' (<underline>', 'image<underline, link:i>', ')<underline>', '](k)']],
  ['[![a](i)](h)', ['mediaSingle{"layout":"center"}[media{"alt":"a","type":"external","url":"i"}[]<link:h>]', 'a<link:h>', ' (', 'image<link:i>', ')']],
  ['[[![a](i)](h)](k)', ['[', 'a<link:h>', ' (', 'image<link:i>', ')](k)']],
  ['[![a](i "t")](i) z', ['a<link:i>', ' (', 'image<link:i:t>', ') z']],
  ['![a](i) z', ['a<link:i>', ' z']],
  ['!adf:underline[![a](i)] z', ['a<underline, link:i>', ' z']],
  ['!adf:link[!adf:underline[![a](i)]]{href="/k"} z', ['opens with a spellable link', 'a<link:/k, underline>', ' (', 'image<link:i>', ') z']],
  ['!adf:link[![a](/k)]{href="/k"} z', ['opens with a spellable link', 'a<link:/k>', ' z']],
  ['**a [b ![c](i) ~~d~~][ref] e**', ['a <strong>', 'b c <strong, link:/r:t>', 'd<strong, link:/r:t, strike>', ' (<strong>', 'image<strong, link:i>', ') e<strong>']],
  ['[a\\\n](h)', ['a<link:h>', 'hardBreak{}[]']],
  ['[!adf:textBreak{}](h)', ['delete !adf:textBreak{} here: it stands only between two runs of text with the same formatting, which would otherwise read as one']],
]

for (const [source, expected] of readings) {
  test(`reads a line of links, images, marks and directives, an image inside a link as its alt text with (image) after the link: ${JSON.stringify(source)}`, () => {
    assert.deepEqual(reading(source), expected, source)
  })
}

test('refuses a spellable link directive that does not open its paragraph', () => {
  assert.deepEqual(reading('a !adf:link[b]{href="/k"}'), [spellableLink])
})

test('highlights the (image) of a link between portable highlight delimiters', () => {
  assert.deepEqual(reading('==[![](i)]()==', 'portable'), [' (<backgroundColor>', 'image<backgroundColor, link:i>', ')<backgroundColor>'])
  assert.deepEqual(reading('==[![a](i)](h)x==', 'portable'), ['a<backgroundColor, link:h>', ' (<backgroundColor>', 'image<backgroundColor, link:i>', ')x<backgroundColor>'])
})

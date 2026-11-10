import assert from 'node:assert/strict'
import test from 'node:test'
import vm from 'node:vm'

import type { AdfDocument, AdfNode } from './document.ts'
import type { ConvertErrorCode, Result } from '../result.ts'
import type { JsonValue } from '../json-value.ts'
import { adfToHtml, adfToLosslessMarkdown, adfToPortableMarkdown } from '../index.ts'
import { readAdfDocument, writableContent } from './document.ts'
import { largestNesting } from '../nesting.ts'

// A message is free text: a refusal pins its code and only the facts the message must name.
function refused(result: Result<unknown>, errorCode: ConvertErrorCode, ...facts: string[]): void {
  assert.equal(result.ok ? 'accepted' : result.error.code, errorCode)
  const message = result.ok ? '' : result.error.message
  for (const fact of facts) assert.ok(message.includes(fact), `${JSON.stringify(message)} names ${fact}`)
}

function written(value: unknown): Result<unknown> {
  const read = readAdfDocument(value)
  return read.ok ? writableContent(read.value) : read
}

function readable(value: unknown): boolean {
  return readAdfDocument(value).ok
}

function nested(levels: number): JsonValue {
  let value: JsonValue = 1
  for (let level = 0; level < levels; level += 1) value = [value]
  return value
}

function withAttribute(value: JsonValue): unknown {
  return { content: [{ attrs: { a: value }, type: 'paragraph' }], type: 'doc', version: 1 }
}

test('accepts an editor-normal document', () => {
  assert.equal(readable({ content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(readable({ type: 'doc', version: 1 }), true)
  assert.equal(written({ content: [{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }).ok, true)
})

test('names the check anything that is not a doc node failed', () => {
  assert.equal(readable(null), false)
  refused(written(null), 'not-an-adf-document', 'an object', 'found null')
  refused(written(undefined), 'not-an-adf-document', 'an object', 'found undefined')
  refused(written([]), 'not-an-adf-document', 'an object', 'found an array')
  refused(written('doc'), 'not-an-adf-document', 'an object', 'found "doc"')
  refused(written('x'.repeat(200000)), 'not-an-adf-document', 'an object', `found "${'x'.repeat(40)}…"`)
  refused(written(function named(first: number, second: number) { return first + second }), 'not-an-adf-document', 'an object', 'found a function')
  refused(written({ fields: { description: { type: 'doc', version: 1 } } }), 'not-an-adf-document', 'content, type and version', 'the key fields')
  refused(written({ extra: 1, type: 'doc', version: 1 }), 'not-an-adf-document', 'content, type and version', 'the key extra')
  refused(written({ version: 1 }), 'not-an-adf-document', 'type "doc"', 'no type field')
  refused(written({ type: 'document', version: 1 }), 'not-an-adf-document', 'type "doc"', 'found "document"')
  refused(written({ type: 'paragraph', version: 1 }), 'not-an-adf-document', 'type "doc"', 'found "paragraph"')
  refused(written({ type: 1, version: 1 }), 'not-an-adf-document', 'type "doc"', 'found 1')
  refused(written({ type: 'doc' }), 'not-an-adf-document', 'version number', 'no version field')
  refused(written({ type: 'doc', version: '1' }), 'not-an-adf-document', 'version number', 'found "1"')
  refused(written({ type: 'doc', version: Number.NaN }), 'not-an-adf-document', 'version number', 'found NaN')
})

function refusedNode(content: unknown[]): { message: string; path: unknown } {
  const read = readAdfDocument({ content, type: 'doc', version: 1 })
  assert.equal(read.ok, false)
  if (read.ok) throw new Error('unreachable')
  assert.equal(read.error.code, 'not-an-adf-document')
  return { message: read.error.message, path: read.error.path }
}

test('names the path of the node that is no ADF node, and what is wrong with it', () => {
  const date = refusedNode([{ content: [{ text: 'x', type: 'text' }], type: 'paragraph' }, { content: [{ attrs: { when: new Date(0) }, type: 'panel' }], type: 'paragraph' }])
  assert.deepEqual(date.path, ['content', 1, 'content', 0])
  assert.match(date.message, /when attribute of panel/)
  const topLevel = refusedNode([{ type: 1 }])
  assert.deepEqual(topLevel.path, ['content', 0])
  assert.match(topLevel.message, /type string: found 1/)
  const extra = refusedNode([{ type: 'paragraph' }, { node: 'x', type: 'paragraph' }])
  assert.deepEqual(extra.path, ['content', 1])
  assert.match(extra.message, /key node/)
  assert.match(refusedNode([{ text: 1, type: 'text' }]).message, /text of text is a string: found 1/)
  assert.match(refusedNode([{ content: {}, type: 'paragraph' }]).message, /content of paragraph is an array: found an object/)
  assert.match(refusedNode([{ marks: [{ type: 'em' }, { type: 1 }], text: 'x', type: 'text' }]).message, /mark at index 1 of text/)
  assert.match(refusedNode([{ marks: {}, text: 'x', type: 'text' }]).message, /marks of text is an array: found an object/)
  assert.match(refusedNode([{ attrs: [], type: 'paragraph' }]).message, /attrs of paragraph is an object: found an array/)
  assert.match(refusedNode([{ attrs: new Map(), type: 'paragraph' }]).message, /attrs of paragraph is a plain object/)
  assert.match(refusedNode([5]).message, /node is an object: found 5/)
})

test('names the first unreadable node in document order', () => {
  assert.deepEqual(refusedNode([{ content: [{ type: 1 }], type: 'paragraph' }, { type: 2 }]).path, ['content', 0, 'content', 0])
  assert.deepEqual(refusedNode([{ content: [{ type: 'text' }, { type: 1 }, { type: 2 }], type: 'paragraph' }]).path, ['content', 0, 'content', 1])
})

test('rejects a node whose shape ProseMirror JSON cannot hold', () => {
  refused(written({ content: {}, type: 'doc', version: 1 }), 'not-an-adf-document', 'content is an array', 'found an object')
  assert.equal(readable({ content: [{ type: 1 }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ text: 1, type: 'text' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ node: 'x', type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ content: {}, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ marks: [{ type: 1 }], text: 'x', type: 'text' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ attrs: { a: Number.POSITIVE_INFINITY }, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ attrs: [], type: 'paragraph' }], type: 'doc', version: 1 }), false)
})

test('names the attribute nesting past the levels the parser reads one at, and still calls the value a document', () => {
  const deeper = (key: string, type: string): string[] => [`the ${key} attribute of ${type}`, `${largestNesting} levels`]
  assert.equal(written(withAttribute(nested(largestNesting))).ok, true)
  refused(written(withAttribute(nested(largestNesting + 1))), 'unsupported-nesting-depth', ...deeper('a', 'paragraph'))
  assert.equal(readable(withAttribute(nested(largestNesting + 1))), true)
  const marked = (levels: number): unknown => ({ content: [{ marks: [{ attrs: { a: nested(levels) }, type: 'link' }], text: 'x', type: 'text' }], type: 'doc', version: 1 })
  assert.equal(written(marked(largestNesting)).ok, true)
  refused(written(marked(largestNesting + 1)), 'unsupported-nesting-depth', ...deeper('a', 'link'))
  assert.equal(readable(marked(largestNesting + 1)), true)
})

test('accepts the JSON values an attribute may hold', () => {
  assert.equal(readable({ content: [{ attrs: { a: [1, 'x', null, true, { b: 2 }] }, type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(readable({ content: [{ attrs: { a: [() => 1] }, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ attrs: { a: Object.assign(Object.create(null), { b: 1 }) }, type: 'paragraph' }], type: 'doc', version: 1 }), true)
  assert.equal(readable(vm.runInNewContext("({ content: [{ attrs: { a: { b: [1] } }, type: 'paragraph' }], type: 'doc', version: 1 })")), true)
})

test('refuses an attribute value that is an object JSON does not hold', () => {
  class Point { x = 1 }
  for (const value of [new Date(0), new Map([['b', 1]]), new Set([1]), new Uint8Array([1, 2]), new Point(), [new Map()], { b: new Set() }]) {
    assert.equal(readable({ content: [{ attrs: { a: value }, type: 'paragraph' }], type: 'doc', version: 1 }), false, String(value))
  }
  assert.equal(readable({ content: [{ attrs: new Map(), type: 'paragraph' }], type: 'doc', version: 1 }), false)
  assert.equal(readable({ content: [{ marks: [{ attrs: { href: new URL('https://x.test') }, type: 'link' }], text: 'x', type: 'text' }], type: 'doc', version: 1 }), false)
})

test("reads a node's siblings as a walk rather than as one call's arguments", () => {
  const wide = { content: [{ content: Array.from({ length: 200000 }, () => ({ type: 'rule' })), type: 'blockquote' }], type: 'doc', version: 1 }
  assert.equal(readable(wide), true)
  assert.equal(written(wide).ok, true)
})

test('refuses an object holding itself, and accepts one shared', () => {
  const holdsItself = ['a tree', 'holds itself']
  const paragraph: { content: unknown[]; type: string } = { content: [], type: 'paragraph' }
  paragraph.content.push(paragraph)
  refused(readAdfDocument({ content: [paragraph], type: 'doc', version: 1 }), 'not-an-adf-document', ...holdsItself)
  const document: { content: unknown[]; type: string; version: number } = { content: [], type: 'doc', version: 1 }
  document.content.push(document)
  refused(readAdfDocument(document), 'not-an-adf-document', ...holdsItself)
  const attrs: Record<string, unknown> = {}
  attrs['a'] = [attrs]
  refused(readAdfDocument({ content: [{ attrs, type: 'paragraph' }], type: 'doc', version: 1 }), 'not-an-adf-document', ...holdsItself)
  refused(readAdfDocument({ content: [{ marks: [{ attrs, type: 'link' }], text: 'x', type: 'text' }], type: 'doc', version: 1 }), 'not-an-adf-document', ...holdsItself)
  assert.equal(readable({ content: [{ attrs, type: 'paragraph' }], type: 'doc', version: 1 }), false)
  const bold = { type: 'strong' }
  const text = { marks: [bold], text: 'x', type: 'text' }
  const shared = { content: [text, text], type: 'paragraph' }
  const values = { b: 1 }
  assert.equal(written({ content: [shared, shared, { attrs: { a: [values, values] }, type: 'paragraph' }], type: 'doc', version: 1 }).ok, true)
})

test('opens every writer with the same checks: a document, version 1, and no more text than the longest output holds', () => {
  const checked = (document: AdfDocument): string => {
    const result = writableContent(document)
    return result.ok ? JSON.stringify(result.value) ?? 'no content key' : result.error.code
  }
  assert.equal(checked({ type: 'doc', version: 2 }), 'unsupported-document-version')
  assert.equal(checked({ type: 'doc', version: 1 }), 'no content key')
  assert.equal(checked({ content: [{ type: 'rule' }], type: 'doc', version: 1 }), '[{"type":"rule"}]')
  const long = 'a'.repeat(2 ** 28)
  const text = { content: [{ text: long, type: 'text' }, { text: long, type: 'text' }, { text: long, type: 'text' }], type: 'paragraph' }
  assert.equal(checked({ content: [text], type: 'doc', version: 1 }), 'unsupported-node-shape')
})

test('refuses an inline card a link marks, wherever the document holds it and whichever call writes it', () => {
  const card = { attrs: { url: 'https://example.com/roadmap' }, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'inlineCard' }
  const paragraph = { content: [{ text: 'See ', type: 'text' }, card], type: 'paragraph' }
  const holders = [
    { holder: paragraph, path: ['content', 0, 'content', 1] },
    { holder: { content: [{ content: [paragraph], type: 'listItem' }], type: 'bulletList' }, path: ['content', 0, 'content', 0, 'content', 0, 'content', 1] },
    { holder: { content: [paragraph], type: 'panel' }, path: ['content', 0, 'content', 0, 'content', 1] },
    { holder: { content: [card, { text: 'x', type: 'text' }], marks: [{ attrs: { align: 'center' }, type: 'alignment' }], type: 'paragraph' }, path: ['content', 0, 'content', 0] },
    { holder: { content: [{ content: [card], type: 'futureNode' }], type: 'futureBlock' }, path: ['content', 0, 'content', 0, 'content', 0] },
  ]
  const writers = [adfToHtml, adfToLosslessMarkdown, adfToPortableMarkdown]
  for (const { holder, path } of holders) {
    for (const write of writers) {
      const result = write({ content: [holder], type: 'doc', version: 1 })
      refused(result, 'unsupported-node-shape', 'inlineCard', 'link')
      assert.deepEqual(!result.ok && result.error.path, path)
    }
  }
})

const shapeWriters = [adfToHtml, adfToLosslessMarkdown, adfToPortableMarkdown]

const schemaRefusals: readonly { facts: string[]; node: AdfNode }[] = [
  { facts: ['panel', 'no text key'], node: { text: 'x', type: 'panel' } },
  { facts: ['paragraph', 'no text key'], node: { text: 'x', type: 'paragraph' } },
  { facts: ['media', 'no content'], node: { content: [{ type: 'paragraph' }], type: 'media' } },
  { facts: ['rule', 'no content'], node: { content: [{ type: 'paragraph' }], type: 'rule' } },
  { facts: ['status', 'neither content nor text', 'holds content'], node: { content: [{ text: 'x', type: 'text' }], type: 'status' } },
  { facts: ['status', 'neither content nor text', 'holds text'], node: { text: 'x', type: 'status' } },
  { facts: ['hardBreak', 'neither content nor text', 'holds text'], node: { text: 'x', type: 'hardBreak' } },
]

const schemaRefusalHolders: readonly { hold: (node: AdfNode) => AdfNode[]; path: (number | string)[]; where: string }[] = [
  { hold: (node) => [node], path: ['content', 0], where: 'at the top' },
  { hold: (node) => [{ content: [node], type: 'paragraph' }], path: ['content', 0, 'content', 0], where: 'in a known node' },
  { hold: (node) => [{ content: [node], type: 'futureBlock' }], path: ['content', 0, 'content', 0], where: 'in a carried node' },
]

for (const { facts, node } of schemaRefusals) {
  for (const { hold, path, where } of schemaRefusalHolders) {
    for (const write of shapeWriters) {
      test(`${write.name} refuses what Atlassian's schema forbids ${where}: ${facts.join(', ')}`, () => {
        const result = write({ content: hold(node), type: 'doc', version: 1 })
        refused(result, 'unsupported-node-shape', ...facts)
        assert.deepEqual(result.ok ? 'written' : result.error.path, path)
      })
    }
  }
}

const carriedShapes: readonly AdfNode[] = [
  { content: [], type: 'rule' },
  { content: [{ text: 'x', type: 'text' }], text: 'y', type: 'futureBlock' },
  { content: [{ content: [{ type: 'paragraph' }], type: 'text' }], type: 'paragraph' },
]

for (const node of carriedShapes) {
  for (const write of shapeWriters) {
    test(`${write.name} writes what the schema refusals leave to the carry: ${JSON.stringify(node)}`, () => {
      assert.equal(write({ content: [node], type: 'doc', version: 1 }).ok, true)
    })
  }
}

test('names the first link-marked card in document order', () => {
  const card = (url: string): AdfNode => ({ attrs: { url }, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'inlineCard' })
  const content = [{ content: [card('https://a.example/'), card('https://b.example/')], type: 'paragraph' }, { content: [card('https://c.example/')], type: 'paragraph' }]
  const result = writableContent({ content, type: 'doc', version: 1 })
  assert.deepEqual(!result.ok && result.error.path, ['content', 0, 'content', 0])
})

test('writes a card holding no link mark, and a node type it does not know holding one', () => {
  const comment = { attrs: { annotationType: 'inlineComment', id: 'c1' }, type: 'annotation' }
  const link = { attrs: { href: 'https://example.com/' }, type: 'link' }
  const marked = { content: [{ attrs: { url: 'https://example.com/roadmap' }, marks: [comment], type: 'inlineCard' }, { marks: [link], type: 'futureInline' }], type: 'paragraph' }
  for (const write of [adfToHtml, adfToLosslessMarkdown, adfToPortableMarkdown]) assert.equal(write({ content: [marked], type: 'doc', version: 1 }).ok, true)
})

test('names a link-marked card at any depth by its path alone, with no step quadratic in the depth', () => {
  const depth = 100_000
  let node: AdfNode = { attrs: { url: 'https://example.com/' }, marks: [{ attrs: { href: 'https://example.com/' }, type: 'link' }], type: 'inlineCard' }
  for (let level = 0; level < depth; level += 1) node = { content: [node], type: 'panel' }
  const result = writableContent({ content: [node], type: 'doc', version: 1 })
  assert.equal(!result.ok && result.error.path.length, 2 * (depth + 1))
  assert.deepEqual(!result.ok && result.error.path.slice(0, 4), ['content', 0, 'content', 0])
})

const writers = [adfToHtml, adfToLosslessMarkdown, adfToPortableMarkdown]

function documentOf(attrs: unknown): unknown {
  return { content: [{ attrs, type: 'paragraph' }], type: 'doc', version: 1 }
}

test('reads a document once into a copy that shares nothing with the original', () => {
  const original = { content: [{ attrs: { a: [1, { b: 'x' }] }, content: [{ text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }
  const result = readAdfDocument(original)
  assert.ok(result.ok)
  assert.deepEqual(result.value, original)
  assert.notEqual(result.value, original)
  original.content[0]?.content.push({ text: 'y', type: 'text' })
  assert.equal(result.value.content?.[0]?.content?.length, 1)
})

test('refuses a value holding an accessor property, whichever object or array holds it', () => {
  const accessor = ['plain data', 'a getter or a setter']
  refused(readAdfDocument({ get content() { return [] }, type: 'doc', version: 1 }), 'not-an-adf-document', ...accessor)
  refused(readAdfDocument({ content: [{ get type() { return 'rule' } }], type: 'doc', version: 1 }), 'not-an-adf-document', ...accessor)
  refused(readAdfDocument(documentOf({ set a(value: number) { void value } })), 'not-an-adf-document', ...accessor)
  refused(readAdfDocument(documentOf({ a: Object.defineProperty([], 0, { enumerable: true, get: () => 1 }) })), 'not-an-adf-document', ...accessor)
})

test('refuses a getter minting a fresh child per access without walking it', () => {
  const endless = (): unknown => ({ get next() { return endless() } })
  refused(readAdfDocument(documentOf(endless())), 'not-an-adf-document', 'plain data', 'a getter or a setter')
})

const unreadable = ['plain data', 'threw']

for (const trap of ['getOwnPropertyDescriptor', 'getPrototypeOf', 'ownKeys']) {
  test(`refuses a Proxy whose ${trap} trap throws, as the document and inside it`, () => {
    const throwing = (target: object): object => new Proxy(target, { [trap]: () => { throw new Error('trap') } })
    refused(readAdfDocument(throwing({ type: 'doc', version: 1 })), 'not-an-adf-document', ...unreadable)
    refused(readAdfDocument(documentOf(throwing({ b: 1 }))), 'not-an-adf-document', ...unreadable)
  })
}

test('refuses a Proxy that throws on an array, and a revoked one, wherever they stand', () => {
  const throwing = (target: unknown[], trap: string): object => new Proxy(target, { [trap]: () => { throw new Error('trap') } })
  refused(readAdfDocument({ content: throwing([1], 'getOwnPropertyDescriptor'), type: 'doc', version: 1 }), 'not-an-adf-document', ...unreadable)
  refused(readAdfDocument({ content: throwing([], 'get'), type: 'doc', version: 1 }), 'not-an-adf-document', ...unreadable)
  const revoked = Proxy.revocable({}, {})
  revoked.revoke()
  refused(readAdfDocument(documentOf(revoked.proxy)), 'not-an-adf-document', ...unreadable)
  const read = readAdfDocument(revoked.proxy)
  refused(read, 'not-an-adf-document', ...unreadable)
  assert.deepEqual(read.ok ? 'accepted' : read.error.path, [])
})

test('copies own enumerable string keys alone, as JSON.stringify does', () => {
  const keyed = Object.defineProperty({ own: 2, [Symbol('symbol')]: 4 }, 'hidden', { enumerable: false, value: 3 })
  const result = readAdfDocument(documentOf(keyed))
  assert.ok(result.ok)
  assert.deepEqual(result.value.content?.[0]?.attrs, { own: 2 })
  assert.equal(readable({ content: [Object.create({ type: 'rule' })], type: 'doc', version: 1 }), false)
  const proxied = new Proxy({ b: 1 }, { getOwnPropertyDescriptor: () => undefined })
  const dropped = readAdfDocument(documentOf(proxied))
  assert.ok(dropped.ok)
  assert.deepEqual(dropped.value.content?.[0]?.attrs, {})
})

test('copies the keys of an object in the order the original holds them', () => {
  const result = readAdfDocument(documentOf({ b: 1, a: 2, c: { z: 1, y: 2 } }))
  assert.ok(result.ok)
  const attrs = result.value.content?.[0]?.attrs
  assert.equal(JSON.stringify(attrs), '{"b":1,"a":2,"c":{"z":1,"y":2}}')
})

test('copies a key named __proto__ as a key, leaving the copy a plain object', () => {
  const result = readAdfDocument(documentOf(JSON.parse('{"__proto__":{"polluted":1}}')))
  assert.ok(result.ok)
  const attrs = result.value.content?.[0]?.attrs
  assert.deepEqual(Object.keys(attrs ?? {}), ['__proto__'])
  assert.equal(Object.getPrototypeOf(attrs), Object.prototype)
  assert.equal(Reflect.get(attrs ?? {}, 'polluted'), undefined)
  assert.deepEqual(Object.getOwnPropertyDescriptor(attrs ?? {}, '__proto__'), { configurable: true, enumerable: true, value: { polluted: 1 }, writable: true })
})

test('reads an array by index, so no iterator runs and a hole is no JSON value', () => {
  const iterated = Object.assign([1, 2], { [Symbol.iterator]: () => { throw new Error('iterated') } })
  const result = readAdfDocument(documentOf({ a: iterated }))
  assert.ok(result.ok)
  assert.deepEqual(result.value.content?.[0]?.attrs, { a: [1, 2] })
  assert.equal(readable(documentOf({ a: [1, , 3] })), false)
})

const claimed = ['at most 10000000 JSON values']
const claiming = (length: unknown): object => new Proxy([], {
  get: (target, key) => (key === 'length' ? length : Reflect.get(target, key)),
  getOwnPropertyDescriptor: () => { throw new Error('trap') },
})

test('refuses an array claiming more elements than the values left, before it reads any', () => {
  refused(readAdfDocument({ content: claiming(2 ** 32 - 1), type: 'doc', version: 1 }), 'unsupported-node-shape', ...claimed)
  refused(readAdfDocument({ content: new Array(10_000_000 - 1), type: 'doc', version: 1 }), 'unsupported-node-shape', ...claimed)
})

test('reads an array of the most values the document may hold, and refuses one value more', () => {
  refused(readAdfDocument({ content: claiming(10_000_000 - 4), type: 'doc', version: 1 }), 'not-an-adf-document', ...unreadable)
  refused(readAdfDocument({ content: claiming(10_000_000 - 3), type: 'doc', version: 1 }), 'unsupported-node-shape', ...claimed)
})

test('refuses an array whose length is no count', () => {
  const badLength = ['plain data', "an array's length is not a count"]
  refused(readAdfDocument({ content: claiming('many'), type: 'doc', version: 1 }), 'not-an-adf-document', ...badLength)
  refused(readAdfDocument({ content: claiming(-1), type: 'doc', version: 1 }), 'not-an-adf-document', ...badLength)
  refused(readAdfDocument({ content: claiming(1.5), type: 'doc', version: 1 }), 'not-an-adf-document', ...badLength)
})

const hostile: [string, AdfDocument][] = [
  ['a getter', { get content() { return [] }, type: 'doc', version: 1 }],
  ['a throwing Proxy', { content: [new Proxy({ type: 'rule' }, { ownKeys: () => { throw new Error('trap') } })], type: 'doc', version: 1 }],
]

for (const write of writers) {
  for (const [name, document] of hostile) {
    test(`${write.name} refuses a document holding ${name}`, () => {
      const result = write(document)
      assert.ok(!result.ok)
      assert.equal(result.error.code, 'not-an-adf-document')
    })
  }
}

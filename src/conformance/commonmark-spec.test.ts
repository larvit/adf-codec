import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import type { AdfDocument, AdfNode } from '../adf/document.ts'
import { adfToMarkdown } from '../markdown/emit/adf-to-markdown.ts'
import { markdownToAdf } from '../markdown/parse/markdown-to-adf.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'corpus', 'commonmark-spec')
const checks = ['count', 'fixpoint', 'text'] as const

type Check = (typeof checks)[number]
type ExceptionKind = 'mark-model' | 'pending'

type SpecExample = { example: number; html: string; markdown: string; section: string }

type Exception = { check: Check; divergence: string; example: number; kind: ExceptionKind; reason: string }

type Refusal = { code: string; example: number }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCheck(value: unknown): value is Check {
  return checks.some((check) => check === value)
}

function isKind(value: unknown): value is ExceptionKind {
  return value === 'mark-model' || value === 'pending'
}

function isSpecExample(value: unknown): value is SpecExample {
  if (!isRecord(value)) return false
  return typeof value['example'] === 'number' && typeof value['html'] === 'string' && typeof value['markdown'] === 'string' && typeof value['section'] === 'string'
}

function isException(value: unknown): value is Exception {
  if (!isRecord(value)) return false
  return (
    isCheck(value['check']) &&
    typeof value['divergence'] === 'string' &&
    value['divergence'].length > 0 &&
    typeof value['example'] === 'number' &&
    isKind(value['kind']) &&
    typeof value['reason'] === 'string' &&
    value['reason'].length > 0
  )
}

function isRefusal(value: unknown): value is Refusal {
  if (!isRecord(value)) return false
  return typeof value['code'] === 'string' && value['code'].length > 0 && typeof value['example'] === 'number'
}

function readJson<T>(name: string, guard: (value: unknown) => value is T, shape: string): T[] {
  const parsed: unknown = JSON.parse(readFileSync(join(root, name), 'utf8'))
  assert.ok(Array.isArray(parsed), `${name} is not an array`)
  return parsed.map((value, index) => {
    assert.ok(guard(value), `${name} holds a ${shape} with the wrong shape at ${index}`)
    return value
  })
}

const spec = readJson('spec.json', isSpecExample, 'spec example')
const exceptions = readJson('exceptions.json', isException, 'exception')
const refusals = readJson('refusals.json', isRefusal, 'refusal')

const exampleToRefusal = new Map(refusals.map((refusal) => [refusal.example, refusal.code]))
const exceptionIndex = new Map(exceptions.map((entry) => [`${entry.example}:${entry.check}`, entry]))

test('the CommonMark spec suite is 0.31.2, vendored byte-exact', () => {
  const digest = createHash('sha256').update(readFileSync(join(root, 'spec.json'))).digest('hex')
  assert.equal(digest, 'd431b29d97b6f73e69d547109cf5081578fac931e72afe95639ebe766c1b2a20')
})

test('every exception is unique, names a parsing example, and files no fixpoint divergence', () => {
  assert.equal(exceptionIndex.size, exceptions.length, 'one exception repeats an example and check another holds')
  for (const entry of exceptions) {
    assert.ok(spec.some((candidate) => candidate.example === entry.example), `exception ${entry.example} names no example in the suite`)
    assert.equal(exampleToRefusal.get(entry.example), undefined, `exception ${entry.example} is on the refusal list, not an exception`)
    assert.notEqual(entry.check, 'fixpoint', `exception ${entry.example} files a fixpoint divergence; the emitter spells every document the parser builds`)
  }
})

test('the refusal list is unique per example and names real examples', () => {
  assert.equal(exampleToRefusal.size, refusals.length, 'one refusal repeats an example another holds')
  for (const example of exampleToRefusal.keys()) assert.ok(spec.some((entry) => entry.example === example), `refusal ${example} names no example in the suite`)
})

// A mark is counted once per text node it touches (docs/decisions.md §No schema validation).
const countKeys = ['a', 'blockquote', 'br', 'code', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img', 'li', 'ol', 'pre', 'strong', 'ul']
const nodeElement: Record<string, string> = {
  blockquote: 'blockquote',
  bulletList: 'ul',
  codeBlock: 'pre',
  hardBreak: 'br',
  listItem: 'li',
  media: 'img',
  mediaInline: 'img',
  orderedList: 'ol',
  rule: 'hr',
}
const markElement: Record<string, string> = { code: 'code', em: 'em', link: 'a', strong: 'strong' }
const blockTags = new Set(['blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p', 'pre', 'ul'])

function tagName(tag: string): string {
  return tag.slice(1).replace(/^\//, '').split(/[\s/>]/)[0] ?? ''
}

function emptyCounts(): Record<string, number> {
  return Object.fromEntries(countKeys.map((key) => [key, 0]))
}

function referenceCounts(html: string): Record<string, number> {
  const counts = emptyCounts()
  let inPre = false
  for (let index = 0; index < html.length; index += 1) {
    if (html[index] !== '<') continue
    const close = html.indexOf('>', index)
    if (close === -1) break
    const tag = html.slice(index, close + 1)
    if (tag.startsWith('</')) {
      if (tagName(tag) === 'pre') inPre = false
      index = close
      continue
    }
    const name = tagName(tag)
    if (name === 'pre') {
      inPre = true
      counts['pre'] = (counts['pre'] ?? 0) + 1
    } else if (name === 'code' && inPre) {
      // A code block's `<code>` is the `<pre>`'s body, already counted.
    } else if (countKeys.includes(name)) {
      counts[name] = (counts[name] ?? 0) + 1
    }
    index = close
  }
  return counts
}

function nodeCounts(document: AdfNode): Record<string, number> {
  const counts = emptyCounts()
  const pending: AdfNode[] = [document]
  while (pending.length > 0) {
    const node = pending.pop()
    if (node === undefined) continue
    if (node.text !== undefined) {
      const seen = new Set<string>()
      for (const mark of node.marks ?? []) {
        const element = markElement[mark.type]
        if (element !== undefined) seen.add(element)
      }
      for (const element of seen) counts[element] = (counts[element] ?? 0) + 1
      continue
    }
    if (node.type === 'heading') {
      const level = node.attrs?.['level']
      if (typeof level === 'number') counts[`h${level}`] = (counts[`h${level}`] ?? 0) + 1
      pending.push(...(node.content ?? []))
      continue
    }
    const element = nodeElement[node.type]
    if (element !== undefined) counts[element] = (counts[element] ?? 0) + 1
    pending.push(...(node.content ?? []))
  }
  return counts
}

const namedEntity: Record<string, string> = { amp: '&', gt: '>', lt: '<', ouml: 'ö', quot: '"' }

function decodeHtmlEntity(text: string, index: number): { length: number; text: string } | undefined {
  if (text[index] !== '&') return undefined
  const end = text.indexOf(';', index)
  if (end === -1 || end - index > 8) return undefined
  const reference = text.slice(index, end + 1)
  const named = namedEntity[reference.slice(1, -1)]
  return named === undefined ? undefined : { length: reference.length, text: named }
}

test('the oracle decodes every entity the reference HTML holds', () => {
  for (const example of spec) {
    for (const [reference] of example.html.matchAll(/&#?[0-9A-Za-z]+;/g)) {
      assert.ok(decodeHtmlEntity(reference, 0) !== undefined, `example ${example.example} holds ${reference}, which the oracle would leave literal`)
    }
  }
})

function referenceText(html: string): string {
  const parts: string[] = []
  let preDepth = 0
  let atBoundary = true
  let skipNewline = false
  for (let index = 0; index < html.length; index += 1) {
    const character = html.charAt(index)
    if (character === '<') {
      const close = html.indexOf('>', index)
      if (close === -1) break
      const tag = html.slice(index, close + 1)
      const name = tagName(tag)
      if (name === 'br') {
        parts.push(' ')
        atBoundary = false
        skipNewline = true
        index = close
        continue
      }
      if (name === 'pre') {
        if (tag.startsWith('</')) {
          preDepth -= 1
          trimTrailingNewline(parts)
        } else {
          preDepth += 1
        }
        atBoundary = true
      } else {
        atBoundary = blockTags.has(name)
      }
      index = close
      continue
    }
    if (character === '\n') {
      if (skipNewline) {
        skipNewline = false
        continue
      }
      if (preDepth > 0) {
        parts.push('\n')
        continue
      }
      if (!atBoundary && !followedByBlock(html, index + 1)) parts.push(' ')
      continue
    }
    const reference = decodeHtmlEntity(html, index)
    if (reference !== undefined) {
      parts.push(reference.text)
      atBoundary = false
      index += reference.length - 1
      continue
    }
    parts.push(character)
    atBoundary = false
  }
  return parts.join('')
}

function trimTrailingNewline(parts: string[]): void {
  const last = parts[parts.length - 1]
  if (last === undefined) return
  parts[parts.length - 1] = last.endsWith('\n') ? last.slice(0, -1) : last
}

// A newline beside a block open or close is a boundary rather than a soft break, so it spells no space.
function followedByBlock(html: string, index: number): boolean {
  let next = index
  while (next < html.length && (html[next] === '\n' || html[next] === ' ' || html[next] === '\t')) next += 1
  if (next >= html.length) return true
  if (html[next] !== '<') return false
  const close = html.indexOf('>', next)
  return close !== -1 && blockTags.has(tagName(html.slice(next, close + 1)))
}

function concatenatedText(document: AdfNode): string {
  const parts: string[] = []
  const pending: { inCode: boolean; node: AdfNode }[] = [{ inCode: false, node: document }]
  while (pending.length > 0) {
    const frame = pending.pop()
    if (frame === undefined) continue
    const { inCode, node } = frame
    if (node.text !== undefined) {
      parts.push(inCode ? node.text : node.text.replace(/\n/g, ' '))
      continue
    }
    if (node.type === 'hardBreak') {
      parts.push(' ')
      continue
    }
    const childInCode = inCode || node.type === 'codeBlock'
    const content = node.content ?? []
    for (let index = content.length - 1; index >= 0; index -= 1) {
      const child = content[index]
      if (child !== undefined) pending.push({ inCode: childInCode, node: child })
    }
  }
  return parts.join('')
}

function fixpointRefused(example: SpecExample, document: AdfDocument): string | undefined {
  const emitted = adfToMarkdown(document)
  if (!emitted.ok) return emitted.error.code
  const again = markdownToAdf(emitted.value)
  assert.ok(again.ok, `example ${example.example} emits markdown it cannot read back`)
  assert.deepEqual(again.value, document, `example ${example.example} does not hold its own round-trip`)
  return undefined
}

function textMismatch(example: SpecExample, document: AdfDocument): string | undefined {
  const expected = referenceText(example.html)
  const actual = concatenatedText(document)
  return expected === actual ? undefined : `${JSON.stringify(expected)} against ${JSON.stringify(actual)}`
}

function countMismatch(example: SpecExample, document: AdfDocument): string | undefined {
  const expected = referenceCounts(example.html)
  const actual = nodeCounts(document)
  const names = countKeys.filter((key) => expected[key] !== actual[key])
  return names.length === 0 ? undefined : names.map((name) => `${name} ${expected[name]}/${actual[name]}`).join(' ')
}

for (const example of spec) {
  test(`CommonMark example ${example.example} => ${example.section}`, () => {
    const parse = markdownToAdf(example.markdown)
    const refused = exampleToRefusal.get(example.example)
    if (refused !== undefined) {
      assert.ok(!parse.ok, `example ${example.example} was expected to refuse with ${refused} but parsed`)
      assert.equal(parse.error.code, refused, `example ${example.example} refused with a different code`)
      return
    }
    if (!parse.ok) assert.fail(`example ${example.example} was expected to parse but refused with ${parse.error.code}`)

    const divergences: Record<Check, string | undefined> = {
      count: countMismatch(example, parse.value),
      fixpoint: fixpointRefused(example, parse.value),
      text: textMismatch(example, parse.value),
    }
    for (const check of checks) {
      const entry = exceptionIndex.get(`${example.example}:${check}`)
      const divergence = divergences[check]
      if (divergence === undefined) {
        assert.equal(entry, undefined, `example ${example.example} passes its ${check} check but files an exception`)
      } else {
        assert.ok(entry !== undefined, `example ${example.example} ${check} check fails: ${divergence}`)
        assert.equal(entry.divergence, divergence, `example ${example.example} ${check} diverged differently than filed`)
      }
    }
  })
}

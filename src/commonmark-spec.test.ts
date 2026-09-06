import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import type { AdfNode } from './adf/document.ts'
import { readEntityReference } from './markdown/entity-references.ts'
import { adfToMarkdown } from './markdown/emit/adf-to-markdown.ts'
import { markdownToAdf } from './markdown/parse/markdown-to-adf.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'corpus', 'commonmark-spec')

type Check = 'count' | 'fixpoint' | 'text'

type SpecExample = { example: number; html: string; markdown: string; section: string }

type Exception = { check: Check; example: number; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isCheck(value: unknown): value is Check {
  return value === 'count' || value === 'fixpoint' || value === 'text'
}

function isSpecExample(value: unknown): value is SpecExample {
  if (!isRecord(value)) return false
  return typeof value['example'] === 'number' && typeof value['html'] === 'string' && typeof value['markdown'] === 'string' && typeof value['section'] === 'string'
}

function isException(value: unknown): value is Exception {
  return isRecord(value) && isCheck(value['check']) && typeof value['example'] === 'number' && typeof value['reason'] === 'string'
}

function readSpec(): SpecExample[] {
  const parsed: unknown = JSON.parse(readFileSync(join(root, 'spec.json'), 'utf8'))
  assert.ok(Array.isArray(parsed), 'spec.json is not an array of examples')
  return parsed.map((value) => {
    assert.ok(isSpecExample(value), 'spec.json holds an example with the wrong shape')
    return value
  })
}

function readExceptions(): Exception[] {
  const parsed: unknown = JSON.parse(readFileSync(join(root, 'exceptions.json'), 'utf8'))
  assert.ok(Array.isArray(parsed), 'exceptions.json is not an array')
  return parsed.map((value, index) => {
    assert.ok(isException(value), `exception ${index} is not an exception`)
    return value
  })
}

const spec = readSpec()
const exceptions = readExceptions()
const exceptionIndex = new Map(exceptions.map((entry) => [`${entry.example}:${entry.check}`, entry.reason]))

test('the CommonMark spec suite is the pinned 0.31.2 run', () => {
  assert.equal(spec.length, 652)
})

test('the exception list is unique per example and check', () => {
  assert.equal(exceptionIndex.size, exceptions.length, 'one exception repeats an example and check another holds')
})

// A mark is counted once per text node it touches: 3e's collapse makes `*(*a*)*` one `em` against two `<em>`.
const countKeys = ['a', 'blockquote', 'br', 'code', 'em', 'heading', 'hr', 'img', 'li', 'ol', 'pre', 'strong', 'ul']
const nodeElement: Record<string, string> = {
  blockquote: 'blockquote',
  bulletList: 'ul',
  codeBlock: 'pre',
  hardBreak: 'br',
  heading: 'heading',
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
    } else if (/^h[1-6]$/.test(name)) {
      counts['heading'] = (counts['heading'] ?? 0) + 1
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
    const element = nodeElement[node.type]
    if (element !== undefined) counts[element] = (counts[element] ?? 0) + 1
    pending.push(...(node.content ?? []))
  }
  return counts
}

function referenceText(html: string): string {
  let out = ''
  let preDepth = 0
  let skipNewline = false
  for (let index = 0; index < html.length; index += 1) {
    const character = html[index]
    if (character === '<') {
      const close = html.indexOf('>', index)
      if (close === -1) break
      const tag = html.slice(index, close + 1)
      const name = tagName(tag)
      if (name === 'br') {
        out += '\n'
        skipNewline = true
        index = close
        continue
      }
      if (name === 'pre') {
        if (tag.startsWith('</')) {
          preDepth -= 1
          out = out.replace(/\n$/, '')
        } else {
          preDepth += 1
        }
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
        out += '\n'
        continue
      }
      let next = index + 1
      while (next < html.length && (html[next] === '\n' || html[next] === ' ' || html[next] === '\t')) next += 1
      if (next >= html.length) continue
      if (html[next] === '<') {
        const close = html.indexOf('>', next)
        if (close === -1) continue
        if (!blockTags.has(tagName(html.slice(next, close + 1)))) out += ' '
      } else {
        out += ' '
      }
      continue
    }
    skipNewline = false
    const reference = readEntityReference(html, index)
    if (reference !== undefined) {
      out += reference.text
      index += reference.length - 1
      continue
    }
    out += character
  }
  return out
}

function concatenatedText(document: AdfNode): string {
  const parts: string[] = []
  const pending: AdfNode[] = [document]
  while (pending.length > 0) {
    const node = pending.pop()
    if (node === undefined) continue
    if (node.text !== undefined) {
      parts.push(node.text)
      continue
    }
    if (node.type === 'hardBreak') {
      parts.push('\n')
      continue
    }
    const content = node.content ?? []
    for (let index = content.length - 1; index >= 0; index -= 1) {
      const child = content[index]
      if (child !== undefined) pending.push(child)
    }
  }
  return parts.join('')
}

function fixpointRefused(example: SpecExample): string | undefined {
  const parsed = markdownToAdf(example.markdown)
  assert.ok(parsed.ok, `example ${example.example} parsed to no document, not an error`)
  const emitted = adfToMarkdown(parsed.value)
  if (!emitted.ok) return emitted.error.code
  const again = markdownToAdf(emitted.value)
  assert.ok(again.ok, `example ${example.example} emits markdown it cannot read back`)
  assert.deepStrictEqual(again.value, parsed.value, `example ${example.example} does not hold its own round-trip`)
  return undefined
}

function textMismatch(example: SpecExample): string | undefined {
  const parsed = markdownToAdf(example.markdown)
  assert.ok(parsed.ok)
  const expected = referenceText(example.html)
  const actual = concatenatedText(parsed.value)
  return expected === actual ? undefined : `${JSON.stringify(expected)} against ${JSON.stringify(actual)}`
}

function countMismatch(example: SpecExample): string | undefined {
  const parsed = markdownToAdf(example.markdown)
  assert.ok(parsed.ok)
  const expected = referenceCounts(example.html)
  const actual = nodeCounts(parsed.value)
  const names = countKeys.filter((key) => expected[key] !== actual[key])
  return names.length === 0 ? undefined : names.map((name) => `${name} ${expected[name]}/${actual[name]}`).join(' ')
}

for (const example of spec) {
  test(`CommonMark example ${example.example} => ${example.section}`, () => {
    const parse = markdownToAdf(example.markdown)
    if (!parse.ok) {
      assert.equal(exceptionIndex.get(`${example.example}:fixpoint`), undefined, `example ${example.example} is a named error but files a fixpoint exception`)
      return
    }

    const failures: Record<Check, string | undefined> = {
      fixpoint: fixpointRefused(example),
      text: textMismatch(example),
      count: countMismatch(example),
    }

    for (const check of ['fixpoint', 'text', 'count'] as const) {
      const filed = exceptionIndex.get(`${example.example}:${check}`)
      const result = failures[check]
      if (result === undefined) {
        assert.equal(filed, undefined, `example ${example.example} passes its ${check} check but files an exception`)
      } else {
        assert.equal(typeof filed, 'string', `example ${example.example} ${check} check fails: ${result}`)
      }
    }
  })
}

for (const entry of exceptions) {
  test(`exception ${entry.example} ${entry.check} still diverges`, () => {
    const example = spec.find((candidate) => candidate.example === entry.example)
    assert.ok(example !== undefined, `exception ${entry.example} names no example in the suite`)
    const failure = entry.check === 'fixpoint' ? fixpointRefused(example) : entry.check === 'text' ? textMismatch(example) : countMismatch(example)
    assert.equal(typeof failure, 'string', `exception ${entry.example} ${entry.check} no longer diverges: ${entry.reason}`)
  })
}

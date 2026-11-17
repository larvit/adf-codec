import assert from 'node:assert/strict'
import fc from 'fast-check'
import test from 'node:test'

import { adfDocument, propertyRuns, propertyTimeout } from './property-harness.ts'
import { adfToLosslessJiraWiki } from '../wiki/emit/adf-to-jira-wiki.ts'
import { jiraWikiToAdf } from '../wiki/parse/jira-wiki-to-adf.ts'

const gateRuns = 1600
const refusalCodes = ['engine-limit', 'unsupported-nesting-depth', 'unsupported-node-shape']
const wikiPieces = fc.constantFrom('\n', '\n\n', '\r', ' ', '!', '!http://a.b/c!', '# ', '(y)', '* ', '*', '**', '--', '----', ':)', '??', '[', '[a|#b]', '\\', '\\\\', ']', '^', '_', 'bq. ', 'h1. ', 'http://a.b', '{adf:display=inline}', '{adf}', '{anchor}', '{code}', '{color:red}', '{color}', '{noformat}', '{panel:title=a}', '{panel}', '{quote}', '{{', '|', '||', '}}', '~')

function assertReadsBack(wiki: string): void {
  const read = jiraWikiToAdf(wiki)
  if (!read.ok) {
    assert.ok(refusalCodes.includes(read.error.code), `${read.error.code} — reading ${JSON.stringify(wiki)}`)
    return
  }
  const written = adfToLosslessJiraWiki(read.value)
  assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message} — reading ${JSON.stringify(wiki)}`)
  const again = jiraWikiToAdf(written.value)
  assert.ok(again.ok, again.ok ? '' : `${again.error.code}: ${again.error.message} — reading ${JSON.stringify(written.value)}`)
  assert.deepEqual(again.value, read.value, `reading ${JSON.stringify(wiki)}, written ${JSON.stringify(written.value)}`)
}

test('a generated document writes Jira wiki markup that reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(adfDocument, (document) => {
      const written = adfToLosslessJiraWiki(document)
      assert.ok(written.ok, written.ok ? '' : `${written.error.code}: ${written.error.message}`)
      const read = jiraWikiToAdf(written.value)
      assert.ok(read.ok, read.ok ? '' : `${read.error.code}: ${read.error.message} — reading ${JSON.stringify(written.value)}`)
      assert.deepEqual(read.value, document, `reading ${JSON.stringify(written.value)}`)
    }),
    propertyRuns(gateRuns),
  )
})

test('Jira wiki markup edited anywhere reads, if at all, to a document whose markup reads back to it', { timeout: propertyTimeout }, () => {
  const edits = fc.array(fc.tuple(fc.nat(), fc.nat({ max: 3 }), wikiPieces), { maxLength: 4, minLength: 1 })
  fc.assert(
    fc.property(adfDocument, edits, (document, cuts) => {
      const written = adfToLosslessJiraWiki(document)
      assert.ok(written.ok)
      let wiki = written.value
      for (const [at, removed, piece] of cuts) wiki = `${wiki.slice(0, at % (wiki.length + 1))}${piece}${wiki.slice((at % (wiki.length + 1)) + removed)}`
      assertReadsBack(wiki)
    }),
    propertyRuns(gateRuns),
  )
})

test('markup of wiki pieces alone reads, if at all, to a document whose markup reads back to it', { timeout: propertyTimeout }, () => {
  fc.assert(
    fc.property(fc.array(fc.oneof(wikiPieces, fc.constantFrom('a', 'b c', '1')), { maxLength: 24 }), (pieces) => {
      assertReadsBack(pieces.join(''))
    }),
    propertyRuns(gateRuns),
  )
})

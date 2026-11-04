import assert from 'node:assert/strict'
import { test } from 'node:test'

import { jiraUrl, wikiUrl } from './source-urls.mjs'

const base = 'https://site.atlassian.net'

test('links a Jira issue, and a comment on it', () => {
  assert.equal(jiraUrl(base, 'KEY-1'), 'https://site.atlassian.net/browse/KEY-1')
  assert.equal(jiraUrl(base, 'KEY-1', '42'), 'https://site.atlassian.net/browse/KEY-1?focusedCommentId=42')
})

test('links a wiki page without the title its web link holds', () => {
  assert.equal(wikiUrl(base, '/spaces/AK/pages/13/Secret+Title'), 'https://site.atlassian.net/wiki/spaces/AK/pages/13')
})

test('links a wiki comment without the title of its page', () => {
  assert.equal(wikiUrl(base, '/spaces/AK/pages/13/Secret+Title?focusedCommentId=42'), 'https://site.atlassian.net/wiki/spaces/AK/pages/13?focusedCommentId=42')
})

test('links a comment on a blog post without its title', () => {
  assert.equal(wikiUrl(base, '/spaces/AK/blog/2020/01/02/13/Secret+Title?focusedCommentId=42'), 'https://site.atlassian.net/wiki/spaces/AK/blog/2020/01/02/13?focusedCommentId=42')
})

test('wikiUrl drops a preview, which names an attached file', () => {
  assert.equal(wikiUrl(base, '/spaces/AK/blog/2020/01/02/13/Secret+Title?preview=%2F13%2F14%2FSecret.jpeg'), `${base}/wiki/spaces/AK/blog/2020/01/02/13`)
  assert.equal(wikiUrl(base, '/spaces/AK/overview?preview=%2F13%2F14%2FSecret.jpeg&focusedCommentId=42'), `${base}/wiki/spaces/AK/overview?focusedCommentId=42`)
})

test('wikiUrl keeps a space overview, which holds no title', () => {
  assert.equal(wikiUrl(base, '/spaces/AK/overview'), `${base}/wiki/spaces/AK/overview`)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { linkedAddress } from './spellings.ts'

const schemesAfterColon = ['callto', 'cvs', 'facetime', 'feed', 'git', 'irc', 'irc6', 'itms', 'magnet', 'mailto', 'mvn', 'news', 'nntp', 'notes', 'rdp', 'sip', 'sips', 'skype', 'slack', 'ssh', 'svn', 'tel', 'telnet', 'urn', 'vnc', 'whatsapp', 'xmpp']
const schemesAfterSlashesOnly = ['file', 'ftp', 'ftps', 'gopher', 'hipchat', 'http', 'https', 'sftp', 'smb']
const schemesJiraShowsAsText = ['about', 'afp', 'blob', 'cid', 'data', 'fax', 'geo', 'imap', 'ircs', 'javascript', 'ldap', 'maps', 'nfs', 'rtsp', 'sms', 'steam', 'vscode', 'webcal', 'ws', 'wss']

for (const scheme of schemesAfterColon) {
  test(`links ${scheme}: and ${scheme}:// before something`, () => {
    assert.equal(linkedAddress(`${scheme}:x`), true)
    assert.equal(linkedAddress(`${scheme}://x`), true)
  })
}

for (const scheme of schemesAfterSlashesOnly) {
  test(`links ${scheme}:// but not ${scheme}: before something`, () => {
    assert.equal(linkedAddress(`${scheme}://x`), true)
    assert.equal(linkedAddress(`${scheme}:x`), false)
  })
}

for (const scheme of schemesJiraShowsAsText) {
  test(`shows ${scheme}:x and ${scheme}://x as text`, () => {
    assert.equal(linkedAddress(`${scheme}:x`), false)
    assert.equal(linkedAddress(`${scheme}://x`), false)
  })
}

const linked = ['HTTP://x', 'Mailto:a@b.c', 'TEL:+1', 'http://#', 'http:///', 'file:///x', 'mailto:/', 'mailto:?subject=a%20b', 'mailto:a#b', 'tel:+1#a', 'ssh:a#', '/', '/p', '/p?q=1&r=2#f', '//host/p', '///x', '#', '#anchor', '#a/b', '/a%20b', '/a^', '#a^', 'http://x/a%41', "/a!$&'()*+,;=:@-._~"]

for (const address of linked) {
  test(`links ${address}`, () => {
    assert.equal(linkedAddress(address), true)
  })
}

const text = ['', 'word', 'x.com', 'www.x.com', 'a@b.c', 'foo/bar', '../p', './p', '?q', 'x#y', '~user', '^att.png', 'SCRUM-1', 'a:b', '1:2', 'x:', ':mailto:x', 'sshx', 'telx', 'x://y', 's3://b/k', 'git+ssh://h/p', 'mailto:', 'tel:', 'http:', 'http://', 'mailto://', 'tel://', 'ssh://', 'mailto:#', 'mailto:#a', 'ssh:#', '//', '/#a#b', '#a#b', '/a##', 'http://x/a#b#c', '/%', '/a%', '/a%2', '/a%zz', '#%2g', 'http://x/a%41%', '/^x', '/a^b', '#a^^', 'http://x/^y', 'mailto:a^b', 'a b', '/a b', 'http://x y', 'a|b', '[x', 'a\\b', 'a{b', 'a}b']

for (const address of text) {
  test(`shows ${JSON.stringify(address)} as text`, () => {
    assert.equal(linkedAddress(address), false)
  })
}

// spec/wiki.md, Blocks: the names Atlassian's text formatting notation help lists for `{code}`.
export const codeLanguages: readonly string[] = [
	'actionscript',
	'ada',
	'applescript',
	'bash',
	'c',
	'c#',
	'c++',
	'css',
	'erlang',
	'go',
	'groovy',
	'haskell',
	'html',
	'java',
	'javascript',
	'json',
	'lua',
	'nyan',
	'objc',
	'perl',
	'php',
	'python',
	'r',
	'ruby',
	'scala',
	'sql',
	'swift',
	'visualbasic',
	'xml',
	'yaml',
]

// spec/wiki.md, Blocks: the `bgColor` Jira writes for each panel type it reads back.
export const panelColours: Readonly<Record<string, string>> = {
	error: '#ffebe6',
	info: '#deebff',
	note: '#eae6ff',
	success: '#e3fcef',
	warning: '#fffae6',
}

// spec/wiki.md, Blocks: what an image's alt and address spell. Jira reads an address holding no `://` as an attachment's name.
export const spellableAlt = /^[^\s!|,\\[\]{}](?:[^!|,\\[\]{}\r\n]*[^\s!|,\\[\]{}])?$/
export const spellableImageUrl = /^[^\s!|\\[\]{}]*:\/\/[^\s!|\\[\]{}]*$/

// spec/wiki.md, Marks: what `{color}` and a link's href and title spell.
export const spellableColour = /^#[0-9a-f]{6}$/i

export const spellableTitle = /^[^\s[\]{}|\\](?:[^[\]{}|\\\r\n]*[^\s[\]{}|\\])?$/

export const spellableUrl = /^[^\s[\]{}|\\]+$/

// spec/wiki.md, Marks: the schemes Jira links before `:` or `://` and a rest.
const schemesAfterColon: ReadonlySet<string> = new Set([
	'callto', 'cvs', 'facetime', 'feed', 'git', 'irc', 'irc6', 'itms', 'magnet', 'mailto', 'mvn', 'news', 'nntp', 'notes', 'rdp', 'sip', 'sips', 'skype', 'slack', 'ssh', 'svn', 'tel', 'telnet', 'urn', 'vnc', 'whatsapp', 'xmpp',
])
// spec/wiki.md, Marks: those schemes, and the ones Jira links only before `://` and a rest.
const schemesAfterSlashes: ReadonlySet<string> = new Set(['file', 'ftp', 'ftps', 'gopher', 'hipchat', 'http', 'https', 'sftp', 'smb', ...schemesAfterColon])

// spec/wiki.md, Marks: Jira shows an address with a second `#`, or a `%` not followed by two hex digits, as text, bare or bracketed.
export function wellFormedAddress(address: string): boolean {
	return wellFormedFrom(address) === 0
}

// The first index from which the rest of `address` is well formed: a suffix of a well-formed address is well formed.
export function wellFormedFrom(address: string): number {
	let from = 0
	for (const bad of address.matchAll(/%(?![0-9a-f]{2})/gi)) from = bad.index + 1
	const lastHash = address.lastIndexOf('#')
	return Math.max(from, lastHash > 0 ? address.lastIndexOf('#', lastHash - 1) + 1 : 0)
}

// spec/wiki.md, Marks: the addresses the reader takes as a link in `[<address>]` and `[<text>|<address>]`, and the writer too where `storedHref` leaves one as it is.
export function linkedAddress(address: string): boolean {
	const pathOrAnchor = address.startsWith('/') || address.startsWith('#')
	const attachmentEmbed = pathOrAnchor ? /\^[^:]+$/ : /\^./
	if (!spellableUrl.test(address) || !wellFormedAddress(address) || attachmentEmbed.test(address)) return false
	if (pathOrAnchor) return address !== '//'
	const colon = address.indexOf(':')
	if (colon === -1) return false
	const lowered = address.slice(0, colon).toLowerCase()
	const rest = address.slice(colon + 1)
	if (rest.startsWith('//')) return rest.length > 2 && schemesAfterSlashes.has(lowered)
	return schemesAfterColon.has(lowered) && rest !== '' && !rest.startsWith('#')
}

// spec/wiki.md, Marks: the `href` Jira stores for a linked address.
export function storedHref(address: string): string {
	return address.replaceAll('"', '%22').replaceAll('<', '%3C').replaceAll('>', '%3E').replaceAll('`', '%60').replaceAll('^', '%5E')
}

// spec/wiki.md, What only the reader reads: each smiley Jira reads as an emoji, with the emoji's id and shortName.
export const smileyEmoji: Readonly<Record<string, { id: string; shortName: string }>> = {
	'(!)': { id: 'atlassian-warning', shortName: ':warning:' },
	'(*)': { id: 'atlassian-yellow_star', shortName: ':yellow_star:' },
	'(*b)': { id: 'atlassian-blue_star', shortName: ':blue_star:' },
	'(*g)': { id: 'atlassian-green_star', shortName: ':green_star:' },
	'(*r)': { id: 'atlassian-red_star', shortName: ':red_star:' },
	'(*y)': { id: 'atlassian-yellow_star', shortName: ':yellow_star:' },
	'(+)': { id: 'atlassian-plus', shortName: ':plus:' },
	'(-)': { id: 'atlassian-minus', shortName: ':minus:' },
	'(/)': { id: 'atlassian-check_mark', shortName: ':check_mark:' },
	'(?)': { id: 'atlassian-question_mark', shortName: ':question:' },
	'(flag)': { id: 'atlassian-flag_on', shortName: ':flag_on:' },
	'(flagoff)': { id: 'atlassian-flag_off', shortName: ':flag_off:' },
	'(i)': { id: 'atlassian-info', shortName: ':info:' },
	'(n)': { id: '1f44e', shortName: ':thumbsdown:' },
	'(off)': { id: 'atlassian-light_bulb_off', shortName: ':light_bulb_off:' },
	'(on)': { id: 'atlassian-light_bulb_on', shortName: ':light_bulb_on:' },
	'(x)': { id: 'atlassian-cross_mark', shortName: ':cross_mark:' },
	'(y)': { id: '1f44d', shortName: ':thumbsup:' },
	':(': { id: '1f61e', shortName: ':disappointed:' },
	':)': { id: '1f642', shortName: ':slight_smile:' },
	':D': { id: '1f603', shortName: ':smiley:' },
	':P': { id: '1f61b', shortName: ':stuck_out_tongue:' },
	';)': { id: '1f609', shortName: ':wink:' },
}

export const smileys: readonly string[] = Object.keys(smileyEmoji)

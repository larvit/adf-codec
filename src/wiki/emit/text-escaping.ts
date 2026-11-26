import { smileys } from '../spellings.ts'

// What stands beside a character: a node's edge inside a line may meet a delimiter, so it counts as punctuation.
type Side = 'punctuation' | 'space' | 'word'

const alwaysEscaped = '[]{}|'
const delimiters = '*+-^_~'
const lineStartMarkers = '#*-'
const lineStartWords = /^(?:bq|h[1-6])\./i
const smileyCharacters = smileys.map((smiley) => ({ characters: Array.from(smiley), parenthesised: /[()]/.test(smiley) }))
export const noformat = '{noformat}'
const unprotectable = /[\\\r\n]|https?:\/\//i

// spec/wiki.md, Inline: `undefined` where no backslash protects the text, so it rides the carry. `inCell`: the text stands in a table cell, where an escaped `|` still ends the cell. `lossy`: spec/wiki.md, The lossy writer: the text a backslash doesn't protect is written as it stands, except for the backslash runs Jira reads as something else, which stand between `{noformat}`, as does a pipe in a cell, since an escaped one still ends the cell.
export function escapedText(text: string, lineStart: boolean, lineEnd: boolean, inCell: boolean, lossy: boolean): string | undefined {
	if (!lossy && ridesCarry(text, lineStart, lineEnd, inCell)) return undefined
	const characters = Array.from(text)
	const edges: { end: Side; start: Side } = { end: lineEnd ? 'space' : 'punctuation', start: lineStart ? 'space' : 'punctuation' }
	const stops = smileyStops(characters, edges.end, lossy)
	if (stops === undefined) return undefined
	const wrapped = lossy ? wrappedBackslashes(characters, lineEnd, inCell) : new Set<number>()
	const written = characters.map((character, index) => spelled(character, characters, index, { edges, inCell: inCell && lossy, lineStart, stops, wrapped })).join('')
	return lossy ? written.replaceAll(noformat + noformat, '') : written
}

// The backslash runs Jira reads as something else: two make a line break, and one swallows itself before an escaped character, or before the markup or break that may follow the text.
function wrappedBackslashes(characters: readonly string[], lineEnd: boolean, inCell: boolean): ReadonlySet<number> {
	const wrapped = new Set<number>()
	let start = 0
	while (start < characters.length) {
		let end = start
		while (characters[end] === '\\') end += 1
		const next = characters[end]
		const stands = next === undefined ? lineEnd && !inCell : /[\dA-Za-z:;., ]/u.test(next)
		if (end - start === 2 || !stands) {
			for (let index = start; index < end; index += 1) wrapped.add(index)
		}
		start = end + 1
	}
	return wrapped
}

type Surroundings = { edges: { end: Side; start: Side }; inCell: boolean; lineStart: boolean; stops: ReadonlySet<number>; wrapped: ReadonlySet<number> }

function spelled(character: string, characters: readonly string[], index: number, { edges, inCell, lineStart, stops, wrapped }: Surroundings): string {
	if (wrapped.has(index)) return `${wrapped.has(index - 1) ? '' : noformat}\\${wrapped.has(index + 1) ? '' : noformat}`
	if (inCell && character === '|') return `${noformat}|${noformat}`
	return stops.has(index) || escapes(character, characters, index, edges, lineStart) ? `\\${character}` : character
}

function ridesCarry(text: string, lineStart: boolean, lineEnd: boolean, inCell: boolean): boolean {
	if (unprotectable.test(text) || (inCell && text.includes('|'))) return true
	return (lineStart && (/^\s/u.test(text) || lineStartWords.test(text))) || (lineEnd && /\s$/u.test(text))
}

function escapes(character: string, characters: readonly string[], index: number, edges: { end: Side; start: Side }, lineStart: boolean): boolean {
	const previous = characters[index - 1]
	const next = characters[index + 1]
	const before = previous === undefined ? edges.start : side(previous)
	const after = next === undefined ? edges.end : side(next)
	if (alwaysEscaped.includes(character)) return true
	if (lineStart && index === 0 && lineStartMarkers.includes(character)) return true
	// A delimiter both of whose neighbours are words, or both spaces, neither opens nor closes a run.
	if (delimiters.includes(character) && !(before === after && before !== 'punctuation')) return true
	if (character === '?' && next === '?') return true
	return character === '!' && after !== 'space'
}

// A smiley reads wherever no letter or digit follows it. One the node's edge cuts reads only if the next node's spelling continues it; that opens with a delimiter, a backslash, `[` or `{`, which no smiley starting with `:` or `;` continues with, so only a cut `(` takes a backslash. Returns the indexes to put a backslash before: only a `(` or a closing `)` takes one, since Jira keeps a backslash before `:`, `;` and a letter. `undefined` where a smiley reads that no such backslash stops, unless `lossy`, which leaves it be.
function smileyStops(characters: readonly string[], end: Side, lossy: boolean): Set<number> | undefined {
	const stops = new Set<number>()
	for (const [index, character] of characters.entries()) {
		for (const { characters: spelled, parenthesised } of smileyCharacters) {
			if (spelled[0] !== character) continue
			const held = characters.slice(index, index + spelled.length)
			if (held.some((heldCharacter, offset) => heldCharacter !== spelled[offset])) continue
			const cut = held.length < spelled.length
			const next = characters[index + spelled.length]
			if (cut ? character !== '(' || end === 'space' : (next === undefined ? end : side(next)) === 'word') continue
			if (character === '(') stops.add(index)
			else if (!cut && parenthesised) stops.add(index + spelled.length - 1)
			else if (!lossy) return undefined
		}
	}
	return stops
}

function side(character: string): Side {
	if (/\s/u.test(character)) return 'space'
	return /[\p{L}\p{N}]/u.test(character) ? 'word' : 'punctuation'
}

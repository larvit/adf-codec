import { smileys } from '../spellings.ts'

// What stands beside a character: a node's edge inside a line may meet a delimiter, so it counts as punctuation.
type Side = 'punctuation' | 'space' | 'word'

const alwaysEscaped = '[]{}|'
const delimiters = '*+-^_~'
const lineStartMarkers = '#*-'
const lineStartWords = /^(?:bq|h[1-6])\./i
const smileyCharacters = smileys.map((smiley) => ({ characters: Array.from(smiley), parenthesised: /[()]/.test(smiley) }))
const unprotectable = /[\\\r\n]|https?:\/\//i

// spec/wiki.md, Inline: `undefined` where no backslash protects the text, so it rides the carry. `inCell`: the text stands in a table cell, where an escaped `|` still ends the cell.
export function escapedText(text: string, lineStart: boolean, lineEnd: boolean, inCell: boolean): string | undefined {
  if (unprotectable.test(text) || (inCell && text.includes('|'))) return undefined
  if ((lineStart && /^\s/u.test(text)) || (lineEnd && /\s$/u.test(text))) return undefined
  const characters = Array.from(text)
  if (lineStart && lineStartWords.test(text)) return undefined
  const edges: { end: Side; start: Side } = { end: lineEnd ? 'space' : 'punctuation', start: lineStart ? 'space' : 'punctuation' }
  const stops = smileyStops(characters, edges.end)
  if (stops === undefined) return undefined
  return characters.map((character, index) => (stops.has(index) || escapes(character, characters, index, edges, lineStart) ? `\\${character}` : character)).join('')
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

// A smiley reads wherever no letter or digit follows it; one the node's edge cuts may close in the next node's spelling. `undefined` where a smiley reads that no backslash stops: Jira keeps one before `:`, `;` and a letter, so only a `(` or a closing `)` takes it.
function smileyStops(characters: readonly string[], end: Side): Set<number> | undefined {
  const stops = new Set<number>()
  for (const [index, character] of characters.entries()) {
    for (const { characters: spelled, parenthesised } of smileyCharacters) {
      if (spelled[0] !== character) continue
      const held = characters.slice(index, index + spelled.length)
      if (held.some((heldCharacter, offset) => heldCharacter !== spelled[offset])) continue
      const cut = held.length < spelled.length
      const next = characters[index + spelled.length]
      if (cut ? end === 'space' : (next === undefined ? end : side(next)) === 'word') continue
      if (character === '(') stops.add(index)
      else if (!cut && parenthesised) stops.add(index + spelled.length - 1)
      else return undefined
    }
  }
  return stops
}

function side(character: string): Side {
  if (/\s/u.test(character)) return 'space'
  return /[\p{L}\p{N}]/u.test(character) ? 'word' : 'punctuation'
}

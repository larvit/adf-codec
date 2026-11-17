import { smileys } from '../spellings.ts'

// What stands beside a character: a node's edge inside a line may meet a delimiter, so it counts as punctuation.
type Side = 'punctuation' | 'space' | 'word'

const alwaysEscaped = '[]{}|'
const delimiters = '*+-^_~'
const lineStartMarkers = '#*-'
const lineStartWords = /^(?:bq|h[1-6])\./i
const smileyOpeners = '(:;'
const smileyCharacters = smileys.map((smiley) => Array.from(smiley))
const unprotectable = /[\\\r\n]|https?:\/\//i

// spec/wiki.md, Inline: `undefined` where no backslash protects the text, so it rides the carry.
export function escapedText(text: string, lineStart: boolean, lineEnd: boolean): string | undefined {
  if (unprotectable.test(text)) return undefined
  if ((lineStart && /^\s/u.test(text)) || (lineEnd && /\s$/u.test(text))) return undefined
  const characters = Array.from(text)
  const edges: { end: Side; start: Side } = { end: lineEnd ? 'space' : 'punctuation', start: lineStart ? 'space' : 'punctuation' }
  return characters.map((character, index) => (escapes(character, characters, index, edges, lineStart) ? `\\${character}` : character)).join('')
}

function escapes(character: string, characters: readonly string[], index: number, edges: { end: Side; start: Side }, lineStart: boolean): boolean {
  const previous = characters[index - 1]
  const next = characters[index + 1]
  const before = previous === undefined ? edges.start : side(previous)
  const after = next === undefined ? edges.end : side(next)
  if (alwaysEscaped.includes(character)) return true
  if (lineStart && index === 0 && (lineStartMarkers.includes(character) || lineStartWords.test(characters.join('')))) return true
  // A delimiter both of whose neighbours are words, or both spaces, neither opens nor closes a run.
  if (delimiters.includes(character) && !(before === after && before !== 'punctuation')) return true
  if (character === '?' && next === '?') return true
  if (character === '!' && after !== 'space') return true
  return smileyOpeners.includes(character) && opensSmiley(characters, index, edges.end)
}

// A smiley reads wherever no letter or digit follows it; one the node's edge cuts may close in the next node's spelling.
function opensSmiley(characters: readonly string[], index: number, end: Side): boolean {
  return smileyCharacters.some((spelled) => {
    const held = characters.slice(index, index + spelled.length)
    if (held.some((character, offset) => character !== spelled[offset])) return false
    if (held.length < spelled.length) return end !== 'space'
    const next = characters[index + spelled.length]
    return (next === undefined ? end : side(next)) !== 'word'
  })
}

function side(character: string): Side {
  if (/\s/u.test(character)) return 'space'
  return /[\p{L}\p{N}]/u.test(character) ? 'word' : 'punctuation'
}

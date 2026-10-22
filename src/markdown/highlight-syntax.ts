import { isWordCharacter } from './commonmark/emphasis-matching.ts'

export const highlightDelimiter = '=='

// ー, ｰ and the kana voicing marks sit outside the kana scripts; Script_Extensions would also take Latin combining marks.
const boundingScript = /^[゙゚ーｰﾞﾟ\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Thai}]$/u

// A delimiter is bounded outside by the code point beyond it, and flanks by the character inside it.
export function highlightFlanking(source: string, index: number): { closes: boolean; opens: boolean } {
  const end = index + highlightDelimiter.length
  const before = Array.from(source.slice(Math.max(0, index - 2), index)).at(-1) ?? ''
  const after = Array.from(source.slice(end, end + 2))[0] ?? ''
  return { closes: flanks(before) && bounds(after, before), opens: flanks(after) && bounds(before, after) }
}

function bounds(outside: string, inside: string): boolean {
  return !isWordCharacter(outside) || boundingScript.test(outside) || boundingScript.test(inside)
}

function flanks(character: string): boolean {
  return character !== '' && !/\s/.test(character)
}

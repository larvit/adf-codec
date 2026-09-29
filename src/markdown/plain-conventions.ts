import { isWordCharacter } from './commonmark/emphasis-matching.ts'

export type Flavour = 'lossless' | 'plain'

type AlertMarker = { folded: boolean; length: number; panelType: string }

export const foldedAlertMarker = '[!NOTE]-'
export const highlightDelimiter = '=='

const alertWords: Readonly<Record<string, string>> = {
  error: 'CAUTION',
  info: 'NOTE',
  note: 'IMPORTANT',
  success: 'TIP',
  tip: 'TIP',
  warning: 'WARNING',
}

// ー, ｰ and the kana voicing marks are Script=Common; Script_Extensions would also take Latin combining marks.
const boundingScript = /^[\u3099-\u309c\u30fc\uff70\uff9e\uff9f\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Thai}]$/u

const panelTypesByWord: Readonly<Record<string, string>> = {
  attention: 'warning',
  bug: 'error',
  caution: 'error',
  check: 'success',
  danger: 'error',
  done: 'success',
  error: 'error',
  fail: 'error',
  failure: 'error',
  hint: 'tip',
  important: 'note',
  missing: 'error',
  success: 'success',
  tip: 'tip',
  warning: 'warning',
}

export function alertMarker(panelType: unknown): string {
  const word = typeof panelType === 'string' && Object.hasOwn(alertWords, panelType) ? alertWords[panelType] : undefined
  return `[!${word ?? 'NOTE'}]`
}

export function readAlertMarker(text: string): AlertMarker | undefined {
  const marker = /^\[!([\w-]+)\]([+-]?)/.exec(text)
  if (marker === null) return undefined
  const word = (marker[1] ?? '').toLowerCase()
  const panelType = Object.hasOwn(panelTypesByWord, word) ? panelTypesByWord[word] : undefined
  return { folded: marker[2] !== '', length: marker[0].length, panelType: panelType ?? 'info' }
}

// A marker leads text that ends at it or goes on past whitespace or a hard break.
export function leadingMarker<T extends { length: number }>(text: string, read: (text: string) => T | undefined): T | undefined {
  const marker = read(text)
  if (marker === undefined) return undefined
  const rest = text.slice(marker.length, marker.length + 2)
  return rest === '' || /^(?:[ \t\n]|\\\n)/.test(rest) ? marker : undefined
}

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

export function taskMarker(state: unknown): string {
  return state === 'DONE' ? '[x]' : '[ ]'
}

export function readTaskMarker(text: string): { length: number; state: 'DONE' | 'TODO' } | undefined {
  const marker = /^\[([ xX])\]/.exec(text)
  if (marker === null) return undefined
  return { length: marker[0].length, state: marker[1] === ' ' ? 'TODO' : 'DONE' }
}

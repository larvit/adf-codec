import type { AdfMark } from '../adf/document.ts'

export type Flavour = 'lossless' | 'plain'

type AlertMarker = { folded: boolean; length: number; panelType: string }

export const editorHighlight: AdfMark = { attrs: { color: '#f8e6a0' }, type: 'backgroundColor' }

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

export function taskMarker(state: unknown): string {
  return state === 'DONE' ? '[x]' : '[ ]'
}

export function readTaskMarker(text: string): { length: number; state: 'DONE' | 'TODO' } | undefined {
  const marker = /^\[([ xX])\]/.exec(text)
  if (marker === null) return undefined
  return { length: marker[0].length, state: marker[1] === ' ' ? 'TODO' : 'DONE' }
}

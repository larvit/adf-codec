import { isUnicodeWhitespace } from './grammar.ts'

type DelimiterRun = { canClose: boolean; canOpen: boolean; character: string; length: number }

export type EmphasisPairing<Run> = { closer: Run; closerOffset: number; opener: Run; openerOffset: number; used: number }

type Candidate<Run> = {
  head: number
  next: Candidate<Run> | undefined
  original: number
  previous: Candidate<Run> | undefined
  remaining: number
  run: Run
  tail: number
}

const unicodePunctuation = /[\p{P}\p{S}]/u

export function delimiterFlags(character: string, before: string, after: string): { canClose: boolean; canOpen: boolean } {
  const left = isLeftFlanking(before, after)
  const right = isRightFlanking(before, after)
  if (character !== '_') return { canClose: right, canOpen: left }
  return { canClose: right && (!left || isPunctuation(after)), canOpen: left && (!right || isPunctuation(before)) }
}

export function isWordCharacter(character: string): boolean {
  return character !== '' && !isWhitespace(character) && !isPunctuation(character)
}

// Transcribes CommonMark's reference process_emphasis line for line; the closer walk and opener search stay whole, since named steps drift from it.
export function matchEmphasis<Run extends DelimiterRun>(runs: readonly Run[]): EmphasisPairing<Run>[] {
  const pairings: EmphasisPairing<Run>[] = []
  const bottoms = new Map<string, Candidate<Run> | undefined>()
  let closer = candidates(runs)
  while (closer !== undefined) {
    if (!closer.run.canClose) {
      closer = closer.next
      continue
    }
    const key = `${closer.run.character}${closer.run.canOpen}${closer.original % 3}`
    const bottom = bottoms.get(key)
    let opener = closer.previous
    while (opener !== undefined && opener !== bottom && !pairs(opener, closer)) opener = opener.previous
    if (opener === undefined || opener === bottom) {
      bottoms.set(key, closer.previous)
      const following = closer.next
      if (!closer.run.canOpen) unlink(closer)
      closer = following
      continue
    }
    const used = closer.remaining >= 2 && opener.remaining >= 2 ? 2 : 1
    opener.remaining -= used
    opener.tail -= used
    pairings.push({ closer: closer.run, closerOffset: closer.head, opener: opener.run, openerOffset: opener.tail, used })
    closer.head += used
    closer.remaining -= used
    opener.next = closer
    closer.previous = opener
    if (opener.remaining === 0) unlink(opener)
    if (closer.remaining > 0) continue
    const following = closer.next
    unlink(closer)
    closer = following
  }
  return pairings
}

export function runLength(text: string, index: number): number {
  const character = text.charAt(index)
  let length = 0
  while (text.charAt(index + length) === character) length += 1
  return length
}

function candidates<Run extends DelimiterRun>(runs: readonly Run[]): Candidate<Run> | undefined {
  let first: Candidate<Run> | undefined
  let previous: Candidate<Run> | undefined
  for (const run of runs) {
    const candidate: Candidate<Run> = {
      head: 0,
      next: undefined,
      original: run.length,
      previous,
      remaining: run.length,
      run,
      tail: run.length,
    }
    if (previous === undefined) first = candidate
    else previous.next = candidate
    previous = candidate
  }
  return first
}

function pairs<Run extends DelimiterRun>(opener: Candidate<Run>, closer: Candidate<Run>): boolean {
  if (!opener.run.canOpen || opener.run.character !== closer.run.character) return false
  const odd = (closer.run.canOpen || opener.run.canClose) && closer.original % 3 !== 0 && (opener.original + closer.original) % 3 === 0
  return !odd
}

function unlink<Run>(candidate: Candidate<Run>): void {
  if (candidate.previous !== undefined) candidate.previous.next = candidate.next
  if (candidate.next !== undefined) candidate.next.previous = candidate.previous
}

function isLeftFlanking(before: string, after: string): boolean {
  if (isWhitespace(after)) return false
  if (!isPunctuation(after)) return true
  return isWhitespace(before) || isPunctuation(before)
}

function isRightFlanking(before: string, after: string): boolean {
  if (isWhitespace(before)) return false
  if (!isPunctuation(before)) return true
  return isWhitespace(after) || isPunctuation(after)
}

function isPunctuation(character: string): boolean {
  return character !== '' && unicodePunctuation.test(character)
}

function isWhitespace(character: string): boolean {
  return character === '' || isUnicodeWhitespace(character)
}

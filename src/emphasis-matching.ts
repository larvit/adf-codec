export type EmphasisDelimiter = { closes: boolean; end: number; pair: number; start: number }

export type EmphasisRun = {
  canClose: boolean
  canOpen: boolean
  character: string
  delimiters: readonly EmphasisDelimiter[]
  end: number
  start: number
}

type Candidate = {
  head: number
  next: Candidate | undefined
  original: number
  previous: Candidate | undefined
  remaining: number
  run: EmphasisRun
  tail: number
}

// Flanking decides which delimiters may pair; matching decides which do, and a pair it leaves unpaired reads back as another document.
export function unmatchedPair(runs: readonly EmphasisRun[]): number | undefined {
  const matched = matchDelimiters(runs)
  // The last opener left unpaired is the innermost: the smallest carry that changes the line.
  let innermost: number | undefined
  for (const run of runs) {
    for (const delimiter of run.delimiters) {
      if (!delimiter.closes && !matched.has(delimiter.pair)) innermost = delimiter.pair
    }
  }
  return innermost
}

function matchDelimiters(runs: readonly EmphasisRun[]): ReadonlySet<number> {
  const matched = new Set<number>()
  const bottoms = new Map<string, Candidate | undefined>()
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
    record(matched, opener, closer, used)
    opener.remaining -= used
    opener.tail -= used
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
  return matched
}

function candidates(runs: readonly EmphasisRun[]): Candidate | undefined {
  let first: Candidate | undefined
  let previous: Candidate | undefined
  for (const run of runs) {
    const length = run.end - run.start
    const candidate: Candidate = { head: run.start, next: undefined, original: length, previous, remaining: length, run, tail: run.end }
    if (previous === undefined) first = candidate
    else previous.next = candidate
    previous = candidate
  }
  return first
}

function pairs(opener: Candidate, closer: Candidate): boolean {
  if (!opener.run.canOpen || opener.run.character !== closer.run.character) return false
  const odd = (closer.run.canOpen || opener.run.canClose) && closer.original % 3 !== 0 && (opener.original + closer.original) % 3 === 0
  return !odd
}

function record(matched: Set<number>, opener: Candidate, closer: Candidate, used: number): void {
  const opened = opener.run.delimiters.find((delimiter) => !delimiter.closes && delimiter.start === opener.tail - used && delimiter.end === opener.tail)
  const closed = closer.run.delimiters.find((delimiter) => delimiter.closes && delimiter.start === closer.head && delimiter.end === closer.head + used)
  if (opened !== undefined && closed !== undefined && opened.pair === closed.pair) matched.add(opened.pair)
}

function unlink(candidate: Candidate): void {
  if (candidate.previous !== undefined) candidate.previous.next = candidate.next
  if (candidate.next !== undefined) candidate.next.previous = candidate.previous
}

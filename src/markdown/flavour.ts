export type Flavour = 'commonmark' | 'lossless' | 'portable'

export type WrittenFlavour = Exclude<Flavour, 'commonmark'>

// What a reader reads past CommonMark, and so what its writer escapes; the portable flavour's alerts, callouts and task markers are left to `FlavourBlockReaders` and `FlavourBlockWriters` (docs/decisions.md §Each call names its flavour).
export type Claims = {
  carryFence: boolean
  directives: boolean
  highlights: boolean
  // `gfm`: a row may drop its leading `|`, and an alignment colon is read and dropped; `flavour`: every row opens with `|`, the delimiter row `-` runs only.
  pipeTables: 'flavour' | 'gfm' | false
  strikethrough: boolean
}

type WrittenClaims = Claims & { pipeTables: 'flavour' | 'gfm'; strikethrough: true }

// Directives exclude highlights: a directive's slot reads `==`.
type ReadClaims = Claims & ({ directives: false } | { directives: true; highlights: false })

// Pinned false: inside an expand directive, a folded callout would read as an expand, not a nestedExpand.
export const flavourClaims: Readonly<{ commonmark: ReadClaims; portable: { directives: false } } & Record<WrittenFlavour, ReadClaims & WrittenClaims>> = {
  commonmark: { carryFence: false, directives: false, highlights: false, pipeTables: false, strikethrough: false },
  lossless: { carryFence: true, directives: true, highlights: false, pipeTables: 'flavour', strikethrough: true },
  portable: { carryFence: false, directives: false, highlights: true, pipeTables: 'gfm', strikethrough: true },
}

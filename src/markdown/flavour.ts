export type Flavour = 'commonmark' | 'lossless' | 'portable'

export type WrittenFlavour = Exclude<Flavour, 'commonmark'>

// What a reader reads past CommonMark, and so what its writer escapes (docs/decisions.md §Each call names its flavour).
export type Claims = {
  alerts: boolean
  carryFence: boolean
  directives: boolean
  highlights: boolean
  // `gfm`: a row may drop its leading `|`, and an alignment colon is read and dropped; `flavour`: every row opens with `|`, the delimiter row `-` runs only.
  pipeTables: 'flavour' | 'gfm' | false
  strikethrough: boolean
  taskMarkers: boolean
}

type WrittenClaims = Claims & { pipeTables: 'flavour' | 'gfm'; strikethrough: true }

// Directives exclude alerts and highlights: an expand directive leaves `inExpand` unset and a directive's slot reads `==`.
type ReadClaims = Claims & ({ directives: false } | { alerts: false; directives: true; highlights: false })

export const flavourClaims: Readonly<{ commonmark: ReadClaims } & Record<WrittenFlavour, ReadClaims & WrittenClaims>> = {
  commonmark: { alerts: false, carryFence: false, directives: false, highlights: false, pipeTables: false, strikethrough: false, taskMarkers: false },
  lossless: { alerts: false, carryFence: true, directives: true, highlights: false, pipeTables: 'flavour', strikethrough: true, taskMarkers: false },
  portable: { alerts: true, carryFence: false, directives: false, highlights: true, pipeTables: 'gfm', strikethrough: true, taskMarkers: true },
}

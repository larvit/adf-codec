// The only file `parse/` imports from `emit/` (docs/decisions.md §The source parts by ADF and format).
export { commonMarkSpelling, type SpellingMemo } from './adf-to-markdown.ts'
export { openingLinkTakesDirective } from './inline-line.ts'

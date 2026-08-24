# The corpus

`<name>.json` is an ADF document; `<name>.md` is the markdown `adfToMarkdown` must emit for it,
byte for byte including the trailing newline, and that `markdownToAdf` must read back to that same
document (AGENTS.md §2). Directories mirror `spec/flavour.md`'s sections.

The JSON is editor-normal — empty `attrs`, `marks` and `content` as the absent key, adjacent
identical-mark text nodes merged — two-space indent, keys sorted.

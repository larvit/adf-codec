# The corpus

One directory per contract kind:

- `round-trip/` — `<name>.json` + `<name>.md`: the markdown `adfToMarkdown` must emit for that
  document, byte for byte, and that `markdownToAdf` must read back to it (AGENTS.md §2). Grouped
  by node family.
- `normalization/` — `<name>.md` + `<name>.json`: markdown input, and the document
  `markdownToAdf` must build from it. One-way; the markdown is not canonical.
- `errors/` — `<name>.md`: markdown input that must not convert. A `<name>.error` beside it
  pins which error.
- `real-payloads/` — `<name>.json`: sanitized live ADF, round-tripped ADF→markdown→ADF. No
  expected markdown.

JSON is editor-normal (AGENTS.md §2), two-space indent, keys sorted.

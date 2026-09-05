# The corpus

One directory per contract kind, each landing with its milestone:

- `round-trip/` — `<name>.json` + `<name>.md`: the markdown `adfToMarkdown` must emit for that
  document, byte for byte, and that `markdownToAdf` must read back to it (AGENTS.md §2). Grouped
  by what the fixture exercises.
- `normalization/` — `<name>.md` + `<name>.json`: markdown input, and the document
  `markdownToAdf` must build from it, which must in turn emit and read back to itself. The
  markdown is not canonical.
- `errors/` — `<name>.md`: markdown input that must not convert. A `<name>.error` beside it
  pins which error.
- `real-payloads/` — `<name>.json`: sanitized live ADF, round-tripped ADF→markdown→ADF. No
  expected markdown.
- `commonmark-spec/` — `spec.json` (the pinned CommonMark suite, read as corpus data per
  AGENTS.md §1) and `exceptions.json` (examples a documented divergence exempts, keyed by
  `check` and `example` with a `reason`). Three checks an example must pass: the §2 canonical
  fixpoint — a named error, or markdown that parses and emits back to itself; the reference HTML's
  text, tags stripped and entities decoded, against the parsed document's concatenated text; and a
  count of the CommonMark subset's elements against the nodes and marks they map to.

JSON is editor-normal (AGENTS.md §2), two-space indent, keys sorted. `spec.json` is the vendored,
upstream machine-readable suite (CommonMark 0.31.2, CC-BY-SA-4.0, © John MacFarlane) and is not
re-serialized by the corpus gate.

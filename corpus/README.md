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
- `commonmark-spec/` — the CommonMark suite run against `markdownToAdf` by three checks. `spec.json`
  is the suite; `refusals.json` pins each refusing example to its error `code`; `exceptions.json`
  pins each known divergence by `check`, `example`, `kind` and the exact `divergence`, with a
  `reason`. `kind` is `mark-model` (the permanent count divergence from ADF's mark-per-text-node
  model), `unspellable` (parses but the flavour has no spelling) or `pending` (a parser gap a later
  milestone may close).

JSON is editor-normal (AGENTS.md §2), two-space indent, keys sorted. `spec.json` is the vendored,
upstream machine-readable suite, byte-exact (CommonMark 0.31.2, CC-BY-SA-4.0, © John MacFarlane),
and is not re-serialized by the corpus gate.

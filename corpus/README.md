# The corpus

One directory per contract kind:

- `round-trip/` — `<name>.json` + `<name>.md`: the markdown `adfToMarkdown` must emit for that
  document, byte for byte, and that `markdownToAdf` must read back to it (`docs/decisions.md` §The
  round-trip is the product). Grouped by what the fixture exercises.
- `normalization/` — `<name>.md` + `<name>.json`: markdown input, and the document
  `markdownToAdf` must build from it, which must in turn emit and read back to itself. The
  markdown is not canonical.
- `errors/` — `<name>.md`: markdown input that must not convert. A `<name>.error` beside it
  pins which error.
- `real-payloads/` — `<name>.json`: ADF Atlassian's editor wrote, round-tripped ADF→markdown→ADF.
  No expected markdown.
- `commonmark-spec/` — the CommonMark suite run against `markdownToAdf` by three checks. `spec.json`
  is the suite; `refusals.json` pins each refusing example to its error `code`; `exceptions.json`
  pins each known divergence by `check`, `example`, `kind` and the exact `divergence`, with a
  `reason`. `kind` is `mark-model` (the permanent count divergence from ADF's mark-per-text-node
  model), `unspellable` (parses but the flavour has no spelling) or `pending` (a parser gap).

JSON is editor-normal (`docs/decisions.md` §Equality is editor-normal), two-space indent, keys
sorted. `spec.json` is the vendored, upstream machine-readable suite, byte-exact from
[spec.commonmark.org](https://spec.commonmark.org/0.31.2/spec.json) (CommonMark 0.31.2, © John
MacFarlane, [CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)), and is not
re-serialized by the corpus gate.

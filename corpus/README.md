# The corpus

One directory per contract kind:

- `round-trip/` — `<name>.json` + `<name>.md`: the markdown `adfToLosslessMarkdown` must emit for
  that document, byte for byte, and that `losslessMarkdownToAdf` must read back to it
  (`docs/decisions.md` §The round-trip is the product). Grouped by what the fixture exercises.
- `normalization/` — `<name>.md` + `<name>.json`: markdown input, and the document
  `losslessMarkdownToAdf` must build from it, which must in turn emit and read back to itself. The
  markdown is not canonical.
- `errors/` — `<name>.md`: markdown input that must not convert. A `<name>.error` beside it
  pins which error.
- `real-payloads/` — `<name>.json`: ADF Atlassian's editor wrote, round-tripped ADF→markdown→ADF
  and ADF→HTML→ADF. No expected markdown or HTML.
- `real-world/` — `<name>.json`: anonymized documents from public Jira and Confluence sites,
  round-tripped as `real-payloads/` is. `real-world-sources.json` names each one's original page,
  licence and retrieval time. `corpus-gathering/run.sh <folder outside the repo>` fetches the
  documents into that folder, then replaces the whole set and that file. It needs Docker and
  network, and takes minutes
  (`docs/decisions.md` §The real-world corpus holds anonymized documents from sites whose licence it records).
  `typesNoFetchedDocumentHolds` in `src/conformance/corpus.test.ts` lists the node types these
  documents don't show.
- `commonmark-spec/` — the CommonMark suite run against `commonMarkToAdf` by three checks.
  `spec.json` is the suite; `refusals.json` pins each refusing example to its error `code`;
  `exceptions.json` pins each known divergence by `check`, `example`, `kind` and the exact
  `divergence`, with a `reason`. `kind` is `mark-model` (the permanent count divergence from ADF's
  mark-per-node model), `node-model` (a permanent divergence where ADF holds no node for what
  CommonMark renders) or `pending` (a parser gap).

JSON is two-space indent, keys sorted, and a document read back must deep-equal the fixture's
(`docs/decisions.md` §Equality is deep). `spec.json` is the vendored, upstream machine-readable
suite, byte-exact from [spec.commonmark.org](https://spec.commonmark.org/0.31.2/spec.json)
(CommonMark 0.31.2, © John MacFarlane,
[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/)), and is not re-serialized by the
corpus gate.

`real-world/` isn't under this repository's MIT licence. Each document adapts the work its entry's
`url` names, replacing its text, names, ids and URLs, and that page credits its creators, whom the
documents don't name. It stays under the licence its entry names,
[CC-BY-3.0](https://creativecommons.org/licenses/by/3.0/) or
[CC-BY-SA-4.0](https://creativecommons.org/licenses/by-sa/4.0/), without warranty, and an adaptation
of a CC-BY-SA-4.0 document is shared under that licence. Only the ONAP wiki states its own licence.
The others rest on the Linux Foundation's terms of use, which don't name these sites, so their
licence is our reading of those terms.

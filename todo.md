# Todo

The plan, in order. Nothing is built. Design questions are settled in `AGENTS.md`; remaining spec
detail is settled at its own milestone.

## Milestones

- [x] **0 — Scaffold.** `package.json` per §6, `tsconfig.json`, `.npmrc` (`save-exact=true`), the
      Docker tooling, `renovate.json` (§9), and `.gitea/workflows/ci.yml` gating branches:
      `runs-on: docker-host`, actions pinned to semver tags.
- [x] **1a — The directive grammar** (`spec/flavour.md`): inline/block/leaf directive forms,
      attributes, escaping, nesting, canonical form, the opaque-carry spelling, the raw-HTML
      input policy.
- [x] **1b — Block node syntaxes** in `spec/flavour.md`: panel, expand/nestedExpand, the media
      family, the pipe-vs-directive table rule and the directive table form, task and decision
      lists, layout, extensions, syncBlock.
- [x] **1c — Inline node syntaxes and marks** in `spec/flavour.md`: mention, emoji, status, date,
      inlineCard, mediaInline; underline, subsup, textColor, border; the spelling for text nodes
      whose whitespace CommonMark cannot hold (literal newlines, leading or trailing spaces) —
      escape-based, never literal, since pipe cells trim and pad. At `mediaInline`, check real
      payloads for external-URL support — if it exists, revisit the media section's
      mid-text-image error and its "no slot" ground.
- [ ] **1d — Corpus start** (§10): checked-in fixtures per spec'd node, in `corpus/`, one
      directory per contract kind (`corpus/README.md`).
      **Blocked on the maintainer** (§15), not to be guessed: Canonical form has no totality
      guard — a `paragraph`, `heading`, `blockquote` or `codeBlock` carrying a `localId`, or a
      `blockquote` carrying marks, has no spelling that keeps it, and picking one (directive
      sections for the six CommonMark block nodes, or the opaque carry) is a permanent format
      decision (§8). Its three collision sites stay out of the corpus until then: an `orderedList`
      starting at 1, a `codeBlock` whose info string is empty, and `media` with an empty `alt` —
      each a choice between the absent attribute and the empty value.
  - [ ] **1d1 — The CommonMark subset**: blockquote, bulletList, codeBlock, heading, orderedList,
        paragraph, rule, listItem, hardBreak, text, code spans, and the `code`, `em`, `link`,
        `strike` and `strong` marks — one mark per text node; nesting is 1d5's.
  - [ ] **1d2 — Block nodes**: panel, expand/nestedExpand, the media family and the CommonMark
        image shape, both table forms, task and decision lists, layout, extensions, syncBlock —
        with the reserved `marks` attribute and the fence lengths nesting forces.
  - [ ] **1d3 — Inline nodes and marks**: date, emoji, inlineCard, mediaInline, mention, status;
        border, subsup, textColor, underline; the content slot's `text` attribute and the
        `:text{text="…"}` whitespace spelling.
  - [ ] **1d4 — Opaque carry** (§3): an unknown node in both positions, the reserved `adf` info
        string, and the `codeBlock` whose language is `adf`.
  - [ ] **1d5 — Carve-outs and combinations**: the three carve-outs and their escapes, mark
        nesting order and the runs a carry breaks, attribute canonicalization, and documents
        combining nodes rather than isolating one.
  - [ ] **1d6 — Input normalization**: one-way markdown→ADF fixtures, not pairs — setext
        headings, indented code, loose lists, `*`/`+` bullets, entity references, soft wraps.
  - [ ] **1d7 — Error input**: also one-way, a markdown input per named error, asserting only
        that conversion fails — malformed directives, the image gap, a claimed pipe-table line
        that does not parse, the content slot, raw HTML with no mapping. Which error each returns
        is pinned at milestone 3, where they are named.
- [ ] **2 — `adfToMarkdown`.** First real code — decide here where §10's coverage check lives, and
      gate that every `corpus/**/*.json` re-serializes to itself under the library's own canonical
      serializer: one implementation, keys sorted, two spellings — two-space indent for the corpus
      files and the block carry's body, compact for the inline carry.
- [ ] **3 — `markdownToAdf`.** The CommonMark parser is the largest single component. The raw-HTML
      element mapping is empty until milestone 6, so at `0.1.0` every raw-HTML construct in input
      is an error result. The CommonMark spec suite runs against it from here (§10), and
      `corpus/errors/` gains the error each fixture must return (1d7).
- [ ] **4 — Round-trip property tests** over the corpus, both ways — the thing that proves 2 and
      3. Generators emit editor-normal ADF (§2). Real sanitized ADF from live Atlassian APIs lands
      here too (§10), in `corpus/real-payloads/`: an ADF→markdown→ADF check with no expected
      markdown, the payloads supplied by the maintainer.
- [ ] **5 — Release pipeline, ship `0.1.0`.** Publish-on-version-change (§9), `NPM_TOKEN` secret,
      the repo made public first (§6). `0.1.0` is the markdown round-trip: both markdown
      directions, the types, `isAdfDocument`. The build lands here: a build tsconfig emitting JS
      and `.d.ts` to `dist/` (the dev config's `allowImportingTsExtensions` forces `noEmit`, so
      the build config needs `rewriteRelativeImportExtensions`), plus `exports`/`files` in
      `package.json`. The maintainer's bump PR also removes `private: true`, the guard against any
      earlier publish.
- [ ] **6 — The HTML dialect spec.** Element-by-element mapping, the `data-*` fidelity scheme, the
      opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts.
- [ ] **7 — HTML, ship `0.2.0`.** `adfToHtml`, `htmlToAdf`, the composed `markdownToHtml` /
      `htmlToMarkdown`. CommonMark spec suite runs against `markdownToHtml` from here (§10).
- [ ] **8 — CLI.** A later goal, shaped around the personas once the library exists.

## The ADF inventory to cover

From Atlassian's [structure
reference](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — not the
whole schema: real payloads also carry `taskList`/`taskItem`, `decisionList`/`decisionItem`,
`layoutSection`/`layoutColumn`, `blockCard`/`embedCard`, `extension`/`bodiedExtension`/`inlineExtension`
and `placeholder`, none documented there. The documented set is the floor: the floor gets designed
syntax, the rest rides the opaque carry (§3) until it does too.

| | |
| --- | --- |
| Top-level block | `blockquote` `bodiedSyncBlock` `bulletList` `codeBlock` `expand` `heading` `mediaGroup` `mediaSingle` `multiBodiedExtension` `orderedList` `panel` `paragraph` `rule` `syncBlock` `table` |
| Child block | `blockTaskItem` `extensionFrame` `listItem` `media` `nestedExpand` `tableCell` `tableHeader` `tableRow` |
| Inline | `date` `emoji` `hardBreak` `inlineCard` `mediaInline` `mention` `status` `text` |
| Marks | `border` `code` `em` `link` `strike` `strong` `subsup` `textColor` `underline` |

Plain markdown covers `blockquote`, `bulletList`, `codeBlock`, `heading`, `orderedList`,
`paragraph`, `rule`, `listItem`, `hardBreak`, `text`, and the `code`, `em`, `link` and `strong`
marks; `strike` is the flavour's `~~` carve-out. Everything else is what the flavour is for.

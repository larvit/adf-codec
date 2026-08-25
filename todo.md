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
- [x] **1d — Corpus start** (§10): checked-in fixtures per spec'd node, in `corpus/`, one
      directory per contract kind (`corpus/README.md`).
      **Blocked on the maintainer** (§15), not to be guessed: Canonical form has no totality
      guard. Per `@atlaskit/adf-schema` 57.1.0 every block node it spells — `blockquote`,
      `bulletList`, `codeBlock`, `heading`, `listItem`, `orderedList`, `paragraph`, `rule` —
      carries a `localId` with no spelling, `codeBlock` also `hideLineNumbers`, `uniqueId` and
      `wrap`, `blockquote` also marks, and `hardBreak` `text` and `localId` with no section for
      the carry fallback to reach. Picking one (directive sections for those nodes, or the opaque
      carry) is a permanent format decision (§8). Three collision sites are held out of the corpus
      meanwhile, each a choice between the absent attribute and the empty value: a `codeBlock`
      whose info string is empty and `media` with an empty `alt`, which one "exactly that shape"
      rule — as the CommonMark image already uses — could settle together, and an `orderedList`
      starting at 1, independent of the totality answer since `order: 9` keeps the markdown form
      either way. **Also blocked**: the link rule covers destination spaces only, so two shapes
      break §2 silently — href `https://example.com/a)b` emits `[t](https://example.com/a)b)`,
      read back as href `…/a` plus literal `b)`; title `He said "hi"` emits
      `[t](u "He said "hi"")`, which holds no title. Two defensible spellings each — angle
      brackets or a backslash escape, and for titles `'…'` or `(…)` besides — so §8 leaves
      the pick here. **Also blocked**: block separation is unstated for a CommonMark block beside a
      directive block in a container body — an `expand` whose content is `paragraph` "A" then a
      `panel` (`panelType` `warning`) holding "B" spells `A` and `:::panel warning` either on
      consecutive lines or with a blank line between. Two defensible spellings, so §8 leaves the
      pick here.
  - [x] **1d1 — The CommonMark subset**: blockquote, bulletList, codeBlock, heading, orderedList,
        paragraph, rule, listItem, hardBreak, text, code spans, and the `code`, `em`, `link`,
        `strike` and `strong` marks — one mark per text node; nesting is 1d3's.
  - [x] **1d2 — Block nodes**: panel, expand/nestedExpand, the media family and the CommonMark
        image shape, both table forms, task and decision lists, layout, extensions, syncBlock —
        with the reserved `marks` attribute and the fence lengths nesting forces.
  - [x] **1d3 — Inline nodes and marks**: date, emoji, inlineCard, mediaInline, mention, status;
        border, subsup, textColor, underline; the content slot's `text` attribute and the
        `:text{text="…"}` whitespace spelling.
- [ ] **2 — `adfToMarkdown`.** First real code. Each sub-item turns one corpus directory green;
      the two that have no fixtures yet write them in the same chunk, tests first (§10).
  - [ ] **2a — The runner and the CommonMark subset.** The corpus runner: walk
        `corpus/round-trip/`, assert `adfToMarkdown` emits each `.md` byte for byte. Decide here
        where §10's coverage check lives, and gate that every `corpus/**/*.json` re-serializes to
        itself under the library's own canonical serializer — one implementation, keys sorted, two
        spellings: two-space indent for the corpus files and the block carry's body, compact for
        the inline carry. `commonmark-subset/` green.
  - [ ] **2b — Block nodes.** `block-nodes/` green. A nested list that cannot interrupt the block
        above it is refused meanwhile, not spelled: the maintainer's answer on tight-versus-blank
        separation turns that refusal into an emission. Block separation becomes
        `separationBetween(previous, next, container)` here — a boolean cannot hold the third case
        `spec/flavour.md` states for two directive blocks in a container body, and the maintainer's
        answer on a CommonMark block beside a directive block (1d) drops into the same seam. Give
        the emitter's refusals a corpus home while the directories grow: `corpus/unspellable/`,
        a `.json` beside the `ConvertErrorCode` it must return, the emitter half of `corpus/errors/`.
  - [ ] **2c — Inline nodes and marks.** `inline-nodes/` green. `InlineSegment.kind` splits into
        its two axes here — escapability (`attribute` for `:text{text="…"}`, `backslash`, `none`)
        and the emphasis role — rather than gaining a third value that means one of each.
  - [ ] **2d — The opaque carry** (§3). Fixtures and emitter together, into
        `corpus/round-trip/opaque-carry/`: an unknown node in both positions, the reserved `adf`
        info string, and the `codeBlock` whose language is `adf`.
  - [ ] **2e — Carve-outs and combinations.** Fixtures and emitter together, into
        `corpus/round-trip/combinations/`: the three carve-outs and their escapes, mark runs — the
        longest-run rule, attributes included — and the runs a carry breaks, a mark spelling that
        cannot open where it sits (`un**-real**istic`; the spec owes the carry a trigger),
        attribute canonicalization, a pipe cell's whitespace edges and `\u007c` for a `|` inside a
        quoted attribute value, documents combining nodes rather than isolating one, and a
        paragraph line inside a container body shaped like a closing fence (`:::`, `::: x`).
        The gate gains the collision property here: no two corpus documents may emit the same
        bytes — one spelling for two documents is a round-trip break no parser can undo, and it is
        provable without one. It also settles the emitter's one known approximation: delimiter
        flanking is exact, but CommonMark's *matching* — the multiple-of-3 rule and the way a run
        splits across several openers — is not modelled. No reachable violation has been found by
        hand; the property test is what decides it.
- [ ] **3 — `markdownToAdf`.** The CommonMark parser is the largest single component; split it
      into sub-items before starting (§15). Fixtures land with the code that reads them:
      `corpus/normalization/` (setext, indented code, loose lists, `*`/`+` bullets, entity
      references, soft wraps — one-way, the markdown not canonical) and `corpus/errors/` (a
      markdown input per named error — malformed directives, the image gap, a claimed pipe-table
      line that does not parse, the content slot, raw HTML with no mapping — each with the error
      it must return). The raw-HTML element mapping is empty until milestone 6, so at `0.1.0`
      every raw-HTML construct in input is an error result. The CommonMark spec suite runs
      against it from here (§10). The parser owes `~` the same `can_open`/`can_close` the emitter
      assumes — CommonMark flanking, as for `*` — which `spec/flavour.md` does not yet pin.
      `src/` gets its hierarchy at the same split — `adf/`,
      `markdown/`, `html/`, the grammar module shared inside `markdown/` — while the rename is
      still mechanical.
- [ ] **4 — Round-trip property tests** over the corpus, both ways — the thing that proves 2 and
      3. Editor-normal (§2) gets its implementation here — `toEditorNormal(doc)` and the equality
      the round-trip asserts, which over normalized input is the canonical serializer's compact
      spelling — rather than staying spelled inline as `?? []` at every reader.
      Generators emit editor-normal ADF (§2). Real sanitized ADF from live Atlassian APIs lands
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

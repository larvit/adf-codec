# Todo

The plan. Design questions are settled in `AGENTS.md`; remaining spec detail is settled at its own
milestone. A done item shrinks to its title here; its full text moves to `todo-history.md`.

## Milestones

Shipping order: 3h, 3i, 3j, 5a, 5b, 5 → `0.1.0`; 4b and 4c → `0.1.1`; 4, 3k → `0.2.0`; 6, 7 →
`0.3.0`.
The numbering is the order the work was planned in, not the order it ships.

- [x] **0 — Scaffold.**
- [x] **1a — The directive grammar.**
- [x] **1b — Block node syntaxes.**
- [x] **1c — Inline node syntaxes and marks.**
- [x] **1d — Corpus start.**
  - [x] **1d1 — The CommonMark subset.**
  - [x] **1d2 — Block nodes.**
  - [x] **1d3 — Inline nodes and marks.**
- [x] **2 — `adfToMarkdown`.**
  - [x] **2a — The runner and the CommonMark subset.**
  - [x] **2b — Block nodes.**
  - [x] **2c — Inline nodes and marks.**
  - [x] **2d — The opaque carry.**
  - [x] **2e — Carve-outs and combinations.**
    - [x] **2e1 — The carve-outs and the claimed line.**
    - [x] **2e2 — Mark runs and the runs a carry breaks.**
    - [x] **2e3 — Attribute canonicalization and the quoted value's escape.**
    - [x] **2e4 — The carry's fallback triggers.**
    - [x] **2e5 — Combined documents and the collision property.**
  - [x] **2f — The attributes CommonMark cannot hold.**
- [ ] **3 — `markdownToAdf` (`0.1.0`).** Each sub-item lands the fixtures its own code reads, and
      the runner grows a parse half as they do: readers for `corpus/normalization/` (setext,
      indented code, loose lists, `*`/`+`
      bullets, entity references, soft wraps — one-way, the markdown not canonical) and
      `corpus/errors/` (a markdown input per named error, the code in a `.error` beside it) with
      the first fixture each. `commonmark-subset/` cannot be the first to green — `::paragraph`
      and `:hardBreak{}` sit in it — so 3b through 3f answer to their own tests and the one-way
      fixtures they land, and 3g is where the first directory reads back. The raw-HTML element
      mapping is empty until milestone 6, so at `0.1.0` every raw-HTML construct in input — a
      block, an inline tag, a comment, a processing instruction — is a named error. Input is where
      unbounded nesting actually arrives, so §11's 500 binds all three of the emitter's guards
      here: block depth at 3c and again at 3f's container fences, inline and mark depth at 3f and
      3i, a carried value's JSON at 3j, where `isJsonValue` already bounds it.
  - [x] **3a — The hierarchy.**
  - [x] **3b — The leaf blocks.**
  - [x] **3c — The container blocks.**
  - [x] **3d — Inline text.**
  - [x] **3e — Emphasis and links.**
  - [x] **3f — The directive grammar.**
  - [x] **3g — The node tables read backwards.**
  - [x] **3h — The block nodes.**
  - [x] **3i — The inline nodes and the marks.**
  - [x] **3j — The carry and the combinations.**
  - [ ] **3k — The CommonMark spec suite (`0.2.0`).** Checked in at `corpus/commonmark-spec/`,
        pinned to the version it ships — the one `html-blocks.ts` names for its start
        conditions — `corpus/README.md` gaining the kind.
        **Settled** (the maintainer, 2026-08-27): three checks an example must pass, the reference
        HTML each ships read as corpus data — which adds no format and no direction (§1). §2's
        canonical fixpoint: a named error, or markdown that parses and emits to itself byte for
        byte. That HTML's text, tags stripped and entities decoded, against the parsed document's
        concatenated `text`. And a count of the dozen elements the CommonMark subset covers
        against the marks and nodes they map to — counting distinct mark types per text node, since
        3e collapses a spelling nested inside its own kind and `*(*a*)*` is two `<em>` against one
        `em`. The fixpoint alone is self-consistency a parser
        returning the empty document passes, and the text alone one dropping every emphasis; the
        counts close both. The exception list stays the maintainer's, and one entry is owed
        already: 3h continues a list across the marker change CommonMark splits on, so an example
        the reference HTML gives two `<ul>` counts one `bulletList`. One outcome is no
        exception and must not be filed as one: valid CommonMark parsing to a document
        `adfToMarkdown` refuses is a §2 hole, which is what `corpus/unspellable/` held until 3c,
        3e and 3h landed their answers and emptied it.
- [ ] **4 — Round-trip property tests (`0.2.0`)**, widening 3j's corpus round-trip past the
      documents a human wrote — the thing that proves 2 and 3 beyond them. Editor-normal (§2) is
      finished here, on 3i's merging — `toEditorNormal(doc)` and the equality the round-trip
      asserts, which over normalized input is the canonical serializer's compact spelling —
      rather than staying spelled inline as `?? []` at every reader. The
      reading half is `nodeContent`/`nodeAttrs`/`nodeMarks` over the ~28 sites spelling it
      inline today, which also lifts the branch floor §10 keeps below 100 for exactly those
      halves.
      Generators emit editor-normal ADF (§2). Real sanitized ADF from live Atlassian APIs lands
      here too (§10), in `corpus/real-payloads/`: an ADF→markdown→ADF check with no expected
      markdown, the payloads supplied by the maintainer. This subsumes 2e5's collision property —
      a document that round-trips proves no other document shares its spelling — so decide here
      whether that gate stays as the parser-free, faster-failing signal or goes; the half holding
      no fixture duplicates is hygiene rather than a round-trip claim, and stays either way.
- [ ] **4b — The block walk's retry (`0.1.1`).** `emitBlock` walks a subtree twice wherever
      `readableBlock` reads it whole and then gives up — a list item whose first line reads back
      as a thematic break — and the walk below does the same, so the cost doubles per level:
      3.4kB of nested lists takes half a second, depth 20 about eight, depth 24 minutes. It
      predates 3g on both directions, and 3g's `commonMarkSpelling` gave it a second entry point.
      The README's bot and pipeline personas feed markdown nobody typed, so this ships as a hang
      on a small input; §11's scanning rule is the same argument one shape further in. The retry
      is what to remove — one walk answering both the readable question and the directive
      fallback. Memoizing `emitBlock` is the shortcut, and the node reference is the wrong key: a
      caller may hold one node object at two positions, where the cached depth and path are
      another node's. `0.1.0` ships with the retry in it, so a deep document is slow rather than
      wrong until the patch.
- [ ] **4c — The scanning rule's remaining sites (`0.1.1`).** A trailing-anchored regex re-walks
      its run from every start position, so an interior whitespace run costs quadratic time rather
      than linear — 3h measured 80k spaces inside an ATX heading at 11.3s, and 3ms once the walk
      replaced the regex. Three sites the same sweep did not reach: `normalizeLabel` in
      `link-syntax.ts`, whose shortcut-reference input is `scan.source.slice(...)` rather than the
      999-capped `readLabel` value, and two in `emit/inline-line.ts`. The fix is the one 3h used —
      an index walk, `trimTrailingSpace` where the ends match. A fourth of another shape joins
      them: `readNestedDirective` restarts its depth counter per level, so each parse level
      re-scans the region below it and nested inline directives cost O(depth × content) — 3f's
      cost, which 3i's slot parse doubles rather than changes in class, bounded by the 500-level
      guard. §11's scanning rule is the whole argument; the pipeline persona feeds documents
      nobody typed.
- [ ] **5 — Release pipeline, ship `0.1.0`.** Publish-on-version-change (§9), `NPM_TOKEN` secret,
      the repo made public first (§6). The `ConvertErrorCode` freeze (§8) is checkable here: 3h
      landed the last decision `corpus/unspellable/` held and the directory went with it, so what
      the code list holds from here is permanent. The parser's own code
      additions are read here as one list before that freeze — nine sessions mint them
      independently, and one cause wearing two codes is breaking to undo after `0.1.0` — one is
      known already: a json attribute value past 500 levels reads `unsupported-node-shape` on
      parse but `unsupported-nesting-depth` through the carry on emit. That read
      gets a test rather than an eye — every `ConvertErrorCode` member named at a production call
      site, the way `spec.test.ts` guards the node tables — since `unspelled-block-separation`
      outlived its cause until 3h went looking. `0.1.0`
      is the markdown round-trip: both markdown directions, the types, `isAdfDocument`. The build
      lands here: `tsconfig.build.json` gains emit of JS and `.d.ts` to `dist/` (its own
      `allowImportingTsExtensions` forces `noEmit`, so `rewriteRelativeImportExtensions` lands
      beside it), plus `exports`/`files` in `package.json`. The
      maintainer's bump PR also removes `private: true`, the guard against any earlier publish.
      §6's browser half is first checkable here, on the emitted `dist/index.js` a browser can
      load — the compile gate names no host API, and a real page converting the corpus is the
      other half. Headless Firefox is that page, settling both at once: the browser proof, and the
      only SpiderMonkey there is, `ci.sh`'s three legs being two V8s and a JavaScriptCore that is
      not Safari's. `engines.node` gets its one-line proof here
      too — `import('./dist/index.js')` under a pinned Node 18 image, which cannot run the
      suite that type stripping wants 22+ for, but proves exactly what the field claims.
      **Settled** (the maintainer, 2026-09-01): the round-trip proved over the checked-in corpus
      is what `0.1.0` ships on, and the open-ended proof work follows it rather than gating it —
      3k's spec suite and 4's generators and maintainer-supplied payloads are `0.2.0`, 4b's retry
      `0.1.1`. A consumer using the library is worth more than a wider proof nobody has needed
      yet, and §8's pre-1.0 rules cover what the wider proof then finds. 3k's exception list
      landing after the release leaves the README's canonical-fixpoint sentence claiming more than
      `0.1.0` keeps — 3e names three shapes that parse and then refuse — so the release narrows
      that sentence or lists them.
- [x] **5a — Rename to `@larvit/adf-codec`.**
- [ ] **5b — The consumer's error surface (`0.1.0`).** A product-owner read of the public surface
      found the error result legible to the library and opaque to the consumer holding it, and the
      README documenting no part of it. The sub-items are that read's answers, and they land before
      5 because §8 freezes the code list at `0.1.0` and 5b3's table is what reads the list before
      the freeze closes it.
  - [x] **5b1 — The error's source position.**
  - [ ] **5b2 — The error messages.** Most state the rule and leave the violation to be inferred —
        `a text node holds text` for a node holding none — so `rule: violation` becomes house style
        across the sites that do. `not-an-adf-document` gives one sentence of eight words to `null`,
        a string, a missing `version`, a `type` that is not `doc` and a REST envelope around the
        document; naming the check that failed makes the highest-frequency integrator mistake
        self-diagnosing without the library naming a REST shape (§7). The three carve-out claim
        messages name the escape that unclaims the line — `\|`, `\~~`, `\:::` — which today only
        `spec/flavour.md` holds. `unmappable-html` reads as §8 now frames it: this version converts
        no raw HTML, never a permanent judgment on the element.
  - [ ] **5b3 — The README's consumer surface.** §8 invites an exhaustive switch on `code` and no
        code name appears in the README, so it gains a table — code, when it fires, what the
        consumer does — grouped by direction; drafting it is the audit that reads the fifteen names
        before 5 freezes them. Four things a reader who has not opened the code cannot know: raw
        HTML is core CommonMark and every construct in input is an error until `0.3.0`, which the
        guarantees' "three carve-outs and one gap" denies and which is the bot and LLM personas'
        most common failure; `adfToHtml`, `htmlToAdf`, `markdownToHtml` and `htmlToMarkdown` sit
        unmarked in the code block people copy from, as do the two HTML guarantee bullets, and take
        a `0.3.0` mark or leave the block; `adfToMarkdown` is partial on valid ADF — two adjacent
        `bulletList` nodes are an error result — which the viewer persona needs told along with
        what to do about it; and GFM past tables and strikethrough is literal text, task lists
        taking `:::taskList`. One sentence for the LLM persona: `code` is stable across minors,
        `message` is free text.
- [ ] **6 — The HTML dialect spec (`0.3.0`).** Element-by-element mapping, the `data-*` fidelity
      scheme, the opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts.
- [ ] **7 — HTML, ship `0.3.0`.** `adfToHtml`, `htmlToAdf`, the composed `markdownToHtml` /
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

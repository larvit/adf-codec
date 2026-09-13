# Todo

The plan. Design questions are settled in `AGENTS.md`; remaining spec detail is settled at its own
milestone. A done item shrinks to its title here; its full text moves to `todo-history.md`.

## Milestones

Shipping order: 3h, 3i, 3j, 5a, 5b, 5c, 5d, 5 → `0.1.0` (shipped 2026-09-05); 3k, 11, 4, 12, 4b, 4c, 10, 5g → `0.2.0`; 4d, 5f → `0.2.1`;
6, 7 → `0.3.0`; 9 → TBD; 5e last.
The numbering is the order the work was planned in, not the order it ships. `0.2.0`'s order is settled
(the maintainer, 2026-09-13): 11 makes the tables 4 generates from answer to Atlassian's schema, 4
proves 12, and 12 rewrites code 4b and 4c change.

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
- [x] **3 — `markdownToAdf`.**
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
  - [x] **3k — The CommonMark spec suite.**
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
- [ ] **4b — The block walk's retry (`0.2.0`).** `emitBlock` walks a subtree twice wherever
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
      wrong until the patch. `adfDocumentFault` is the second site to look at: `isNodeArray` reads
      every node and attribute value, then `nestingFault` reads them again, so the emit entry the
      export persona runs in bulk walks the document twice. Both walks are linear, so this is a
      constant factor rather than 4b's class change, and the parting is what gives depth its own
      code (§8) — measure before joining them back.
- [ ] **4c — The scanning rule's remaining sites (`0.2.0`).** A trailing-anchored regex re-walks
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
- [ ] **4d — What the gate says while it runs (`0.2.1`).** `ci.sh` runs nine legs and announces
      none of them, so five minutes of a Gitea run read as silence and a hang cannot be told from
      a slow pull — the maintainer hit exactly this on the `0.1.0` release. Three causes, each its
      own fix. The legs need markers: `plainpages`' `ci.sh` prints a `step()` header per leg and
      this one prints nothing, so name the leg and the image before each. The longest leg is the
      quietest: `test_output=$(… npm test 2>&1)` buffers the whole Node run to replay it after,
      because the zero-test guard greps the count — stream it and grep a copy (`tee`), rather than
      trading the output for the guard. And two legs are silenced outright, `npm pack` and the
      tarball install, whose `>/dev/null` predates the offline install that made them quick and
      quiet. `publish.sh` owes the same: today it says nothing between reading `private` and the
      registry answering, which is where its `npm ci` and rebuild sit — the seconds §9 accepts
      rather than promoting the gate's `dist`, and unmeasured until the log shows them. Per-leg
      timing is what turns "slow or hung" from a guess into a reading; the browser leg's own
      5.4–7.9s against a 17s warm gate is the number that made it obviously cheap.
- [x] **5 — Ship `0.1.0`.**
- [ ] **5e — The publish token's deadline.** `0.1.0` published only once the npm
      token carried **Bypass 2FA**: the account requiring no 2FA on writes was not enough, and npm
      answered `EOTP` until the token itself bypassed. npm retires bypass-2FA tokens for direct
      publishing around January 2027, leaving them `npm stage publish`, which a maintainer
      approves with 2FA; its replacement — trusted publishing over OIDC — supports GitHub-hosted
      Actions, GitLab.com's shared runners and CircleCI's cloud, self-hosted runners planned
      without a date. So the release path has an expiry date and no drop-in successor yet. Revisit:
      whether npm has added Gitea or self-hosted OIDC, and otherwise whether the
      release moves to the staged publish — which fits badly with publish-on-merge,
      and is the trade to weigh rather than discover on a red release run.
      **Settled** (the maintainer, 2026-09-13): last of the known work, clear of `0.2.0`, placed
      there knowing the cutoff may land before `0.2.0` ships.
- [ ] **5f — Publish the bundle size (`0.2.1`).** Measure the shipped artifact and put the number in the
      README, kept honest by the release pipeline rather than by a human re-reading it. The
      quantity is what a consumer downloads and loads: the tarball `npm pack` produces, its
      unpacked `dist`, and the built JavaScript minified + gzipped — the figure the competitors
      advertise (marklassian's "12kb") and the only apple-to-apple one, since ours ships tsc's
      unminified output and no minifier yet (decide here whether to minify for the build or report
      the unminified gzip). A publish/pipeline leg measures it and fails when the README figure
      drifts, so the number can't rot; the figure lands in README §The package beside the
      "no runtime dependencies" claim. Measured today, unminified: tarball 60.4 kB, unpacked
      221.5 kB, JS gzipped 45.6 kB.
- [ ] **5g — Reweight the README for the reader (`0.2.0`).** It opens with the pre-launch rationale —
      Atlassian's REST APIs, `pf-editor-service/convert` being decommissioned, a link to
      JRACLOUD-77436 — where a shipped package should answer what it is, what it does and for whom
      first, then the shortest runnable example; the reader's top seconds go to "why this exists"
      instead of "what I can do with it". Demote the Jira/endpoint background to a later "why
      losslessness" note or drop it — the internal references (the `jira.atlassian.com` URL,
      `pf-editor-service/convert`) don't belong in published text at all, no ticket IDs or internal
      URLs. The `0.3.0` HTML future should read as an aside, not the lede: the package reads as a
      shipped `0.1.0`, not a work-in-progress.
- [x] **5a — Rename to `@larvit/adf-codec`.**
- [x] **5b — The consumer's error surface.**
  - [x] **5b1 — The error's source position.**
  - [x] **5b2 — The error messages.**
  - [x] **5b3 — The code list and the flavour's gaps.**
  - [x] **5b4 — The README's consumer surface.**
- [x] **5c — The build and the release pipeline.**
- [x] **5d — The browser leg.**
- [ ] **6 — The HTML dialect spec (`0.3.0`).** Element-by-element mapping, the `data-*` fidelity
      scheme, the opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts.
- [ ] **7 — HTML, ship `0.3.0`.** `adfToHtml`, `htmlToAdf`, the composed `markdownToHtml` /
      `htmlToMarkdown`. CommonMark spec suite runs against `markdownToHtml` from here (§10).
- [ ] **8 — CLI.** A later goal, shaped around the personas once the library exists.
- [ ] **9 — The online sandbox.** A web page with two textboxes converting back and forth between ADF and markdown, powered by the library's browser build.
- [ ] **10 — Lossy conversion (`0.2.0`).** A direction that only converts what Markdown actually supports, keeping the ADF's data while dropping what markdown cannot hold — format, design and the richer nodes.
- [ ] **11 — Evaluate `@atlaskit/adf-schema` (`0.2.0`).** Whether to add `@atlaskit/adf-schema` as a dev dependency to use as truth for the ADF schema.
- [ ] **12 — The `!adf:` re-spelling (`0.2.0`).** Replace the colon directive grammar with the
      namespaced prefix, a breaking change to the emitted contract (shipped `0.1.0`, so §8 makes it
      `0.2.0`). Forms: block container `!adf:name arg {attrs}` … `!adf:/name` — the `/` parts open
      from close, nestable without a fence-length discipline, so the `::::`/`:::::` runs and their
      length rule go and every container opens the constant `!adf:`; block leaf `!adf:name arg
      {attrs}` with no closer; inline node `!adf:name[content]{attrs}`; directive marks
      `!adf:border`/`subsup`/`textColor`/`underline` `[content]{attrs}`. Attributes and their
      escaping stay `{key=value}`; the literal escape is `\!adf:`; a line opening `!adf:` claims as
      today's colon-run does. Leaf vs container is decided by the node's content model rather than
      syntax — the `::`/`:::` split and §4's name-set-independent recognition go, a simplification
      the carry makes safe (an unknown *block* node already rides the fence, not the directive).
      The carry's reserved name becomes `carry`, both spellings — the block fence info string
      `` `carry` `` and the inline `!adf:carry{json="…"}` — named for what it does: it carries a node
      verbatim, never "unknown-node", since a known node no section spells where it stands rides it
      too. A spelling change, not a semantic one: no `ConvertErrorCode` is added, removed or renamed,
      the round-trip guarantee and the carry both hold through it. Mechanical surface: the grammar in
      `spec/flavour.md`, `src/adf/block-directives.ts` + `inline-directives.ts`, `src/markdown/`'s
      `directive-syntax.ts`, `opaque-carry.ts` and the `emit/` + `parse/` readers, every corpus
      fixture (round-trip, normalization and `errors/`), `spec.test.ts`'s prose reader, and the
      README's examples.
  - [ ] **12a — The spec and the decision.** Rewrite `spec/flavour.md` to the `!adf:` grammar, and
        record the departures in `AGENTS.md` §4 (leaf/container by content model, carry renamed
        `carry`).
  - [ ] **12b — The emit side.** `adfToMarkdown` spells `!adf:` / `!adf:/name` / `!adf:carry`; its
        fixtures re-spelled, green.
  - [ ] **12c — The parse side and the round-trip.** `markdownToAdf` reads it back; the round-trip
        corpus, the `errors/` fixtures and the CommonMark spec suite re-spelled,
        `markdownToAdf(adfToMarkdown(doc))` still equals `doc`.
  - [ ] **12d — The README and the sweep.** The README's examples follow; sweep docs and fixtures
        for any stale `::`/`:name` spelling.

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

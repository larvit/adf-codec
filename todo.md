# Todo

The plan. Design questions are settled in `AGENTS.md`; remaining spec detail is settled at its own
milestone. A done item shrinks to its title here; its full text moves to `todo-history.md`.

## Milestones

Shipping order: 3h, 3i, 3j, 5a, 5b, 5c, 5d, 5 → `0.1.0` (shipped 2026-09-05); 3k, 11, 4, 12, 13, 4b, 4c, 10, 5g → `0.2.0`; 4d, 5f → `0.2.1`;
6, 7 → `0.3.0`; 9 → TBD; 5e last.
The numbering is the order the work was planned in, not the order it ships. `0.2.0`'s order is settled
(the maintainer, 2026-09-13): 11 makes the tables 4 generates from answer to Atlassian's schema, 4
proves 12, 13 spells 11's gaps in 12's grammar, and 12 rewrites code 4b and 4c change.

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
      documents a human wrote — the thing that proves 2 and 3 beyond them.
      **Settled** (the maintainer, 2026-09-13): `fast-check` generates and shrinks. The gate runs a
      fixed seed, the properties together adding about five seconds per engine; an environment
      variable raises the runs and randomizes the seed for local digging, and a counterexample
      found becomes a round-trip fixture. The generators draw from the node tables — each node's
      content model and attribute vocabulary as `adf/` records them, which 11 holds to Atlassian's
      schema — and misplace a share of nodes so the carry (§3) is exercised; no JSON Schema walker
      enters the tests. `toEditorNormal` stays internal. 2e5's collision test goes, since a
      collision already fails the round-trip on the same fixtures; the fixture-duplicate test
      stays.
  - [ ] **4.1 — Editor-normal and the node accessors.** `toEditorNormal(doc)` in
        `src/adf/editor-normal.ts`, on 3i's merging: adjacent text nodes carrying identical marks
        merged, an empty `attrs`, `marks` or `content` the absent key (§2), and the round-trip
        tests compare through it. `nodeContent`/`nodeAttrs`/`nodeMarks` replace the 49 inline
        `?? []`/`?? {}` reads in `src/` (27 `content`, 12 `marks`, 10 `attrs`), and the branch floor
        rises to what the suite then measures.
  - [ ] **4.2 — The ADF property.** `fast-check` joins `devDependencies`, AGENTS.md §5 naming what
        it earns — shrinking a failing document to the nodes that break it — and §10 the properties
        beside the corpus. A generated editor-normal document either refuses in `adfToMarkdown`
        with a `ConvertError` or reads back through `markdownToAdf` to an equal document, and
        nothing throws, under Node, Deno and Bun alike. 2e5's collision test is deleted.
  - [ ] **4.3 — The markdown property.** Generated markdown through `markdownToAdf` never throws,
        and the runs fit the budget; where it parses and `adfToMarkdown` spells the result, that
        spelling parses and emits to itself byte for byte (§2).
  - [ ] **4.4 — The real payloads.** `corpus/real-payloads/` holds the maintainer's sanitized
        payloads, each round-tripped ADF→markdown→ADF with no expected markdown. It waits on the
        maintainer placing the files.
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
      first, then the shortest runnable example.
      **Settled** (the maintainer, 2026-09-13): the background goes entirely, no endpoint, ticket or
      "why" note left. The top follows the package-README order: an npm version badge and the Gitea
      Actions badge, a tagline that is also `package.json`'s `description`, a feature list and a
      one-line table of contents, then install and the shortest runnable example; a table of
      everything exported sits near the bottom. The HTML directions are one aside line under the API
      until `0.3.0` ships them, the `// 0.3.0` signatures and the `0.3.0` guarantee going until then.
      The tagline and `description` read "Lossless conversion between Atlassian Document Format and
      extended markdown" until 7 restores HTML.
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
      `htmlToMarkdown`. CommonMark spec suite runs against `markdownToHtml` from here (§10). The
      README's tagline and `package.json`'s `description` regain HTML (5g).
- [ ] **8 — CLI.** A later goal, shaped around the personas once the library exists.
- [ ] **9 — The online sandbox.** A web page with two textboxes converting back and forth between ADF and markdown, powered by the library's browser build.
- [ ] **10 — Lossy conversion (`0.2.0`).** A direction that only converts what Markdown actually
      supports, keeping the ADF's data while dropping what markdown cannot hold — format, design
      and the richer nodes.
      **Settled** (the maintainer, 2026-09-13): `adfToPlainMarkdown(doc)` is one export whose body
      reduces the document ADF→ADF in `src/adf/` and hands the result to `adfToMarkdown`, so §1's
      four conversions stay four. Its markdown is the flavour without directives — CommonMark, the
      pipe table and `~~` — and it refuses only what the document guard refuses
      (`not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`); every
      other shape degrades. The reduction:
      - `panel`, `layoutSection`/`layoutColumn`, `bodiedExtension`, `bodiedSyncBlock`,
        `multiBodiedExtension` and `extensionFrame` unwrap to their body blocks in order; `expand`
        and `nestedExpand` put their title first as a strong paragraph.
      - The CommonMark blocks keep their spelling, attributes dropped.
      - `taskList` and `decisionList` become bullet lists, a task item's state leading its text as
        `[x]` or `[ ]`, the way Obsidian and GFM write a checkbox: `- [x] Write the spec`.
      - `mention` and `status` become their text, `emoji` its text or else its `shortName`, and
        `date` its ISO date in UTC (`2026-09-13`).
      - `inlineCard`, `blockCard` and `embedCard` become a link to their `url`, dropped when they
        carry only `data`; a `mediaSingle` holding an external image stays `![alt](url)`; `media`,
        `mediaGroup` and `mediaInline` become their `alt` text or nothing; `caption` its text as a
        paragraph; `extension`, `inlineExtension` and `syncBlock` their `text` attribute or nothing;
        `placeholder` nothing; a node no row names, or one standing where no spelling holds it, its
        blocks or its text.
      - A table stays a pipe table: the first row becomes the header, a cell's blocks join on one
        line with spaces, and spans and the cells they cover drop.
      - `code`, `em`, `link`, `strike` and `strong` stay and every other mark drops, keeping its text;
        a link no CommonMark escape writes becomes its text, and a mark run CommonMark's flanking or
        matching cannot spell drops its mark.
      - A newline in text becomes a hard break and edge whitespace is trimmed; carriage returns and
        null characters are removed; a paragraph line opening with a code span whose backticks would
        read as a fence loses the code mark; an empty paragraph drops, and adjacent lists of one type
        merge.
  - [ ] **10a — Obsidian's formats.** Look up the formats Obsidian-flavoured markdown adds —
        callouts, highlights, embeds, task states and whatever else it writes — and propose which
        of the reduction's rows should adopt one; the maintainer settles the proposal, revising the
        rows above, before 10b starts (the maintainer's request, 2026-09-13).
  - [ ] **10b — The reduction.** The reduction in `src/adf/`, tests first, a test per row as 10a
        leaves them.
  - [ ] **10c — `adfToPlainMarkdown`.** The export and its README section, and a property over
        4.2's generators: it refuses only the guard's codes, and its output reads back through
        `markdownToAdf` holding no node or mark the flavour spells as a directive. AGENTS.md §1
        records the reduction as what keeps the conversions at four.
- [ ] **11 — Atlassian's ADF schema as the tables' truth (`0.2.0`).** `@atlaskit/adf-schema`'s two
      JSON Schemas vendored rather than the package installed (AGENTS.md §5), and the node tables
      gated against them (§10). **Settled** (the maintainer, 2026-09-13): vendored at
      `spec/adf-schema/` and re-pinned by hand when a need shows; the gate compares attribute names
      and kinds, never value sets, over `full.json` and `stage-0.json` together.
  - [x] **11a — The vendored schema.**
  - [ ] **11b — The gate.** For each node and mark type the tables spell, the attribute names and
        kinds equal the union over every definition in both files whose `type` enum names it,
        `anyOf`/`allOf` branches included, the argument slot (`panelType`, `state`) counting as
        spelled. Kinds: `string`; `number`, `integer` included; `boolean`; `json` for an object, an
        array or an untyped value; an `enum`-only attribute takes its values' kind. What the schema
        holds past the tables is pinned in two exact lists — an entry the schema no longer needs is
        red, like a difference neither list names: gaps, attributes of a spelled type (57.4.9:
        `link` `collection` `id` `occurrenceKey`, `rule` `color` `style` `weight`, `layoutSection`
        `columnRuleStyle`), emptied by 13; and carried, types the tables do not spell (`alignment`
        `annotation` `backgroundColor` `blockCard` `bodiedRule` `breakout` `dataConsumer`
        `embedCard` `fontSize` `fragment` `indentation` `inlineExtension` `placeholder`), `doc` and
        `text` counting as the grammar's own.
- [ ] **12 — The `!adf:` re-spelling (`0.2.0`).** Replace the colon directive grammar with the
      namespaced prefix, a breaking change to the emitted contract (shipped `0.1.0`, so §8 makes it
      `0.2.0`). Forms: block container `!adf:name arg {attrs}` … `!adf:/name` — the `/` parts open
      from close, nestable without a fence-length discipline, so the `::::`/`:::::` runs and their
      length rule go and every container opens the constant `!adf:`; block leaf `!adf:name arg
      {attrs}` with no closer; inline node `!adf:name[content]{attrs}`; directive marks
      `!adf:border`/`subsup`/`textColor`/`underline` `[content]{attrs}`. Attributes and their
      escaping stay `{key=value}`; the literal escape is `\!adf:`. Leaf vs container is decided by
      the node's content model rather than syntax — the `::`/`:::` split goes, a simplification the
      carry makes safe (an unknown *block* node already rides the fence, not the directive). The
      carry's reserved name becomes `carry`, both spellings — the block fence info string `carry`
      and the inline `!adf:carry{json="…"}` — named for what it does: it carries a node verbatim,
      never "unknown-node", since a known node no section spells where it stands rides it too. No
      `ConvertErrorCode` is added, removed or renamed, and the round-trip guarantee and the carry
      both hold through it. Mechanical surface: the grammar in `spec/flavour.md`,
      `src/adf/block-directives.ts` + `inline-directives.ts`, `src/markdown/`'s
      `directive-syntax.ts`, `opaque-carry.ts` and the `emit/` + `parse/` readers, every corpus
      fixture (round-trip, normalization and `errors/`), the prose reader over `spec/flavour.md`,
      and the README's examples.
      **Settled** (the maintainer, 2026-09-13):
      - A line opening `!adf:name` is a block line when a space or the line's end follows the name,
        and a paragraph when `[` or `{` does. Claiming stays syntactic and structure comes from the
        tables: an unknown name is `unknown-directive-name` at the opener, whatever follows it.
      - An unescaped `!adf:` claims on its own anywhere inline: one completing no directive is
        `malformed-directive`, the emitter escapes every literal `!adf:`, and `!adf:hardBreak{}`
        keeps its braces. Block and inline share the one `\!adf:` escape hint.
      - A closer names the innermost open container, crosses no list-item or blockquote edge,
        indents as a fence does and carries nothing after the name; anything else is
        `malformed-directive`.
      - A node holding no content whose content model takes some is an empty opener–closer pair,
        never a leaf.
      - A spelled node's content model is frozen with its spelling: changing it is MAJOR (§8).
      - The colon spellings are dropped, not refused: `0.1.0` markdown reads back as prose, `adf`
        is no longer a reserved language, and `MIGRATION.md` tells a consumer to convert stored
        markdown through `0.1.0`'s parser and `0.2.0`'s emitter.
      - Inputs moving between codes ride the break: a leaf given a body, a container missing its
        closer and `listBreak` with a body are `malformed-directive`, and an empty inline-body
        container parses.
      - Split by construct, each sub-item both directions: 55 of 78 round-trip fixtures feed both
        the emit and the read-back test, so an emit-only chunk cannot land green.
  - [ ] **12a — The spec and the decision.** `spec/flavour.md` rewritten to the `!adf:` grammar and
        the settled answers above, no colon directive form left in it; AGENTS.md §4's directive
        bullet and prior-art line, and §8's escape hints and `::adf`/`::listBreak` examples, name
        the new forms, §8 gaining the frozen content model.
  - [ ] **12b — The inline form.** Inline nodes, directive marks, `text` and the inline carry
        `!adf:carry{json=…}` spelled and read as `!adf:name[content]{attrs}`, with the prefix claim
        and its escape; the round-trip, normalization and `errors/` fixtures holding inline forms
        re-spelled, and the gate green.
  - [ ] **12c — The block form.** Openers and `!adf:/name` closers, leaf vs container by content
        model, empty pairs, `listBreak` and the `carry` fence, spelled and read; the fence-length
        rule and the corpus test's fence nesting check deleted; the remaining fixtures re-spelled
        and `errors/` re-derived under the shifted codes, and the gate green.
  - [ ] **12d — The README, `MIGRATION.md` and the sweep.** The README's examples and error tables
        follow, `MIGRATION.md` linked from one README line; docs and fixtures swept for any stale
        `::`/`:name` spelling.
- [ ] **13 — The schema's gap attributes (`0.2.0`).** Spell the attributes 11b pins as gaps, in
      12's grammar, and empty the list.
      **Settled** (the maintainer, 2026-09-13): a link `[text](url "title")` cannot hold takes the
      directive mark `!adf:link[text]{attrs}` — one carrying `collection`, `id` or `occurrenceKey`,
      or an `href` or `title` no CommonMark escape writes — and a directive link CommonMark could
      spell is `unsupported-node-shape`. That leaves `unspellable-link` no cause, so it leaves
      `ConvertErrorCode` in `0.2.0`, §8 recording the removal.
  - [ ] **13a — `rule` and `layoutSection`.** `rule`'s `color`, `style` and `weight` and
        `layoutSection`'s `columnRuleStyle` join their tables and `spec/flavour.md` bullets, with
        round-trip fixtures; their gap entries go.
  - [ ] **13b — The directive link.** `link` spelled as above in both directions, with a round-trip
        fixture per trigger, `spec/flavour.md`'s Marks section following; `unspellable-link` removed
        from the code list, its `errors/` fixtures and the CommonMark suite's `unspellable`
        exceptions it cures re-derived, and the README's code table and its "not every document
        converts back" guarantee following; the gap list is empty.

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

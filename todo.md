# Todo

The plan. Design questions are settled in `AGENTS.md`; remaining spec detail is settled at its own
milestone. A done item shrinks to its title here; its full text moves to `todo-history.md`.

## Next session

Start a session with: `Read AGENTS.md and todo.md, then do what todo.md's "Next session" says.`

1. `git fetch origin` first and read this file at `origin/main`, then branch off it, not the
   worktree left behind: a checkout behind the remote reads a merged item as unchecked.
2. The first unchecked item in shipping order, per AGENTS.md §15 — or, where that item has no
   release, the planning chunk §15 describes.
3. In flight: nothing.
4. Before stopping, rewrite this section: the in-flight line, and the prompt itself wherever the
   session found it wrong or short.

## Milestones

Shipping order: 3h, 3i, 3j, 5a, 5b, 5c, 5d, 5 → `0.1.0` (shipped 2026-09-05); 3k, 11, 4, 12, 13, 4b,
4c, 14, 15, 16, 18, 4d, 17, 10, 6, 7, 5f, 5g → `0.2.0`; 8, 9 → TBD; 5e last.
The numbering is the order the work was planned in, not the order it ships. Everything known and
shaped ships in one release rather than a string of them: nothing waits on a version, and no
consumer is served by the churn (the maintainer, 2026-09-18). So `0.2.0` completes §1's three
formats, and `0.2.1` and `0.3.0` are gone. `8` and `9` stay out as the two goals nothing has shaped
yet. `0.2.0`'s order is settled (the maintainer, 2026-09-13, extended 2026-09-18): 11 makes the
tables 4 generates from answer to Atlassian's schema, 4 proves 12, 13 spells 11's gaps in 12's
grammar, and 12 rewrites code 4b and 4c change; then 14 moves the files 15, 16 and 10 edit and HTML
is written against that layout, 4d marks the gate legs before 17 adds one, 17 puts the complexity
guardrail under the largest body of new code, and 5f and 5g read last because 7 is what changes the
bundle size and the tagline.

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
- [x] **4 — Round-trip property tests.**
  - [x] **4.1 — Editor-normal and the node accessors.**
  - [x] **4.2 — The ADF property.**
  - [x] **4.3 — The markdown property.**
  - [x] **4.4 — The real payloads.**
- [x] **4b — The block walk's retry (`0.2.0`).**
- [x] **4c — The scanning rule's remaining sites (`0.2.0`).**
- [ ] **4d — What the gate says while it runs (`0.2.0`).** `ci.sh` runs nine legs and announces
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
- [ ] **5f — Publish the bundle size (`0.2.0`).** Measure the shipped artifact and put the number in the
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
      everything exported sits near the bottom. The HTML directions were to stay an aside until a
      later release shipped them; 7 now ships in this one and reads ahead of this item, so the
      README documents HTML as it documents markdown, the tagline and `description` naming both
      (the maintainer, 2026-09-13, revised 2026-09-18).
- [x] **5a — Rename to `@larvit/adf-codec`.**
- [x] **5b — The consumer's error surface.**
  - [x] **5b1 — The error's source position.**
  - [x] **5b2 — The error messages.**
  - [x] **5b3 — The code list and the flavour's gaps.**
  - [x] **5b4 — The README's consumer surface.**
- [x] **5c — The build and the release pipeline.**
- [x] **5d — The browser leg.**
- [ ] **6 — The HTML dialect spec (`0.2.0`).** Element-by-element mapping, the `data-*` fidelity
      scheme, the opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts.
- [ ] **7 — HTML, the third format (`0.2.0`).** `adfToHtml`, `htmlToAdf`, the composed
      `markdownToHtml` / `htmlToMarkdown`. CommonMark spec suite runs against `markdownToHtml` from
      here (§10). The README's tagline and `package.json`'s `description` regain HTML (5g).
- [ ] **8 — CLI.** A later goal, shaped around the personas once the library exists.
- [ ] **9 — The online sandbox.** A web page with two textboxes converting back and forth between ADF and markdown, powered by the library's browser build.
- [ ] **10 — Lossy conversion (`0.2.0`).** Markdown other tools render readably, to and from ADF,
      keeping the content while dropping what markdown cannot hold — format, design and the richer
      nodes.
      **Settled** (the maintainer, 2026-09-14): two exports composed around the lossless pair, so §1's
      four conversions stay four. `adfToPlainMarkdown(doc)` reduces the document ADF→ADF and hands it
      to `adfToMarkdown`; `plainMarkdownToAdf(markdown)` hands the markdown to `markdownToAdf` and
      lifts the result ADF→ADF. Both carry markdown conventions, so the reduction sits in
      `src/markdown/emit/`, the lift in `src/markdown/parse/` and what both read in `src/markdown/`
      (§11). The markdown is the flavour without directives — CommonMark, the pipe table and `~~` —
      plus the conventions below, chosen for readability from a survey of GitHub, GitLab, Gitea,
      Obsidian, Pandoc, MkDocs, Docusaurus, Typora, Joplin, Logseq, Bear, Notion, Azure DevOps and
      Discord, GitHub's renderer confirming each shape. Writing refuses only what the document guard
      refuses (`not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`)
      and degrades every other shape; reading refuses what `markdownToAdf` refuses. A lifted node
      carries no `localId`. The lift also reads other tools' spellings — type words in any case,
      Obsidian's aliases, `[X]` — since it reads their output and never writes those spellings.
      - A `panel` is an alert: the marker alone on the quote's first line, a blank `>`, then the body
        (`> [!WARNING]`), in GitHub's five words by colour — info `NOTE`, note `IMPORTANT`, tip and
        success `TIP`, warning `WARNING`, error `CAUTION`, custom `NOTE`. The lift reads those words
        back (`NOTE` info, `IMPORTANT` note, `TIP` tip, `WARNING` warning, `CAUTION` error) and
        Obsidian's by meaning (hint tip; success, check and done success; attention warning; danger,
        failure, fail, missing and bug error; any other word info). Text after a marker in its
        paragraph is the panel's first body paragraph.
      - An `expand` or `nestedExpand` is Obsidian's folded callout, `> [!NOTE]- Title`, a blank `>`,
        then the body. The lift reads a fold sign (`-` or `+`) as an expand whatever the word, the
        rest of the marker's paragraph as its title, and an expand inside an expand as a
        `nestedExpand`.
      - A `taskList` is a bullet list whose items lead with `[x]` or `[ ]` (`- [x] Write the spec`).
        The lift reads a list whose every item is so marked back as a `taskList` — a `blockTaskItem`
        where an item holds more than one block, a nested task list moved beside its item — and
        leaves mixed and ordered lists plain. A `decisionList` is a plain bullet list.
      - `backgroundColor` is `==text==`, and the lift gives `==text==` the Atlassian editor's default
        highlight colour.
      - `layoutSection`/`layoutColumn`, `bodiedExtension`, `bodiedSyncBlock`, `multiBodiedExtension`
        and `extensionFrame` unwrap to their body blocks in order; the CommonMark blocks keep their
        spelling, attributes dropped.
      - `mention` and `status` become their text, the mention's `@` kept; `emoji` its text or else its
        `shortName`; `date` its ISO date in UTC (`2026-09-13`); `inlineCard`, `blockCard` and
        `embedCard` a link to their `url`, dropped when they carry only `data`; a `mediaSingle`
        holding an external image stays `![alt](url)`; `media`, `mediaGroup` and `mediaInline` their
        `alt` text or nothing; `caption` its text as a paragraph; `extension`, `inlineExtension` and
        `syncBlock` their `text` attribute or nothing; `placeholder` nothing; a node no row names, or
        one standing where no spelling holds it, its blocks or its text.
      - A table stays a pipe table: the first row becomes the header, a cell's blocks join on one line
        with spaces, and spans and the cells they cover drop.
      - `code`, `em`, `link`, `strike` and `strong` stay and every other mark drops, keeping its text —
        `subsup` too, since `~2~` is a strike on GitHub; a link no CommonMark escape writes becomes its
        text, and a mark run CommonMark's flanking or matching cannot spell drops its mark.
      - A newline in text becomes a hard break and edge whitespace is trimmed; carriage returns and
        null characters are removed; a paragraph line opening with a code span whose backticks would
        read as a fence loses the code mark; an empty paragraph drops, and adjacent lists of one type
        merge.
      - Rejected in the survey: `~sub~` and `^sup^`, underline and colour spellings, raw HTML
        (`<details>`, `<mark>`), MkDocs `!!!` and the `:::` admonition family, footnotes, definition
        lists, wikilinks, embeds, tags, comments, TOC tokens, spoilers, task states past `[x]`/`[ ]`,
        and lifting bare URLs, `@name`, `:shortcode:` or ISO dates into nodes.
  - [ ] **10a — The reduction.** `adfToPlainMarkdown`'s ADF→ADF reduction, tests first, a test per
        row above.
  - [ ] **10b — The lift.** `plainMarkdownToAdf`'s ADF→ADF lift, tests first, a test per row it reads,
        other tools' spellings included; the editor's default highlight colour looked up and cited.
  - [ ] **10c — The exports.** `adfToPlainMarkdown` and `plainMarkdownToAdf` exported with their README
        sections, and two properties over 4.2's generators: writing refuses only the guard's codes,
        and markdown `adfToPlainMarkdown` wrote reads back through `plainMarkdownToAdf` and writes
        again byte for byte. AGENTS.md §1 records the pair as composed around the lossless one.
- [x] **11 — Atlassian's ADF schema as the tables' truth.**
  - [x] **11a — The vendored schema.**
  - [x] **11b — The gate.**
- [x] **12 — The `!adf:` re-spelling.**
  - [x] **12a — The spec and the decision.**
  - [x] **12b — The inline form.**
  - [x] **12c — The block form.**
  - [x] **12d — The README, `MIGRATION.md` and the sweep.**
- [x] **13 — The schema's gap attributes (`0.2.0`).**
  - [x] **13a — `rule` and `layoutSection`.**
  - [x] **13b — The directive link.**
- [x] **14 — The CommonMark subset's directory (`0.2.0`).**
- [x] **15 — The href-less directive link (`0.2.0`).**
- [ ] **16 — The link wrapping a link (`0.2.0`).** Read `[<http://x/>](/v)` and
      `[!adf:link[a]{href="/u"}](/v)` as `[[a](/u)](/v)` reads — the inner link wins and the outer
      brackets stay literal text, CommonMark's rule that no link holds another — rather than
      dropping the outer link silently as `closeLink`'s `applyMark` does today, with a normalization
      fixture per shape (the stability-reviewer, 2026-09-16; the maintainer, 2026-09-17).
- [ ] **17 — A machine-enforced size guardrail (`0.2.0`).** Add a per-function complexity check to
      the gate — branch count or size — so the fits-in-your-head guardrail fails the build rather
      than waiting for a review to catch it (the systems-architect, 2026-09-16). It reads ahead of
      6, 7 and 10 so the largest body of new code is written under it, which is also what decides
      the threshold: today's worst is `readDirectiveContent`, 27 lines and about 12 decision points
      over four concerns in one loop — escape, code span, nested directive, bracket balance — which
      4c left half-split and this item either passes or forces apart (the systems-architect and the
      maintainer, 2026-09-18).
- [ ] **18 — The subtree the directive spelling asks about (`0.2.0`).** The parser asks
      `commonMarkSpelling` at every directive-spelled block and the answer emits the whole subtree
      below, so a node at depth d is spelled d times: three nested rule-first directive lists cost
      18 asks over 10 nodes, and 250 levels parse in 1.2 s at 16.4 kB, 4.9 s at 261 kB with a
      kilobyte of content per level. The depth guard bounds the levels at about 250, never the
      content, so this is the pipeline persona's hang on an input nobody typed (§11). Keeping each
      child's emitted result for its parent's ask is not a straight handover: the same node object
      is asked at different depths — 4, 3 and 2 for the innermost list of three — because the
      parser counts a list and its item as two levels where the emitter's readable list counts one
      (4b), and `headroom` is that guard's slack. The parts that survive the measurement: the paths
      agree, `text` and `spelling` carry no depth, `headroom` is affine in it, and the parser asks
      first at the deepest of them, so a kept result rebases by the difference. Either rebase and
      record that argument in `AGENTS.md`, or give both directions one list accounting so a node
      has one depth and nothing needs rebasing — which reopens 4b. A single post-build walk was
      rejected: it reports the outer offender where the build reports the inner one (the
      maintainer, 2026-09-18).

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

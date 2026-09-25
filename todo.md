# Todo

The plan. Design questions are settled in `AGENTS.md`; remaining spec detail is settled at its own
milestone. A done item shrinks to its title here; its full text moves to `todo-history.md`.

## Next session

Start a session with: `Read AGENTS.md and todo.md, then do what todo.md's "Next session" says.`

1. `git fetch origin` first and read this file at `origin/main`, then branch off it, not the
   worktree left behind: a checkout behind the remote reads a merged item as unchecked. `tea pr
   list` in the same breath — an open PR is a chunk already in flight whatever line 3 says, and
   finishing it is the session.
2. The first unchecked item in shipping order, per AGENTS.md §15 — the order the Milestones line
   states, which wins over where an item's bullet sits: a newly filed item is written beside the
   one it came in with, not at its own place in the order. Where that item has no release, the
   planning chunk §15 describes.
3. In flight: nothing.
4. Before stopping, rewrite this section: the in-flight line, and the prompt itself wherever the
   session found it wrong or short.

## Milestones

Shipping order: 3h, 3i, 3j, 5a, 5b, 5c, 5d, 5 → `0.1.0` (shipped 2026-09-05); 3k, 11, 4, 12, 13, 4b,
4c, 14, 15, 16, 18, 4d, 28, 17, 29, 19, 20, 21, 22, 32, 23, 24, 25, 30, 26, 27, 10, 6, 7, 31, 5f, 5g →
`0.2.0`;
8, 9 → TBD; 5e last.
The numbering is the order the work was planned in, not the order it ships. Everything known and
shaped ships in one release rather than a string of them: nothing waits on a version, and no
consumer is served by the churn (the maintainer, 2026-09-18). So `0.2.0` completes §1's three
formats, and `0.2.1` and `0.3.0` are gone. `8` and `9` stay out as the two goals nothing has shaped
yet. `0.2.0`'s order is settled (the maintainer, 2026-09-13, extended 2026-09-18): 11 makes the
tables 4 generates from answer to Atlassian's schema, 4 proves 12, 13 spells 11's gaps in 12's
grammar, and 12 rewrites code 4b and 4c change; then 14 moves the files 15, 16 and 10 edit and HTML
is written against that layout, 4d marks the gate legs before 17 adds one, 17 puts the size ratchet
under the largest body of new code, and 5f and 5g read last because 7 is what changes the
bundle size and the tagline.
19 to 27 come from a comprehension panel — nine readers across four experience levels, none of
them able to see this file, reporting what defeated them and whether the project's shape fits in a
head (2026-09-20). They read ahead of 6, 7 and 10 because every one of them is cheaper before the
HTML format lands than after: 19 and 20 because HTML has no answer without them, 21 to 24 because
HTML doubles the importers and the file count they touch, and 25 to 27 because they are what the
panel says the next reader pays for.
29 and 30 come from 17's prose pass (2026-09-20). 29 reads first because every goal is what a later
ask is settled against, 19's included; 30 sits beside 25, the other chunk rereading AGENTS.md.
31 comes from 20's gate runs (2026-09-21) and reads beside 5f, the other chunk putting a measured
number under the pipeline. 32 comes from 21's review (2026-09-21) and reads beside 22, the other
chunk clearing a §11 seam.

- [ ] **31 — The branch figure the floor is read against is stable (`0.2.0`).** Three Node test
      legs over one unchanged tree reported `emit/inline-line.ts` at 95.83%, 96.23% and 96.23%,
      and the total at 98.80%, 98.84% and 98.84% (2026-09-21). `--experimental-test-coverage`
      counts branches off V8's own coverage, which the runner's parallel files and V8's
      optimization make run-dependent, so the number the floor is read against is not the code's
      alone. The floor of 98 holds today on 0.8 points of slack and §10 says it only ever moves
      upward, so the first raise to the measured figure reddens a run that changed nothing. Make
      the measurement repeatable, or state the number the floor may be raised to and why it is not
      the measured one.
- [x] **24 — The conformance gates have a directory (`0.2.0`).**
- [x] **25 — AGENTS.md §8 and §11 are findable (`0.2.0`).**
- [x] **26 — The two mutable structures say what they guarantee (`0.2.0`).**
- [x] **27 — The dead `headroom` write goes (`0.2.0`).**
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
- [x] **4d — What the gate says while it runs (`0.2.0`).**
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
      scheme, the opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts —
      the set `markdownToAdf` shares (`spec/flavour.md` §Raw HTML in input; 29).
      **Settled** (the maintainer, 2026-09-20), the four answers that shape the set:
      - A container ADF has no node for unwraps to its children, its own attributes dropped, so
        `<div align="center">text</div>` keeps `text` and loses the box and the alignment ADF
        cannot hold.
      - `<details><summary>Title</summary>…</details>` is an `expand`, the summary its `title`;
        one inside another is a `nestedExpand`, as 10 already spells for the lossy pair. An empty
        `<details>` is still refused — `expand` requires content, so there is nothing to build.
      - A comment stays an error result. Neither schema holds a comment node: across 84 and 98
        definitions the only "comment" in either file is `annotationType: "inlineComment"` on the
        `annotation` mark, which carries an `id` and no text, the words living behind an Atlassian
        API. `placeholder` is the editor's own visible hint, and `extension` demands an
        `extensionKey` naming a vendor app. Nothing can hold the words, so nothing accepts them.
      - `<script>` and `<style>` drop whole, their text with them. Neither holds anything a reader
        of the document ever saw, so nothing is lost; unwrapping them would put `alert(1)` on the
        page as prose. A `style` attribute is a separate question — `textColor` and
        `backgroundColor` are the marks it could reach — and is not read at `0.2.0`, the work
        outweighing what it buys.
      So the set sorts every element three ways, and that is what AGENTS.md §3 gains in place of
      "error result naming the element": a container around document content unwraps, content ADF
      cannot hold is an error result naming it, and what is not document content at all drops
      whole. A comment sorts into the second rather than the third because a person wrote those
      words on purpose. 10's "Rejected in the survey" line names raw HTML and comments and does not
      contradict this: it rejects them as spellings the lossy pair writes and reads back, where
      `plainMarkdownToAdf` composes on `markdownToAdf` and so inherits whatever this set accepts.
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
        `embedCard` a link to their `url`, or to their `data`'s `url` named by its `name` — the name
        alone without a `url`; an external image, wherever it stands, `![alt](url)`; `media`,
        `mediaGroup` and `mediaInline` holding a stored file their `alt` text; `caption` its text as
        a paragraph; `extension` and `inlineExtension` their `text` attribute; `placeholder` nothing,
        its text being the editor's prompt rather than the document's; a node no row names, or one
        standing where no spelling holds it, its blocks or its text.
      - Content the document only references — a stored file with no `alt`, an extension with no
        `text`, a `syncBlock`, a card with neither `url` nor `data` naming one — leaves MARKER.
      - A table stays a pipe table: the first row becomes the header, a cell's blocks join on one line
        with spaces, and a span keeps its cell under its header by empty cells in the columns and
        rows it covered, padding at most to the table's cell count.
      - A list stays a list: where CommonMark cannot hold a block inside an item, what gives way is
        what a reader does not see — the spaces of a whitespace-only code line, a rule's spelling.
      - `code`, `em`, `link`, `strike` and `strong` stay and every other mark drops, keeping its text —
        `subsup` too, since `~2~` is a strike on GitHub; a link no CommonMark escape writes has its
        `href` percent-encoded until one does, and a mark run CommonMark's flanking or matching cannot
        spell drops its mark.
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
- [x] **16 — The link wrapping a link (`0.2.0`).**
- [x] **17 — A machine-enforced size ratchet (`0.2.0`).**
- [x] **18 — The subtree the directive spelling asks about (`0.2.0`).**
- [x] **19 — A home for what both formats read (`0.2.0`).**
- [x] **20 — The give-way channel is unmistakable (`0.2.0`).**
- [x] **21 — The ADF tables carry ADF's nouns (`0.2.0`).**
- [x] **22 — `LineContainer` sits at the markdown level (`0.2.0`).**
- [x] **23 — The block-directive fragments are one file (`0.2.0`).**
- [x] **28 — `emitLine`'s retry loop cannot spin (`0.2.0`).**
- [x] **29 — The README reads raw HTML as refused for good (`0.2.0`).**
- [x] **30 — AGENTS.md says each thing once (`0.2.0`).**
- [x] **32 — The mark depth `adf/` counts is stated in ADF's terms (`0.2.0`).**

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

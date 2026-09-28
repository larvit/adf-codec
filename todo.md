# Todo

## 0.2.0

- **36 — Move every decision into `docs/decisions.md`, indexed from `AGENTS.md`.** Each entry states
  the decision, its date, who made it, the README goal it serves and the premise it is valid while;
  one no goal serves is proposed as a goal and asked. Sources: `AGENTS.md`'s body, the settled text
  in this file's items, and `todo-history.md`, deleted with the bare `(28)` citations into it once
  nothing cites it. Split by `AGENTS.md` section where one chunk is too big.
  - **36d — Move the settled text in `todo.md`'s items and §11 and §15's dated rules, and point
    §15's "the rule that closes it, landing here" at `docs/decisions.md`.** `AGENTS.md`'s sections
    are renumbered once only working rules remain, their citations with them.
  - **36e — Move `todo-history.md`'s decisions, re-point its citations and delete it.**
- **35 — Read and write plain markdown as a flavour of the markdown grammar.** Per Goal 2 and
  `docs/decisions.md` §Plain markdown is a flavour of the grammar, `plainMarkdownToAdf` is
  `markdownToAdf`'s parser and `adfToPlainMarkdown` `adfToMarkdown`'s writer, each with the plain
  flavour set; 10's rows are read and written there, and the lift goes (the maintainer, 2026-09-27).
  The exports, their refusals and 10's rows stay as they are.
  - **35a — Read the plain flavour in the parser and delete the lift.** 10's rows are read while
    parsing, and `plain-lift.ts` is deleted, its tests reading through `plainMarkdownToAdf`. `>
    [!faq]- Why?` with the body on the next `>` line reads to an expand titled `Why?` whose body
    keeps the next lines' link targets and marks, and `> [!tip] Title` then `> body` to a panel
    whose paragraphs are `Title` and `body`: the rest of the marker's line is the title (an expand)
    or the first body paragraph (a panel). A CommonMark backslash keeps a marker literal — `\==x==`,
    `> \[!NOTE]`, `- \[x]`.
  - **35b — Spell the plain flavour in the writer.** Panels, expands, task lists and highlights are
    written by the writer, which escapes text that would read back as one, so
    `plainMarkdownToAdf(adfToPlainMarkdown(doc))` keeps a literal `==x==`, a quote opening `[!NOTE]`
    and a list whose items all open `[x] ` as text. A highlighted `=` (today `=====`) and `a==b`
    (today `==a==b==`, highlighting `a` alone) come back highlighted whole, or lose the highlight
    where no spelling holds them; 10c's byte-for-byte property misses both, since the wrong document
    re-spells to the same bytes. The reduction keeps only degrading what the flavour cannot spell.
- **10f — Give task nodes read from plain markdown position ids.** `plainMarkdownToAdf` gives each
  `taskList`, `taskItem` and `blockTaskItem` a deterministic `localId` from its position in document
  order, so a site that rejects a missing `localId` takes the document and the same markdown reads
  to the same ids every run; README §Plain markdown's `localId` bullet says so (the maintainer,
  2026-09-26). The id spelling — unique within the document, no host API — is part of the chunk.
- **6 — Specify the HTML dialect.** Element-by-element mapping, the `data-*` fidelity scheme, the
  opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts — the set
  `markdownToAdf` shares (`spec/flavour.md` §Raw HTML in input; 29).
  **Settled** (the maintainer, 2026-09-20), the four answers that shape the set:
  - A container ADF has no node for unwraps to its children, its own attributes dropped, so `<div
    align="center">text</div>` keeps `text` and loses the box and the alignment ADF cannot hold.
  - `<details><summary>Title</summary>…</details>` is an `expand`, the summary its `title`; one
    inside another is a `nestedExpand`, as 10 already spells for the lossy pair. An empty
    `<details>` is still refused — `expand` requires content, so there is nothing to build.
  - A comment stays an error result. Neither schema holds a comment node: across 84 and 98
    definitions the only "comment" in either file is `annotationType: "inlineComment"` on the
    `annotation` mark, which carries an `id` and no text, the words living behind an Atlassian API.
    `placeholder` is the editor's own visible hint, and `extension` demands an `extensionKey` naming
    a vendor app. Nothing can hold the words, so nothing accepts them.
  - `<script>` and `<style>` drop whole, their text with them. Neither holds anything a reader of
    the document ever saw, so nothing is lost; unwrapping them would put `alert(1)` on the page as
    prose. A `style` attribute is a separate question — `textColor` and `backgroundColor` are the
    marks it could reach — and is not read at `0.2.0`, the work outweighing what it buys.
  So the set sorts every element three ways, and that is what `docs/decisions.md` §Foreign HTML is
  refused by name becomes in place of "error result naming the element": a container around document
  content unwraps, content ADF cannot hold is an error result naming it, and what is not document
  content at all drops whole. A comment sorts into the second rather than the third because a person
  wrote those words on purpose. 10's "Rejected in the survey" line names raw HTML and comments and
  does not contradict this: it rejects them as spellings the lossy pair writes and reads back, where
  `plainMarkdownToAdf` reads through `markdownToAdf`'s parser and so inherits whatever this set
  accepts.
- **7 — Ship HTML: `adfToHtml`, `htmlToAdf`, and `markdownToHtml` / `htmlToMarkdown` composed
  through ADF.** CommonMark spec suite runs against `markdownToHtml` from here. The README's
  tagline and `package.json`'s `description` regain HTML (5g).
- **31 — Make the branch figure the coverage floor is read against repeatable.** Three Node test
  legs over one unchanged tree reported `emit/inline-line.ts` at 95.83%, 96.23% and 96.23%, and the
  total at 98.80%, 98.84% and 98.84% (2026-09-21). `--experimental-test-coverage` counts branches
  off V8's own coverage, which the runner's parallel files and V8's optimization make run-dependent,
  so the number the floor is read against is not the code's alone. The floor of 98 holds today on
  0.8 points of slack and `docs/decisions.md` §The coverage floors says it only ever moves upward,
  so the first raise to the measured figure reddens a run that changed nothing. Make the
  measurement repeatable, or state the number the floor may be raised to and why it is not the
  measured one.
- **37 — State what the Deno leg proves that Node's does not, or drop it.** `docs/decisions.md` §The
  gate runs on Deno and Bun credits Deno with holding the module graph to fully-spelled specifiers,
  which Node already refuses under `"type": "module"`, and `tsc` under `NodeNext`.
- **33 — Make a carried mark run cost the line one re-emit.** `adfToMarkdown` spends 23 s on one
  paragraph of 2000 × `un` plus `**-r**`: each run its flanking cannot spell re-emits the whole line
  before riding the carry, quadratic in the runs (Goal 9), and the plain reduction's
  `spellableLine` drops one mark per re-emit the same way. Make both linear.
- **34 — Read emphasis flanking by the whole character beside an astral symbol.** Check whether
  `line-escaping.ts`'s `charAt` and the parser's flanking read one UTF-16 unit beside an astral
  symbol — a lone surrogate is neither punctuation nor symbol, where CommonMark reads `😀` as
  punctuation — and, where they do, read the code point, with a fixture per direction.
- **5f — Publish the bundle size, after 7 changes it.** Measure the shipped artifact and put the
  number in the README, kept honest by the release pipeline rather than by a human re-reading it.
  The quantity is what a consumer downloads and loads: the tarball `npm pack` produces, its unpacked
  `dist`, and the built JavaScript minified + gzipped — the figure the competitors advertise
  (marklassian's "12kb") and the only apple-to-apple one, since ours ships tsc's unminified output
  and no minifier yet (decide here whether to minify for the build or report the unminified gzip). A
  publish/pipeline leg measures it and fails when the README figure drifts, so the number can't rot;
  the figure lands in README §The package beside the "no runtime dependencies" claim. Measured
  today, unminified: tarball 60.4 kB, unpacked 221.5 kB, JS gzipped 45.6 kB.
- **5g — Reweight the README for the reader.** It opens with the pre-launch rationale — Atlassian's
  REST APIs, `pf-editor-service/convert` being decommissioned, a link to JRACLOUD-77436 — where a
  shipped package should answer what it is, what it does and for whom first, then the shortest
  runnable example.
  **Settled** (the maintainer, 2026-09-13): the background goes entirely, no endpoint, ticket or
  "why" note left. The top follows the package-README order: an npm version badge and the Gitea
  Actions badge, a tagline that is also `package.json`'s `description`, a feature list and a
  one-line table of contents, then install and the shortest runnable example; a table of everything
  exported sits near the bottom. The HTML directions were to stay an aside until a later release
  shipped them; 7 now ships in this one and reads ahead of this item, so the README documents HTML
  as it documents markdown, the tagline and `description` naming both (the maintainer, 2026-09-13,
  revised 2026-09-18). They name the lossy pair too, and the flavours it writes and reads by name —
  GitHub Flavored Markdown's alerts and task lists, Obsidian Flavored Markdown's callouts — so a
  search for either finds the package (the maintainer, 2026-09-26).

## 0.3.0

- **5e — Keep the release path publishing past npm's bypass-2FA token retirement.** `0.1.0`
  published only once the npm token carried **Bypass 2FA**: the account requiring no 2FA on writes
  was not enough, and npm answered `EOTP` until the token itself bypassed. npm retires bypass-2FA
  tokens for direct publishing around January 2027, leaving them `npm stage publish`, which a
  maintainer approves with 2FA; its replacement — trusted publishing over OIDC — supports
  GitHub-hosted Actions, GitLab.com's shared runners and CircleCI's cloud, self-hosted runners
  planned without a date. So the release path has an expiry date and no drop-in successor yet.
  Revisit: whether npm has added Gitea or self-hosted OIDC, and otherwise whether the release moves
  to the staged publish — which fits badly with publish-on-merge, and is the trade to weigh rather
  than discover on a red release run.
  **Settled** (the maintainer, 2026-09-13, placed in `0.3.0` 2026-09-27): clear of `0.2.0`, knowing
  the cutoff may land before `0.2.0` ships.
- **8 — Ship a CLI, shaped around the personas.**
- **9 — Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on
  the library's browser build.**

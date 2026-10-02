# Todo

## 0.2.0

- **43 — Give each markdown input its own reader, strict to its own standard.** Today
  `markdownToAdf` reads CommonMark and the lossless flavour as one input: text shaped like a
  directive, a pipe table or a `~~` pair becomes a flavour node where CommonMark reads plain text
  (Goals 3 and 4). A caller names the markdown it hands in: CommonMark, read as its spec says, or
  the lossless flavour, read as `spec/flavour.md` says. Breaking: `MIGRATION.md` says which call a
  caller takes.
- **40 — Make `markdownToAdf(adfToMarkdown(doc))` deep-equal `doc` for every document it takes.**
  Today it holds for editor-normal documents only: two adjacent text nodes with the same marks
  merge, an empty `attrs`, `marks` or `content` drops, and `-0` reads back `0` — shapes pipelines
  and bots build. Spell each so it reads back as written, CommonMark's spelling kept wherever none
  occurs; the spellings are part of the chunk. `docs/decisions.md` §Equality is editor-normal,
  `spec/flavour.md` and `corpus/README.md` follow, and the tests drop `toEditorNormal`.
- **6 — Specify the HTML dialect.** Element-by-element mapping, the `data-*` fidelity scheme, the
  opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts — the set
  `markdownToAdf` shares (`spec/flavour.md` §Raw HTML in input).
  The set sorts per `docs/decisions.md` §Foreign HTML sorts three ways.
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
- **33 — Make a carried mark run cost the line one re-emit.** `adfToMarkdown` spends 23 s on one
  paragraph of 2000 × `un` plus `**-r**`: each run its flanking cannot spell re-emits the whole line
  before riding the carry, quadratic in the runs (Goal 8), and the plain reduction's
  `spellableLine` drops one mark per re-emit the same way. Make both linear.
- **42 — Trim a text leaf's trailing blanks in linear time.** `plain-inline.ts`'s `leafEdges` finds
  the trail with an unanchored `/[ \t]*$/`, quadratic in a run of blanks inside one leaf: a
  paragraph of `a`, 80 000 spaces, `b` takes 6.5 s in `adfToPlainMarkdown` (Goal 8). Scan backward,
  as the expand title's trim does.
- **34 — Read emphasis flanking by the whole character beside an astral symbol.** Check whether
  `line-escaping.ts`'s `charAt` and the parser's flanking read one UTF-16 unit beside an astral
  symbol — a lone surrogate is neither punctuation nor symbol, where CommonMark reads `😀` as
  punctuation — and, where they do, read the code point, with a fixture per direction.
- **38 — Spell a lone surrogate in a text node so it survives a UTF-8 encode.** `adfToMarkdown`
  emits it verbatim, so markdown stored as UTF-8 reads back U+FFFD; attribute values already escape
  it.
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
  runnable example. The background goes entirely, no endpoint, ticket or
  "why" note left. The top follows the package-README order: an npm version badge and the Gitea
  Actions badge, a tagline that is also `package.json`'s `description`, a feature list and a
  one-line table of contents, then install and the shortest runnable example; a table of everything
  exported sits near the bottom. The README documents HTML as it documents markdown, the tagline and
  `description` naming both, the lossy pair, and the flavours it writes and reads by name — GitHub
  Flavored Markdown's alerts and task lists, Obsidian Flavored Markdown's callouts — so a search for
  either finds the package.
- **44 — Delete `AGENTS.md` §7's empty-release bullet, leaving the maintainer's global working loop
  to rule it.** "An earliest release with no items left and nothing shipped toward it is planned as
  the chunk" restates that loop, in a sentence its own prose rules ban.

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
  than discover on a red release run. It stays out of `0.2.0` knowing the cutoff may land first.
- **9 — Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on
  the library's browser build.**

## 0.4.0

- **8 — Ship a CLI.** Its goal and its persona land in the README's `## Goals` and `## Audience`
  with it.

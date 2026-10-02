# todo

## Scoring

`Score = -R - S/4 + 2*A + 2*G*W`

`Bar = 9`

`Next ID = 52`

| Goal | W |
|---|---|
| 1 | 1.00 |
| 2 | 0.89 |
| 3 | 0.78 |
| 4 | 0.67 |
| 5 | 0.56 |
| 6 | 0.44 |
| 7 | 0.33 |
| 8 | 0.22 |
| 9 | 0.11 |

## Items

| ID | Release | Exempt | Item | R | S | A | G | Goals | Score |
|---|---|---|---|---|---|---|---|---|---|
| 40 | 0.2.0 | decision | **Make `markdownToAdf(adfToMarkdown(doc))` deep-equal `doc` for every document `adfToMarkdown` takes.** | 6 | 7 | 8 | 9 | 1 | 26.2 |
| 7 | 0.2.0 |  | **Ship HTML: `adfToHtml`, `htmlToAdf`, and `markdownToHtml` / `htmlToMarkdown` composed through ADF.** | 6 | 9 | 9 | 9 | 2, 3 | 25.8 |
| 45 | 0.2.0 |  | **Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.** | 2 | 3 | 6 | 8 | 1 | 25.2 |
| 6 | 0.2.0 | decision | **Specify the HTML dialect.** | 2 | 6 | 7 | 8 | 2, 3 | 24.7 |
| 43 | 0.2.0 |  | **Give each markdown input its own reader, strict to its own standard.** | 6 | 7 | 8 | 9 | 3, 4 | 22.3 |
| 49 | 0.2.0 |  | **Read a list whose bullet or ordered delimiter changes as two lists, as CommonMark does.** | 3 | 3 | 5 | 8 | 3, 4 | 18.7 |
| 51 | 0.2.0 |  | **Match a reference label to its definition under Unicode case folding.** | 2 | 2 | 2 | 7 | 3, 4 | 12.4 |
| 50 | 0.2.0 |  | **Read `[](/url)` and `[]()` as CommonMark's empty link.** | 4 | 4 | 3 | 6 | 3, 4 | 10.4 |
| 38 | 0.3.0 |  | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 2 | 2 | 4 | 7 | 1 | 19.5 |
| 47 | 0.3.0 |  | **Open the README with what the package is, what it does and for whom.** | 1 | 4 | 7 | 9 | 9 | 14.0 |
| 34 | 0.3.0 |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 3 | 3 | 6 | 3, 4 | 12.6 |
| 42 | 0.3.0 |  | **Trim a text leaf's trailing blanks in linear time.** | 1 | 2 | 5 | 9 | 8 | 12.5 |
| 48 | 0.3.0 |  | **Keep the release path publishing past npm's bypass-2FA token retirement.** | 4 | 4 | 8 | 3 | 9 | 11.7 |
| 31 | 0.3.0 |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 3 | 3 | 4 | 1 | 11.2 |
| 33 | 0.3.0 |  | **Emit a line in time linear in its mark runs, in `adfToMarkdown` and `adfToPlainMarkdown`.** | 4 | 5 | 6 | 9 | 8 | 10.7 |
| 46 | 0.3.0 |  | **Publish the bundle size in the README, failing the release pipeline when it drifts.** | 2 | 4 | 5 | 5 | 7, 9 | 10.3 |
| 9 | 0.3.0 |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 2 | 6 | 6 | 8 | 9 | 10.3 |
| 8 | 0.4.0 |  | **Ship a CLI.** | 3 | 7 | 7 | 6 | 9 | 10.6 |

## Details

### 40. Make `markdownToAdf(adfToMarkdown(doc))` deep-equal `doc` for every document `adfToMarkdown` takes.

Today it holds for editor-normal documents only: two adjacent text nodes with the same marks merge,
an empty `attrs`, `marks` or `content` drops, and `-0` reads back `0` — shapes pipelines and bots
build. Spell each so it reads back as written; CommonMark's spelling stays wherever the document
holds none of these shapes. The spellings are part of the chunk. `docs/decisions.md` §Equality is
editor-normal, `spec/flavour.md` and `corpus/README.md` follow, and the tests drop `toEditorNormal`.

### 7. Ship HTML: `adfToHtml`, `htmlToAdf`, and `markdownToHtml` / `htmlToMarkdown` composed through ADF.

Lands after item 6. The CommonMark spec suite also runs against `markdownToHtml`. The README
documents HTML as it documents markdown, and its tagline and `package.json`'s `description` regain
HTML.

### 45. Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.

Goal 1 has every call return a result; the boolean guard is the one export that does not, and it
cannot say which branch refused, where `not-an-adf-document`'s message already does. Breaking:
`MIGRATION.md` shows the guard's replacement.

### 6. Specify the HTML dialect.

Element-by-element mapping, the `data-*` fidelity scheme, the opaque-carry form, and the documented
foreign-element set `htmlToAdf` accepts — the set `markdownToAdf` shares (`spec/flavour.md` §Raw
HTML in input). The set sorts per `docs/decisions.md` §Foreign HTML sorts three ways.

### 43. Give each markdown input its own reader, strict to its own standard.

Today `markdownToAdf` reads CommonMark and the lossless flavour as one input: text shaped like a
directive, a pipe table or a `~~` pair becomes a flavour node where CommonMark reads plain text. A
caller names the markdown it hands in: CommonMark, read as its spec says, or the lossless flavour,
read as `spec/flavour.md` says. Breaking: `MIGRATION.md` says which call a caller takes.

### 49. Read a list whose bullet or ordered delimiter changes as two lists, as CommonMark does.

`- a` then `+ b`, or `1.` then `1)`, opens one list where CommonMark opens two (spec examples 301
and 302). Breaking: it changes what a spelling the README documents builds, so it ships beside item
43. Its `pending` exceptions and the README's bullet on them go.

### 51. Match a reference label to its definition under Unicode case folding.

`link-syntax.ts` normalizes a label with `toLowerCase`, so `[ẞ]` misses its `[SS]` definition (spec
example 540); lowercasing and then uppercasing folds it. Breaking, as item 49. Its `pending`
exceptions and the README's bullet on them go.

### 50. Read `[](/url)` and `[]()` as CommonMark's empty link.

Both stay literal text today (spec examples 484 and 487). ADF holds no empty text node to carry a
link mark, so the chunk settles what the empty link builds by Goals 3 and 6, asked where they do not
decide it. Breaking, as item 49. Its `pending` exceptions and the README's bullet on them go.

### 38. Spell a lone surrogate in a text node so it survives a UTF-8 encode.

`adfToMarkdown` emits it verbatim, so markdown stored as UTF-8 reads back U+FFFD; attribute values
already escape it.

### 47. Open the README with what the package is, what it does and for whom.

It opens with the pre-launch rationale — Atlassian's REST APIs, `pf-editor-service/convert` being
decommissioned, a link to JRACLOUD-77436. The background goes entirely, no endpoint, ticket or "why"
note left. The badges are npm's version and the Gitea Actions status. The README names the lossy
pair, `adfToPlainMarkdown` and `plainMarkdownToAdf`, and the flavours it writes and reads — GitHub
Flavored Markdown's alerts and task lists, Obsidian Flavored Markdown's callouts — so a search for
any of these names finds the package.

### 34. Read emphasis flanking by the whole character beside an astral symbol.

Check whether `line-escaping.ts`'s `charAt` and the parser's flanking read one UTF-16 unit beside an
astral symbol — a lone surrogate is neither punctuation nor symbol, where CommonMark reads `😀` as
punctuation — and, where they do, read the code point, with a fixture per direction.

### 42. Trim a text leaf's trailing blanks in linear time.

`plain-inline.ts`'s `leafEdges` finds the trail with an unanchored `/[ \t]*$/`, quadratic in a run
of blanks inside one leaf: a paragraph of `a`, 80 000 spaces, `b` takes 6.5 s in
`adfToPlainMarkdown`. Scan backward, as the expand title's trim does.

### 48. Keep the release path publishing past npm's bypass-2FA token retirement.

Lands after 2027-01-01, or after a release run fails on the token, whichever comes first: the
maintainer waits to see whether the retirement bites (2026-10-02). `0.1.0` published only once the
npm token carried **Bypass 2FA**: the account requiring no 2FA on writes was not enough, and npm
answered `EOTP` until the token itself bypassed. npm retires bypass-2FA tokens for direct publishing
around January 2027, leaving them `npm stage publish`, which a maintainer approves with 2FA; its
replacement — trusted publishing over OIDC — supports GitHub-hosted Actions, GitLab.com's shared
runners and CircleCI's cloud, self-hosted runners planned without a date. Revisit: whether npm has
added Gitea or self-hosted OIDC, and otherwise whether the release moves to the staged publish —
which fits badly with publish-on-merge, and is the maintainer's trade to weigh. The Goals and G
cells are provisional: no README goal covers the release path. It stays out of `0.2.0` knowing the
cutoff may land first.

### 31. Make the branch-coverage figure repeat across runs of an unchanged tree.

Three Node test legs over one unchanged tree reported `emit/inline-line.ts` at 95.83%, 96.23% and
96.23%, and the total at 98.80%, 98.84% and 98.84% (2026-09-21). `--experimental-test-coverage`
counts branches off V8's own coverage, which the runner's parallel files and V8's optimization make
run-dependent, so the number the floor is read against is not the code's alone. The floor of 98
holds today on 0.8 points of slack and `docs/decisions.md` §The coverage floors says it only ever
moves upward, so the first raise to the measured figure reddens a run that changed nothing. Make the
measurement repeatable, or state the number the floor may be raised to and why it is not the
measured one.

### 33. Emit a line in time linear in its mark runs, in `adfToMarkdown` and `adfToPlainMarkdown`.

`adfToMarkdown` spends 23 s on one paragraph of 2000 × `un` plus `**-r**`: each run its flanking
cannot spell re-emits the whole line before riding the carry, quadratic in the runs, and the plain
reduction's `spellableLine` drops one mark per re-emit the same way. Make both linear.

### 46. Publish the bundle size in the README, failing the release pipeline when it drifts.

Lands after item 7, which changes it. The quantity is what a consumer downloads and loads: the
tarball `npm pack` produces, its unpacked `dist`, and the built JavaScript minified + gzipped — the
figure the competitors advertise (marklassian's "12kb") and the only apples-to-apples one, since
ours ships tsc's unminified output and no minifier yet (decide here whether to minify for the build
or report the unminified gzip). The figure lands in README §The package beside the "no runtime
dependencies" claim. Measured today, unminified: tarball 60.4 kB, unpacked 221.5 kB, JS gzipped 45.6
kB.

### 8. Ship a CLI.

The Goals and G cells are provisional: no goal or persona in the README covers a CLI yet. Naming
both is part of the work (the maintainer, 2026-10-02): the chunk proposes them, and they land in the
README's `## Goals` and `## Audience` with the CLI.

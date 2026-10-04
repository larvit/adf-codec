# todo

## Scoring

`Score = -R - S/4 + 2*A + 2*G*W`

`Bar = 9`

`Next ID = 66`

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
| 63 | 0.2.0 | defect | **Refuse a cyclic input as `not-an-adf-document`.** | 2 | 2 | 6 | 9 | 1 | 27.5 |
| 7 | 0.2.0 |  | **Ship HTML: `adfToHtml`, `htmlToAdf`, and `markdownToHtml` / `htmlToMarkdown` composed through ADF.** | 6 | 9 | 9 | 9 | 2, 3 | 25.8 |
| 55 | 0.2.0 | defect | **Spell every document the emitter refuses today for a carriage return, a NUL, a code-span line start, a newline inside an emoji, mention or status, or a text node whose text is empty or missing, or which holds content.** | 5 | 5 | 7 | 9 | 1 | 25.8 |
| 45 | 0.2.0 |  | **Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.** | 2 | 3 | 6 | 8 | 1 | 25.2 |
| 6 | 0.2.0 | decision | **Specify the HTML dialect.** | 2 | 6 | 7 | 8 | 2, 3 | 24.7 |
| 64 | 0.2.0 | defect | **Read back unchanged on V8 every JSON key the emitter writes, with a fixture whose key holds `\`, `"` or a control character.** | 4 | 4 | 6 | 8 | 1, 7 | 23.0 |
| 43 | 0.2.0 | decision | **Give each markdown input its own reader, strict to its own standard.** | 6 | 7 | 8 | 9 | 3, 4 | 22.3 |
| 65 | 0.2.0 | defect | **Read an image not alone in its paragraph as its alt text linked to its URL, and a titled image alone in its paragraph as the image captioned with its title.** | 5 | 5 | 7 | 7 | 3, 4, 6 | 18.7 |
| 49 | 0.2.0 |  | **Read a list whose bullet or ordered delimiter changes as two lists, in both readers, and retire `!adf:listBreak`.** | 4 | 5 | 5 | 8 | 3, 4 | 17.2 |
| 61 | 0.2.0 | decision | **Have the emitter ask the inline reader how a line reads back, in place of `line-escaping.ts` predicting it.** | 6 | 8 | 3 | 8 | 1 | 14.0 |
| 52 | 0.2.0 |  | **Spell `colwidth` as a comma list, `colwidth="340,420"`.** | 3 | 3 | 5 | 6 | 5 | 13.0 |
| 51 | 0.2.0 |  | **Match a reference label to its definition under Unicode case folding.** | 2 | 2 | 2 | 7 | 3, 4 | 12.4 |
| 53 | 0.2.0 |  | **Put a block's `marks` spelling to the writer panel and adopt its pick.** | 4 | 5 | 5 | 6 | 5 | 11.5 |
| 60 | 0.2.0 | decision | **Collect the questions `parse/` asks `emit/` into one named module.** | 3 | 4 | 2 | 6 | 2 | 10.7 |
| 59 | 0.2.0 | decision | **Group the directive grammar into `src/markdown/directive/`, move `Read<T>` to `result.ts`, and move `Flavour` to `markdown/flavour.ts`.** | 3 | 5 | 2 | 6 | 2 | 10.4 |
| 50 | 0.2.0 |  | **Read `[](/url)` and `[]()` as CommonMark's empty link.** | 4 | 4 | 3 | 6 | 3, 4, 6 | 10.4 |
| 62 | 0.2.0 | decision | **Move the plain flavour's reading out of `parse/` and its writing out of `emit/` into `markdown/plain/`, so `emit/` no longer imports `plain/`.** | 4 | 5 | 2 | 6 | 2 | 9.4 |
| 38 | 0.3.0 |  | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 2 | 2 | 4 | 7 | 1 | 19.5 |
| 47 | 0.3.0 |  | **Open the README with what the package is, what it does and for whom.** | 1 | 4 | 7 | 9 | 9 | 14.0 |
| 34 | 0.3.0 |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 3 | 3 | 6 | 3, 4 | 12.6 |
| 42 | 0.3.0 |  | **Trim a text leaf's trailing blanks in linear time.** | 1 | 2 | 5 | 9 | 8 | 12.5 |
| 48 | 0.3.0 |  | **Keep the release path publishing past npm's bypass-2FA token retirement.** | 4 | 4 | 8 | 3 | 9 | 11.7 |
| 31 | 0.3.0 |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 3 | 3 | 4 | 1 | 11.2 |
| 33 | 0.3.0 |  | **Emit a line in time linear in its mark runs, in `adfToMarkdown` and `adfToPlainMarkdown`.** | 4 | 5 | 6 | 9 | 8 | 10.7 |
| 46 | 0.3.0 |  | **Publish the bundle size in the README, failing the release pipeline when it drifts.** | 2 | 4 | 5 | 5 | 7, 9 | 10.3 |
| 9 | 0.3.0 |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 2 | 6 | 6 | 8 | 9 | 10.3 |
| 56 | 0.3.0 | principle | **Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.** | 4 | 5 | 2 | 4 | 1 | 6.8 |
| 57 | 0.3.0 | principle | **Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.** | 2 | 3 | 1 | 3 | 7 | 1.2 |
| 58 | 0.3.0 | principle | **Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.** | 4 | 6 | 1 | 2 | 7 | -2.2 |
| 8 | 0.4.0 |  | **Ship a CLI.** | 3 | 7 | 7 | 6 | 9 | 10.6 |

## Details

### 63. Refuse a cyclic input as `not-an-adf-document`.

`adfDocumentFault` walks with `isNodeArray` (`adf/document.ts`) and `isJsonValue` (`json-value.ts`),
worklists that record no visited object, so a node whose `content` holds itself hangs
`adfToMarkdown`, `adfToPlainMarkdown` and `isAdfDocument`; README §The guarantees promises no input
loops forever.

### 7. Ship HTML: `adfToHtml`, `htmlToAdf`, and `markdownToHtml` / `htmlToMarkdown` composed through ADF.

Lands after items 6, 59, 60, 61 and 62. The CommonMark spec suite also runs against
`markdownToHtml`. The README documents HTML as it documents markdown, and its tagline and
`package.json`'s `description` regain HTML.

### 55. Spell every document the emitter refuses today for a carriage return, a NUL, a code-span line start, a newline inside an emoji, mention or status, or a text node whose text is empty or missing, or which holds content.

Today `inline-line.ts` refuses a carriage return or NUL in text, and a NUL in an emoji, mention or
status (`unspellable-character`), and a paragraph opening with a code-span run (`unspellable-line-start`); `fencedTexts` refuses the same
characters in a code block; `inline-line.ts` refuses a newline in an emoji, mention or status
(`unspellable-whitespace`); `inline-line.ts` and `fencedTexts` refuse a text node whose `text` is
empty or missing, and `inline-line.ts` one holding `content`. The carries spell all of them: the
inline carry in a paragraph, the block carry in a code block. Inline, a carriage return or NUL
could ride `!adf:text{text="…"}` instead, which keeps the text readable — a writer panel picks.

The maintainer approved on 2026-10-04: §Markdown in is a canonical fixpoint drops its code-span
exception, §Which code a cause takes drops `unspellable-character`, and drops `unspellable-whitespace` as an
emitter cause, and `unspellable-character` and `unspellable-line-start` retire.
`unspellable-whitespace` stays, since the reader raises it for a content slot spanning a newline.
Found by the README-goals audit, 2026-10-03.

### 45. Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.

Goal 1 has every call return a result; the boolean guard is the one export that does not, and it
cannot say which branch refused, where `not-an-adf-document`'s message already does. Breaking:
`MIGRATION.md` shows the guard's replacement.

### 6. Specify the HTML dialect.

Element-by-element mapping, the `data-*` fidelity scheme, the opaque-carry form, and the documented
foreign-element set `htmlToAdf` accepts — the set `markdownToAdf` shares (`spec/flavour.md` §Raw
HTML in input). The set sorts per `docs/decisions.md` §Foreign HTML sorts three ways.

### 64. Read back unchanged on V8 every JSON key the emitter writes, with a fixture whose key holds `\`, `"` or a control character.

`property-harness.ts` strips `\`, `"` and control characters from generated JSON keys, citing V8's
`JSON.parse` returning a wrong key for an escaped backslash. The library reads `json` attributes
(`directive-syntax.ts`) and both carries (`opaque-carry.ts`) through that `JSON.parse`, so on Node,
Deno and Chrome the round-trip would refuse its own output or read back a different key; the fixture
tells which. Confirm with a fixture first; then read JSON with our own parser or record the gap with
an ending item. Found by the README-goals audit, 2026-10-03.

### 43. Give each markdown input its own reader, strict to its own standard.

Today `markdownToAdf` reads CommonMark and the lossless flavour as one input: text shaped like a
directive, a pipe table or a `~~` pair becomes a flavour node where CommonMark reads plain text, and
a code fence whose info string opens `adf:` becomes the block carry where CommonMark reads code. A
caller names the markdown it hands in: CommonMark, read as its spec says, or the lossless flavour,
read as `spec/flavour.md` says. Breaking: `MIGRATION.md` says which call a caller takes.

### 65. Read an image not alone in its paragraph as its alt text linked to its URL, and a titled image alone in its paragraph as the image captioned with its title.

Both are refused today with `unmappable-image`: 14 examples in
`corpus/commonmark-spec/refusals.json`, a bot's `See ![diagram](url) here` among them. `mediaInline`
takes only Atlassian media ids, never a URL. An image not alone in its paragraph reads as its alt
text, linked to its URL. Its title becomes the link's `title`. An empty alt text reads as the URL,
as item 50 reads an empty link. A titled image alone in its paragraph reads as the image, with its
title as a `caption` (the maintainer, 2026-10-04). By Goal 4, the lossless flavour reads both the same way. An image inside
a link, `[![moon](moon.jpg)](/uri)` (spec example 517), would need two links on one text node: the
chunk settles which link the alt text keeps by Goal 6, and asks where it does not decide.

### 49. Read a list whose bullet or ordered delimiter changes as two lists, in both readers, and retire `!adf:listBreak`.

Lands after item 43. Today `- a` then `+ b`, or `1.` then `1)`, reads as one list; CommonMark reads
two (spec examples 301 and 302). Goal 4 settles it for the lossless flavour too: CommonMark spells
adjacent lists by changing the marker, so `adfToMarkdown` and `adfToPlainMarkdown` alternate `-`
and `*` between adjacent bullet lists and `.` and `)` between adjacent ordered lists, and
`!adf:listBreak` retires. `*` is the maintainer's pick (2026-10-04); ordered lists have only `)`. Breaking, so it ships beside item 43: `MIGRATION.md`'s
Readings and Spellings tables gain their rows. Examples 301 and 302 lose their `pending` exceptions,
and the spelling leaves the README's "Four CommonMark spellings" bullet, which counts one fewer.

### 61. Have the emitter ask the inline reader how a line reads back, in place of `line-escaping.ts` predicting it.

The comprehension panel's worst place: `escapeClaims` and `escapeClosedRuns` re-implement the
reader's view — flanking, code-span closers, link-definition openings, highlight flanking — and
only the property tests catch drift. It caps the panel's Locality score.

### 52. Spell `colwidth` as a comma list, `colwidth="340,420"`.

A writer panel chose it on 2026-10-03, 5 of 7, over today's `colwidth="[340,420]"`. Breaking:
`MIGRATION.md`'s Spellings table gains its row.

### 51. Match a reference label to its definition under Unicode case folding.

`link-syntax.ts` normalizes a label with `toLowerCase`, so `[ẞ]` misses its `[SS]` definition (spec
example 540); lowercasing and then uppercasing folds it. Breaking, so it ships beside item 43:
`MIGRATION.md`'s Readings table gains its row. Its `pending` exceptions go, and its spelling leaves
the README's "Four CommonMark spellings" bullet, which counts one fewer.

### 53. Put a block's `marks` spelling to the writer panel and adopt its pick.

Today `marks="[{\"attrs\":{\"mode\":\"wide\"},\"type\":\"breakout\"}]"`, the marks array as
escaped JSON. Breaking where the panel picks another spelling: `MIGRATION.md`'s Spellings table
gains its row.

### 60. Collect the questions `parse/` asks `emit/` into one named module.

`parse/` asks `emit/` through `commonMarkSpelling` and `openingLinkTakesDirective`, each imported
from where it happens to live. One module naming the questions keeps `docs/decisions.md` §The source
parts by ADF and format true as they grow.

### 59. Group the directive grammar into `src/markdown/directive/`, move `Read<T>` to `result.ts`, and move `Flavour` to `markdown/flavour.ts`.

Eight directive files sit across three directories, and the `markdown/` root holds 14 entries. HTML
needs `Read<T>` and `Flavour` out of the plain flavour and `markdown/`; it needs the carry and the
mark spellings too, which item 7 moves where it learns what HTML shares.

### 50. Read `[](/url)` and `[]()` as CommonMark's empty link.

Both stay literal text today (spec examples 484 and 487). ADF holds no empty text node to carry a
link mark, so a link whose text is empty takes its URL as its text (the maintainer, 2026-10-04):
`[](/url)` reads as `/url` linked to `/url`. `[]()` has no URL to show; the chunk settles it by Goals
3 and 6. Breaking, so it ships beside item 43: `MIGRATION.md`'s Readings table gains its row. Its
`pending` exceptions go, and its spelling leaves the README's "Four CommonMark spellings" bullet,
which counts one fewer.

### 62. Move the plain flavour's reading out of `parse/` and its writing out of `emit/` into `markdown/plain/`, so `emit/` no longer imports `plain/`.

Reading: the alert and task-marker reads in `parse/markdown-to-adf.ts`, the `mintTaskIds` call and
the `inlineLeaves` use. Writing: `spellPlainBlock`, `quotedUnder`, `tryTaskList` and `taskBlocks` in
`emit/adf-to-markdown.ts`. And `highlightDelimiter` and `highlightFlanking` move out of
`plain/conventions.ts`, which `emit/` imports them from; item 59 moves `Flavour`. Every comprehension reader on 2026-10-03
named the plain flavour's spread across three directories.

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

`plain/inline-reduction.ts`'s `leafEdges` finds the trail with an unanchored `/[ \t]*$/`, quadratic
in a run of blanks inside one leaf: a paragraph of `a`, 80 000 spaces, `b` takes 6.5 s in
`adfToPlainMarkdown`. Scan backward, as the expand title's trim does.

### 48. Keep the release path publishing past npm's bypass-2FA token retirement.

Lands after 2027-01-01, or after a release run fails on the token, whichever comes first: the
maintainer chose on 2026-10-02 to wait and see whether the retirement bites. It holds back no
release: when the rest of its release is done, it moves to the next. `0.1.0` published only once the
npm token carried **Bypass 2FA**: the account requiring no 2FA on writes was not enough, and npm
answered `EOTP` until the token itself bypassed. npm retires bypass-2FA tokens for direct publishing
around January 2027, leaving them `npm stage publish`, which a maintainer approves with 2FA; its
replacement — trusted publishing over OIDC — supports GitHub-hosted Actions, GitLab.com's shared
runners and CircleCI's cloud, self-hosted runners planned without a date. Revisit: whether npm has
added Gitea or self-hosted OIDC, and otherwise whether the release moves to the staged publish —
which fits badly with publish-on-merge, and is the maintainer's trade to weigh. The Goals and G
cells are provisional: no README goal covers the release path.

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

### 56. Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.

Technical principle "One owner per value": the `Walk` record passes through twelve functions that
mutate it and return `void`; `walk.leaf` alone is written in seven places. `ContainerStack` in the
same file shows the shape to follow.
`inline-content.ts`'s `Scan` has the same shape: about fifteen functions write `pending`, `pieces`,
`deactivatedBefore` and `openingSpellableLink` and return `void`, and `parseInlineContent` reads a
flag `scanInline` leaves on it.

### 57. Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.

Technical principle "Compose, do not entangle": Deno, Bun and the tests read the install leg's
`node_modules`, the floor and consumer legs the pack leg's, and the browser leg whatever `dist/` the
build leg left, so a leg run alone can pass on stale output.

### 58. Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes.

### 8. Ship a CLI.

The Goals and G cells are provisional: no README goal or persona covers a CLI yet. The chunk
proposes both (the maintainer, 2026-10-02), and they land in the README's `## Goals` and `##
Audience` with the CLI.

# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 178`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 153 | 0.4.0 |  | question | **Decide whether `src/markdown/` root may import `emit/`, `parse/` or `portable/`, and hold the answer in `.oxlintrc.json` and §The source parts by ADF and format.** | 1 | 2 | 2 | 3 | 2 | code health by 3 | 26.2 |
| 112 | 0.4.0 |  |  | **Pad a GFM pipe table's short rows with empty cells, read its body rows holding no pipe, and read a one-column table without leading pipes in `portableMarkdownToAdf`.** | 2 | 1 | 2 | 3 | 3 | 4 by 4 | 6.2 |
| 80 | 0.4.0 |  |  | **Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.** | 2 | 1 | 2 | 3 | 3 | 6 by 4 | 6.0 |
| 171 | 0.4.0 |  | principle | **Assert the facts an error message must carry, never its whole sentence, in `markdown-to-adf.test.ts`, `document.test.ts` and `html-to-adf.test.ts`.** | 3 | 1 | 1 | 3 | 6 | code health by 3 | 4.4 |
| 173 | 0.4.0 |  | principle | **Move each CommonMark spelling's description out of `commonMarkSpellings`, beside the emitter's spelling it describes.** | 2 | 1 | 1 | 2 | 4 | code health by 1 | 4.4 |
| 147 | 0.4.0 |  |  | **Ship `adfToPlainText`, writing a document's content with no markup, under a README goal for plain text.** | 2 | 2 | 1 | 3 | 4 | 3 by 4 | 4.2 |
| 141 | 0.4.0 |  | decision | **Write `strike` as HTML in `adfToHtml` and read it back in `htmlToAdf`, in place of the carry element.** | 1 | 1 | 1 | 1 | 2 | 6 by 2 | 4.0 |
| 135 | 0.4.0 |  |  | **Write media, media groups and captions as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 4 | 6 by 2 | 2.0 |
| 136 | 0.4.0 |  |  | **Write underline, text and background colours, subscript, superscript, alignment and indentation as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 4 | 6 by 2 | 2.0 |
| 134 | 0.4.0 |  | decision | **Write panels, expands, task lists and decision lists as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 5 | 6 by 3 | 1.8 |
| 46 | 0.4.0 | 134, 135, 136 |  | **Publish the bundle size in the README, failing the release pipeline when it drifts.** | 2 | 2 | 1 | 3 | 4 | 3 by 3 | 3.2 |
| 174 | 0.4.0 |  | defect | **Bound the passes `trimmedEdges` takes by a constant, so a line of alternating code and emphasized blanks trims in linear time.** | 3 | 1 | 2 | 4 | 7 | 9 by 3 | 2.3 |
| 51 | 0.4.0 |  |  | **Match a reference label to its definition under Unicode case folding.** | 2 | 1 | 2 | 3 | 4 | 4 by 2 | 2.1 |
| 148 | 0.4.0 |  |  | **Ship conversion between ADF and Jira wiki markup both ways, under a README goal for wiki markup.** | 3 | 2 | 2 | 5 | 7 | 3 by 5 | 0.9 |
| 149 | 0.4.0 |  |  | **Read any HTML into ADF, in a call or option a developer panel picks, under a README goal for foreign HTML.** | 3 | 2 | 2 | 5 | 7 | 3 by 5 | 0.9 |
| 172 | 0.4.0 |  | principle | **Build one test per reader or case in place of a loop inside a test body, in the 26 test files that loop.** | 3 | 1 | 1 | 3 | 8 | code health by 2 | 0.8 |
| 107 | 0.4.0 |  | decision | **Spell the block carry's JSON so its length stays linear in the node's JSON.** | 3 | 1 | 3 | 5 | 5 |  | 0.0 |
| 170 | 0.4.0 |  | owner | **Bundle the packed tarball with webpack, esbuild, Rollup and Bun in the gate, failing on any bundler warning, and run each bundle's round-trip in Node.** | 3 | 1 | 1 | 3 | 5 |  | 0.0 |
| 42 | 0.5.0 |  | defect | **Trim a text leaf's trailing blanks in linear time.** | 1 | 1 | 2 | 2 | 2 | 9 by 3 | 26.2 |
| 31 | 0.5.0 |  |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 19.6 |
| 57 | 0.5.0 |  |  | **Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 19.6 |
| 38 | 0.5.0 |  | defect | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 1 | 1 | 2 | 2 | 2 | 1 by 2 | 17.4 |
| 76 | 0.5.0 |  |  | **State the files the package does not ship once, so the build, the lint ceiling, the coverage exclusions and the mutation run cannot drift apart.** | 1 | 1 | 1 | 1 | 2 | code health by 2 | 17.4 |
| 56 | 0.5.0 |  |  | **Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.** | 3 | 1 | 2 | 4 | 5 | code health by 5 | 13.1 |
| 118 | 0.5.0 |  |  | **Spell a portable link's title through `oneLine`.** | 1 | 1 | 1 | 1 | 1 | code health by 1 | 10.5 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | code health by 1 | 6.5 |
| 58 | 0.5.0 |  |  | **Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.** | 4 | 2 | 2 | 6 | 6 | code health by 3 | 4.4 |
| 9 | 0.5.0 |  |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 3 | 2 | 1 | 4 | 6 | 3 by 6 | 2.1 |
| 34 | 0.5.0 |  |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 1 | 2 | 3 | 3 | 4 by 1 | 1.5 |
| 74 | 0.5.0 |  | owner | **Keep the release path publishing after npm retires bypass-2FA tokens.** | 3 | 2 | 4 | 7 | 4 |  | 0.0 |
| 8 | 0.6.0 |  | owner | **Ship a CLI.** | 3 | 2 | 1 | 4 | 7 |  | 0.0 |
| 139 | 0.7.0 |  | decision | **Ship the calls between markdown and HTML, composed through ADF and each named by its flavour.** | 2 | 1 | 2 | 3 | 4 | 3 by 3 | 3.2 |
| 137 | 0.7.0 |  | decision | **Read foreign HTML in `htmlToAdf` the three ways `docs/decisions.md` §Foreign HTML sorts three ways states.** | 2 | 1 | 2 | 3 | 4 | 4 by 2 | 2.1 |
| 138 | 0.7.0 | 137 |  | **Read raw HTML in every markdown reader through `htmlToAdf`'s foreign-element mapping, in place of refusing it as `unmappable-html`.** | 3 | 1 | 3 | 5 | 5 | 4 by 4 | 2.5 |

## Renamed

- 0.2.1 renamed to 0.3.0

## Details

### 153. Decide whether `src/markdown/` root may import `emit/`, `parse/` or `portable/`, and hold the answer in `.oxlintrc.json` and §The source parts by ADF and format.

The writers read each escaped line back through `src/markdown/inline-content.ts`'s scan. A writer
question put back on that scan's path, such as the opening-link consult `parseInlineContent` takes
as an argument today, would close the cycle writer → reader → writer and recurse without bound on
a paragraph opening with a spellable `!adf:link` (§Nothing recurses unbounded). The override for
`src/markdown/**` bans only `html/`; banning `emit/`, `parse/` and `portable/` for the root's own
files, with its `ci.sh` probe, extends the decision.

### 112. Pad a GFM pipe table's short rows with empty cells, read its body rows holding no pipe, and read a one-column table without leading pipes in `portableMarkdownToAdf`.

GFM pads a short row with empty cells, reads a line holding no `|` after a table as a row, and
reads `a |` over `--- |` as a one-column table. `portableMarkdownToAdf` refuses a short row as
`malformed-pipe-table`, ends the table at a line holding no `|`, and reads the one-column shape as a
paragraph. A long row stays refused (`docs/decisions.md` §The portable reader refuses what GFM's
reading would drop), so the README's pipe-table guarantee keeps the long row for both readers, and
the short row and the line holding no `|` for `losslessMarkdownToAdf` alone. The one-column shape needs `isBareDelimiterRow` in the writer's escaping to cover it too.

### 80. Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.

Today `readAdfDocument` and the converters refuse every node, such as one with a `Date` in an
attribute, with the message `an ADF document's content holds ADF nodes: one of them is not` and an
empty `path`. An export tool told this about one document in thousands then searches that
document's whole tree. Give the node's path, and name its type and the attribute key as
`attributeNestingMessage` does. Found by the product-owner review of items 66 and 67, 2026-10-05.

### 171. Assert the facts an error message must carry, never its whole sentence, in `markdown-to-adf.test.ts`, `document.test.ts` and `html-to-adf.test.ts`.

README → Audience says no persona may rely on a message's wording, yet `content()` in
`src/markdown/parse/markdown-to-adf.test.ts` folds a failure into `${code}: ${message}`, about 103
assertions compare that whole sentence, and `document.test.ts` (7) and `html-to-adf.test.ts` (3)
pin `message:` the same way. A rewording fails tests with no behaviour changed, while the facts
§`message` and `path` requires (the violation, the escape named) are never asserted on their own.
Assert `code`, `path` and `position` exactly, and match `message` against the facts it must carry.
Technical principle: "Pin wording only where the wording is the contract". Found by the principles
audit of the release review of 0.3.0, 2026-11-08.

### 173. Move each CommonMark spelling's description out of `commonMarkSpellings`, beside the emitter's spelling it describes.

`commonMarkSpellings` (`src/markdown/parse/markdown-to-adf.ts`) restates in prose the spellings
`spellReadableBlock` (`src/markdown/emit/adf-to-markdown.ts`) owns, such as "each item behind `- `,
or behind `* ` where …". A changed spelling leaves the refusal naming the old one, and a node
missing from the map is refused naming no spelling. Put each description beside the spelling and
export it through `emit/spelling-questions.ts`, the one import `parse/` may take from `emit/`, and
drop the comment at `markdown-to-adf.ts:145` that keeps them apart.
Technical principle: DRY. Found by the principles audit of the release review of 0.3.0, 2026-11-08.

### 147. Ship `adfToPlainText`, writing a document's content with no markup, under a README goal for plain text.

Asked on the Atlassian developer community for search indexing, notifications, emails and CSV
exports, where markdown's markers are noise, and with a mention as `@Display Name` rather than an
account id. Add the goal to the README's `## Goals` in the same change. Split into items before
starting. The maintainer, 2026-10-28: ship what exists first, so this waits for 0.4.0.

Once it ships, answer developer-community topic 41858, which asks for ADF as plain text (the
maintainer, 2026-10-28).

### 141. Write `strike` as HTML in `adfToHtml` and read it back in `htmlToAdf`, in place of the carry element.

GFM spells `strike`, and no other HTML item writes it: `adfToHtml` writes only the marks CommonMark
spells. A writer panel picks `<s>` or `<del>`. A reader panel (`docs/decisions.md`, the
feature-table entry) expected `<s>` or `<del>`, and the writer panel takes that as input.

### 135. Write media, media groups and captions as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

A writer panel picks the spellings; a plain external image already has one, `<p><img …></p>`.
Atlassian's editor puts `localId`, `width` and `widthType` on every `mediaSingle`, so every
editor-written image rides the carry until this item.

### 136. Write underline, text and background colours, subscript, superscript, alignment and indentation as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

A writer panel picks the spellings.

### 134. Write panels, expands, task lists and decision lists as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

An expand is `<details><summary>`, as `htmlToAdf` reads it (`docs/decisions.md` §Foreign HTML sorts
three ways). A writer panel picks the rest. A reader panel (`docs/decisions.md`, the feature-table
entry) expected a panel as `<div class="adf-panel" data-panel-type="…">` and a task list as
`<ul class="adf-task-list">` of `<li data-state="DONE|TODO">` with a checkbox input, and the writer
panel takes these as input.

### 46. Publish the bundle size in the README, failing the release pipeline when it drifts.

The HTML items change the size. The quantity is what a consumer downloads and loads: the
tarball `npm pack` produces, its unpacked `dist`, and the built JavaScript minified + gzipped — the
figure the competitors advertise (marklassian's "12kb") and the only apples-to-apples one, since
ours ships tsc's unminified output and no minifier yet (decide here whether to minify for the build
or report the unminified gzip). The figure lands in README §The package beside the "no runtime
dependencies" claim, and in a size column of the comparison table. Measured today,
unminified: tarball 60.4 kB, unpacked 221.5 kB, JS gzipped 45.6 kB.

### 174. Bound the passes `trimmedEdges` takes by a constant, so a line of alternating code and emphasized blanks trims in linear time.

`trimmedEdges` (`src/markdown/portable/inline-reduction.ts`) repeats a pass until nothing changes, and
each pass costs O(leaves) while leaf text is short; the trailing-blank scan inside one long leaf is
item 42's. Leaves alternating `' '` marked code with `' '` marked em take
ceil(n/4) + 1 passes: 26, 251 and 2 501 at n = 100, 1 000 and 10 000, so the trim is quadratic,
against goal 9. The same holds for `'x'` code beside `' '` em, and for `[link, code] 'x'` beside
`[link, em] ' '`. The smallest line is six leaves `' '` marked code, em, code, em, code, em, which
takes 3 passes. The passes in a random search of 20 000 short lines never went above 4.

The cause: under `spanned` grouping an em or link run crosses the code leaves, which can't hold
it, so one run spans the line and only its two end leaves stand beside a neighbour outside it. Each
pass strips em from those two, and the next pair is exposed. A single pass cannot take the fixpoint
directly: every pass judges all leaves against one snapshot, and `edgeOutcome` (drop at a line edge
while a run is shared, keep when not) isn't monotone. A hard break between `[link, em] ' '` and
`[link, em] ' b'` trims to `b` today, but to a linked space and `b` if the first leaf's drop is seen
first. Two ways forward: make the edge rule monotone, which changes output in edge cases and
needs a decision and a writer panel; keep run extents under truncation in `runsSharedWithNext`
(`emit/inline-runs.ts`), exact but large. Count passes
to measure, never time (§Cost fixes are measured, never timed). Found by the principles audit of the release review of 0.3.0, 2026-11-08.

### 51. Match a reference label to its definition under Unicode case folding.

`link-syntax.ts` normalizes a label with `toLowerCase`, so `[ẞ]` misses its `[SS]` definition (spec
example 540). Fold with Unicode's full case folding, `CaseFolding.txt`'s C and F mappings, shipped
as data per §Standards ship as data: lowercasing and then uppercasing would also merge `ı` with
`I`, which folding keeps apart, so add that pair as a fixture. Breaking: `MIGRATION.md`'s Readings table
gains its row. Its `pending` exceptions go, and the README's guarantees drop the case-folding
exception and count one fewer.

### 148. Ship conversion between ADF and Jira wiki markup both ways, under a README goal for wiki markup.

Jira's REST API v2 and its changelogs carry wiki markup, and Atlassian's
`WikiMarkupTransformer` is the only converter; community threads report its round-trip losing
expands, layouts and some marks. Add the goal to the README's `## Goals` in the same change. Split
into items before starting. The maintainer, 2026-10-28: ship what exists first, so this waits for
0.4.0.

### 149. Read any HTML into ADF, in a call or option a developer panel picks, under a README goal for foreign HTML.

`htmlToAdf` reads only what `adfToHtml` writes. The most asked need on the Atlassian
developer community is HTML from emails, CMSs and editors into ADF. The maintainer, 2026-10-28:
reading foreign HTML is a separate goal, added to the README in this change. Before building, a
panel of the developer personas picks the API among those the goals allow: a parameter on
`htmlToAdf` or a separate call; Goal 8's "nothing to configure" and Goal 6.1's naming bear on the
choice. Split into items once the API is picked.

### 172. Build one test per reader or case in place of a loop inside a test body, in the 26 test files that loop.

134 loops run several readers or cases inside one test body, for example
`for (const read of [commonMarkToAdf, losslessMarkdownToAdf, portableMarkdownToAdf])` at lines 97,
279, 771, 917, 926, 962 and 1118 of `src/markdown/parse/markdown-to-adf.test.ts`; the most are in
`adf-schema.test.ts` (18), `limits.test.ts` (12) and `portable-markdown-to-adf.test.ts` (10). The
first failing reader stops the test and the failure never names the reader. Write
``for (const read of readers) test(`… in ${read.name}`, …)`` at the top level. Technical principle:
"No loops or branches in a test body; parametrize the cases". Found by the principles audit of the
release review of 0.3.0, 2026-11-08.

### 107. Spell the block carry's JSON so its length stays linear in the node's JSON.

The block carry indents two spaces a level, so about 1 MB of deeply nested arrays in a carried
node's JSON spells past V8's longest string, which the writers refuse as `unsupported-node-shape`;
the inline carry's compact JSON would fit. docs/decisions.md §The code list calls a refusal no
spelling recovers from a gap in the flavour. Respelling the carry changes the format (§The formats
are API). Found by the README-goals audit of item 83, 2026-10-11.

### 170. Bundle the packed tarball with webpack, esbuild, Rollup and Bun in the gate, failing on any bundler warning, and run each bundle's round-trip in Node.

Consumers bundle the package, Forge apps with webpack among them, and one reported a "Critical
dependency" warning from another converter. Nothing in the gate bundles it today. Install the
tarball as `package-tests` does, bundle an entry file that round-trips one document through
`adfToLosslessMarkdown` and `losslessMarkdownToAdf`, and run each bundle in Node. A warning fails the
leg as an error does: webpack's "Critical dependency" is a warning. The bundlers live in their own
package, as Stryker does (§Stryker in its own package), with pinned versions. Bun builds from the
image the gate already pulls. No leg needs an account or a network beyond the install.

Once the leg holds, the README may say the package bundles with those four; it says nothing about
Forge's runtime, which no leg tests. Item 46 may take its bundle size from this leg.

### 42. Trim a text leaf's trailing blanks in linear time.

`portable/inline-reduction.ts`'s `leafEdges` finds the trail with an unanchored `/[ \t]*$/`,
quadratic in a run of blanks inside one leaf: a paragraph of `a`, 80 000 spaces, `b` takes 6.5 s in
`adfToPortableMarkdown`. Scan backward, as the expand title's trim does.

### 31. Make the branch-coverage figure repeat across runs of an unchanged tree.

Three Node test legs over one unchanged tree reported `emit/inline-line.ts` at 95.83%, 96.23% and
96.23%, and the total at 98.80%, 98.84% and 98.84% (2026-09-21). `--experimental-test-coverage`
counts branches off V8's own coverage, which the runner's parallel files and V8's optimization make
run-dependent, so the number the floor is read against is not the code's alone. The floor of 98
holds today on 0.8 points of slack and `docs/decisions.md` §The coverage floors says it only ever
moves upward, so the first raise to the measured figure reddens a run that changed nothing. Make the
measurement repeatable, or state the number the floor may be raised to and why it is not the
measured one.

### 57. Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.

Technical principle "Compose, do not entangle": Deno, Bun and the tests read the install leg's
`node_modules`, the floor and consumer legs the pack leg's, and the browser leg whatever `dist/` the
build leg left, so a leg run alone can pass on stale output.

### 38. Spell a lone surrogate in a text node so it survives a UTF-8 encode.

`adfToLosslessMarkdown` emits it verbatim, so markdown stored as UTF-8 reads back U+FFFD; attribute
values already escape it.

### 76. State the files the package does not ship once, so the build, the lint ceiling, the coverage exclusions and the mutation run cannot drift apart.

Technical principle DRY: the set is written in `tsconfig.build.json`'s `exclude`, `.oxlintrc.json`'s
`ignorePatterns` and the `test` script's two `--test-coverage-exclude` flags, and §The size ratchet
assumes they agree. A helper added to one list lints test code under the shipped ceiling, or drops
shipped code from coverage, silently. Derive the others from one, or assert in a test that
they agree. Found by the technical-principles audit, 2026-10-04.

`mutation-tests/run.sh`'s pathspec restates the test files and test helpers, and
`mutation-tests/stryker.config.mjs`'s `testFiles` the test files, so a helper missing from the
pathspec has its mutants read as survivors. Found by the architecture review of item 152, 2026-10-28.

### 56. Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.

Technical principle "One owner per value": the `Walk` record passes through functions that mutate it
and return `void`; `walk.leaf` alone is written in seven places, and `openedList` reads the
`endedLists` that `closeLeaf` fills. `ContainerStack` in the same file shows the shape to follow. `inline-content.ts`'s `Scan` has the same shape: about fifteen
functions write `pending`, `pieces`, `brackets`, `linkOpenersFrom` and `openingSpellableLink` on the `Scan`
they are handed, most of them returning `void`, and `parseInlineContent` reads a flag `scanInline` leaves on it. The same shape recurs in
`mintTaskIds` (`portable/task-ids.ts`), which writes `attrs` on the document `readDocument` built;
`takeFallback` (`emit/inline-line.ts`), which writes the record the next `lineSegments` pass reads;
`writeUnpaired` and `markHighlights` (`inline-content.ts`), whose order changes the
output.
Once `Scan`'s pieces have owners, the bracket resolution — `linkedAlt` through `linkTo`,
`holdsLink`, and `closeBracket` through `altText` — can leave `inline-content.ts` (about 690 lines)
for a module of its own. That module resolves an image once, into a node holding its alt text and
its link, so `imageAlt`, `resolvedPieces` and `directiveMarkPieces` no longer filter and regroup
`ImageLink` pieces. Found by the architecture pass of the release review of 0.3.0, 2026-11-08.

### 118. Spell a portable link's title through `oneLine`.

`portableLink` (`src/markdown/portable/inline-reduction.ts`) repeats `oneLine`'s replacements by
hand, so a change to what a portable line drops would miss link titles. Technical principle: DRY.
Found by the principles audit of item 99, 2026-10-14.

### 82. Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.

Technical principle: tests use random UUID v7 ids; `portable-markdown-to-adf.test.ts` already does.
Found by the technical-principles audit of item 78, 2026-10-05.

### 58. Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes. A wrong line range in
`run.sh` mutates the wrong lines without failing, so the port tests how it reads diff hunks.

### 34. Read emphasis flanking by the whole character beside an astral symbol.

Check whether `delimiterRunToken` (`inline-tokens.ts`) and `resolveEmphasis` (`line-escaping.ts`)
read one UTF-16 unit beside an astral symbol. A lone surrogate is neither punctuation nor symbol,
but CommonMark reads `😀` as punctuation. Where they do, read the code point, with a fixture per
direction.

### 74. Keep the release path publishing after npm retires bypass-2FA tokens.

Lands after 2027-01-01, or after a release run fails on the token, whichever comes first: the
maintainer chose on 2026-10-02 to wait and see whether the retirement bites. It holds back no
release: when the rest of its release is done, it moves to the next. `0.1.0` published only once the
npm token carried **Bypass 2FA**: the account requiring no 2FA on writes was not enough, and npm
answered `EOTP` until the token itself bypassed. npm retires bypass-2FA tokens for direct publishing
around January 2027, leaving them `npm stage publish`, which a maintainer approves with 2FA. Trusted
publishing over OIDC replaces the token, and GitHub-hosted Actions support it. The release has run
there since 2026-10-04, still with the organization's `NPM_TOKEN`: the maintainer chose to keep the
token for now. The trade is the maintainer's: move `publish.sh` to trusted publishing, or to the
staged publish, which fits badly with publish-on-merge. Its Moves cell is empty: no README goal covers
the release path.

### 8. Ship a CLI.

Its Moves cell is empty: no README goal or persona covers a CLI yet. The chunk
proposes both (the maintainer, 2026-10-02), and they land in the README's `## Goals` and `##
Audience` with the CLI.

### 139. Ship the calls between markdown and HTML, composed through ADF and each named by its flavour.

Waits until a consumer needs it. Which flavours get a composed call is this item's to settle; the
CommonMark spec suite runs against the one reading CommonMark, checked against the spec's expected
HTML. Where a composed call naming a markdown `Flavour` sits is this item's to settle.

### 137. Read foreign HTML in `htmlToAdf` the three ways `docs/decisions.md` §Foreign HTML sorts three ways states.

Waits until a consumer needs `htmlToAdf` to read HTML that `adfToHtml` did not write.

### 138. Read raw HTML in every markdown reader through `htmlToAdf`'s foreign-element mapping, in place of refusing it as `unmappable-html`.

Waits until a consumer needs it. The change touches `inline-content.ts` and `markdown-to-adf.ts`,
places the comprehension seats found hard; leave each place it touches easier to read.

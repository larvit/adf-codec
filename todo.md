# todo

## Scoring

`Score = -R - S/4 + 2*A + 2*G*W`

`Bar = 9`

`Next ID = 84`

| Goal | W |
|---|---|
| 1 | 1.00 |
| 2 | 0.89 |
| 3 | 0.78 |
| 4 | 0.67 |
| 5 | 0.56 |
| 6 | 0.44 |
| 6.1 | 0.44 |
| 7 | 0.33 |
| 8 | 0.22 |
| 9 | 0.11 |

## Items

| ID | Release | Exempt | Item | R | S | A | G | Goals | Score |
|---|---|---|---|---|---|---|---|---|---|
| 65 | 0.2.0 | defect | **Read an image not alone in its paragraph as its alt text linked to its URL, and a titled image alone in its paragraph as the image captioned with its title.** | 5 | 5 | 7 | 7 | 4, 5, 7 | 17.1 |
| 49 | 0.2.0 |  | **Read a list whose bullet or ordered delimiter changes as two lists, in every reader, and retire `!adf:listBreak`.** | 4 | 5 | 5 | 8 | 4, 5 | 15.5 |
| 61 | 0.2.0 | decision | **Have the emitter ask the inline reader how a line reads back, in place of `line-escaping.ts` predicting it.** | 6 | 8 | 3 | 8 | 1 | 14.0 |
| 60 | 0.2.0 | decision | **Collect the questions `parse/` asks `emit/` into one named module.** | 3 | 4 | 2 | 6 | 2 | 10.7 |
| 59 | 0.2.0 | decision | **Group the directive grammar into `src/markdown/directive/`, move `Read<T>` to `result.ts`, and move `Flavour` and `flavourClaims` to `markdown/flavour.ts`.** | 3 | 5 | 2 | 6 | 2 | 10.4 |
| 62 | 0.2.0 | decision | **Move the portable flavour's reading out of `parse/` and its writing out of `emit/` into `markdown/portable/`, so `emit/` no longer imports `portable/`.** | 4 | 5 | 2 | 6 | 2 | 9.4 |
| 50 | 0.2.0 |  | **Read `[](/url)` and `[]()` as CommonMark's empty link.** | 4 | 4 | 3 | 6 | 4, 5, 7 | 9.0 |
| 7 | 0.3.0 | decision | **Ship HTML: `adfToHtml`, `htmlToAdf`, and markdown to and from HTML composed through ADF, each call named by its flavour.** | 6 | 9 | 9 | 9 | 2, 4 | 25.8 |
| 45 | 0.3.0 |  | **Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.** | 2 | 3 | 6 | 8 | 1 | 25.2 |
| 6 | 0.3.0 | decision | **Specify the HTML dialect.** | 2 | 6 | 7 | 8 | 2, 4 | 24.7 |
| 77 | 0.3.0 | decision | **Read the input once into a plain copy, so an accessor property or a throwing Proxy yields `not-an-adf-document` and every call returns a result.** | 4 | 4 | 5 | 9 | 1 | 23.0 |
| 83 | 0.3.0 | defect | **Refuse a document whose markdown would pass the engine's string limit with a result, never a `RangeError`.** | 3 | 4 | 5 | 8 | 1, 9 | 22.0 |
| 71 | 0.3.0 |  | **Add a README table comparing the package with the other ADF converters, each cell checked against that package's own docs or behaviour.** | 1 | 3 | 6 | 7 | 3 | 21.2 |
| 80 | 0.3.0 |  | **Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.** | 2 | 3 | 5 | 6 | 1 | 19.2 |
| 68 | 0.3.0 |  | **Carry a non-text inline node holding `content` or `text`, a block holding `text`, and a leaf block holding `content`.** | 3 | 3 | 4 | 7 | 1 | 18.2 |
| 75 | 0.3.0 |  | **Make the generated-markdown property write block carries as `adf:` fences, canonical and hostile.** | 2 | 2 | 3 | 7 | 1 | 17.5 |
| 81 | 0.3.0 |  | **Fail the gate unless the README's error tables list exactly the codes `ConvertErrorCode` holds.** | 1 | 2 | 5 | 5 | 3 | 16.3 |
| 46 | 0.3.0 |  | **Publish the bundle size in the README, failing the release pipeline when it drifts.** | 2 | 4 | 5 | 5 | 3, 8 | 14.8 |
| 72 | 0.3.0 | decision | **Re-create `gitea.larvit.se/larvit/adf-codec` as a read-only pull mirror of GitHub, its issues and Actions off and its description pointing at GitHub.** | 2 | 1 | 3 | 6 | 3 | 13.1 |
| 52 | 0.3.0 |  | **Spell `colwidth` as a comma list, `colwidth="340,420"`.** | 3 | 3 | 5 | 6 | 6 | 11.5 |
| 51 | 0.3.0 |  | **Match a reference label to its definition under Unicode case folding.** | 2 | 2 | 2 | 7 | 4, 5 | 10.9 |
| 53 | 0.3.0 |  | **Put a block's `marks` spelling to the writer panel and adopt its pick.** | 4 | 5 | 5 | 6 | 6 | 10.0 |
| 73 | 0.4.0 |  | **Announce the package where someone needing an ADF converter already reads: JRACLOUD-77436, the Atlassian developer community and Stack Overflow's ADF-to-markdown questions.** | 1 | 2 | 6 | 8 | 3 | 23.0 |
| 9 | 0.4.0 |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 2 | 6 | 6 | 8 | 3 | 21.0 |
| 38 | 0.4.0 |  | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 2 | 2 | 4 | 7 | 1 | 19.5 |
| 74 | 0.4.0 |  | **Keep the release path publishing after npm retires bypass-2FA tokens.** | 4 | 4 | 8 | 3 | 3 | 15.7 |
| 34 | 0.4.0 |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 3 | 3 | 6 | 4, 5 | 11.3 |
| 31 | 0.4.0 |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 3 | 3 | 4 | 1 | 11.2 |
| 42 | 0.4.0 | defect | **Trim a text leaf's trailing blanks in linear time.** | 1 | 2 | 5 | 9 | 9 | 10.5 |
| 33 | 0.4.0 | defect | **Emit a line in time linear in its mark runs, in `adfToLosslessMarkdown` and `adfToPortableMarkdown`.** | 4 | 5 | 6 | 9 | 9 | 8.7 |
| 56 | 0.4.0 | principle | **Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.** | 4 | 5 | 2 | 4 | 1 | 6.8 |
| 76 | 0.4.0 | principle | **State the files the package does not ship once, so the build, the lint ceiling and the coverage exclusions cannot drift apart.** | 2 | 2 | 1 | 3 | 1 | 5.5 |
| 82 | 0.4.0 | principle | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 1 | 3 | 1 | 2 | 1 | 4.2 |
| 57 | 0.4.0 | principle | **Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.** | 2 | 3 | 1 | 3 | 8 | 0.6 |
| 58 | 0.4.0 | principle | **Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.** | 4 | 6 | 1 | 2 | 8 | -2.6 |
| 8 | 0.5.0 |  | **Ship a CLI.** | 3 | 7 | 7 | 6 | 3 | 18.6 |

## Details

### 65. Read an image not alone in its paragraph as its alt text linked to its URL, and a titled image alone in its paragraph as the image captioned with its title.

Both are refused today with `unmappable-image`: 14 examples in
`corpus/commonmark-spec/refusals.json`, a bot's `See ![diagram](url) here` among them. `mediaInline`
takes only Atlassian media ids, never a URL. An image not alone in its paragraph reads as its alt
text, linked to its URL. Its title becomes the link's `title`. An empty alt text reads as the URL,
as item 50 reads an empty link. A titled image alone in its paragraph reads as the image, with its
title as a `caption` (the maintainer, 2026-10-04). By Goal 5, every reader reads both as CommonMark
does. An image inside a link: `[![moon](moon.jpg)](/uri)` (spec example 517). Alone in its
paragraph, it reads as the image with a `link` mark to `/uri`, which ADF's `media` takes. Not alone
in its paragraph, the image reads as its alt text linked to `/uri`, and its URL drops. A writer
panel chose this reading 3 of 3 (2026-10-04), by Goal 6, which outranks Goal 7.

### 49. Read a list whose bullet or ordered delimiter changes as two lists, in every reader, and retire `!adf:listBreak`.

Today `- a` then `+ b`, or `1.` then `1)`, reads as one list; CommonMark reads two (spec examples
301 and 302). Goal 5 settles it for the lossless flavour too: CommonMark spells adjacent lists by
changing the marker, so `adfToLosslessMarkdown` and `adfToPortableMarkdown` alternate `-` and `*`
between adjacent bullet lists and `.` and `)` between adjacent ordered lists, and `!adf:listBreak`
retires. `*` is the maintainer's pick (2026-10-04). Breaking: `MIGRATION.md`'s Readings and
Spellings tables gain their rows. Examples 301 and 302 lose their `pending` exceptions, and the
spelling leaves the README's "Four CommonMark spellings" bullet, which counts one fewer.

### 61. Have the emitter ask the inline reader how a line reads back, in place of `line-escaping.ts` predicting it.

The comprehension panel's worst place: `escapeClaims` and `escapeClosedRuns` re-implement the
reader's view — flanking, code-span closers, link-definition openings, highlight flanking — and
only the property tests catch drift. It caps the panel's Locality score. The replacement runs in
time linear in the line: today `mergesWithSyntax`, `touchesSyntax` and `closesHeading` rescan a run
of one character from each of its characters.

### 60. Collect the questions `parse/` asks `emit/` into one named module.

`parse/` asks `emit/` through `commonMarkSpelling` and `openingLinkTakesDirective`, each imported
from where it happens to live. One module naming the questions keeps `docs/decisions.md` §The source
parts by ADF and format true as they grow.

### 59. Group the directive grammar into `src/markdown/directive/`, move `Read<T>` to `result.ts`, and move `Flavour` and `flavourClaims` to `markdown/flavour.ts`.

Eight directive files sit across three directories, and the `markdown/` root holds 14 entries. HTML
needs `Read<T>` and `Flavour` out of the portable flavour and `markdown/`; it needs the carry and
the mark spellings too, which item 7 moves where it learns what HTML shares.
Once moved, a reader takes a `Flavour` and looks up its claims, as a writer does, so no reader is
handed a set of claims no flavour holds.

### 62. Move the portable flavour's reading out of `parse/` and its writing out of `emit/` into `markdown/portable/`, so `emit/` no longer imports `portable/`.

Reading: the alert and task-marker reads in `parse/markdown-to-adf.ts` and the `mintTaskIds` call.
Writing: `spellPortableBlock`, `quotedUnder`, `tryTaskList` and `taskBlocks` in
`emit/adf-to-markdown.ts`. And `highlightDelimiter` and `highlightFlanking` move out of
`portable/conventions.ts`, which `emit/` imports them from; item 59 moves `Flavour` and
`flavourClaims`. Every comprehension reader on 2026-10-03 named the portable flavour's spread across
three directories.

### 50. Read `[](/url)` and `[]()` as CommonMark's empty link.

Both stay literal text today (spec examples 484 and 487). ADF holds no empty text node to carry a
link mark, so a link whose text is empty takes its URL as its text (the maintainer, 2026-10-04):
`[](/url)` reads as `/url` linked to `/url`. `[]()` has no URL to show; the chunk settles it by
Goals 4 and 7. Breaking: `MIGRATION.md`'s Readings table gains its row. Its `pending` exceptions go,
and its spelling leaves the README's "Four CommonMark spellings" bullet, which counts one fewer.

### 7. Ship HTML: `adfToHtml`, `htmlToAdf`, and markdown to and from HTML composed through ADF, each call named by its flavour.

Lands after items 6, 59, 60, 61 and 62. Which flavours get a composed call is this item's to settle;
the CommonMark spec suite also runs against the one reading CommonMark. The README documents HTML as
it documents markdown. `htmlToAdf` refuses a value that is not a string as `not-a-string`
(`docs/decisions.md` §Which code a cause takes).

### 45. Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.

Lands with item 77: the reader returns item 77's copy. Goal 1 has every call return a result; the
boolean guard is the one export that does not, and it cannot say which branch refused, where
`not-an-adf-document`'s message already does. Breaking: `MIGRATION.md` shows the guard's
replacement.

### 6. Specify the HTML dialect.

Element-by-element mapping, the `data-*` fidelity scheme, the opaque-carry form, and the documented
foreign-element set `htmlToAdf` accepts — the set the markdown readers share (`spec/flavour.md` §Raw
HTML in input). The set sorts per `docs/decisions.md` §Foreign HTML sorts three ways.

### 77. Read the input once into a plain copy, so an accessor property or a throwing Proxy yields `not-an-adf-document` and every call returns a result.

Lands with item 45, in one chunk: item 45's reader returns the copy. The maintainer's call,
2026-10-04: Goal 1 promises a result for any value, getters and Proxies included. Today the guards
and the conversions read the caller's object many times, so a throwing getter, a revoked Proxy or a
getter minting a fresh child per access throws or walks forever. Item 45's reader copies the
document once inside one tight `try/catch`, reading property descriptors so no getter runs: an
accessor property, or a Proxy trap that throws, is `not-an-adf-document`. The copy keeps own
enumerable keys, as `JSON.stringify` does, so an inherited or non-enumerable key drops. The reader
reads arrays by index, so no custom iterator runs. Every later step works on the copy. A Proxy can
still claim unbounded width, which the 500-level limit does not cover, so the copy reads at most 10
million JSON values, each object, array, string, number, boolean and null counting one (the
maintainer, 2026-10-05): roughly 50 to 100 MB of JSON, far past any real page, where 10 000 would
refuse a 500-row table. Before reading an array, the reader checks its `length` against the values
left, so a Proxy claiming 2³² elements is refused at once. The chunk asks whether that refusal
shares the 500-level guard's `unsupported-nesting-depth` or takes another code. Found by the
technical-principles audit, 2026-10-04.

### 83. Refuse a document whose markdown would pass the engine's string limit with a result, never a `RangeError`.

The block carry indents its JSON two spaces a level, so one unknown block holding 497 nested arrays
around 540,000 numbers, about 1.1 MB as JSON, spells about 540 million characters, past V8's 2^29 −
24. `serializeCanonicalJson`'s `join` throws, and `adfToLosslessMarkdown` throws with it. Any output
past the limit does the same. Refuse it with a code from the closed list, and add a fixture. Found
by the README-goals audit, 2026-10-08.

### 71. Add a README table comparing the package with the other ADF converters, each cell checked against that package's own docs or behaviour.

Lands after items 7 and 46: the table names HTML and compares item 46's size figure. Its columns:
which directions each converts, whether the round-trip holds, what an unknown node does, the
formats, runtime dependencies and size. Candidates are the packages an npm search for ADF and
markdown returns. Every cell cites that package's README or a run against its published version, and
the table names each version and the date it was checked. Found while planning discoverability,
2026-10-04. Checked 2026-10-05: no other package converts HTML or holds the round-trip; the
candidates are `@atlaskit/editor-markdown-transformer`, `adf-to-markdown`, `adf-to-md`,
`adf2markdown`, `extended-markdown-adf-parser`, `marklassian` and `md-to-adf`.

### 80. Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.

Lands with items 45 and 77, whose reader walks every node. Today every refused node, such as one
with a `Date` in an attribute, reads `an ADF document's content holds ADF nodes: one of them is not`
with an empty `path`. An export tool told this about one document in thousands then searches that
document's whole tree. Give the node's path, and name its type and the attribute key as
`attributeNestingMessage` does. Found by the product-owner review of items 66 and 67, 2026-10-05.

### 68. Carry a non-text inline node holding `content` or `text`, a block holding `text`, and a leaf block holding `content`.

`refuseContentAndText` (`emit/inline-line.ts`) and `emitDirectiveBlock` (`emit/adf-to-markdown.ts`)
refuse these with `unsupported-node-shape`, though `isAdfDocument` accepts them and the carry
round-trips them; `docs/decisions.md` §The code list gives a cause the carry answers no code. Drop
them from the emitting half of the README's `unsupported-node-shape` row. Found by the README-goals
audit, 2026-10-04.

### 75. Make the generated-markdown property write block carries as `adf:` fences, canonical and hostile.

`blockCarry` and `hostileBlockCarry` (`src/conformance/markdown-property.test.ts`) write a fence
whose info string is `carry`. Under the `docs/decisions.md` entry "The carry fence names the node
type", that is an ordinary code language, so the property reaches `readCarriedBlock`'s refusals only
where a random edit lands in a canonical document. Write `adf:<type>` and `adf:` fences, canonical
and hostile. Found by the technical-principles audit, 2026-10-04.

### 81. Fail the gate unless the README's error tables list exactly the codes `ConvertErrorCode` holds.

`src/result.test.ts` checks the union against the call sites only, so a code added or removed
leaves the README's tables a false contract under a green gate. Assert that the tables list exactly
the union. Found by the technical-principles audit of item 78, 2026-10-05.

### 46. Publish the bundle size in the README, failing the release pipeline when it drifts.

Lands after item 7, which changes it. The quantity is what a consumer downloads and loads: the
tarball `npm pack` produces, its unpacked `dist`, and the built JavaScript minified + gzipped — the
figure the competitors advertise (marklassian's "12kb") and the only apples-to-apples one, since
ours ships tsc's unminified output and no minifier yet (decide here whether to minify for the build
or report the unminified gzip). The figure lands in README §The package beside the "no runtime
dependencies" claim. Measured today, unminified: tarball 60.4 kB, unpacked 221.5 kB, JS gzipped 45.6
kB.

### 72. Re-create `gitea.larvit.se/larvit/adf-codec` as a read-only pull mirror of GitHub, its issues and Actions off and its description pointing at GitHub.

Lands after every other `0.3.0` item (the maintainer, 2026-10-05). The maintainer does this. Gitea
cannot convert an existing repository to a mirror, so the copy is deleted and re-created. That drops
the copy's commit hashes from before the 2026-10-04 history rewrite, and its Actions secrets. The
Gitea copy holds no issues or releases to move. Actions stay off on the mirror: Gitea runs
`.github/workflows/` when `.gitea/workflows/` is absent, and the mirrored `publish` job would
otherwise run there. When this lands, the `docs/decisions.md` entry "GitHub is canonical" loses its
interim sentence.

### 52. Spell `colwidth` as a comma list, `colwidth="340,420"`.

A writer panel chose it on 2026-10-03, 5 of 7, over today's `colwidth="[340,420]"`. Breaking:
`MIGRATION.md`'s Spellings table gains its row.

### 51. Match a reference label to its definition under Unicode case folding.

`link-syntax.ts` normalizes a label with `toLowerCase`, so `[ẞ]` misses its `[SS]` definition (spec
example 540); lowercasing and then uppercasing folds it. Breaking: `MIGRATION.md`'s Readings table
gains its row. Its `pending` exceptions go, and its spelling leaves the README's "Four CommonMark
spellings" bullet, which counts one fewer.

### 53. Put a block's `marks` spelling to the writer panel and adopt its pick.

Today `marks="[{\"attrs\":{\"mode\":\"wide\"},\"type\":\"breakout\"}]"`, the marks array as
escaped JSON. Breaking where the panel picks another spelling: `MIGRATION.md`'s Spellings table
gains its row.

### 73. Announce the package where someone needing an ADF converter already reads: JRACLOUD-77436, the Atlassian developer community and Stack Overflow's ADF-to-markdown questions.

Lands after `0.3.0` is published with item 71, so each post links the GitHub repository, the
README's comparison table and a README that opens with what the package is. We draft each post for
the place it goes; the maintainer posts them. Found while planning discoverability, 2026-10-04.

### 38. Spell a lone surrogate in a text node so it survives a UTF-8 encode.

`adfToLosslessMarkdown` emits it verbatim, so markdown stored as UTF-8 reads back U+FFFD; attribute
values already escape it.

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
staged publish, which fits badly with publish-on-merge. The Goals and G cells are provisional: no
README goal covers the release path.

### 34. Read emphasis flanking by the whole character beside an astral symbol.

Check whether `line-escaping.ts`'s `charAt` and the parser's flanking read one UTF-16 unit beside an
astral symbol — a lone surrogate is neither punctuation nor symbol, where CommonMark reads `😀` as
punctuation — and, where they do, read the code point, with a fixture per direction.

### 31. Make the branch-coverage figure repeat across runs of an unchanged tree.

Three Node test legs over one unchanged tree reported `emit/inline-line.ts` at 95.83%, 96.23% and
96.23%, and the total at 98.80%, 98.84% and 98.84% (2026-09-21). `--experimental-test-coverage`
counts branches off V8's own coverage, which the runner's parallel files and V8's optimization make
run-dependent, so the number the floor is read against is not the code's alone. The floor of 98
holds today on 0.8 points of slack and `docs/decisions.md` §The coverage floors says it only ever
moves upward, so the first raise to the measured figure reddens a run that changed nothing. Make the
measurement repeatable, or state the number the floor may be raised to and why it is not the
measured one.

### 42. Trim a text leaf's trailing blanks in linear time.

`portable/inline-reduction.ts`'s `leafEdges` finds the trail with an unanchored `/[ \t]*$/`,
quadratic in a run of blanks inside one leaf: a paragraph of `a`, 80 000 spaces, `b` takes 6.5 s in
`adfToPortableMarkdown`. Scan backward, as the expand title's trim does.

### 33. Emit a line in time linear in its mark runs, in `adfToLosslessMarkdown` and `adfToPortableMarkdown`.

`adfToLosslessMarkdown` spends 23 s on one paragraph of 2000 × `un` plus `**-r**`: each run its
flanking cannot spell re-emits the whole line before riding the carry, quadratic in the runs, and
the portable reduction's `spellableLine` drops one mark per re-emit the same way. An inline node
whose attributes no spelling writes re-emits the line the same way before riding the carry. Make all
three linear.

### 56. Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.

Technical principle "One owner per value": the `Walk` record passes through twelve functions that
mutate it and return `void`; `walk.leaf` alone is written in seven places. `ContainerStack` in the
same file shows the shape to follow. `inline-content.ts`'s `Scan` has the same shape: about fifteen
functions write `pending`, `pieces`, `deactivatedBefore` and `openingSpellableLink` and return
`void`, and `parseInlineContent` reads a flag `scanInline` leaves on it. The same shape recurs in
`mintTaskIds` (`portable/task-ids.ts`), which writes `attrs` on the document `readDocument` built;
`takeFallback` (`emit/inline-line.ts`), which writes the record the next `lineSegments` pass reads;
`writeUnpaired`, `markPairings` and `markHighlights` (`inline-content.ts`), whose order changes the
output; and `nestIn` (`portable/adf-to-portable-markdown.ts`), which pushes into its caller's array.

### 76. State the files the package does not ship once, so the build, the lint ceiling and the coverage exclusions cannot drift apart.

Technical principle DRY: the set is written in `tsconfig.build.json`'s `exclude`, `.oxlintrc.json`'s
`ignorePatterns` and the `test` script's two `--test-coverage-exclude` flags, and §The size ratchet
assumes they agree. A helper added to one list lints test code under the shipped ceiling, or drops
shipped code from coverage, silently. Derive two from the third, or assert in a test that the three
agree. Found by the technical-principles audit, 2026-10-04.

### 82. Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.

Technical principle: tests use random UUID v7 ids; `portable-markdown-to-adf.test.ts` already does.
Found by the technical-principles audit of item 78, 2026-10-05.

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

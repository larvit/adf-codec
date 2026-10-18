# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 122`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 121 | 0.3.0 |  | question | **Decide whether an image's title stays its caption, in a goal in `README.md` or a decision in `docs/decisions.md`.** | 1 | 2 | 2 | 3 | 2 |  | 0.0 |
| 115 | 0.3.0 |  | defect | **Build text holding no `border` mark in `losslessMarkdownToAdf`, and have `adfToLosslessMarkdown` carry text holding one.** | 2 | 1 | 2 | 3 | 3 | 4 by 3 | 4.8 |
| 60 | 0.3.0 |  | decision | **Collect the questions `parse/` asks `emit/` into one named module.** | 2 | 1 | 2 | 3 | 4 | 10 by 4 | 4.0 |
| 92 | 0.3.0 |  |  | **Lower the reading cost of the files a chunk reads most before its first commit.** | 2 | 1 | 1 | 2 | 4 | 10 by 4 | 4.0 |
| 102 | 0.3.0 |  | decision | **Place a block a portable task list refuses at its path in the returned document without replaying `splitTaskList` on stand-in nodes.** | 2 | 1 | 2 | 3 | 4 | 10 by 4 | 4.0 |
| 95 | 0.3.0 |  | decision | **Find the code-span closers an escape forms, the mark runs a line cannot spell and the text `[` that opens link text by reading the line back, in place of `escapeClosedRuns`, `unspellableRuns` and `lastLinkClose` predicting them.** | 4 | 1 | 3 | 6 | 6 | 10 by 7 | 2.3 |
| 91 | 0.3.0 | 95 |  | **Spell an emphasis once across the code spans, an emphasis or link once across the hard breaks, dates, emoji, inline cards, mentions and statuses between two nodes it marks, and an emphasis across inline media, in both writers.** | 3 | 2 | 2 | 5 | 5 | 6 by 6 | 3.7 |
| 59 | 0.3.0 |  | decision | **Group the directive grammar into `src/markdown/directive/`, move `Read<T>` to `result.ts`, and move `Flavour` and `flavourClaims` to `markdown/flavour.ts`.** | 3 | 1 | 2 | 4 | 5 | 10 by 5 | 3.0 |
| 62 | 0.3.0 |  | decision | **Move the portable flavour's reading out of `parse/` and its writing out of `emit/` into `markdown/portable/`, so `emit/` no longer imports `portable/`.** | 3 | 1 | 2 | 4 | 5 | 10 by 5 | 3.0 |
| 33 | 0.3.0 |  | defect | **Emit a line in time linear in its mark runs, in `adfToLosslessMarkdown` and `adfToPortableMarkdown`.** | 3 | 1 | 2 | 4 | 5 | 9 by 3 | 2.0 |
| 109 | 0.3.0 |  | defect | **Spell nested lists and quotes in time linear in the markdown.** | 3 | 1 | 2 | 4 | 5 | 9 by 3 | 2.0 |
| 73 | 0.3.0 | 33, 59, 60, 62, 91, 92, 95, 102, 109, 115, 121 |  | **Announce the package where someone needing an ADF converter already reads: JRACLOUD-77436, the Atlassian developer community and Stack Overflow's ADF-to-markdown questions.** | 1 | 2 | 2 | 3 | 2 | 3 by 8 | 17.4 |
| 112 | 0.4.0 |  |  | **Pad a GFM pipe table's short rows with empty cells, read its body rows holding no pipe, and read a one-column table without leading pipes in `portableMarkdownToAdf`.** | 2 | 1 | 2 | 3 | 3 | 4 by 4 | 6.3 |
| 80 | 0.4.0 |  |  | **Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.** | 2 | 1 | 2 | 3 | 3 | 6 by 4 | 6.2 |
| 81 | 0.4.0 |  |  | **Fail the gate unless the README's error tables list exactly the codes `ConvertErrorCode` holds.** | 1 | 1 | 1 | 1 | 2 | 3 by 2 | 4.4 |
| 75 | 0.4.0 |  |  | **Make the generated-markdown property write block carries as `adf:` fences, canonical and hostile.** | 1 | 1 | 1 | 1 | 2 | 10 by 2 | 4.0 |
| 6 | 0.4.0 |  | decision | **Specify the HTML dialect.** | 3 | 2 | 1 | 4 | 6 |  | 0.0 |
| 7 | 0.4.0 | 6, 59, 60, 62 | decision | **Ship HTML: `adfToHtml`, `htmlToAdf`, and markdown to and from HTML composed through ADF, each call named by its flavour.** | 4 | 2 | 2 | 6 | 9 | 3 by 6 | 0.3 |
| 46 | 0.4.0 | 7 |  | **Publish the bundle size in the README, failing the release pipeline when it drifts.** | 2 | 2 | 1 | 3 | 4 | 3 by 3 | 3.3 |
| 45 | 0.4.0 |  | defect | **Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.** | 2 | 1 | 3 | 4 | 3 | 1 by 2 | 3.3 |
| 68 | 0.4.0 |  | defect | **Carry a non-text inline node holding `content` or `text`, a block holding `text`, and a leaf block holding `content`.** | 2 | 1 | 2 | 3 | 3 | 1 by 2 | 3.3 |
| 51 | 0.4.0 |  |  | **Match a reference label to its definition under Unicode case folding.** | 2 | 1 | 2 | 3 | 4 | 4 by 2 | 2.1 |
| 77 | 0.4.0 |  | decision | **Read the input once into a plain copy, so an accessor property or a throwing Proxy yields `not-an-adf-document` and every call returns a result.** | 3 | 1 | 3 | 5 | 4 |  | 0.0 |
| 107 | 0.4.0 |  | decision | **Spell the block carry's JSON so its length stays linear in the node's JSON.** | 3 | 1 | 3 | 5 | 5 |  | 0.0 |
| 72 | 0.4.0 | 6, 7, 45, 46, 51, 68, 75, 77, 80, 81, 107, 112 | decision | **Re-create `gitea.larvit.se/larvit/adf-codec` as a read-only pull mirror of GitHub, its issues and Actions off and its description pointing at GitHub.** | 1 | 2 | 1 | 2 | 1 | 3 by 1 | 2.6 |
| 42 | 0.5.0 |  | defect | **Trim a text leaf's trailing blanks in linear time.** | 1 | 1 | 2 | 2 | 2 | 9 by 3 | 6.5 |
| 31 | 0.5.0 |  |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 1 | 1 | 2 | 3 | 10 by 3 | 4.5 |
| 57 | 0.5.0 |  |  | **Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.** | 2 | 1 | 1 | 2 | 3 | 10 by 3 | 4.5 |
| 38 | 0.5.0 |  | defect | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 1 | 1 | 2 | 2 | 2 | 1 by 2 | 4.4 |
| 76 | 0.5.0 |  |  | **State the files the package does not ship once, so the build, the lint ceiling and the coverage exclusions cannot drift apart.** | 1 | 1 | 1 | 1 | 2 | 10 by 2 | 4.0 |
| 56 | 0.5.0 |  |  | **Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.** | 3 | 1 | 2 | 4 | 5 | 10 by 5 | 3.0 |
| 118 | 0.5.0 |  |  | **Spell a portable link's title through `oneLine`.** | 1 | 1 | 1 | 1 | 1 | 10 by 1 | 2.4 |
| 9 | 0.5.0 |  |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 3 | 2 | 1 | 4 | 6 | 3 by 6 | 2.2 |
| 34 | 0.5.0 |  |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 1 | 2 | 3 | 3 | 4 by 1 | 1.6 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | 10 by 1 | 1.5 |
| 58 | 0.5.0 |  |  | **Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.** | 3 | 1 | 2 | 4 | 6 | 10 by 3 | 1.0 |
| 74 | 0.5.0 |  | owner | **Keep the release path publishing after npm retires bypass-2FA tokens.** | 3 | 2 | 4 | 7 | 4 |  | 0.0 |
| 8 | 0.6.0 |  | owner | **Ship a CLI.** | 3 | 2 | 1 | 4 | 7 |  | 0.0 |

## Renamed

- 0.2.1 renamed to 0.3.0

## Details

### 121. Decide whether an image's title stays its caption, in a goal in `README.md` or a decision in `docs/decisions.md`.

Seven readers read `![Moon over the hills](https://docs.example.com/images/moon-over-hills.jpg "The
moon, at night")` alone in its paragraph: the bot, the LLM pipeline, a support agent and a product
manager, some of them twice. Each wrote what it expected to see in Jira or Confluence, then picked
the picture with the title printed under it, the picture alone, or neither. Two picked the caption,
two the picture alone, and three neither, expecting the title as hover text. No output reached five
of seven.

ADF holds no node for hover text, so the caption is the only ADF place for the title's words. Goal 7
says lossy conversion drops form, never content. The README's portable section defines content as
what a reader sees or follows, which a hover title is not at rest. The goals do not say whether a
title is content. Earlier entries of this class: §An image reads as an image only alone in its paragraph (the
caption, 2026-10-09, 3 of 3); §A linked image is written `[![alt](url)](href)`, a captioned image as
its directive (2026-10-11, 3 of 3, reading a title as hover text); and the title that drops inside
another link, chosen by Goal 6 over Goal 7.

Candidate entry: an image's title stays the caption of an image that stays an image, because ADF
holds no hover text and the caption keeps the title's words. This image keeps "The moon, at night"
as visible text under the picture.

Blocks 73: the announcement waits for this answer, since the answer may change what the package
writes for a titled image.

### 115. Build text holding no `border` mark in `losslessMarkdownToAdf`, and have `adfToLosslessMarkdown` carry text holding one.

`!adf:border[x]{color="#091e42" size=2}` builds text holding `border`, which
`formatted_text_inline_node` (`spec/adf-schema/full.json`) withholds from text: only `media` and
`mediaInline` take it, so a site may reject the document. `takenMarkTypes`
(`src/adf/inline-nodes.ts`) restricts text only when it is marked `code`. It changes how stored
markdown reads, so it ships in a minor. Found while building item 114, 2026-10-14.

### 60. Collect the questions `parse/` asks `emit/` into one named module.

`parse/` asks `emit/` through `commonMarkSpelling` and `openingLinkTakesDirective`, each imported
from where it happens to live. One module naming the questions keeps `docs/decisions.md` §The source
parts by ADF and format true as they grow.

### 92. Lower the reading cost of the files a chunk reads most before its first commit.

The last five chunks' median is 106412 new input tokens before their first commit, the five before
them 104037. Files read most over the last five chunks, counting opens and searches: `todo.md` 19,
`README.md` 18, `docs/decisions.md` 9, `CHANGELOG.md` 6, `MIGRATION.md` 6,
`src/conformance/commonmark-spec.test.ts` 6, `src/markdown/portable/inline-reduction.ts` 6,
`spec/flavour.md` 5, `src/markdown/portable/adf-to-portable-markdown.test.ts` 5,
`src/markdown/parse/inline-content.ts` 4.

### 102. Place a block a portable task list refuses at its path in the returned document without replaying `splitTaskList` on stand-in nodes.

`splitPath` (`src/markdown/parse/markdown-to-adf.ts`) builds stand-ins and `splitPlace`
(`src/markdown/portable/task-list.ts`) finds them again by object identity, right only while
`taskOfParagraphs` keeps the original child objects. Both paired-ruling seats on 2026-10-11 named it
the reason the project read worse.

### 95. Find the code-span closers an escape forms, the mark runs a line cannot spell and the text `[` that opens link text by reading the line back, in place of `escapeClosedRuns`, `unspellableRuns` and `lastLinkClose` predicting them.

`escapeClosedRuns` works out which backtick strings an escape leaves, `unspellableRuns` rebuilds the
reader's emphasis and highlight pairing, and `lastLinkClose` guesses which text `[` opens link
text. Only the property tests catch drift between these and the reader, and it holds the project
under the comprehension floor. Reading the line back costs one parse each time a line is tried. The
run it carries may differ from today's, which changes lossless output (§The formats are API).

### 91. Spell an emphasis once across the code spans, an emphasis or link once across the hard breaks, dates, emoji, inline cards, mentions and statuses between two nodes it marks, and an emphasis across inline media, in both writers.

It needs item 95, which lets the joined spelling be tried and kept only where it reads back. No
reader marks a hard break, so `*One\` then `Two*` writes back as `_One_\` then `_Two_`, and a link
typed across a line as two links. No reader gives those other nodes a mark Atlassian's schema
withholds from them, and none gives code text a mark but a link. So `**Ping !adf:mention[@A]{id=x}
now**` and ``**Run `npm ci` first**`` each write back as two strong runs, with the space beside the
mention or code spelled `!adf:text{text=" "}`. Joining the run across the break in
`inline-line.ts` ruled worse with two comprehension panels (PR #22): a joined run that cannot be spelled needs its own fallback,
first as a set of parted breaks, then as a flag the first fallback clears.

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

### 33. Emit a line in time linear in its mark runs, in `adfToLosslessMarkdown` and `adfToPortableMarkdown`.

`adfToLosslessMarkdown` spends 28 s on one paragraph of 2000 × `un` plus `**-r**`: each run its
flanking cannot spell re-emits the whole line before riding the carry, quadratic in the runs, and
the portable reduction's `spellableLine` drops one mark per re-emit the same way. An inline node
whose attributes no spelling writes re-emits the line the same way before riding the carry. Make all
three linear.

### 109. Spell nested lists and quotes in time linear in the markdown.

Each level of a nested list or quote re-indents its whole text, so the work is the depth times the
text. `losslessMarkdownToAdf` on 3 MB of lazy lines in a list nested 490 levels inside
`!adf:blockquote` spends about 5 seconds re-spelling it. 2 MB of the same lines, split over two
items of a list nested 480 levels, took 11 minutes to refuse on Node 24: a deep subtree past the
length bound refuses only once every level below has re-indented its text. The writers do the same
on such a document. Found while shipping item 106, 2026-10-11.

### 73. Announce the package where someone needing an ADF converter already reads: JRACLOUD-77436, the Atlassian developer community and Stack Overflow's ADF-to-markdown questions.

Blocked by every other `0.3.0` item (the maintainer, 2026-10-14): the posts announce the finished
release. Each post links the GitHub repository, the README's comparison table and a README that opens with what the package is. Before
posting, set `converter-comparison/run.sh`'s pins to each package's latest version,
`@larvit/adf-codec@0.3.0` included, and `--before` to today. Run it, then bring the README table,
its versions and its date in step with the output. We draft each post for the place it goes; the
maintainer posts them once `0.3.0` is published. Found while planning discoverability, 2026-10-04.

### 112. Pad a GFM pipe table's short rows with empty cells, read its body rows holding no pipe, and read a one-column table without leading pipes in `portableMarkdownToAdf`.

GFM pads a short row with empty cells, reads a line holding no `|` after a table as a row, and
reads `a |` over `--- |` as a one-column table. `portableMarkdownToAdf` refuses a short row as
`malformed-pipe-table`, ends the table at a line holding no `|`, and reads the one-column shape as a
paragraph. A long row stays refused (`docs/decisions.md` §The portable reader refuses what GFM's
reading would drop), so the README's pipe-table guarantee keeps the long row for both readers, and
the short row and the line holding no `|` for `losslessMarkdownToAdf` alone. The one-column shape needs `isBareDelimiterRow` in the writer's escaping to cover it too.

### 80. Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.

Lands with items 45 and 77, whose reader walks every node. Today every refused node, such as one
with a `Date` in an attribute, reads `an ADF document's content holds ADF nodes: one of them is not`
with an empty `path`. An export tool told this about one document in thousands then searches that
document's whole tree. Give the node's path, and name its type and the attribute key as
`attributeNestingMessage` does. Found by the product-owner review of items 66 and 67, 2026-10-05.

### 81. Fail the gate unless the README's error tables list exactly the codes `ConvertErrorCode` holds.

`src/result.test.ts` checks the union against the call sites only, so a code added or removed
leaves the README's tables a false contract under a green gate. Assert that the tables list exactly
the union. Found by the technical-principles audit of item 78, 2026-10-05.

### 75. Make the generated-markdown property write block carries as `adf:` fences, canonical and hostile.

`blockCarry` and `hostileBlockCarry` (`src/conformance/markdown-property.test.ts`) write a fence
whose info string is `carry`. Under the `docs/decisions.md` entry "The carry fence names the node
type", that is an ordinary code language, so the property reaches `readCarriedBlock`'s refusals only
where a random edit lands in a canonical document. Write `adf:<type>` and `adf:` fences, canonical
and hostile. Technical principle: for pure logic over many inputs, prefer a property test, so the property must reach the fenced carry's refusals itself. Found by the technical-principles audit, 2026-10-04.

### 6. Specify the HTML dialect.

Element-by-element mapping, the `data-*` fidelity scheme, the opaque-carry form, and the documented
foreign-element set `htmlToAdf` accepts — the set the markdown readers share (`spec/flavour.md` §Raw
HTML in input). The set sorts per `docs/decisions.md` §Foreign HTML sorts three ways.

### 7. Ship HTML: `adfToHtml`, `htmlToAdf`, and markdown to and from HTML composed through ADF, each call named by its flavour.

Which flavours get a composed call is this item's to settle; the
CommonMark spec suite also runs against the one reading CommonMark. The README documents HTML as it
documents markdown, its comparison table names HTML, and its tagline and `package.json`'s
description and keywords name HTML again. `htmlToAdf` refuses a value that is not a string as
`not-a-string` (`docs/decisions.md` §Which code a cause takes).

### 46. Publish the bundle size in the README, failing the release pipeline when it drifts.

Item 7 changes the size. The quantity is what a consumer downloads and loads: the
tarball `npm pack` produces, its unpacked `dist`, and the built JavaScript minified + gzipped — the
figure the competitors advertise (marklassian's "12kb") and the only apples-to-apples one, since
ours ships tsc's unminified output and no minifier yet (decide here whether to minify for the build
or report the unminified gzip). The figure lands in README §The package beside the "no runtime
dependencies" claim, and in a size column of the comparison table. Measured today,
unminified: tarball 60.4 kB, unpacked 221.5 kB, JS gzipped 45.6 kB.

### 45. Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.

Lands with item 77: the reader returns item 77's copy. Goal 1 has every call return a result; the
boolean guard is the one export that does not, and it cannot say which branch refused, where
`not-an-adf-document`'s message already does. Breaking: `MIGRATION.md` shows the guard's
replacement.

### 68. Carry a non-text inline node holding `content` or `text`, a block holding `text`, and a leaf block holding `content`.

`emitLeaf` (`emit/inline-line.ts`) and `emitDirectiveBlock` (`emit/adf-to-markdown.ts`)
refuse these with `unsupported-node-shape`, though `isAdfDocument` accepts them and the carry
round-trips them; `docs/decisions.md` §The code list gives a cause the carry answers no code. Drop
them from the README's `unsupported-node-shape` cause "Writing, in `adfToLosslessMarkdown`". Found by the README-goals
audit, 2026-10-04.

### 51. Match a reference label to its definition under Unicode case folding.

`link-syntax.ts` normalizes a label with `toLowerCase`, so `[ẞ]` misses its `[SS]` definition (spec
example 540). Fold with Unicode's full case folding, `CaseFolding.txt`'s C and F mappings, shipped
as data per §Standards ship as data: lowercasing and then uppercasing would also merge `ı` with
`I`, which folding keeps apart, so add that pair as a fixture. Breaking: `MIGRATION.md`'s Readings table
gains its row. Its `pending` exceptions go, and the README's guarantees drop the case-folding
exception and count one fewer.

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

### 107. Spell the block carry's JSON so its length stays linear in the node's JSON.

The block carry indents two spaces a level, so about 1 MB of deeply nested arrays in a carried
node's JSON spells past V8's longest string, which the writers refuse as `unsupported-node-shape`;
the inline carry's compact JSON would fit. docs/decisions.md §The code list calls a refusal no
spelling recovers from a gap in the flavour. Respelling the carry changes the format (§The formats
are API). Found by the README-goals audit of item 83, 2026-10-11.

### 72. Re-create `gitea.larvit.se/larvit/adf-codec` as a read-only pull mirror of GitHub, its issues and Actions off and its description pointing at GitHub.

Blocked by every other `0.4.0` item (the maintainer, 2026-10-05). The maintainer does this. Gitea
cannot convert an existing repository to a mirror, so the copy is deleted and re-created. That drops
the copy's commit hashes from before the 2026-10-04 history rewrite, and its Actions secrets. The
Gitea copy holds no issues or releases to move. Actions stay off on the mirror: Gitea runs
`.github/workflows/` when `.gitea/workflows/` is absent, and the mirrored `publish` job would
otherwise run there. When this lands, the `docs/decisions.md` entry "GitHub is canonical" loses its
interim sentence.

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

### 76. State the files the package does not ship once, so the build, the lint ceiling and the coverage exclusions cannot drift apart.

Technical principle DRY: the set is written in `tsconfig.build.json`'s `exclude`, `.oxlintrc.json`'s
`ignorePatterns` and the `test` script's two `--test-coverage-exclude` flags, and §The size ratchet
assumes they agree. A helper added to one list lints test code under the shipped ceiling, or drops
shipped code from coverage, silently. Derive two from the third, or assert in a test that the three
agree. Found by the technical-principles audit, 2026-10-04.

### 56. Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.

Technical principle "One owner per value": the `Walk` record passes through functions that mutate it
and return `void`; `walk.leaf` alone is written in seven places, and `openedList` reads the
`endedLists` that `closeLeaf` fills. `ContainerStack` in the same file shows the shape to follow. `inline-content.ts`'s `Scan` has the same shape: about fifteen
functions write `pending`, `pieces`, `deactivatedBefore` and `openingSpellableLink` and return
`void`, and `parseInlineContent` reads a flag `scanInline` leaves on it. The same shape recurs in
`mintTaskIds` (`portable/task-ids.ts`), which writes `attrs` on the document `readDocument` built;
`takeFallback` (`emit/inline-line.ts`), which writes the record the next `lineSegments` pass reads;
`writeUnpaired`, `markPairings` and `markHighlights` (`inline-content.ts`), whose order changes the
output.
Once `Scan`'s pieces have owners, the bracket resolution — `linkedAlt` through `linkTo`,
`holdsLink`, and `closeBracket` through `altText` — can leave `inline-content.ts` (about 690 lines)
for a module of its own.

### 118. Spell a portable link's title through `oneLine`.

`portableLink` (`src/markdown/portable/inline-reduction.ts`) repeats `oneLine`'s replacements by
hand, so a change to what a portable line drops would miss link titles. Technical principle: DRY.
Found by the principles audit of item 99, 2026-10-14.

### 34. Read emphasis flanking by the whole character beside an astral symbol.

Check whether `delimiterRunToken` (`inline-tokens.ts`), `emittedRuns` and `resolveEmphasis`
(`line-escaping.ts`) read one UTF-16 unit beside an astral symbol. A lone surrogate is neither
punctuation nor symbol, but CommonMark reads `😀` as punctuation. Where they do, read the code
point, with a fixture per direction.

### 82. Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.

Technical principle: tests use random UUID v7 ids; `portable-markdown-to-adf.test.ts` already does.
Found by the technical-principles audit of item 78, 2026-10-05.

### 58. Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes.

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

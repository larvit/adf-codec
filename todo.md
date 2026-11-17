# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 209`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 201 | 0.4.0 |  | question | **Confirm or change the readings `jiraWikiToAdf` takes that differ from Jira's.** | 2 | 2 | 2 | 4 | 2 | 11 by 3, 6 by 2 | 5.7 |
| 204 | 0.4.0 |  | question | **Decide whether `adfToHtml`'s HTML, changed outside a carry element or missing its final line feed, keeps its `data-*` attributes when `htmlToAdf` reads it; today it reads as other HTML and drops them without a refusal.** | 2 | 2 | 3 | 5 | 3 |  | 0.0 |
| 202 | 0.4.0 |  |  | **Keep every test under Bun's 5 s limit on a loaded machine, so the local gate fails only on a defect.** | 1 | 1 | 1 | 1 | 1 | code health by 2 | 12.5 |
| 200 | 0.4.0 |  |  | **Carry a link whose `href` Jira shows as text, and read `[x]` and `[a\|x]` with such an address as text.** | 2 | 2 | 2 | 4 | 3 | 11 by 4, 6 by 2 | 5.1 |
| 194 | 0.4.0 |  | owner | **Write ADF as Jira wiki markup alone, dropping the form and keeping the content of what wiki markup cannot spell.** | 2 | 2 | 2 | 4 | 4 | 11 by 2 | 1.1 |
| 196 | 0.4.0 | 194 | owner | **Document the wiki calls in the README, with a row comparing them with Atlassian's `WikiMarkupTransformer`.** | 1 | 2 | 1 | 2 | 2 | 3 by 2, 11 by 1 | 3.6 |
| 199 | 0.4.0 |  |  | **Spell a text ending in `:` or `;` inside a line plainly where the next spelled character cannot close a smiley, as in `*Environment:* Chrome`.** | 2 | 1 | 1 | 2 | 3 | 6 by 2, 11 by 2 | 3.5 |
| 137 | 0.4.0 |  | owner | **Read foreign HTML in `htmlToAdf` best effort, never refusing it, as `docs/decisions.md` §Foreign HTML reads best effort and is never refused states.** | 4 | 1 | 2 | 5 | 6 | 12 by 6 | 1.1 |
| 172 | 0.4.0 |  | principle | **Build one test per reader or case in place of a loop inside a test body, in the 26 test files that loop.** | 3 | 1 | 1 | 3 | 8 | code health by 2 | 0.5 |
| 107 | 0.4.0 |  | decision | **Spell the block carry's JSON so its length stays linear in the node's JSON.** | 3 | 1 | 3 | 5 | 5 |  | 0.0 |
| 170 | 0.4.0 |  | owner | **Bundle the packed tarball with webpack, esbuild, Rollup and Bun in the gate, failing on any bundler warning, and run each bundle's round-trip in Node.** | 3 | 1 | 1 | 3 | 5 |  | 0.0 |
| 42 | 0.5.0 |  | defect | **Trim a text leaf's trailing blanks in linear time.** | 1 | 1 | 2 | 2 | 2 | 9 by 3 | 15.6 |
| 191 | 0.5.0 |  | defect | **Make the edge trim and the reference of its property test agree on a line whose strong link run ends in blanks before two hard breaks.** | 2 | 1 | 2 | 3 | 2 | code health by 3 | 15.6 |
| 31 | 0.5.0 |  |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 11.7 |
| 57 | 0.5.0 |  |  | **Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 11.7 |
| 38 | 0.5.0 |  | defect | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 1 | 1 | 2 | 2 | 2 | 1 by 2 | 10.4 |
| 76 | 0.5.0 |  |  | **State the files the package does not ship once, so the build, the lint ceiling, the coverage exclusions and the mutation run cannot drift apart.** | 1 | 1 | 1 | 1 | 2 | code health by 2 | 10.4 |
| 56 | 0.5.0 |  |  | **Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.** | 3 | 1 | 2 | 4 | 5 | code health by 5 | 7.8 |
| 118 | 0.5.0 |  |  | **Spell a portable link's title through `oneLine`.** | 1 | 1 | 1 | 1 | 1 | code health by 1 | 6.2 |
| 208 | 0.5.0 |  |  | **Make the two HTML edit properties hold where an edit puts a raw `<` in an attribute value, which the dialect reads and writes back as `&lt;`.** | 1 | 1 | 1 | 1 | 1 | code health by 1 | 6.2 |
| 183 | 0.5.0 |  |  | **Answer developer-community topic 41858 once 0.4.0 is published.** | 1 | 1 | 1 | 1 | 1 | 3 by 2, 6.2 by 2 | 5.8 |
| 197 | 0.5.0 |  |  | **Write a heading holding a node wiki markup cannot spell as `h1.` to `h6.` with that node's inline carry, rather than carrying the whole heading.** | 2 | 1 | 1 | 2 | 3 | 6 by 3, 11 by 2 | 4.4 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | code health by 1 | 3.9 |
| 178 | 0.5.0 |  | owner | **Reach the comprehension floor: move the reasoning behind the emitter's fallback and escape loops into the code that runs them, so each reads on its own.** | 3 | 1 | 2 | 4 | 7 | code health by 8 | 3.7 |
| 207 | 0.5.0 |  | decision | **Read `colspan` and `rowspan` on a cell of foreign HTML as the cell's spans.** | 2 | 1 | 2 | 3 | 2 | 12 by 3 | 3.3 |
| 58 | 0.5.0 |  |  | **Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.** | 4 | 2 | 2 | 6 | 6 | code health by 3 | 2.6 |
| 205 | 0.5.0 |  |  | **Settle by a reader panel how an image of empty `alt` in foreign HTML reads, an email's 1×1 tracking pixel among them, and read it so.** | 2 | 2 | 2 | 4 | 2 | 12 by 2 | 2.2 |
| 187 | 0.5.0 |  |  | **Write a `blockTaskItem` and a nested task list as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 3 | 6 by 2 | 1.8 |
| 206 | 0.5.0 |  | decision | **Place each node foreign HTML reads where Atlassian's schema allows it, as in a table inside a quote read to blocks the quote can hold.** | 2 | 2 | 2 | 4 | 4 | 12 by 3 | 1.6 |
| 9 | 0.5.0 |  |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 3 | 2 | 1 | 4 | 6 | 3 by 6 | 1.3 |
| 34 | 0.5.0 |  |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 1 | 2 | 3 | 3 | 4 by 1 | 0.9 |
| 74 | 0.5.0 |  | owner | **Keep the release path publishing after npm retires bypass-2FA tokens.** | 3 | 2 | 4 | 7 | 4 |  | 0.0 |
| 8 | 0.6.0 |  | owner | **Ship a CLI.** | 3 | 2 | 1 | 4 | 7 |  | 0.0 |
| 139 | 0.7.0 |  | decision | **Ship the calls between markdown and HTML, composed through ADF and each named by its flavour.** | 2 | 1 | 2 | 3 | 4 | 3 by 3 | 1.9 |
| 138 | 0.7.0 | 137 |  | **Read raw HTML in every markdown reader through `htmlToAdf`'s foreign-element mapping, in place of refusing it as `unmappable-html`.** | 3 | 1 | 3 | 5 | 5 | 4 by 4 | 1.5 |

## Renamed

- 0.2.1 renamed to 0.3.0

## Details

### 201. Confirm or change the readings `jiraWikiToAdf` takes that differ from Jira's.

Item 195 made these choices without the maintainer, and `docs/decisions.md` §The wiki reader refuses only a broken `{adf}` macro, nesting past 500 levels and output past the engine's limits, and reads every other string records them. Each is a string the writers never write. Confirm each, or say what it reads to instead:

- A broken `{adf}` macro is refused as `unsupported-node-shape`, with the path `[]`, where it could read as text.
- `{code}`, `{noformat}`, `{panel}` and `{quote}` after anything else on a line read as text, where Jira reads them inside a line.
- An image that shares its line reads as text, where Jira shows it inline.
- An `{adf}` macro inside a line that closes on a later line is refused.
- A delimiter reads by the rule the writer escapes by, where Jira's own rule differs at an edge such as `x^2^`.
- `-- ` at a line's start reads as an en dash and text, where Jira reads a nested bullet.
- A list line of up to 500 markers reads, and the writers refuse the document past 250 levels of list as `unsupported-nesting-depth`.

Touches:
- `src/wiki/parse/jira-wiki-to-adf.ts`: `readMacro`, `readItem`, `readLine`
- `src/wiki/parse/inline.ts`: `delimiter`, `dash`
- `spec/wiki.md`: `## What only the reader reads`
- `docs/decisions.md`: the entry named above

### 204. Decide whether `adfToHtml`'s HTML, changed outside a carry element or missing its final line feed, keeps its `data-*` attributes when `htmlToAdf` reads it; today it reads as other HTML and drops them without a refusal.

The gap: `docs/decisions.md` §`htmlToAdf` reads any HTML, with no option and no second call lets
only a `data-adf` attribute or an `adf-` class claim the dialect. So `htmlToAdf(html.trimEnd())`
on `adfToHtml`'s output, or the same HTML with one block an editor added, reads best effort and
loses every `data-local-id`, `data-align`, `data-indent-level`, `data-colwidth`,
`data-background-color` and `data-text-color` outside a claiming element, where `0.3.1` refused
before the save. The viewer/editor persona relies on a refusal arriving before the save. Both the
product-owner and the prose reviewer of item 137 raised it; the README, `spec/html.md` and
`MIGRATION.md` state the loss and the check an app can make.

Earlier entries of its class: §Foreign HTML reads best effort and is never refused, §`htmlToAdf`
also reads the dialect as a browser serializes it.

Candidate entry: "The dialect's `data-*` attributes claim it too: an element holding one reads only
as the dialect, and HTML missing only its final line feed reads as the dialect." Instance it
yields: `<p data-align="center">a</p>` in an email is `unsupported-node-shape` or a centred
paragraph instead of a plain one, and a trimmed document reads whole.

Recommendation: read HTML that misses only its final line feed as the dialect, and leave the claim
rule as the developer panel picked it.

### 202. Keep every test under Bun's 5 s limit on a loaded machine, so the local gate fails only on a defect.

Item 195's chunk ran `./ci.sh` eight times at a load average of 15 to 20, and the Bun leg failed four of them, only on two markdown tests the chunk didn't touch: `joins a mark run's segments as a walk rather than as one call's arguments` (3.9 s when it passes, 13 to 17 s on Node) and `reduces a line alike dropping every run a pass may or the first alone`. GitHub's gate passed each time. Shrink the two inputs to the smallest that still fails on the quadratic walk each guards against, or give the tests their own timeout.

Touches:
- the two tests named above, under `src/markdown/`

### 200. Carry a link whose `href` Jira shows as text, and read `[x]` and `[a|x]` with such an address as text.

Item 195's probes of Jira found that it shows `[x]` and `[a|x]` as text where `x` is no address it links, such as a bare word. The lossless writer writes a `link` with such an `href` as `[a|x]`, so the link is lost when Jira renders the markup, and `jiraWikiToAdf` reads both as a `link`, unlike Jira. Probe which addresses Jira links (a scheme, `#anchor`, `mailto:`, a path), record the list in `spec/wiki.md`, carry every other `href`, and read the same strings as text.

Touches:
- `src/wiki/spellings.ts`: `spellableUrl`
- `src/wiki/emit/inline-line.ts`: the link spelling
- `src/wiki/parse/inline.ts`: `bracketed`, `closeLink`
- `spec/wiki.md`: Marks
- `src/wiki/emit/adf-to-jira-wiki.test.ts`, `src/wiki/parse/jira-wiki-to-adf.test.ts` (small)

### 194. Write ADF as Jira wiki markup alone, dropping the form and keeping the content of what wiki markup cannot spell.

Goal 7. The maintainer asked for it beside the lossless writer, 2026-11-15. It spells as the
lossless writer does, except where that writer would use the `{adf}` macro.

Touches:

- `src/jira-wiki/emit/adf-to-jira-wiki.ts`
- `src/jira-wiki/emit/adf-to-jira-wiki.test.ts`
- `src/index.ts`: lines 3-13 (small)
- `package-tests/consumer.ts`: lines 1-17 (small)

### 196. Document the wiki calls in the README, with a row comparing them with Atlassian's `WikiMarkupTransformer`.

A Quick start section per direction, the calls table and the guarantees. The comparison tables
gain a row, as the decision "The comparison tables list every ADF converter that starts and
converts" asks.

Touches:

- `README.md`: `## Main functionality`, `## Quick start`, `## Other ADF converters`, `## The calls`, `### The error shape` (small), `## The guarantees`, `## Everything exported`
- `converter-comparison/compare.mjs`: lines 67-108 (small)

### 199. Spell a text ending in `:` or `;` inside a line plainly where the next spelled character cannot close a smiley, as in `*Environment:* Chrome`.

Item 198's product-owner review found that `escapedText` carries any text ending in `:` or `;` inside a line, since the next node's spelling may close a smiley. The closing delimiter of a mark group (`*` after `Environment:`) cannot, so a bold label comes out as `{adf}` JSON where plain `*Environment:*` reads the same. `atom` doesn't know the next spelled character; `groupSpelling` does.

Touches:
- `src/wiki/emit/inline-line.ts`: `atom`, `groupSpelling`
- `src/wiki/emit/text-escaping.ts`: `escapedText`, `smileyStops`
- `spec/wiki.md`: Inline
- `src/wiki/emit/adf-to-jira-wiki.test.ts` (small)

### 137. Read foreign HTML in `htmlToAdf` best effort, never refusing it, as `docs/decisions.md` §Foreign HTML reads best effort and is never refused states.

Reading HTML from emails, CMSs and editors is the most asked need on the Atlassian developer
community. A developer panel picked `htmlToAdf` itself, with no option, as `docs/decisions.md`
records. The maintainer placed it in 0.4.0 on 2026-11-16; it doesn't move to a later release.

Touches:

- `src/html/parse/html-to-adf.ts`
- `src/html/parse/inline.ts`
- `src/html/parse/inline-block.ts`
- `src/html/parse/source.ts`
- `src/html/parse/node-element.ts`
- `src/html/parse/carry-element.ts`
- `src/html/parse/html-to-adf.test.ts`
- `spec/html.md`: `## Reading`
- `README.md`: `## HTML` (small), `## The calls` (small), `## The errors` (small)

### 172. Build one test per reader or case in place of a loop inside a test body, in the 26 test files that loop.

134 loops run several readers or cases inside one test body, for example
`for (const read of [commonMarkToAdf, losslessMarkdownToAdf, portableMarkdownToAdf])` at lines 97,
279, 771, 917, 926, 962 and 1118 of `src/markdown/parse/markdown-to-adf.test.ts`; the most are in
`adf-schema.test.ts` (18), `limits.test.ts` (12) and `portable-markdown-to-adf.test.ts` (10). The
first failing reader stops the test and the failure never names the reader. Write
``for (const read of readers) test(`… in ${read.name}`, …)`` at the top level. Technical principle:
"No loops or branches in a test body; parametrize the cases". Found by the principles audit of the
release review of 0.3.0, 2026-11-08.

Touches:

- `src/conformance/adf-schema.test.ts`
- `src/conformance/commonmark-spec.test.ts`
- `src/conformance/corpus.test.ts`
- `src/conformance/adf-property.test.ts`
- `src/conformance/flavour.test.ts`
- `src/conformance/markdown-property.test.ts`
- `src/html/parse/html-to-adf.test.ts`
- `src/html/emit/adf-to-html.test.ts`
- `src/markdown/emit/limits.test.ts`
- `src/markdown/emit/unspellable-runs.test.ts`
- `src/markdown/emit/inline-line.test.ts`
- `src/markdown/emit/block-text.test.ts`
- `src/markdown/emit/adf-to-markdown.test.ts`
- `src/markdown/parse/markdown-to-adf.test.ts`
- `src/markdown/parse/blocks.test.ts`
- `src/markdown/portable/portable-markdown-to-adf.test.ts`
- `src/markdown/portable/adf-to-portable-markdown.test.ts`
- `src/markdown/portable/inline-reduction.test.ts`
- `src/markdown/portable/task-ids.test.ts`
- `src/markdown/portable/editor-normal.test.ts`
- `src/markdown/inline-tokens.test.ts`
- `src/markdown/commonmark/link-syntax.test.ts`
- `src/markdown/commonmark/entity-references.test.ts`
- `src/markdown/commonmark/case-folding.test.ts`
- `src/adf/document.test.ts`
- `src/plain-text/adf-to-plain-text.test.ts`
- `src/json-text.test.ts`
- `src/result.test.ts`
- `src/canonical-json.test.ts`

### 107. Spell the block carry's JSON so its length stays linear in the node's JSON.

The block carry indents two spaces a level, so about 1 MB of deeply nested arrays in a carried
node's JSON spells past V8's longest string, which the writers refuse as `unsupported-node-shape`;
the inline carry's compact JSON would fit. docs/decisions.md §The code list calls a refusal no
spelling recovers from a gap in the flavour. Respelling the carry changes the format (§The formats
are API). Found by the README-goals audit of item 83, 2026-10-11.

Touches:

- `src/canonical-json.ts`: `JsonSpelling`, `canonicalJsonPieces`, `objectMembers`, `schedule`, `spellsCanonicalJson` (small)
- `src/markdown/opaque-carry.ts`: `carriedBlock`, `readCarriedJson`
- `src/adf/carried-json.ts`: `carriedJson` (small)
- `src/canonical-json.test.ts`
- `src/markdown/parse/markdown-to-adf.test.ts`: lines 450-500
- `src/conformance/markdown-property.test.ts`: lines 183-200
- `spec/flavour.md`: `## The opaque carry`
- `corpus/round-trip/opaque-carry/unknown-block.md`
- `corpus/round-trip/opaque-carry/unknown-type-spelling.md`
- `corpus/round-trip/opaque-carry/carry-in-wrappers.md`
- `corpus/round-trip/opaque-carry/code-block-children.md`
- `corpus/errors/carry-fence-type.md`
- `corpus/errors/carry-fence-type-spellable.md`

### 170. Bundle the packed tarball with webpack, esbuild, Rollup and Bun in the gate, failing on any bundler warning, and run each bundle's round-trip in Node.

Consumers bundle the package, Forge apps with webpack among them, and one reported a "Critical
dependency" warning from another converter. Nothing in the gate bundles it today. Install the
tarball as `package-tests` does, bundle an entry file that round-trips one document through
`adfToLosslessMarkdown` and `losslessMarkdownToAdf`, and run each bundle in Node. A warning fails the
leg as an error does: webpack's "Critical dependency" is a warning. The bundlers live in
`bundle-size/`'s package, beside esbuild, as Stryker lives in its own (§Stryker in its own package), with
pinned versions. Bun builds from the
image the gate already pulls. No leg needs an account or a network beyond the install.

Once the leg holds, the README may say the package bundles with those four; it says nothing about
Forge's runtime, which no leg tests.

Touches:

- `ci.sh`: lines 108-113 (small)
- `bundle-size/package.json`
- `bundle-size/package-lock.json`
- `package-tests/bundle-round-trip.mjs`
- `package-tests/bundle-entry.js`
- `README.md`: `## The package` (small)

### 42. Trim a text leaf's trailing blanks in linear time.

`portable/inline-reduction.ts`'s `leafEdges` finds the trail with an unanchored `/[ \t]*$/`,
quadratic in a run of blanks inside one leaf: a paragraph of `a`, 80 000 spaces, `b` takes 6.5 s in
`adfToPortableMarkdown`. Scan backward, as the expand title's trim does. `edgeWhitespace`, in the
same file, counts a leaf's lead and trail by index.

### 191. Make the edge trim and the reference of its property test agree on a line whose strong link run ends in blanks before two hard breaks.

Found while shipping item 190, on `origin/main`'s trim as well as on that chunk's: fast-check seed 578490788, path `94554:1:8:16:15:15:16:16:16:16`, in `trims a spanned line as the reference counts trim it, in no more passes` (`src/markdown/portable/inline-reduction.test.ts`), about one random line in 100 000, so the gate's 3 000 runs on a fixed seed pass. The line, with `held` a link to `v` and `strong`: `'x '` holding `held` and `backgroundColor`, `' '` holding `held`, `' '` unmarked, a hard break, `' '` holding `held`, `' '` unmarked, a hard break. `trimmedEdges` returns the one leaf `'x'`; the reference, `trimPass` on `runsSharedWithNext`'s counts, also keeps a linked `' '`. Decide which is right by `docs/decisions.md` → "After 32 passes…" and the trim's entries, then fix the other and pin the line as a fixed test. A second line of the class, with no link and one hard break: seed -1783810909, path `201490:2:4:5:9:9:9:15:14:18:18:18:18:22:23:23`, the line `'x '` strong, `' '` code, `' '` strong, a hard break, `' '` unmarked, `'x '` strong, `' '` unmarked; the trim gives `x`, `' '`, `' '`, hard break, `x`, the reference `'x '`, `' '`, hard break, `x`.

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

### 208. Make the two HTML edit properties hold where an edit puts a raw `<` in an attribute value, which the dialect reads and writes back as `&lt;`.

`assertReadsBack` in `src/conformance/adf-property.test.ts` expects the written HTML to equal the
edited HTML. `PROPERTY_RUNS=40000` finds `<pre data-local-id="< a"><code>a</code></pre>`, which
reads as a browser's spelling and writes back with `&lt;`. The gate's seed does not reach it.

### 183. Answer developer-community topic 41858 once 0.4.0 is published.

Topic 41858 asks for ADF as plain text. `adfToPlainText` now writes tables, images, cards, extensions and expand titles, so the answer names what it writes. Post it only after 0.4.0 publishes (§Posts announcing a release wait for its publish). The post is the maintainer's (the maintainer, 2026-10-28). It sits in 0.5.0 because the post can only go out after 0.4.0 publishes, so no chunk of 0.4.0 can finish it.

### 197. Write a heading holding a node wiki markup cannot spell as `h1.` to `h6.` with that node's inline carry, rather than carrying the whole heading.

Today `adfToLosslessJiraWiki` carries a heading as a block whenever any inline node in it rides, such as a `status`, since `spec/wiki.md` lets an inline carry stand on its own only inside a paragraph. A Jira user then sees no heading where the document has one. Extend the paragraph rule to headings in `spec/wiki.md` → The carry, and in `headingSpelling` in `src/wiki/emit/spelled-blocks.ts`; item 195's reader must then read an inline carry inside a heading line too.

### 82. Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.

Technical principle: tests use random UUID v7 ids; `portable-markdown-to-adf.test.ts` already does.
Found by the technical-principles audit of item 78, 2026-10-05.

### 178. Reach the comprehension floor: move the reasoning behind the emitter's fallback and escape loops into the code that runs them, so each reads on its own.

The scoring run at fa8600f (PR #162) averaged 5.88 overall, under the 7.0 floor; Locality and Self-sufficiency scored lowest, at 5.38 each. Make these places, the ones every seat named, easier to read:

- `src/markdown/emit/unspellable-runs.ts:223` `pairStanding` / `pairVerdicts`: the case analysis behind the two sweeps lives only in `docs/decisions.md`. State it in the types or the code, with one vocabulary.
- `src/markdown/emit/inline-line.ts:120` `settledLine`: fallbacks change the `carried` Set and `openingLinkAsDirective` out of sight. Make each pass's state an explicit value, with the 32-pass bound visible where it holds.
- `src/markdown/emit/line-escaping.ts:99` `readBack`: say in the code why three escape passes suffice.
- `src/markdown/inline-content.ts:255` and `:424` (`directiveMarkPieces`, `closeBracket`, `applyClosing`): one mutable `Scan` shared by nine piece kinds in a 695-line file. Split it by piece kind.
- `src/markdown/emit/adf-to-markdown.ts:138` `spellingMemo`: keep its take, ask and depth rebasing in one type.

Keep every output byte-identical: the round-trip properties and the CommonMark suite must pass unchanged.

### 207. Read `colspan` and `rowspan` on a cell of foreign HTML as the cell's spans.

`readForeignHtml` (`src/html/parse/foreign.ts`) drops every attribute of a `<td>` and `<th>`, so a
table from an email or a CMS loses its merged cells and its columns shift. Revise
`docs/decisions.md` §Foreign HTML reads best effort and is never refused with it.

### 58. Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes. A wrong line range in
`run.sh` mutates the wrong lines without failing, so the port tests how it reads diff hunks.

### 205. Settle by a reader panel how an image of empty `alt` in foreign HTML reads, an email's 1×1 tracking pixel among them, and read it so.

Today `<img src="https://example.com/open.gif" width="1" height="1" alt="">` beside other text
reads as its URL, linked, and alone in its paragraph as a `mediaSingle`, by §An image reads as an
image only alone in its paragraph. Most marketing email ends in one. `alt=""` marks an image as
decoration in HTML (WHATWG HTML §4.8.4.4.4). The product-owner reviewer of item 137 asked whether
the audience expects that reading (README goal 6).

### 187. Write a `blockTaskItem` and a nested task list as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

The reader panel of §The HTML dialect expected a `blockTaskItem` as an `<li>` of two `<p>` and a nested task list as an inner `<ul>`. The writer panel's spellings left both on the carry, since a task item holds inline content alone. A writer panel settles the two spellings (AGENTS.md §7); the item takes it and writes the HTML both ways.

### 206. Place each node foreign HTML reads where Atlassian's schema allows it, as in a table inside a quote read to blocks the quote can hold.

`readForeignHtml` (`src/html/parse/foreign.ts`) places a node where the HTML places it: a
`<table>` in a `<blockquote>`, a `<pre>` in a table header, an image in a list item. Jira's editor
refuses some of those documents. `spec/html.md` → "Other HTML" states today's reading in its last
paragraph. Which reading each misplaced node takes is a reader panel's pick.

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

### 138. Read raw HTML in every markdown reader through `htmlToAdf`'s foreign-element mapping, in place of refusing it as `unmappable-html`.

Waits until a consumer needs it. The change touches `inline-content.ts` and `markdown-to-adf.ts`,
places the comprehension seats found hard; leave each place it touches easier to read.

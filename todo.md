# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 152`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 151 | 0.3.0 |  | defect | **Read a link destination holding an unbalanced unescaped parenthesis as no destination, in every markdown reader.** | 2 | 2 | 2 | 4 | 2 | 5 by 2 | 17.4 |
| 95 | 0.3.0 |  | decision | **Find the code-span closers an escape forms, the mark runs a line cannot spell and the text `[` that opens link text by reading the line back, in place of `escapeClosedRuns`, `unspellableRuns` and `lastLinkClose` predicting them.** | 4 | 1 | 3 | 6 | 6 | code health by 7 | 10.2 |
| 146 | 0.3.0 |  |  | **Open the README with what an app developer choosing an ADF converter needs: what the package converts, which call to take, and that it runs without React, Atlaskit or any runtime dependency, in Node, Forge, Deno, Bun and browsers.** | 2 | 2 | 1 | 3 | 3 | 3 by 6 | 9.5 |
| 33 | 0.3.0 |  | defect | **Emit a line in time linear in its mark runs, in `adfToLosslessMarkdown` and `adfToPortableMarkdown`.** | 3 | 1 | 2 | 4 | 5 | 9 by 3 | 7.8 |
| 109 | 0.3.0 |  | defect | **Spell nested lists and quotes in time linear in the markdown.** | 3 | 1 | 2 | 4 | 5 | 9 by 3 | 7.8 |
| 150 | 0.3.0 |  | decision | **Read `adfToHtml`'s HTML in `htmlToAdf` as a browser serializes it too — a raw `"` in text, `&nbsp;`, `\r\n` line endings — so a page's `innerHTML` or a form post reads back.** | 2 | 2 | 2 | 4 | 4 | 6 by 5 | 5.0 |
| 115 | 0.3.0 |  | defect | **Build text holding no `border` mark in `losslessMarkdownToAdf`, and have `adfToLosslessMarkdown` carry text holding one.** | 2 | 1 | 2 | 3 | 3 | 4 by 3 | 4.6 |
| 145 | 0.3.0 |  |  | **Widen the README's "Other ADF converters" table to every ADF converter a developer might pick: npm packages, other languages' libraries, Atlassian's REST APIs and MCP servers, `mdast-util-from-adf` among them.** | 2 | 2 | 1 | 3 | 4 | 3 by 4 | 4.2 |
| 91 | 0.3.0 | 95 |  | **Spell an emphasis once across the code spans, an emphasis or link once across the hard breaks, dates, emoji, inline cards, mentions and statuses between two nodes it marks, and an emphasis across inline media, in both writers.** | 3 | 2 | 2 | 5 | 5 | 6 by 6 | 3.6 |
| 133 | 0.3.0 |  | decision | **Write mentions, emoji, dates, statuses and inline cards as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 4 | 6 by 3 | 3.0 |
| 132 | 0.3.0 |  |  | **Write tables as `<table>` in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 5 | 6 by 4 | 2.4 |
| 73 | 0.3.0 | 33, 91, 95, 109, 115, 132, 133, 145, 146, 150 |  | **Announce the package where someone needing an ADF converter already reads: JRACLOUD-77436, the Atlassian developer community and Stack Overflow's ADF-to-markdown questions.** | 1 | 2 | 2 | 3 | 2 | 3 by 8 | 16.9 |
| 72 | 0.3.0 | 33, 91, 95, 109, 115, 132, 133, 145, 146, 150 | decision | **Re-create `gitea.larvit.se/larvit/adf-codec` as a read-only pull mirror of GitHub, its issues and Actions off and its description pointing at GitHub.** | 1 | 2 | 1 | 2 | 1 | 3 by 1 | 2.5 |
| 128 | 0.4.0 |  |  | **Pin the portable flavour's block reading and writing with tests: callout titles past one line, a link beside other marks in a title, the nesting limit of callouts and task lists, refusals inside tasks and their paths, and empty or non-paragraph tasks.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 19.6 |
| 75 | 0.4.0 |  |  | **Make the generated-markdown property write block carries as `adf:` fences, canonical and hostile.** | 1 | 1 | 1 | 1 | 2 | code health by 2 | 17.4 |
| 45 | 0.4.0 |  | defect | **Replace `isAdfDocument` with a reader returning `Result<AdfDocument>`.** | 2 | 1 | 3 | 4 | 3 | 1 by 2 | 13.1 |
| 68 | 0.4.0 |  | defect | **Carry a non-text inline node holding `content` or `text`, a block holding `text`, and a leaf block holding `content`.** | 2 | 1 | 2 | 3 | 3 | 1 by 2 | 13.1 |
| 127 | 0.4.0 |  | principle | **Hold what `entity-references.test.ts`, `json-text.test.ts` and `result.test.ts` check by asserting outcomes, so none reads source text.** | 2 | 2 | 1 | 3 | 3 | code health by 2 | 13.1 |
| 144 | 0.4.0 |  |  | **Give every container `docker-runner.sh` and `publish.sh` start a memory limit and an equal swap limit, sized from the largest a gate leg measurably needs.** | 1 | 1 | 1 | 1 | 2 | code health by 1 | 8.7 |
| 143 | 0.4.0 |  | defect | **Keep, in `adfToPortableMarkdown`, the link around a note and the target of a link marking a card, so a linked stored image or card writes every target.** | 2 | 1 | 3 | 4 | 3 | 7 by 1 | 6.5 |
| 112 | 0.4.0 |  |  | **Pad a GFM pipe table's short rows with empty cells, read its body rows holding no pipe, and read a one-column table without leading pipes in `portableMarkdownToAdf`.** | 2 | 1 | 2 | 3 | 3 | 4 by 4 | 6.2 |
| 80 | 0.4.0 |  |  | **Name the node's path and the attribute key when `not-an-adf-document` refuses a node inside the document.** | 2 | 1 | 2 | 3 | 3 | 6 by 4 | 6.0 |
| 81 | 0.4.0 |  |  | **Fail the gate unless the README's error tables list exactly the codes `ConvertErrorCode` holds.** | 1 | 1 | 1 | 1 | 2 | 3 by 2 | 4.2 |
| 147 | 0.4.0 |  |  | **Ship `adfToPlainText`, writing a document's content with no markup, under a README goal for plain text.** | 2 | 2 | 1 | 3 | 4 | 3 by 4 | 4.2 |
| 141 | 0.4.0 |  |  | **Write `strike` as HTML in `adfToHtml` and read it back in `htmlToAdf`, in place of the carry element.** | 1 | 1 | 1 | 1 | 2 | 6 by 2 | 4.0 |
| 135 | 0.4.0 |  |  | **Write media, media groups and captions as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 4 | 6 by 2 | 2.0 |
| 136 | 0.4.0 |  |  | **Write underline, text and background colours, subscript, superscript, alignment and indentation as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 4 | 6 by 2 | 2.0 |
| 134 | 0.4.0 |  |  | **Write panels, expands, task lists and decision lists as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 5 | 6 by 3 | 1.8 |
| 46 | 0.4.0 | 134, 135, 136 |  | **Publish the bundle size in the README, failing the release pipeline when it drifts.** | 2 | 2 | 1 | 3 | 4 | 3 by 3 | 3.2 |
| 51 | 0.4.0 |  |  | **Match a reference label to its definition under Unicode case folding.** | 2 | 1 | 2 | 3 | 4 | 4 by 2 | 2.1 |
| 148 | 0.4.0 |  |  | **Ship conversion between ADF and Jira wiki markup both ways, under a README goal for wiki markup.** | 3 | 2 | 2 | 5 | 7 | 3 by 5 | 0.9 |
| 149 | 0.4.0 |  |  | **Read any HTML into ADF, in a call or option a developer panel picks, under a README goal for foreign HTML.** | 3 | 2 | 2 | 5 | 7 | 3 by 5 | 0.9 |
| 77 | 0.4.0 |  | decision | **Read the input once into a plain copy, so an accessor property or a throwing Proxy yields `not-an-adf-document` and every call returns a result.** | 3 | 1 | 3 | 5 | 4 |  | 0.0 |
| 107 | 0.4.0 |  | decision | **Spell the block carry's JSON so its length stays linear in the node's JSON.** | 3 | 1 | 3 | 5 | 5 |  | 0.0 |
| 42 | 0.5.0 |  | defect | **Trim a text leaf's trailing blanks in linear time.** | 1 | 1 | 2 | 2 | 2 | 9 by 3 | 26.2 |
| 31 | 0.5.0 |  |  | **Make the branch-coverage figure repeat across runs of an unchanged tree.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 19.6 |
| 57 | 0.5.0 |  |  | **Make each `ci.sh` leg build what it reads, so one leg run alone tests the current tree.** | 2 | 1 | 1 | 2 | 3 | code health by 3 | 19.6 |
| 38 | 0.5.0 |  | defect | **Spell a lone surrogate in a text node so it survives a UTF-8 encode.** | 1 | 1 | 2 | 2 | 2 | 1 by 2 | 17.4 |
| 76 | 0.5.0 |  |  | **State the files the package does not ship once, so the build, the lint ceiling and the coverage exclusions cannot drift apart.** | 1 | 1 | 1 | 1 | 2 | code health by 2 | 17.4 |
| 56 | 0.5.0 |  |  | **Give each piece of `blocks.ts`'s block-walk state and `inline-content.ts`'s `Scan` one owner that returns what it changes.** | 3 | 1 | 2 | 4 | 5 | code health by 5 | 13.1 |
| 118 | 0.5.0 |  |  | **Spell a portable link's title through `oneLine`.** | 1 | 1 | 1 | 1 | 1 | code health by 1 | 10.5 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | code health by 1 | 6.5 |
| 58 | 0.5.0 |  |  | **Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.** | 4 | 2 | 2 | 6 | 6 | code health by 3 | 4.4 |
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

### 151. Read a link destination holding an unbalanced unescaped parenthesis as no destination, in every markdown reader.

CommonMark lets an unbracketed destination hold a parenthesis only escaped or in a balanced pair,
but `[a](b(c "t")` reads as a link to `b(c` titled `t`, where cmark and commonmark.js read text.
`readDestination` and `targetMemo` (`src/markdown/commonmark/link-syntax.ts`) stop at a space with
parentheses still open and keep the destination. The writers escape an unbalanced parenthesis, so
no written markdown changes. Found while shipping item 140, 2026-10-28.

### 95. Find the code-span closers an escape forms, the mark runs a line cannot spell and the text `[` that opens link text by reading the line back, in place of `escapeClosedRuns`, `unspellableRuns` and `lastLinkClose` predicting them.

`escapeClosedRuns` works out which backtick strings an escape leaves, `unspellableRuns` rebuilds the
reader's emphasis and highlight pairing, and `lastLinkClose` guesses which text `[` opens link
text. Only the property tests catch drift between these and the reader, and it holds the project
under the comprehension floor. Reading the line back costs one parse each time a line is tried. The
run it carries may differ from today's, which changes lossless output (§The formats are API).

### 146. Open the README with what an app developer choosing an ADF converter needs: what the package converts, which call to take, and that it runs without React, Atlaskit or any runtime dependency, in Node, Forge, Deno, Bun and browsers.

Found 2026-10-28 surveying the Atlassian developer community: the most asked need is HTML or
markdown into ADF, and most threads stall on Atlaskit needing React, not being ESM and clashing
with Forge's bundler and `prosemirror-model` versions. The README says none of this before its
call list. Before the change, a reader panel of the four personas in `## Audience` reads the first
screen cold and says what the package does, which call it would take, and why over Atlaskit; fix
what they miss. Bring the npm `description` and `keywords` and the GitHub topics in step.

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

### 150. Read `adfToHtml`'s HTML in `htmlToAdf` as a browser serializes it too — a raw `"` in text, `&nbsp;`, `\r\n` line endings — so a page's `innerHTML` or a form post reads back.

`htmlToAdf` refuses all three today. A browser's `innerHTML` writes text's `"` raw and a no-break
space as `&nbsp;`, and a form post turns every line feed into `\r\n`, so a viewer/editor app
sending its page back gets `unmappable-html`. `docs/decisions.md` §`htmlToAdf` also reads the
dialect as a browser serializes it records the maintainer's yes. Take every difference from WHATWG
HTML §Serializing HTML fragments, not only these three, and check them against a browser's own
`innerHTML`. README §HTML and `spec/html.md` say `\r\n` is refused; update both. The comprehension
panel found `misspelling` in `src/html/escaping.ts` hard to read: make it easier.

### 115. Build text holding no `border` mark in `losslessMarkdownToAdf`, and have `adfToLosslessMarkdown` carry text holding one.

`!adf:border[x]{color="#091e42" size=2}` builds text holding `border`, which
`formatted_text_inline_node` (`spec/adf-schema/full.json`) withholds from text: only `media` and
`mediaInline` take it, so a site may reject the document. `takenMarkTypes`
(`src/adf/inline-nodes.ts`) restricts text only when it is marked `code`. It changes how stored
markdown reads, so it ships in a minor. Found while building item 114, 2026-10-14.

### 145. Widen the README's "Other ADF converters" table to every ADF converter a developer might pick: npm packages, other languages' libraries, Atlassian's REST APIs and MCP servers, `mdast-util-from-adf` among them.

The table lists only npm packages over 1,000 downloads a week, run in `converter-comparison/`.
`mdast-util-from-adf` 2.3.0 passed that bar after the table's date, 2026-10-14: 1,283 downloads in
the week to 2026-10-26. A developer choosing a converter also weighs Atlassian's own paths, the
Rovo MCP server's markdown and HTML formats among them, and libraries in Python, Go, Rust and .NET.

The maintainer, 2026-10-28: list every converter that is reasonably complete and works, whatever
its downloads, and state that bar above the table in place of the 1,000-a-week one. Run what can
run in `converter-comparison/`; describe a REST API or a hosted MCP server from Atlassian's
documentation, saying so in its row.

### 91. Spell an emphasis once across the code spans, an emphasis or link once across the hard breaks, dates, emoji, inline cards, mentions and statuses between two nodes it marks, and an emphasis across inline media, in both writers.

It needs item 95, which lets the joined spelling be tried and kept only where it reads back. No
reader marks a hard break, so `*One\` then `Two*` writes back as `_One_\` then `_Two_`, and a link
typed across a line as two links. No reader gives those other nodes a mark Atlassian's schema
withholds from them, and none gives code text a mark but a link. So `**Ping !adf:mention[@A]{id=x}
now**` and ``**Run `npm ci` first**`` each write back as two strong runs, with the space beside the
mention or code spelled `!adf:text{text=" "}`. Joining the run across the break in
`inline-line.ts` ruled worse with two comprehension panels (PR #22): a joined run that cannot be spelled needs its own fallback,
first as a set of parted breaks, then as a flag the first fallback clears.

### 133. Write mentions, emoji, dates, statuses and inline cards as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

A writer panel picks the elements, classes and `data-*` attributes. Where a link marks a card, both
the link's target and the card's URL stay in sight, a card showing only its name included
(`docs/decisions.md` §The HTML dialect).

### 132. Write tables as `<table>` in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

Header cells as `<th>`; a cell's span, width and background in HTML attributes or `data-*`, as a
writer panel picks.

### 73. Announce the package where someone needing an ADF converter already reads: JRACLOUD-77436, the Atlassian developer community and Stack Overflow's ADF-to-markdown questions.

Blocked by every other `0.3.0` item (the maintainer, 2026-10-14): the posts announce the finished
release. Item 145 rebuilds the README's comparison table; before posting, set
`converter-comparison/run.sh`'s pins to each package's latest version, `@larvit/adf-codec@0.3.0`
included, and `--before` to today, run it, and bring the table's versions and date in step.

Venues found 2026-10-28, each a thread a reply answers today: on the developer community, topics
96176, 99408, 82496, 100699, 101278, 86214 and 96638; on GitHub, `atlassian/atlassian-mcp-server`
issues 60 and 161. Finding Stack Overflow's ADF-to-markdown questions is part of this item.

We draft each post for the place it goes. Each opens with the asker's problem and how the package
solves it, then links the GitHub repository, the README's comparison table and the README's
opening. The maintainer posts them once `0.3.0` is published (`docs/decisions.md` §Posts
announcing a release wait for its publish). Found while planning discoverability, 2026-10-04.

### 72. Re-create `gitea.larvit.se/larvit/adf-codec` as a read-only pull mirror of GitHub, its issues and Actions off and its description pointing at GitHub.

Blocked by every other `0.3.0` item but 73 (the maintainer, 2026-10-05; moved to `0.3.0` 2026-10-28,
since the copy, not marked a mirror, reads as the package's origin). The maintainer does this. Gitea
cannot convert an existing repository to a mirror, so the copy is deleted and re-created. That drops
the copy's commit hashes from before the 2026-10-04 history rewrite, and its Actions secrets. The
Gitea copy holds no issues or releases to move. Actions stay off on the mirror: Gitea runs
`.github/workflows/` when `.gitea/workflows/` is absent, and the mirrored `publish` job would
otherwise run there. When this lands, the `docs/decisions.md` entry "GitHub is canonical" loses its
interim sentence.

### 128. Pin the portable flavour's block reading and writing with tests: callout titles past one line, a link beside other marks in a title, the nesting limit of callouts and task lists, refusals inside tasks and their paths, and empty or non-paragraph tasks.

Mutation testing left about 40 mutants alive in code moved verbatim into `src/markdown/portable/`
on 2026-10-22, so the gaps predate the move: `tryTaskList` and `taskBlocks` in `src/markdown/portable/block-spelling.ts`, and
`markerLine`, `quoteReader`, `titleText`, `taskBlocks` and `readTaskBlock` in
`src/markdown/portable/portable-markdown-to-adf.ts`. Each test takes its expected value from
`spec/flavour.md` or `docs/decisions.md`, never from the code.

### 75. Make the generated-markdown property write block carries as `adf:` fences, canonical and hostile.

`blockCarry` and `hostileBlockCarry` (`src/conformance/markdown-property.test.ts`) write a fence
whose info string is `carry`. Under the `docs/decisions.md` entry "The carry fence names the node
type", that is an ordinary code language, so the property reaches `readCarriedBlock`'s refusals only
where a random edit lands in a canonical document. Write `adf:<type>` and `adf:` fences, canonical
and hostile. Technical principle: for pure logic over many inputs, prefer a property test, so the property must reach the fenced carry's refusals itself. Found by the technical-principles audit, 2026-10-04.

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

### 127. Hold what `entity-references.test.ts`, `json-text.test.ts` and `result.test.ts` check by asserting outcomes, so none reads source text.

Technical principle "Assert the outcome", which bans scanning the source with `ast` or a regex.
Three tests read source text:

- `src/markdown/commonmark/entity-references.test.ts` regex-extracts the `packedReferences` literal
  from `entity-references.ts`, to guard that each of the 2125 packed references parts into one name
  and one value the table decodes. Reformatting the literal fails it with the table unchanged.
- `src/json-text.test.ts` greps every shipped file for `JSON.parse(`, to guard that only
  `parseJsonText` reads JSON text. `JSON.parse (` or `JSON['parse'](` escapes it.
- `src/result.test.ts` regex-parses the `ConvertErrorCode` union out of `result.ts`, and each
  `failure('…'` and `code: '…'` out of every shipped file, to guard that every declared code has a
  production cause and every call site names a declared code. A code held in a variable or passed
  through another helper escapes it.

Item 81 changes `result.test.ts` too. Found by the technical-principles audit of
item 60, 2026-10-22.

### 144. Give every container `docker-runner.sh` and `publish.sh` start a memory limit and an equal swap limit, sized from the largest a gate leg measurably needs.

`in_image`, `with_firefox` and `publish.sh` run `docker run` with neither `--memory` nor
`--memory-swap`, so a runaway leg can starve the machine instead of failing alone. Some tests build
strings near V8's longest, about 512 MB each, so measure each leg's peak before picking the limit:
one too small fails the gate.

### 143. Keep, in `adfToPortableMarkdown`, the link around a note and the target of a link marking a card, so a linked stored image or card writes every target.

`noteLeaves` (`src/markdown/portable/inline-reduction.ts`) drops the node's marks, so a stored
image a link marks writes `_(image not included)_` without the link's target, which Goal 7 counts as
content. `adfToHtml`'s carry element keeps it, `<a href="…"><em>(image)</em></a>`.

`cardLeaves`, in the same file, links a card to its own URL, so a card a link to another target
marks writes a link to the card's URL and drops the mark's target. The carry element keeps both: it
links the card's URL, as its text, to the mark's target (`docs/decisions.md` §The HTML dialect).

Move the choice of where a card's text and a note link into `src/adf/shown-text.ts`, beside
`shownImage`'s for an image, so both writers render one answer.

Leave what an HTML carry element shows unchanged, or ship the change as a breaking HTML change with
a `MIGRATION.md` entry: `htmlToAdf` refuses any other content, so HTML stored by an earlier release
would no longer read (`docs/decisions.md` §The formats are API).

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

### 147. Ship `adfToPlainText`, writing a document's content with no markup, under a README goal for plain text.

Asked on the Atlassian developer community for search indexing, notifications, emails and CSV
exports, where markdown's markers are noise, and with a mention as `@Display Name` rather than an
account id. Add the goal to the README's `## Goals` in the same change. Split into items before
starting. The maintainer, 2026-10-28: ship what exists first, so this waits for 0.4.0.

Once it ships, answer developer-community topic 41858, which asks for ADF as plain text (the
maintainer, 2026-10-28).

### 141. Write `strike` as HTML in `adfToHtml` and read it back in `htmlToAdf`, in place of the carry element.

GFM spells `strike`, and no other HTML item writes it: `adfToHtml` writes only the marks CommonMark
spells. A writer panel picks `<s>` or `<del>`.

### 135. Write media, media groups and captions as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

A writer panel picks the spellings; a plain external image already has one, `<p><img …></p>`.
Atlassian's editor puts `localId`, `width` and `widthType` on every `mediaSingle`, so every
editor-written image rides the carry until this item.

### 136. Write underline, text and background colours, subscript, superscript, alignment and indentation as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

A writer panel picks the spellings.

### 134. Write panels, expands, task lists and decision lists as semantic HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

An expand is `<details><summary>`, as `htmlToAdf` reads it (`docs/decisions.md` §Foreign HTML sorts
three ways). A writer panel picks the rest.

### 46. Publish the bundle size in the README, failing the release pipeline when it drifts.

The HTML items change the size. The quantity is what a consumer downloads and loads: the
tarball `npm pack` produces, its unpacked `dist`, and the built JavaScript minified + gzipped — the
figure the competitors advertise (marklassian's "12kb") and the only apples-to-apples one, since
ours ships tsc's unminified output and no minifier yet (decide here whether to minify for the build
or report the unminified gzip). The figure lands in README §The package beside the "no runtime
dependencies" claim, and in a size column of the comparison table. Measured today,
unminified: tarball 60.4 kB, unpacked 221.5 kB, JS gzipped 45.6 kB.

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
functions write `pending`, `pieces`, `brackets`, `linkOpenersFrom` and `openingSpellableLink` on the `Scan`
they are handed, most of them returning `void`, and `parseInlineContent` reads a flag `scanInline` leaves on it. The same shape recurs in
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

### 82. Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.

Technical principle: tests use random UUID v7 ids; `portable-markdown-to-adf.test.ts` already does.
Found by the technical-principles audit of item 78, 2026-10-05.

### 58. Port `ci.sh`, `publish.sh` and `docker-runner.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes.

### 34. Read emphasis flanking by the whole character beside an astral symbol.

Check whether `delimiterRunToken` (`inline-tokens.ts`), `emittedRuns` and `resolveEmphasis`
(`line-escaping.ts`) read one UTF-16 unit beside an astral symbol. A lone surrogate is neither
punctuation nor symbol, but CommonMark reads `😀` as punctuation. Where they do, read the code
point, with a fixture per direction.

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

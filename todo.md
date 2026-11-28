# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 226`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 225 | 0.4.0 |  | defect | **Return a result from `serializeCanonicalJson` past the output bound, so no library code throws on purpose.** | 3 | 1 | 2 | 4 | 5 | code health by 4 | 6.2 |
| 183 | 0.5.0 |  |  | **Answer developer-community topic 41858 once 0.4.0 is published.** | 1 | 1 | 1 | 1 | 1 | 3 by 2, 6.2 by 2 | 5.8 |
| 197 | 0.5.0 |  |  | **Write a heading holding a node wiki markup cannot spell as `h1.` to `h6.` with that node's inline carry, rather than carrying the whole heading.** | 2 | 1 | 1 | 2 | 3 | 6 by 3, 11 by 2 | 4.4 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | code health by 1 | 3.9 |
| 178 | 0.5.0 |  | owner | **Reach the comprehension floor: move the reasoning behind the emitter's fallback and escape loops into the code that runs them, so each reads on its own.** | 3 | 1 | 2 | 4 | 7 | code health by 8 | 3.7 |
| 223 | 0.5.0 |  | decision | **Read `colspan` and `rowspan` on a cell of foreign HTML as the cell's spans.** | 2 | 1 | 2 | 3 | 2 | 12 by 3 | 3.3 |
| 58 | 0.5.0 |  |  | **Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.** | 4 | 2 | 2 | 6 | 6 | code health by 3 | 2.6 |
| 221 | 0.5.0 |  |  | **Settle by a reader panel how an image of empty `alt` in foreign HTML reads, an email's 1×1 tracking pixel among them, and read it so.** | 2 | 2 | 2 | 4 | 2 | 12 by 2 | 2.2 |
| 187 | 0.5.0 |  |  | **Write a `blockTaskItem` and a nested task list as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 3 | 6 by 2 | 1.8 |
| 222 | 0.5.0 |  | decision | **Place each node foreign HTML reads where Atlassian's schema allows it, as in a table inside a quote read to blocks the quote can hold.** | 2 | 2 | 2 | 4 | 4 | 12 by 3 | 1.6 |
| 224 | 0.5.0 |  |  | **Check `htmlToAdf`'s reading of foreign HTML against a browser's parse of generated HTML in the gate, so an end tag HTML's parser implies is caught before a reviewer has to notice it.** | 3 | 2 | 3 | 6 | 4 | 12 by 3 | 1.6 |
| 9 | 0.5.0 |  |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 3 | 2 | 1 | 4 | 6 | 3 by 6 | 1.3 |
| 34 | 0.5.0 |  |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 1 | 2 | 3 | 3 | 4 by 1 | 0.9 |
| 74 | 0.5.0 |  | owner | **Keep the release path publishing after npm retires bypass-2FA tokens.** | 3 | 2 | 4 | 7 | 4 |  | 0.0 |
| 8 | 0.6.0 |  | owner | **Ship a CLI.** | 3 | 2 | 1 | 4 | 7 |  | 0.0 |
| 139 | 0.7.0 |  | decision | **Ship the calls between markdown and HTML, composed through ADF and each named by its flavour.** | 2 | 1 | 2 | 3 | 4 | 3 by 3 | 1.9 |
| 138 | 0.7.0 |  |  | **Read raw HTML in every markdown reader through `htmlToAdf`'s foreign-element mapping, in place of refusing it as `unmappable-html`.** | 3 | 1 | 3 | 5 | 5 | 4 by 4 | 1.5 |

## Renamed

- 0.2.1 renamed to 0.3.0

## Details

### 225. Return a result from `serializeCanonicalJson` past the output bound, so no library code throws on purpose.

Today §Output past V8's longest string is refused on every engine records that `serializeCanonicalJson` (`src/canonical-json.ts`) throws V8's `Invalid string length` when `joinedWithin` stops at the bound, for `withinEngineLimits` to catch as `tooLong`. The release review's principles pass rated that a 🔴 against AGENTS.md §4 ("failures are values … nothing throws") and technical-principles.md "Handle errors explicitly, as values": every caller silently relies on a `withinEngineLimits` frame above it, and the comparisons that call it can throw from what reads as an equality check. The public calls never throw today.

The maintainer allowed the decision to change, 2026-11-28, taking this design: `serializeCanonicalJson` returns `Result<string>` from `joinedWithin`; the writing callers pass it on as `tooLong`; the comparison callers take a `sameCanonicalJson(a, b)` that compares `canonicalJsonPieces` streams piece by piece and never builds the string; `withinEngineLimits` then catches only real engine throws. The decision entry's sentence on the throw changes to say so.

Touches:
- `src/canonical-json.ts`: `serializeCanonicalJson`
- `src/length-bound.ts`: `withinEngineLimits` (small)
- `src/adf/document.ts`: `marksKey` (small)
- `src/adf/plain-image.ts`
- `src/markdown/directive/block.ts`: `readMarkValues` (small)
- `src/markdown/directive/syntax.ts`: `spellJsonAttribute` (small), `spellAttributeValue` (small)
- `src/html/parse/foreign.ts`: `sameMarks` (small)
- `src/html/parse/html-to-adf.ts`
- `src/html/cell-element.ts`
- `src/html/data-attributes.ts`
- `src/html/emit/adf-to-html.ts`: `adfToHtml` (small)
- `docs/decisions.md`: `## Output past V8's longest string is refused on every engine` (small)

### 183. Answer developer-community topic 41858 once 0.4.0 is published.

Topic 41858 asks for ADF as plain text. `adfToPlainText` now writes tables, images, cards, extensions and expand titles, so the answer names what it writes. Post it only after 0.4.0 publishes (§Posts announcing a release wait for its publish). The post is the maintainer's (the maintainer, 2026-10-28). It sits in 0.5.0 because the post can only go out after 0.4.0 publishes, so no chunk of 0.4.0 can finish it.

### 197. Write a heading holding a node wiki markup cannot spell as `h1.` to `h6.` with that node's inline carry, rather than carrying the whole heading.

Today `adfToLosslessJiraWiki` carries a heading as a block whenever any inline node in it rides, such as a `status`, since `spec/wiki.md` lets an inline carry stand on its own only inside a paragraph. A Jira user then sees no heading where the document has one. Extend the paragraph rule to headings in `spec/wiki.md` → The carry, and in `headingSpelling` in `src/wiki/emit/spelled-blocks.ts`; item 195's reader must then read an inline carry inside a heading line too.

### 82. Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.

Technical principle: tests use random UUID v7 ids; `portable-markdown-to-adf.test.ts` already does.
Found by the technical-principles audit of item 78, 2026-10-05.

### 178. Reach the comprehension floor: move the reasoning behind the emitter's fallback and escape loops into the code that runs them, so each reads on its own.

The scoring runs at 1475160 (PR #246) averaged 6.00 and 5.88 overall, under the 7.0 floor; Self-sufficiency scored lowest, at 5.25 in the second run, then Locality at 5.38. Make these places, the ones the seats named most, easier to read:

- `src/markdown/emit/unspellable-runs.ts:223` `pairStanding` / `pairVerdicts`: all eight seats named it. The case analysis behind the two sweeps lives only in `docs/decisions.md`. State it in the types or the code as a named case table, one reason per row, with one vocabulary for the four standings and three verdicts.
- `src/markdown/emit/inline-line.ts:123` `settledLine`: fallbacks change state out of sight, and the lossless writer and the portable reducer share it through three type parameters. Make each pass's state an explicit value, with the 32-pass bound and its give-up visible where it holds.
- `src/markdown/emit/line-escaping.ts:99` `readBack`: say in the code why three escape passes suffice.
- `src/markdown/emit/adf-to-markdown.ts:142` `spellingMemo`: keep its take, ask and depth rebasing in one type, apart from the four look-alike result types at `:23`.
- `src/markdown/portable/inline-reduction.ts:204` `withoutEdgeWhitespace`: say in the code what happens where it and `trimPass` disagree.
- `src/markdown/inline-content.ts:45` `parseInlineContent`: the inline reader sits loose at the `markdown/` root, beside a second `inline-content.ts` in `parse/`. Give it a directory and a name of its own.

Keep every output byte-identical: the round-trip properties and the CommonMark suite must pass unchanged.

### 223. Read `colspan` and `rowspan` on a cell of foreign HTML as the cell's spans.

`readForeignHtml` (`src/html/parse/foreign.ts`) drops every attribute of a `<td>` and `<th>`, so a
table from an email or a CMS loses its merged cells and its columns shift. Revise
`docs/decisions.md` §Foreign HTML reads best effort and is never refused with it.

### 58. Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes. A wrong line range in
`run.sh` mutates the wrong lines without failing, so the port tests how it reads diff hunks.

### 221. Settle by a reader panel how an image of empty `alt` in foreign HTML reads, an email's 1×1 tracking pixel among them, and read it so.

Today `<img src="https://example.com/open.gif" width="1" height="1" alt="">` beside other text
reads as its URL, linked, and alone in its paragraph as a `mediaSingle`, by §An image reads as an
image only alone in its paragraph. Most marketing email ends in one. `alt=""` marks an image as
decoration in HTML (WHATWG HTML §4.8.4.4.4). The product-owner reviewer of item 137 asked whether
the audience expects that reading (README goal 6).

### 187. Write a `blockTaskItem` and a nested task list as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

The reader panel of §The HTML dialect expected a `blockTaskItem` as an `<li>` of two `<p>` and a nested task list as an inner `<ul>`. The writer panel's spellings left both on the carry, since a task item holds inline content alone. A writer panel settles the two spellings (AGENTS.md §7); the item takes it and writes the HTML both ways.

### 222. Place each node foreign HTML reads where Atlassian's schema allows it, as in a table inside a quote read to blocks the quote can hold.

`readForeignHtml` (`src/html/parse/foreign.ts`) places a node where the HTML places it: a
`<table>` in a `<blockquote>`, a `<pre>` in a table header, an image in a list item. Jira's editor
refuses some of those documents. `spec/html.md` → "Other HTML" states today's reading in its last
paragraph. Which reading each misplaced node takes is a reader panel's pick.

### 224. Check `htmlToAdf`'s reading of foreign HTML against a browser's parse of generated HTML in the gate, so an end tag HTML's parser implies is caught before a reviewer has to notice it.

An outside reviewer found that a `<head>` missing its end tag hid the whole body, and that a hidden
`<p>` missing its end tag hid what followed. No review pass or test raised either: the tests hold
hand-picked inputs, and which end tags HTML's parser implies is a long list nobody reads through.

The gate already starts Firefox to read the build. Generate foreign HTML with fast-check, let the
browser parse it, and compare the text the browser shows with the text of the document `htmlToAdf`
reads. A difference is a finding; where a decision makes the reading differ on purpose, the
generator leaves that input out and names the decision.

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

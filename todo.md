# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 219`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 215 | 0.4.0 |  | question | **Return a result, never an engine abort, from the markdown writers where one line of text, a link `href` included, is 2^26 characters or longer.** | 2 | 2 | 2 | 4 | 3 | 1 by 3 | 9.4 |
| 218 | 0.4.0 |  | defect | **Return a result from `adfToLosslessJiraWiki` and `adfToLossyJiraWiki` where one key of a carried node is a string of 2^28 characters.** | 2 | 1 | 2 | 3 | 2 | 1 by 3 | 15.6 |
| 137 | 0.4.0 |  | decision | **Read foreign HTML in `htmlToAdf` best effort, never refusing it, as `docs/decisions.md` §Foreign HTML reads best effort and is never refused states.** | 2 | 1 | 2 | 3 | 4 | 12 by 6 | 3.3 |
| 183 | 0.5.0 |  |  | **Answer developer-community topic 41858 once 0.4.0 is published.** | 1 | 1 | 1 | 1 | 1 | 3 by 2, 6.2 by 2 | 5.8 |
| 197 | 0.5.0 |  |  | **Write a heading holding a node wiki markup cannot spell as `h1.` to `h6.` with that node's inline carry, rather than carrying the whole heading.** | 2 | 1 | 1 | 2 | 3 | 6 by 3, 11 by 2 | 4.4 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | code health by 1 | 3.9 |
| 178 | 0.5.0 |  | owner | **Reach the comprehension floor: move the reasoning behind the emitter's fallback and escape loops into the code that runs them, so each reads on its own.** | 3 | 1 | 2 | 4 | 7 | code health by 8 | 3.7 |
| 58 | 0.5.0 |  |  | **Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.** | 4 | 2 | 2 | 6 | 6 | code health by 3 | 2.6 |
| 187 | 0.5.0 |  |  | **Write a `blockTaskItem` and a nested task list as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.** | 2 | 2 | 2 | 4 | 3 | 6 by 2 | 1.8 |
| 9 | 0.5.0 |  |  | **Ship an online sandbox: a web page with two textboxes converting between ADF and markdown on the library's browser build.** | 3 | 2 | 1 | 4 | 6 | 3 by 6 | 1.3 |
| 34 | 0.5.0 |  |  | **Read emphasis flanking by the whole character beside an astral symbol.** | 2 | 1 | 2 | 3 | 3 | 4 by 1 | 0.9 |
| 74 | 0.5.0 |  | owner | **Keep the release path publishing after npm retires bypass-2FA tokens.** | 3 | 2 | 4 | 7 | 4 |  | 0.0 |
| 8 | 0.6.0 |  | owner | **Ship a CLI.** | 3 | 2 | 1 | 4 | 7 |  | 0.0 |
| 139 | 0.7.0 |  | decision | **Ship the calls between markdown and HTML, composed through ADF and each named by its flavour.** | 2 | 1 | 2 | 3 | 4 | 3 by 3 | 1.9 |
| 138 | 0.7.0 | 137 |  | **Read raw HTML in every markdown reader through `htmlToAdf`'s foreign-element mapping, in place of refusing it as `unmappable-html`.** | 3 | 1 | 3 | 5 | 5 | 4 by 4 | 1.5 |

## Renamed

- 0.2.1 renamed to 0.3.0

## Details

### 215. Return a result, never an engine abort, from the markdown writers where one line of text, a link `href` included, is 2^26 characters or longer.

Goal 1 promises a result, never a throw, yet `adfToLosslessMarkdown` of one paragraph whose text, or whose link `href`, is 2^26 characters ends Node 26.13.1 (node:26.13.1-alpine3.24, in an 8 GB container) with `FATAL ERROR: Ineffective mark-compacts near heap limit`, which no `try` can catch. At 2^25 characters it writes: plain text in 14 s at a peak RSS of 1.6 GB, an `href` in 7 s at 1.3 GB.

The cost is per line, not per link. The writer reads each line back through the reader (`readBack` in `src/markdown/emit/line-escaping.ts`). `losslessMarkdownToAdf` of one plain line of 2^24 `a` peaks at 1.2 GB, about 70 bytes a character.

Question for the maintainer. The gap: no decision states the longest line the writer reads back. §Output past V8's longest string is refused on every engine states only the longest output, `longestOutput` (2^29 − 24 characters). §Which code a cause takes gives a conversion the engine stops with a throw the code `engine-limit`, but V8 aborts on an exhausted heap without throwing, so no entry covers this case.

Candidate entry for `docs/decisions.md`:

> **The writer refuses a line longer than 2^25 characters before reading it back**
>
> Goal 1. The markdown writers refuse a line longer than 2^25 characters, before reading it back, as `unsupported-node-shape` at the path of the node holding the line. V8 aborts the process, past any `try`, on the heap that reading back a longer line takes: at about 70 bytes a character, a line of 2^26 characters needs about 4.7 GB, past V8's heap limit of about 2 GB. The code is `unsupported-node-shape`, not `engine-limit`: the library refuses a stated bound that no retry passes, and the engine doesn't throw anything (§Which code a cause takes).

The instance it yields: `adfToLosslessMarkdown` of one paragraph of 2^26 `a` returns `unsupported-node-shape` at the paragraph's path, where today it ends Node 26.13.1.

Rejected unless the maintainer picks it: cut the reader's memory per character until a 2^28-character line fits V8's heap limit, a rewrite of the inline scanner that needs a re-score.

The scores assume the candidate. Each test stays within V8's heap limit.

Touches:

- `src/length-bound.ts`: `longestOutput` (small)
- `src/markdown/emit/inline-line.ts`: `emitLine` (small)
- `src/markdown/emit/limits.test.ts`

### 218. Return a result from `adfToLosslessJiraWiki` and `adfToLossyJiraWiki` where one key of a carried node is a string of 2^28 characters.

Goal 1 and the failures-are-values rule (AGENTS.md §4) want a result, yet `adfToLosslessJiraWiki` of `{ type: 'doc', version: 1, content: [{ type: 'unknownBlock', attrs: { ['a'.repeat(2 ** 28)]: 1 } }] }` throws `RangeError: Maximum call stack size exceeded`, measured on node:26.13.1-alpine3.24. The throw comes out of `closingMacroEscaped` (`src/wiki/carry.ts:25`), from its `json.replace(/"(?:[^"\\]|\\.)*"/g, …)`, reached through `blockCarry` and `writeWiki`. `withinEngineLimits` lets it through, since it treats a stack overflow as a bug.

Whether `adfToLossyJiraWiki` throws too is unmeasured. The item's first step is to measure it.

Touches:

- `src/wiki/carry.ts`: `closingMacroEscaped`
- `src/wiki/emit/adf-to-jira-wiki.test.ts`

### 137. Read foreign HTML in `htmlToAdf` best effort, never refusing it, as `docs/decisions.md` §Foreign HTML reads best effort and is never refused states.

Reading HTML from emails, CMSs and editors is the most asked need on the Atlassian developer
community. A developer panel picked `htmlToAdf` itself, with no option, as `docs/decisions.md`
records. The maintainer moved it from 0.4.0 to 0.5.0 on 2026-11-25.

The maintainer moved it back into 0.4.0 on 2026-11-26, since the unmerged branch `item-137` already holds most of the work: a foreign HTML reader in `src/html/parse/foreign.ts`, its tests, and the spec, README, migration and decision text, reviewed through the security, product-owner and prose passes. The item keeps that branch's work, merges `main` into it and ships it. That settles the feasibility question this item raised.

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

### 58. Port `ci.sh`, `publish.sh`, `docker-runner.sh` and `mutation-tests/run.sh` to standalone Python scripts.

Technical principle "Prefer a standalone Python script over a shell script": `AGENTS.md` §3 teaches
bash footguns (`&&` chaining under `||`, `tee /dev/stderr`) the port removes. A wrong line range in
`run.sh` mutates the wrong lines without failing, so the port tests how it reads diff hunks.

### 187. Write a `blockTaskItem` and a nested task list as HTML in `adfToHtml` and read them back in `htmlToAdf`, in place of the carry element.

The reader panel of §The HTML dialect expected a `blockTaskItem` as an `<li>` of two `<p>` and a nested task list as an inner `<ul>`. The writer panel's spellings left both on the carry, since a task item holds inline content alone. A writer panel settles the two spellings (AGENTS.md §7); the item takes it and writes the HTML both ways.

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

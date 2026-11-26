# todo

## Scoring

`Score = 100 * V / (2**S + 8)`

`Bar = 0.1`

`Next ID = 212`

## Items

| ID | Release | Blocked by | Exempt | Item | L | E | I | R | S | Moves | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 201 | 0.4.0 |  | question | **Confirm or change the readings `jiraWikiToAdf` takes that differ from Jira's.** | 2 | 2 | 2 | 4 | 2 | 11 by 3, 6 by 2 | 5.7 |
| 107 | 0.4.0 |  | question | **Spell the block carry's JSON so its length stays linear in the node's JSON.** | 3 | 1 | 3 | 5 | 5 |  | 0.0 |
| 211 | 0.4.0 |  |  | **Spell a hard break the lossless wiki writer writes so Jira reads it as a break, where text or a spelling starting with `{` or an escaped character follows.** | 2 | 2 | 2 | 4 | 3 | 11 by 4, 6 by 2 | 5.1 |
| 183 | 0.5.0 |  |  | **Answer developer-community topic 41858 once 0.4.0 is published.** | 1 | 1 | 1 | 1 | 1 | 3 by 2, 6.2 by 2 | 5.8 |
| 197 | 0.5.0 |  |  | **Write a heading holding a node wiki markup cannot spell as `h1.` to `h6.` with that node's inline carry, rather than carrying the whole heading.** | 2 | 1 | 1 | 2 | 3 | 6 by 3, 11 by 2 | 4.4 |
| 82 | 0.5.0 |  |  | **Give the directive tests and fixtures random UUID v7 ids in place of `a-1`, `a`, `x` and `h`.** | 2 | 1 | 1 | 2 | 3 | code health by 1 | 3.9 |
| 178 | 0.5.0 |  | owner | **Reach the comprehension floor: move the reasoning behind the emitter's fallback and escape loops into the code that runs them, so each reads on its own.** | 3 | 1 | 2 | 4 | 7 | code health by 8 | 3.7 |
| 137 | 0.5.0 |  | decision | **Read foreign HTML in `htmlToAdf` best effort, never refusing it, as `docs/decisions.md` §Foreign HTML reads best effort and is never refused states.** | 2 | 1 | 2 | 3 | 4 | 12 by 6 | 3.3 |
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
- `docs/decisions.md`: `` ## The wiki reader refuses only a broken `{adf}` macro, nesting past 500 levels and output past the engine's limits, and reads every other string ``

### 107. Spell the block carry's JSON so its length stays linear in the node's JSON.

The block carry indents two spaces a level, so about 1 MB of deeply nested arrays in a carried
node's JSON spells past V8's longest string, which the writers refuse as `unsupported-node-shape`;
the inline carry's compact JSON would fit. docs/decisions.md §The code list calls a refusal no
spelling recovers from a gap in the flavour. Respelling the carry changes the format (§The formats
are API). Found by the README-goals audit of item 83, 2026-10-11.

Open question for the maintainer, 2026-11-17: how many levels the block carry indents before it
spells a value compact on its line. No decision states the number. A writer panel of seven (product
managers, engineers, support agents) saw one chart carried five ways: compact on one line; the top
level indented; three levels indented, deeper values compact; five levels indented, deeper values
compact; one value per line unindented. All seven ranked the three-level and five-level spellings
first and second. Four picked five levels and three picked three, short of five of seven. All seven
expected indentation all the way down, which goal 9 rules out. Of the corpus's 18 carry fences, five
levels respells none and three levels respells 3; either cap needs a `MIGRATION.md` entry for stored
carries nested deeper. Recommended: five levels. The answer lands as a `docs/decisions.md` entry, and
the panel is not run again.

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

### 211. Spell a hard break the lossless wiki writer writes so Jira reads it as a break, where text or a spelling starting with `{` or an escaped character follows.

Probed on the live test site on 2026-11-26 while answering item 194's review: Jira reads `\\` as a line break only where the next character isn't `{`, and shows `a\\\_a` (what the lossless writer writes for a text, a hard break and the text `_a`) as `a`, three backslashes and `_a`, with no break. The same holds for `a\\{color:red}…`, `a\\{anchor:x}…`, `a\\{{…}}` and a text `{` written `\{`. `\\{noformat}{noformat}` before a letter does read as a break. The lossless writer writes each of these right after a hard break, so Jira shows the break as backslashes, and `jiraWikiToAdf` reads the spelling back as a break, unlike Jira (see item 201). Find a spelling of the break or of what follows it that Jira reads, record it in `spec/wiki.md` and `docs/decisions.md`, and where none exists, carry the pair. Item 194's lossy writer shares the gap for a text that starts with a backslash run it writes between `{noformat}` right after a hard break (`docs/decisions.md`'s "Not handled").

Touches:
- `src/wiki/emit/inline-line.ts`: `leafSpelling`, `inlineLine`
- `spec/wiki.md`: `## Inline`
- `src/wiki/emit/adf-to-jira-wiki.test.ts`

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

### 137. Read foreign HTML in `htmlToAdf` best effort, never refusing it, as `docs/decisions.md` §Foreign HTML reads best effort and is never refused states.

Reading HTML from emails, CMSs and editors is the most asked need on the Atlassian developer
community. A developer panel picked `htmlToAdf` itself, with no option, as `docs/decisions.md`
records. The maintainer moved it from 0.4.0 to 0.5.0 on 2026-11-25.

Before building further, evaluate whether the item is feasible at all or should be abandoned, and
ask the maintainer to decide. The unmerged branch `item-137` holds an attempt to judge by. Abandoning it
also calls for decisions on item 138, which it blocks, README goal 12 and the two decisions that cite it.

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

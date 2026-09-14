# Working in this repo

Decisions a reader would otherwise relitigate, and the rules for every collaborator, human or
agent. Using the library: `README.md`. What is still to build: `todo.md`.

## 1. Three formats, ADF is the hub

ADF, one markdown flavour, one HTML dialect. Six directions exposed, but markdown↔HTML compose
through ADF: four conversions exist to keep correct — never write a fifth. No fourth format, ever;
each one doubles the directions.

## 2. The round-trip is the product

`markdownToAdf(adfToMarkdown(doc))` and `htmlToAdf(adfToHtml(doc))` must equal `doc` — anything
less silently destroys content an editor could not represent, in a document it did not author.
When losslessness and readability conflict, losslessness wins.

The other direction is a canonical fixpoint, not byte-identity: human markdown normalizes, the way
back yields the library's canonical spelling, and that spelling round-trips byte-identically —
where there is a way back. CommonMark spells some things the flavour has no escape for — a link
destination or title holding a backslash or newline, a paragraph opening with a code span whose
backticks read back as a fence — so a parse succeeding does not imply a spellable document;
`corpus/commonmark-spec/exceptions.json` names those.

"Equals" is structural equality over editor-normal ADF — adjacent text nodes with identical marks
and no attributes merged, JSON number semantics, an empty attrs object, marks array or content
array the absent key — the only domain markdown can restore.

Round-trip equality is a property tested over a corpus, not a claim made in prose.

## 3. Unknown input policy

- Unknown ADF node: carried opaquely — raw JSON rides a dedicated syntax in both formats and
  restores to a deep-equal node. The round-trip holds for documents newer than the library. So
  does a known node no section spells where it stands: a markdown serializer spells a node by type
  without checking its position, and refusing loses a document ADF itself keeps in an
  `unsupportedBlock`. Where a container's own spelling cannot hold the child it has — a
  `bulletList` outside `listItem`, a `codeBlock` outside text — the error result names that
  instead.
- Unmappable foreign HTML element: error result naming the element — never a silent drop.
- Bare `@name` / `:smile:` in typed text: stays a text node. Only directives produce
  mention/emoji/media nodes; resolving names to ids needs I/O, which is the consumer's job.

## 4. The flavour

- Directives, one grammar for everything markdown lacks: `:::panel info` … `:::` blocks,
  `:mention[@Mikael]{id=5b10a2}` inline. Prior art: CommonMark's generic-directives proposal.
- Plain CommonMark is a subset, with carve-outs (`spec/flavour.md`): literal text shaped like a
  directive, a pipe table or a `~~` pair is claimed — plus one image gap.
- Tables: one header row plus plain inline cells → pipe table; anything richer → directive form.
- Identity-bearing nodes carry their ids in attributes; a document is only portable within its
  site — accepted.
- The HTML dialect mirrors this: semantic elements, stable `adf-*` classes, `data-*` for what HTML
  cannot express, text always escaped. No stylesheet ships.

## 5. Dependencies

`dependencies` is empty. A runtime dependency enters only through a decision entry here stating
why ~20 lines of own code cannot do the job, who maintains it, and what auditing it costs. So the
CommonMark and HTML parsers are written in this repo. A table a standard fixes is data rather than
a dependency: HTML5's 2125 semicolon-terminated character references ship packed in their own
module, so entity decoding is complete without one. The CommonMark spec suite is the same shape of
data and ships vendored at `corpus/commonmark-spec/` rather than as the `commonmark-spec` dev
dependency — that package is CommonJS-only, and Renovate auto-bumping a spec version would silently
point the vendored exception list's example numbers at a renumbered suite. A spec bump is a
deliberate re-pin, exceptions re-derived by hand beside it. Atlassian's ADF JSON Schemas ship
vendored the same way, at `spec/adf-schema/`, rather than as the `@atlaskit/adf-schema` dev
dependency — CommonJS-only, some fifty packages with React among them, and a release most days for
Renovate to automerge — re-pinned by hand when a payload or a report shows the need.
`devDependencies`: few, each earning its keep; they never reach a consumer.

## 6. The package contract

- Runs on any ES2022 engine, not only Node — a browser as readily as a server. The shipped source
  is ECMAScript and nothing else: no host import, no host global, no DOM. `tsconfig.build.json` is
  that gate, typechecking and emitting the shipped files alone, so `node:fs`, `process` and an
  ES2024 method are compile errors here rather than a consumer's crash there. The standard is the line, never an
  engine list: one implementing it in part — Hermes is the live doubt, on §10's property escapes
  and on lookbehind — is out of scope rather than a bug. Node's test runner, the corpus reads and
  the build are the repo's own,
  never the library's, and `engines.node` states the floor the shipped JavaScript needs — `>=18` —
  never the higher one those repo-only tools want.
- ESM only — no CommonJS build, no dual-package hazard.
- One entrypoint: built JavaScript, `.d.ts` beside it. Do not add a TypeScript-source entrypoint —
  Node refuses to type-strip under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`),
  so it cannot serve an npm consumer.
- Published to public npmjs as `@larvit/adf-codec`. Public source: the Gitea repo
  goes public, LICENSE in place, before the first publish.
- Exact versions: `save-exact=true` in `.npmrc`.

## 7. Nothing about any consumer

No Jira client, no HTTP, no REST shapes, no issue keys, no actual consumer named anywhere. Design
against the README's personas.

## 8. Semver: the formats are API

The emitted markdown and HTML are contracts. After 1.0: previously-emitted output parsing
differently, or not at all, is MAJOR; new syntax while old output still round-trips is MINOR.
Pre-1.0, normal 0.x rules.

The error surface is a contract too. `ConvertError` is `{ code, message, path, position? }` — the
code from a closed list a consumer may switch exhaustively, the message free text, the path the
node's place from the document root, the position where a parse read the refusal in its input.
A message names the violation, not the rule alone — a rule by itself states a truth the reader
must invert before it reads as a failure — and where the flavour's claim refuses ordinary prose it
names the escape that unclaims the form claimed: `\:::` for a directive line, `\|` for every pipe
row, `\:` for an inline directive.
Adding, removing or renaming a code is breaking, so a milestone meeting a new failure cause
reuses a code where one fits; the list is complete at `0.1.0`. A code names the
cause; where one cause recurs across node types, across one mark's attributes or across
directions, one code covers them all and
`path` and `message` say which — `unsupported-nesting-depth` is the 500-level guard whichever
direction hits it, `unspellable-link` the destination and the title alike. Where two codes stay
apart, the line between them is what they name: `unspellable-character` is a character CommonMark
rewrites wherever text holds it, `unspellable-whitespace` the newline no inline directive's
content slot spans, in either direction. A claim code names the spelling claimed, never the node that spelling would have built:
a malformed `:::table` is a `malformed-directive`, and an alignment colon a `malformed-pipe-table` —
the flavour's own delimiter row is `-` runs, so the grammar refuses the colon rather than ADF's
missing column model doing it. A refusal no spelling recovers from is a gap in the flavour rather
than a code: give the flavour the spelling and the code goes, which the freeze is the last moment
for. A cause the carry answers gets no code: a mark no
spelling writes rides the carry with its node. A directive whose name reads back to no node is
`unknown-directive-name` rather than a claim code — the spelling is well formed, and telling that
apart from a typo is what a consumer switches on when a later MINOR gives the name meaning. A
reserved name is a known name, so never that code, and the two the flavour reserves part on form:
a form the grammar does not have is a claim code — `::adf`, whose carry is the fence — and a
well-formed form in the wrong place is `unsupported-node-shape`, `::listBreak` parting anything
but two adjacent lists of one type. What
the grammar itself refuses stays a claim code, key order among it; a well-formed directive the
node tables refuse — an attribute a node does not hold or spells elsewhere, a value outside its
kind or its canonical spelling, an argument or a body its content model does not take — is
`unsupported-node-shape`, the emitter's code for the same mismatch read the other way — one code
across both directions for good, since the call site knows which direction it called and parting
them after `0.1.0` is MAJOR. `unmappable-html` names the version rather than the element: this one
converts no raw HTML, so at `0.3.0` the mapped elements stop erroring and the code stays for what
no ADF node carries. A refusal found before its path is known — the block walk's, a directive
reader's — is a `ConvertFault`, the code and message alone; the node walk attaches the path as it
descends, so a document reports its first error in document order. `not-an-adf-document` carries
the document's own path throughout: eight of the guard's nine branches read the document's own
shape, and threading a path to the ninth — a malformed node anywhere in the tree — wants the
manual stack §11's no-recursion rule forces, whose empty half no input reaches. The message names
the violation instead. Depth is not one of the nine: `adfDocumentFault` returns the code with the
message, so an attribute value past 500 levels is `unsupported-nesting-depth` from the emitter as
it already is from the parser, both directions refusing the same value. A node's attribute is
counted from the value itself, never from the `attrs` object holding it; a mark's is counted three
levels in, because the block directive spells the whole mark set as one JSON attribute and the
parser reads the value at the bottom of array, mark and `attrs`. `isAdfDocument` is true for a depth fault:
a deep document is a document, as the 2000-level blocks and the 600-deep marks the guard already
waves through are, and depth is the walks' answer rather than the shape's. A non-finite number
stays parted where depth is joined: the parse says `unsupported-node-shape` because the markdown is
at fault, the emit `not-an-adf-document` because the input is, and unlike depth nothing round-trips
inconsistently between them.

`position` is the parse side's alone: an emitter reads no source, so an emit error carries `path`
and nothing more. It is `{ line, offset }` at the start of the line the block holding the refusal
begins on — the offset indexing the string the caller passed, the line counted from 1 — minted by
the block walk and attached as results return, so the innermost block wins, the emitter's own
refusals the parser re-enters for the CommonMark spelling included.

A parse names a position for every refusal it returns, so the type says so rather than the prose:
`Result<T, E extends ConvertError = ConvertError>`, and a direction reading a source returns
`Result<T, ParseError>` — `ConvertError` with `position` required. An optional field a direction
always fills is a branch a consumer cannot take, and the `!` §11 bans is how they take it anyway.
`htmlToAdf` inherits this at `0.3.0`; the composed `markdownToHtml` and `htmlToMarkdown` keep the
wide `Result<T>`, since half their refusals come from an emit stage that read no source.

## 9. Release automation

- `package.json` version on `main` is the source of truth. CI on `main`: tests green and version
  differs from npm → publish and tag `vX.Y.Z`. No bump, no deploy; the bump is each shipping PR's
  deliberate semver judgment. `publish.sh` is that job, and `private: true` stops it before it
  reads the token, so the pipeline is live and silent until the maintainer's first bump drops the
  field.
- The publish and the tag each observe their own end state — the version on npm, the tag on the
  remote — and neither gates the other, so a run that dies between them converges on the next push
  to `main` rather than leaving npm ahead of the tags. An unanswered registry reads the same as an
  unpublished version, which npm's own duplicate rejection is what catches. The job rebuilds rather
  than taking the gate's `dist`: the lockfile is committed, the image is patch-pinned and `tsc` is
  deterministic, so the two builds agree, and promoting an artifact would make the release path
  depend on a store that the gate would then have to keep.
- Renovate watches devDependencies, Docker pins and action tags; automerges everything on green CI.
- Docker images pin the full patch version (`node:24.19.0-alpine3.24`, never `node:24`), as
  specific as the publisher tags: `oven/bun:1.4.0-alpine` pins Bun's patch and leaves the base
  floating because Bun publishes nothing narrower. Actions pin semver tags.

## 10. Tests first, in Docker

Test for the behaviour wanted first, then implement until green. `node --test`, beside the code.
Node, tsc and npm never run on the host — only via the pinned images (§9). Tests are independent,
coverage does not decline, containers are torn down after a run.

The gate runs that same suite under Deno and Bun as well as Node, the three images pinned alike,
and neither extra leg is Node's proof twice. Deno refuses an extensionless or directory specifier,
so it holds the module graph to the fully-spelled form a browser can load; Bun runs
JavaScriptCore, the one engine of the three that is not V8, where the Unicode property escapes
emphasis matching leans on can disagree. Both refuse a run matching no test, so Node's is the only
vacuous-green guard, and a test may reach only for what all three `node:` shims carry — the price
of proving those engines over the corpus rather than over a smoke import.

The gate then packs the build and installs the tarball under `package-tests/`, so `files`,
`exports` and `types` are proved on the artifact that ships rather than on the source tree a
self-reference would resolve against. `consumer.ts` typechecks the emitted `.d.ts` from outside
`tsconfig.build.json` — declaration emit leaves the `.ts` specifiers
`rewriteRelativeImportExtensions` rewrites in the JavaScript, and this is what says a consumer's
resolver maps them, under `NodeNext` alone; a `.d.ts` reader that is not `tsc` stays unproven.
`node-floor.js` round-trips the installed package under a Node pinned to `engines.node`'s floor.

A fourth engine reads the build rather than the source: a headless Firefox loads `dist/index.js`
over HTTP and converts the round-trip, normalization and error fixtures — the `commonmark-spec`
sort is the Node suite's to check — which is §6's browser half and the only SpiderMonkey
there is — the gate's other three engines are two V8s and a JavaScriptCore that is not Safari's.
A WebDriver session is what carries a verdict back out, the driver and the page's server sharing
one network namespace so each is the other's `127.0.0.1`; `--headless --screenshot` has no such
channel, and loading `dist/index.js` in a globals-stripped realm buys one by not running a browser.
The leg re-checks the conversions and nothing else — each fixture's emitted markdown, its parsed
document, its error code — leaving the corpus's pairing, uniqueness, source positions and
byte-level equality to the Node suite that owns them.

The floors live in the `test` script, so `npm test` and the gate are one path: 100% of lines and
functions, and a branch floor that only ever moves upward. It sits below 100 because the guards
`noUncheckedIndexedAccess` and ADF's optional keys force — `?? []`, `?? {}`, `?.`, an index
compared against `undefined` — have a half no valid document reaches.

The corpus, all checked in: hand-built fixtures per node and combination; real sanitized ADF from
live Atlassian APIs; the CommonMark spec suite against `markdownToAdf` and `markdownToHtml`.

`spec/flavour.md` is read as a source too, so the node tables cannot drift from the prose they
copy: each `- ` bullet in `## Block nodes`, `## Inline nodes` and `## Marks` declares the nodes
named before its first em dash, with the attributes following `Attributes: ` — a parenthesized
value set reading `string` — and must equal the tables in `adf/`. Keep prose in those sections out
of a bullet; fenced examples are skipped. It guards the attributes alone: nodes that differ in
content model share a bullet, and the argument attribute is spelled ahead of `Attributes: `, so
both answer to the round-trip corpus and to nothing else where a node has no fixture.

The tables answer to Atlassian's schema too (§5): for every node and mark they spell, the attribute
names and kinds equal what `full.json` and `stage-0.json` hold between them. Value sets stay
documentation, since any value round-trips. What the schema holds and the tables do not spell is
pinned by name — an attribute as a gap, a type as carried — so a re-pin adding either goes red until
someone spells it or pins it.

## 11. Code rules

- Two-space indent, strict TypeScript, English everywhere. Alphabetical order wherever order
  carries no meaning.
- Failures are values: everything returns
  `Result<T>` — `{ ok: true; value } | { ok: false; error: ConvertError }` — nothing throws.
  `try/catch` only wrapped tightly around a call that genuinely throws, converted to a result on
  the spot. A reader with no path to name returns `Read<T>` instead, the same two arms over a
  `ConvertFault`, and `faulted` attaches the path where the walk knows it.
- Only the hard break's inline segment holds a raw newline — every other spelling escapes one or
  refuses it — which is how the whitespace carry finds a line edge.
- Emphasis is spelled against CommonMark's matching, never flanking alone: a delimiter run in text
  escapes wherever CommonMark could open or close with it, leaving the emitter's own delimiters the
  only ones in play, and a pair that matching hands to another delimiter rides the carry instead.
  `matchEmphasis` transcribes the reference `process_emphasis` line for line, and its closer walk and
  opener search stay whole: broken into named steps they drift from the algorithm being faithful is
  the whole point of.
- A readable spelling tried ahead of a general one — a CommonMark block, the image, the pipe
  table, a pipe cell — gives way with `undefined` for every shape it cannot spell, and fails only
  where the general form fails on the same node. Refusing there refuses a document the general
  form spells, so a refusal the general form does not share belongs in the general form or
  nowhere — save the nested list a tight spelling would swallow, whose refusal the
  tight-versus-blank answer owns (`todo.md` 2b).
- Nothing recurses unbounded: the guards walk iteratively, and blocks, marks and JSON values — an
  attribute's and a carried node's alike — are all held to 500 levels, so a deep document is a
  `Result` rather than the stack overflow that waits near 2000.
- A reader takes the text and an index — a sticky regex whose `lastIndex` the caller sets on the
  line before it reads, `indexOf` — never a fresh slice per character, and a per-character walk
  hoists the scan that does not vary with the character. The pipeline persona feeds documents
  nobody typed, and a megabyte through a quadratic walk is a minute rather than a millisecond.
- No casts: `as`, `as unknown as`, non-null `!`. A boundary owes a type guard validating the
  fields it claims (`isAdfDocument`); past it everything is typed. Make invalid states
  unrepresentable.
- `src/adf/` holds ADF's own knowledge and imports no format. Each format directory (`markdown/`,
  `html/`) parts into `emit/` (ADF→format) and `parse/` (format→ADF), its root holding what both
  directions read. A construct's reader lives in that root beside the regex the emitter escapes
  against, so the two cannot drift; a reader with no emit counterpart goes in `parse/`, unless it is
  part of a construct the root already holds — a grammar stays in one file rather than splitting
  across the seam. A rule both
  directions must answer alike — whether a list marker interrupts a paragraph — is one function
  there too, never a copy per direction, however conservative the copy would be. Where the rule is
  the emitter's own choice, input consults it rather than restating it: the parser asks
  `commonMarkSpelling` which form the emitter picks, so no fixture the emitter writes can be
  refused, and a spelling the emitter refuses gives its own error rather than a second name for it.
- The attribute vocabulary is ADF's: `adf/` walks it and narrows each value to its kind, and a
  format spells the narrowed value. A spelling that re-checks the type is the check's second copy.
  Reading a spelling back is the format's own: the reader sits beside the spelling it inverts, so
  decode-respell-compare cannot drift, and each format writes its own — canonical JSON for a
  number is the markdown flavour's choice, not ADF's.
- Explicit over implicit; descriptive names; no catch-all files (`utils`, `helpers`, `misc`); a
  file does not repeat its directory in its name — `adf/document.ts`, never
  `adf/adf-document.ts`.
- Reuse before adding; the smallest sufficient diff is the benchmark; no speculative generality —
  a second consumer, or it goes.

## 12. Prose to a minimum

Applies everywhere: comments, every markdown file in this repo (this one included), PR text.

- Default is no comment. One earns its single line only by naming an invariant, footgun or
  external constraint the code cannot show — never restatement, history, absence or arrangement.
  A second line belongs in the commit message or a decision entry here.
- Every prose comment in a diff is a review question; the default answer is delete.
- A doc paragraph says what the repo cannot say for itself, or it goes. The fix for a redundant
  one is deletion, not trimming. A false claim in any doc is a bug, fixed where found.
- Published text — npm README, error messages, API docs — never references internal systems,
  tickets or repos.

## 13. Commits and PRs

One-line commit messages and PR titles; short PR summaries. No AI-attribution markers, ever.

## 14. Non-goals

No wiki markup (§1), no network or filesystem I/O, no name→id resolution (§3), no ADF schema
validation or exported validator — a refusal that keeps the round-trip is not schema validation,
so the one a spelled node carrying the same mark type twice earns stays, and input nesting a
spelling inside its own kind (`*(*a*)*`) names that mark once, no shipped CSS (§4), no
streaming APIs, no performance budget past §11's scanning rule — nothing here is tuned, and no
figure is promised. A CLI is a later goal (`todo.md`), not a non-goal.

## 15. The working loop

One unchecked `todo.md` item per session, in the smallest PR-able chunk — split a big milestone
into sub-items in `todo.md` before starting it. A chunk running a little over or under that is not
worth deliberating; what matters is that nothing is left undone in the end. Per chunk:

1. Fresh worktree off updated `origin/main`; implement tests-first (§10).
2. Run the larv-review flow until it passes and CI is green. A reviewer launch states the latest
   gate result (commit and outcome); a reviewer does not re-run `ci.sh` or the tests when a
   result exists for the commit under review, or when the diff since that result cannot affect
   it (docs-only) — re-run only what its own findings or fixes invalidate.
3. Merge the PR (standing authorization, this repo only, granted through the `0.2.0` release —
   the maintainer, 2026-09-13), check the box in `todo.md` and move the item's text to
   `todo-history.md`, leaving its title behind, report, stop. The next chunk gets a fresh session.

Ask, don't guess: any choice where what the maintainer would pick is not near-certain gets asked,
and the answer lands as a decision in this file. The confidence bar is very high — asking too
often is the accepted cost, guessing wrong is not.

Reserved for the maintainer, never the agent: changing `version` in `package.json` (a bump on
`main` publishes, §9 — every release is the maintainer's) and the `NPM_TOKEN` secret.

A continuous loop session (`/loop`) counts as a chain of sessions: one chunk per iteration, each
iteration starting by re-reading `AGENTS.md` and `todo.md` and trusting them over anything
remembered from earlier iterations. The loop session is a thin driver: each chunk's work runs in
a fresh-context subagent holding this file as its charter, and the driver only relays maintainer
questions, runs the review flow, merges, and cleans up. The loop stops when only
maintainer-reserved acts remain.

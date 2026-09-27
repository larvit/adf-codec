# Working in this repo

The rules for every collaborator, human or agent, and an index of the decisions a reader would
otherwise relitigate. Using the library: `README.md`. What is still to build: `todo.md`; a bare
`(28)` cites that item's entry in `todo-history.md`.

## Decisions

In `docs/decisions.md`:

- Plain markdown is a flavour of the grammar
- The round-trip is the product
- Markdown in is a canonical fixpoint
- Equality is editor-normal
- Unknown nodes ride the carry
- Foreign HTML is refused by name
- Names stay text
- Directives under `!adf:`
- CommonMark is a subset
- Tables
- Links
- Ids stay site-local
- The HTML dialect
- No runtime dependencies
- Standards ship as data
- fast-check
- Any ES2022 engine
- ESM only
- One built entrypoint
- Public on npm

## 7. Nothing about any consumer

No Jira client, no HTTP, no REST shapes, no issue keys, no actual consumer named anywhere. Design
against the README's personas.

## 8. Semver: the formats are API

The emitted markdown and HTML are contracts. After 1.0: previously-emitted output parsing
differently, or not at all, is MAJOR; new syntax while old output still round-trips is MINOR.
Pre-1.0, normal 0.x rules. A spelled node's content model is part of that contract — leaf or
container is the model, not the syntax — so giving a spelled node's model content it had not, or
taking it away, is MAJOR whatever ADF's own schema does.

The error surface is a contract too; `README.md` §The errors states it to the consumer, and the
types in `src/result.ts` hold its shape.

### The code list

- Adding, removing or renaming a code is breaking, so a new cause takes an existing code whose
  name reads true of it in both directions; where none does and a plain name exists, a new code —
  in any 0.x minor, and after 1.0 only in a MAJOR (the maintainer, 2026-09-18).
- A refusal whose cause is this library's own invariant rather than the input takes the existing
  code nearest what the consumer sees — a document that does not convert is
  `unsupported-node-shape` — since a code no input reaches is one no consumer can switch on (the
  maintainer, 2026-09-20).
- A refusal no spelling recovers from is a gap in the flavour rather than a code: give the flavour
  the spelling and the code goes, which the freeze is the last moment for (`unspellable-link`, the
  maintainer, 2026-09-13). A cause the carry answers gets no code: a mark no spelling writes rides
  the carry with its node.

### Which code a cause takes

- A code names the cause; where one cause recurs across node types, across one mark's attributes
  or across directions, one code covers them all and `path` and `message` say which —
  `unsupported-nesting-depth` is the 500-level guard whichever direction hits it,
  `unspellable-character` the text node and the code block alike. Where two codes stay apart, the
  line between them is what they name: `unspellable-character` is a character CommonMark rewrites
  wherever text holds it, `unspellable-whitespace` the newline no inline directive's content slot
  spans, in either direction.
- A claim code names the spelling claimed, never the node that spelling would have built: a
  malformed `!adf:table` is a `malformed-directive`, and an alignment colon a
  `malformed-pipe-table` — the flavour's own delimiter row is `-` runs, so the grammar refuses the
  colon rather than ADF's missing column model doing it. What the grammar itself refuses stays a
  claim code, key order among it, and a leaf given a body is refused at its opener, as a container
  missing its closer is (the maintainer, 2026-09-16).
- A directive whose name reads back to no node is `unknown-directive-name` rather than a claim
  code — the spelling is well formed, and telling that apart from a typo is what a consumer
  switches on when a later MINOR gives the name meaning. A reserved name is a known name, so never
  that code, and the two the flavour reserves part on form: a form the grammar does not have is a
  claim code — `!adf:carry`, whose carry is the fence — and a well-formed form in the wrong place
  is `unsupported-node-shape`, `!adf:listBreak` parting anything but two adjacent lists of one
  type.
- A well-formed directive the node tables refuse — an attribute a node does not hold or spells
  elsewhere, a value outside its kind or its canonical spelling, an argument, or a body of a shape
  its content model does not take — is `unsupported-node-shape`, the emitter's code for the same
  mismatch read the other way: one code across both directions for good, since the call site
  knows which direction it called and parting them after `0.1.0` is MAJOR.
- A non-finite number takes two codes: `unsupported-node-shape` parsing, `not-an-adf-document`
  emitting — no document holds one, so no round-trip crosses them.

### `message` and `path`

- A message names the violation, not the rule alone — a rule by itself states a truth the reader
  must invert before it reads as a failure — and where the flavour's claim refuses ordinary prose
  it names the escape that unclaims the form claimed: `\!adf:` for a directive, block line and
  inline alike, `\|` for every pipe row.
- `not-an-adf-document` carries the document's own path throughout: seven of the guard's eight
  branches read the document's own shape, and threading a path to the eighth — a malformed node
  anywhere in the tree — wants the manual stack §11's no-recursion rule forces, whose empty half
  no input reaches. The message names the violation instead.

## 9. Release automation

- `package.json` version on `main` is the source of truth. CI on `main`: tests green and version
  differs from npm → publish and tag `vX.Y.Z`. No bump, no deploy; the bump is each shipping PR's
  deliberate semver judgment. `publish.sh` is that job, and `private: true` stops it before it
  reads the token, so the pipeline is live and silent until the maintainer's first bump drops the
  field.
- The bump commit renames `CHANGELOG.md`'s `## Unreleased` to the version.
- Docs on `main` describe the release being built rather than the version npm holds, so they match
  it the moment the bump publishes; add no interim note marking the gap (the maintainer,
  2026-09-16).
- The publish and the tag each observe their own end state — the version on npm, the tag on the
  remote — and neither gates the other, so a run that dies between them converges on the next push
  to `main` rather than leaving npm ahead of the tags. An unanswered registry reads the same as an
  unpublished version, which npm's own duplicate rejection is what catches. The job rebuilds rather
  than taking the gate's `dist`: the lockfile is committed, the image is patch-pinned and `tsc` is
  deterministic, so the two builds agree, and promoting an artifact would make the release path
  depend on a store that the gate would then have to keep.
- Exact versions: `save-exact=true` in `.npmrc`.
- Renovate watches devDependencies, Docker pins and action tags; automerges everything on green CI.
- Docker images pin the full patch version (`node:24.19.0-alpine3.24`, never `node:24`), as
  specific as the publisher tags: `oven/bun:1.4.0-alpine` pins Bun's patch and leaves the base
  floating because Bun publishes nothing narrower. Actions pin semver tags.

## 10. Tests first, in Docker

Test for the behaviour wanted first, then implement until green. `node --test`, beside the code.
Node, tsc and npm never run on the host — only via the pinned images (§9). Tests are independent,
containers are torn down after a run.

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
over HTTP and converts the round-trip, normalization and error fixtures and the real payloads — the
`commonmark-spec` sort is the Node suite's to check — which is the browser half of
`docs/decisions.md` §Any ES2022 engine and the only SpiderMonkey there is — the gate's other three
engines are two V8s and a JavaScriptCore that is not Safari's. A WebDriver session is what carries a
verdict back out, the driver and the page's server sharing one network namespace so each is the
other's `127.0.0.1`; `--headless --screenshot` has no such channel, and loading `dist/index.js` in a
globals-stripped realm buys one by not running a browser. The leg re-checks the conversions and
nothing else — each fixture's emitted markdown, its parsed document, its error code — leaving the
corpus's pairing, uniqueness, source positions and byte-level equality to the Node suite that owns
them.

Every leg announces its name and, where a container is in play, the image, before it runs and its
elapsed time after, `publish.sh` alongside `ci.sh`, so a long run reads as progress rather than as
a hang. A leg added later owes the same marker, and a function a leg reaches chains its statements
with `&&`, because the `||` that captures the leg's status suspends `set -e` for everything it
calls. A leg whose output is both streamed and grepped keeps the copy in a `mktemp`
file: `tee /dev/stderr` reopens fd 2, and under `./ci.sh > log 2>&1` the two offsets punch NUL
holes through each other's lines (4d).

The floors live in the `test` script, so `npm test` and the gate are one path: 100% of lines and
functions, and a branch floor that only ever moves upward. It sits below 100 because the guards
`noUncheckedIndexedAccess` and ADF's optional keys force — `?? []`, `?? {}`, `?.`, an index
compared against `undefined` — have a half no valid document reaches.

The size ratchet is the other such number, `.oxlintrc.json`'s single rule over the files
`tsconfig.build.json` builds, measured by `oxlint` since TypeScript 7 is a native compiler
publishing no in-process parser, only the `unstable/` AST surface an out-of-process handshake
reaches. It is a per-function line ceiling, set at that set's worst and moving only downward. It
covers the built files alone, since one ceiling over the tests too would have to be their worst,
loosening the guard over the shipped code. It guards against drift and never drives a refactor, so
no cyclomatic rule and no second lint rule join it: neither measure picked out what nine readers
found hard (the comprehension panel, 2026-09-20). Three switches guard a silent green: `IIFEs:
true`, since oxlint exempts an IIFE otherwise; an explicit `-c`, so a config gone missing fails the
leg instead of falling back to oxlint's own defaults; and `--deny-warnings`, since a rule from a
category this config never names arrives as a warning it exits 0 on.

The corpus, all checked in: hand-built fixtures per node and combination; real ADF Atlassian's
editor wrote; the CommonMark spec suite against `markdownToAdf` and `markdownToHtml`.

Beside the corpus, properties run over documents generated from the node tables and over generated
markdown, on a fixed seed in the gate; `PROPERTY_RUNS=<runs>` raises the runs and randomizes the
seed for local digging, and a counterexample found becomes a round-trip fixture. The generators and
run parameters properties share live in `src/conformance/property-harness.ts`, outside the build and coverage.

`spec/flavour.md` is read as a source too, so the node tables cannot drift from the prose they
copy: each `- ` bullet in `## Block nodes`, `## Inline nodes` and `## Marks` declares the nodes
named before its first em dash, with the attributes following `Attributes: ` — a parenthesized
value set reading `string` — and must equal the tables in `adf/`. Keep prose in those sections out
of a bullet; fenced examples are skipped. It guards the attributes alone: nodes that differ in
content model share a bullet, and the argument attribute is spelled ahead of `Attributes: `, so
both answer to the round-trip corpus and to nothing else where a node has no fixture.

The tables answer to Atlassian's schema too (`docs/decisions.md` §Standards ship as data): for every
node and mark they spell, the attribute names and kinds equal what `full.json` and `stage-0.json`
hold between them. Value sets stay documentation, since any value round-trips. What the schema holds
and the tables do not spell is pinned by name — an attribute as a gap, a type as carried — so a
re-pin adding either goes red until someone spells it or pins it.

## 11. Code rules

### Style

- Two-space indent, English everywhere. Alphabetical order wherever order
  carries no meaning, keyed on the name a line introduces rather than where it came from: an
  import sorts on its first binding, type imports ahead of value imports, so moving or renaming a
  module reorders nothing (the maintainer, 2026-09-18).
- No casts: `as`, `as unknown as`, non-null `!`. A boundary owes a type guard validating the
  fields it claims (`isAdfDocument`); past it everything is typed. Make invalid states
  unrepresentable.
- Failures are values: everything returns `Result<T>`, nothing throws. `try/catch` only wrapped
  tightly around a call that genuinely throws, converted to a result on the spot. A reader with no
  path to name returns `Read<T>`, and the walk attaches the path where it knows it.
- Reuse before adding; the smallest sufficient diff is the benchmark; no speculative generality —
  a second consumer, or it goes.

### Bounds

- Nothing recurses unbounded: the guards walk iteratively, and blocks, marks and JSON values — an
  attribute's and a carried node's alike — are all held to 500 levels (`largestNesting`), so a
  deep document is a `Result` rather than the stack overflow that waits near 2000. An attribute
  is counted from its value; a spelling that nests it deeper — the block directive's `marks`, the
  carry — refuses in its own format, as its parser does. A list giving way to the directive form
  refuses at zero headroom rather than walking again; counting every list twice halved the list
  limit, counting the directive form once doubled the parser's frames per level (the maintainer,
  2026-09-18).
- Nothing spreads an unbounded array into a call — a node's siblings, a code block's held lines, a
  mark run's segments: the argument list caps near 125k and throws a `RangeError` where a `Result`
  is owed. A walk pushes one at a time. A literal spread (`[...value]`) is not the same thing and
  is fine (4c).
- A loop retrying an input until a fallback spells it refuses the pass taking no fallback, so its
  termination is the loop's own check (28).
- A reader takes the text and an index — a sticky regex whose `lastIndex` the caller sets on the
  line before it reads, `indexOf` — never a fresh slice per character, and a per-character walk
  hoists the scan that does not vary with the character. The pipeline persona feeds documents
  nobody typed, and a megabyte through a quadratic walk is a minute rather than a millisecond. A
  scan may keep what it read for a later walk of the same text, and the fallback where it kept
  nothing must be the same reader over the same text at the same index, so the two cannot disagree
  — which is what makes the kept value a memo rather than a second spelling (4c).
- The parse keeps each node's readable spelling in a memo, so the `commonMarkSpelling` ask stops
  spelling a node once per level above it (18). The node reference is the key, which holds
  because the parse builds one object per position; `adfToMarkdown` passes no memo, where a
  consumer's document may hold one node at two positions (4b). `text` and `spelling` carry no depth
  and `headroom` is affine in it, so a read at or above the depth that filled the entry rebases; a
  read below re-spells, because a hit skips the depth guards the walk it replaces runs and an
  ordered list past the marker cap gives way, spending two emitter levels where the parser spent
  one. Only what succeeded is kept, so no path minted at another position is ever read.

### Spellings

- Only the hard break's inline segment holds a raw newline — every other spelling escapes one or
  refuses it — which is how the whitespace carry finds a line edge.
- Emphasis is spelled against CommonMark's matching, never flanking alone: a delimiter run in text
  escapes wherever CommonMark could open or close with it, leaving the emitter's own delimiters the
  only ones in play, and a pair that matching hands to another delimiter rides the carry instead.
- A readable spelling tried ahead of a general one takes the `try` prefix and fails only where the
  general form fails on the same node (20): refusing there refuses a document the general form
  spells, so a refusal the general form does not share belongs in the general form or nowhere. A
  readable spelling that must spell its subtree before it can give way — the list, whose
  thematic-break first line and blank lines exist only spelled — hands that one walk to the general
  form instead: giving way after the walk walks again at every level, doubling per level (4b).
- The attribute vocabulary is ADF's: `adf/` walks it and narrows each value to its kind, and a
  format spells the narrowed value. A spelling that re-checks the type is the check's second copy.
  Reading a spelling back is the format's own: the reader sits beside the spelling it inverts, so
  decode-respell-compare cannot drift, and each format writes its own — canonical JSON for a
  number is the markdown flavour's choice, not ADF's.

### Layout

- `src/adf/` holds ADF's own knowledge, imports no format, and is where a construct both formats
  read lives: the question is answered in ADF's vocabulary — a node type, an attribute kind, a
  content model — and no delimiter, element name or escape reaches it. A helper that cannot answer
  that way is two constructs, the ADF question there and the spelling in each format, the seam
  `markAttributes` and `markSpellings` already draw; one that cannot be split is a gap to ask (§15).
  `markdown/` and `html/` are peers: neither imports the other, and no third directory sits between
  them. A primitive knowing neither ADF nor a format stays at `src/` root. A construct rises to
  `adf/` on its second consumer, not in anticipation of one (the maintainer, 2026-09-21).
- Each format directory (`markdown/`, `html/`) parts into `emit/` (ADF→format) and `parse/`
  (format→ADF), the rest of it holding what both directions read. A construct's reader lives there
  beside the regex the emitter escapes against, so the two cannot drift; a reader with no emit
  counterpart goes in `parse/`, unless it is part of a construct that side already holds — a grammar
  stays in one file rather than splitting across the seam. A rule both directions must answer
  alike — whether a list marker interrupts a paragraph — is one function there too, never a copy
  per direction, however conservative the copy would be. Where the rule is the emitter's own
  choice, input consults it rather than restating it, and that is the only import `parse/` takes
  from `emit/` — `commonMarkSpelling` and `openingLinkTakesDirective` — so no fixture the emitter
  writes can be refused, and a spelling the emitter refuses gives its own error rather than a
  second name for it.
- Explicit over implicit; descriptive names; no catch-all files (`utils`, `helpers`, `misc`); a
  file does not repeat its directory in its name — `adf/document.ts`, never
  `adf/adf-document.ts`. A name is the noun `spec/flavour.md` or ADF's schema uses for the
  thing; a directory follows a split the spec draws; a placement these rules leave open goes
  beside its only reader, or in what both read where there are two (the maintainer, 2026-09-18).

## 12. Prose to a minimum

Applies everywhere: comments, every markdown file in this repo (this one included), PR text.

- Default is no comment. One earns its single line only by naming an invariant, footgun or
  external constraint the code cannot show — never restatement, history, absence or arrangement.
  A second line belongs in the commit message or a decision entry here.
- A doc paragraph says what the repo cannot say for itself, or it goes. The fix for a redundant
  one is deletion, not trimming. A false claim in any doc is a bug, fixed where found.
- Published text — npm README, error messages, API docs — never references internal systems,
  tickets or repos.

## 13. Commits and PRs

One-line commit messages and PR titles; short PR summaries. No AI-attribution markers, ever.

## 14. Non-goals

No network or filesystem I/O, no name→id resolution (`docs/decisions.md` §Names stay text), no ADF
schema validation or exported validator — a refusal that keeps the round-trip is not schema
validation, so the one a spelled node carrying the same mark type twice earns stays, and input
nesting a spelling inside its own kind (`*(*a*)*`) names that mark once, no shipped CSS
(`docs/decisions.md` §The HTML dialect), no streaming APIs, no performance budget past §11's
scanning rule — nothing here is tuned, and no figure is promised. A CLI is a later goal (`todo.md`),
not a non-goal.

## 15. The working loop

`todo.md` lists what is left under the release that ships it, in shipping order. One item per
session — the first under the earliest release — in the smallest PR-able chunk; split a big item
into sub-items in `todo.md` before starting it. A chunk running a little over or under that is not
worth deliberating; what matters is that nothing is left undone in the end. The session stops there
whatever it was asked to finish: a release is a chain of sessions, so an instruction to work until a
release is done names the chain, not the session. An open PR is a chunk already in flight, and
finishing it is the session.
Per chunk:

1. Fresh worktree off updated `origin/main`; implement tests-first (§10).
2. Run the larv-review flow until it passes and CI is green. A reviewer launch states the latest
   gate result (commit and outcome); a reviewer does not re-run `ci.sh` or the tests when a
   result exists for the commit under review, or when the diff since that result cannot affect
   it (docs-only) — re-run only what its own findings or fixes invalidate.
3. Merge the PR (standing authorization, this repo only, granted through the `0.2.0` release —
   the maintainer, 2026-09-13), delete the item from `todo.md` — what a consumer sees of it is
   reworded for them into `CHANGELOG.md`'s `## Unreleased` — report, stop.

Reserved for the maintainer whatever any rule here says: changing `version` in `package.json` (a
bump on `main` publishes, §9 — every release is the maintainer's) and the `NPM_TOKEN` secret.

### Ask, don't guess

Any choice where what the maintainer would pick is not near-certain gets asked. The confidence bar
is very high — asking too often is the accepted cost, guessing wrong is not.

An ask is a gap in this file, and its answer is the rule that closes it, landing here — never the
instance alone. Before asking, name the class the question belongs to and the earlier
`(the maintainer, …)` entries of that class; where a rule already decides it, apply it without
asking, and where the rule reads two ways on this input, that reading is the ask. Never ask "A or
B?": state the gap, the earlier asks of its class, the nearest text here, a candidate rule in this
file's voice and section, and the instance it yields. A rule that keeps collecting instances is
wrong: rewrite it.

Which output the audience expects — README goal 5 — is settled by a reader panel rather than
asked: three fresh-context readers, one per README persona the conversion serves, each given only
`## Audience` and the input, writing what they expect before picking among outputs the goals
allow, rendered, shuffled, with no rationale and nothing saying what is implemented. Three agreeing
settle it; otherwise four more read, five of seven settle it, and less is a missing goal, asked.
The verdict lands in the item it settles (the maintainer, 2026-09-25).

### Rules the loop has settled (the maintainer, 2026-09-18)

- A finding inside the chunk's item is fixed in the chunk. Outside it, a new `todo.md` item, always
  in a release, weighed against every item on that release by the personas and `docs/decisions.md`
  §Plain markdown is a flavour of the grammar through §Names stay text — an item it outweighs moves
  later. A weighing no rule decides is asked as a gap.
- A stated number — 500 levels, the branch floor — is kept; a chunk that cannot keep it asks,
  naming the number it can reach. A number the code needs and no rule states is a gap.
- An earliest release with no items left and nothing shipped toward it is planned as the chunk:
  every later item weighed as above, the order written in `todo.md`, and the maintainer's approval
  taken before any code. With work shipped toward it, it is ready to cut: report that and stop.

### The continuous loop

A `/loop` session counts as a chain of sessions, each iteration starting by re-reading `AGENTS.md`
and `todo.md` and trusting them over anything remembered from earlier iterations. The loop session
is a thin driver: each chunk's work runs in a fresh-context subagent holding this file as its
charter, and the driver only relays maintainer questions, runs the review flow, merges, and cleans
up. The loop stops when only maintainer-reserved acts remain.

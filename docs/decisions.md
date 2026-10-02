# Decisions

## Plain markdown is a flavour of the grammar

2026-09-27, the maintainer. Goal 2. Valid while the plain flavour's spellings are ones the markdown
grammar can read and write.

The lossy pair is the plain flavour: the markdown grammar's reader and writer with the flavour set,
its spellings — alerts, callouts, task markers, `==` — read and written there, so a marker line and
a backslash reach them intact; what the flavour cannot spell reduces ADF→ADF ahead of the writer.

## The round-trip is the product

2026-08-23, real payloads 2026-09-15, the maintainer. Goal 1. Valid while a consumer saves back
through the lossless pair.

`markdownToAdf(adfToMarkdown(doc))` and `htmlToAdf(adfToHtml(doc))` must equal `doc` — anything
less silently destroys content an editor could not represent, in a document it did not author.
When losslessness and readability conflict, losslessness wins. Round-trip equality is a property
tested over a checked-in corpus (`corpus/README.md`), not a claim made in prose. Its real payloads
are invented content written in Atlassian's editor on the maintainer's test site, so none is
sanitized and a mention keeps the test user's real account id.

## Markdown in is a canonical fixpoint

2026-08-23, the maintainer. Goals 1 and 4. Valid while markdown input may be written by hand.

The other direction is a canonical fixpoint, not byte-identity: human markdown normalizes, the way
back yields the library's canonical spelling, and that spelling round-trips byte-identically —
where there is a way back. CommonMark spells some things the flavour has no escape for — a
paragraph opening with a code span whose backticks read back as a fence — so a parse succeeding
does not imply a spellable document; `corpus/commonmark-spec/exceptions.json` names those.

## Equality is editor-normal

2026-08-24, the maintainer. Goal 1. Valid while markdown cannot tell apart the ADF shapes this
merges.

"Equals" is structural equality over editor-normal ADF — adjacent text nodes with identical marks
and no attributes merged, JSON number semantics, an empty attrs object, marks array or content
array the absent key — the only domain markdown can restore.
Replaced by deep equality with `todo.md` 40 (2026-09-28, the maintainer).

## Unknown nodes ride the carry

2026-08-23, extended to misplaced known nodes 2026-08-26, the maintainer. Goal 1. Valid while ADF
holds nodes, or node positions, this library does not spell.

An unknown ADF node is carried opaquely — raw JSON rides a dedicated syntax in both formats and
restores to a deep-equal node. The round-trip holds for documents newer than the library. So does
a known node no section spells where it stands: a markdown serializer spells a node by type without
checking its position, and refusing loses a document ADF itself keeps in an `unsupportedBlock`.
Where a container's own spelling cannot hold the child it has — a `bulletList` holding other than
`listItem`, a `codeBlock` other than text — the error result names that instead.

## Foreign HTML sorts three ways

2026-08-23, the sort 2026-09-20, the maintainer. Goals 1 and 4. Valid while ADF holds no node
for a bare container, a comment or a script. Lands with `todo.md` 6.

Every foreign element `htmlToAdf` and `markdownToAdf` read sorts one of three ways, never a silent
drop of content:

- A container around document content that ADF has no node for unwraps to its children, its own
  attributes dropped: `<div align="center">text</div>` keeps `text`, losing the alignment.
- Content ADF cannot hold is an error result naming it. A comment is one: a person wrote those
  words, and neither of Atlassian's schemas holds them — `annotation`'s `inlineComment` carries an
  id, `placeholder` is the editor's own hint, `extension` names a vendor app.
- What is not document content drops whole: `<script>` and `<style>`, their text with them.

`<details><summary>Title</summary>…</details>` is an `expand` titled by its summary, a
`nestedExpand` inside another; an empty one is refused, since `expand` requires content. A `style`
attribute is not read at `0.2.0`: the `textColor` and `backgroundColor` it could reach cost more
than they buy.
`plainMarkdownToAdf` reads through `markdownToAdf`'s parser, so it takes the same set.

## Names stay text

2026-08-23, the maintainer. Goal 7. Valid while resolving a name to an id needs I/O.

A bare `@name` or `:smile:` in typed text stays a text node. Only directives produce
mention/emoji/media nodes; resolving names to ids is the consumer's job.

## Directives under `!adf:`

2026-08-23, prefixed `!adf:` 2026-09-16, the maintainer. Goals 4 and 5. Valid while prose does not
write `!adf:`.

Directives are one grammar for everything markdown lacks, namespaced under `!adf:`:
`!adf:panel info` … `!adf:/panel` blocks, `!adf:mention[@Mikael]{id=5b10a2}` inline, `\!adf:` the
one escape. Not CommonMark's generic-directives proposal: its `:::` claims a form prose writes, and
its fence-length discipline ties a container's opener to its own body, where closing from the
opener nests by itself and leaf versus container falls out of the node's content model.

## CommonMark is a subset

2026-08-23, the maintainer. Goal 4. Valid while prose rarely writes the shapes the carve-outs claim.

Plain CommonMark is a subset, with carve-outs (`spec/flavour.md`): literal text shaped like a
directive, a pipe table or a `~~` pair is claimed — plus one image gap.

## Tables

2026-08-23, the maintainer. Goal 5. Valid while a pipe table holds only one header row and inline
cells.

One header row plus plain inline cells → pipe table; anything richer → directive form.

## Links

2026-09-13, nesting 2026-09-17, the maintainer. Goals 1 and 5. Valid while CommonMark's link
syntax is what readers edit.

`[text](url "title")`, or `<url>` for a bare autolink-shaped text, wherever CommonMark spells the
mark; `!adf:link[text]{attrs}` where it does not — an attribute CommonMark cannot hold, an `href` or
`title` no canonical escape spells, a paragraph opening whose CommonMark spelling would read as a
link reference definition — and a directive link CommonMark could spell is refused. No link wraps a
link — the bracket form goes literal, the directive form refused — which is CommonMark's prose
where its reference implementation nests one `<a>` in another.

## Ids stay site-local

2026-08-23, the maintainer. Goal 1. Valid while ADF ids are minted per site.

Identity-bearing nodes carry their ids in attributes; a document is only portable within its site —
accepted.

## Plain task ids come from position

2026-09-26, spelling 2026-09-29, the maintainer. Goals 6 and 7. Valid while a site rejects a task
node with no `localId`.

`plainMarkdownToAdf` gives each `taskList`, `taskItem` and `blockTaskItem` lacking one a `localId`
in the editor's UUID v4 shape, hashed from the whole markdown and the node's order among those it
mints, skipping any id the document holds: the same markdown reads to the same ids every run,
different markdown to different ids. The same markdown pasted twice into one document repeats its
ids: determinism wins over that case. A node the carry restores stays deep-equal (§Unknown nodes ride the carry): its
ids are only skipped.

## A callout title keeps its link targets

2026-09-29, the maintainer. Goals 5 and 6. Valid while an expand's `title` is a string.

`plainMarkdownToAdf` writes a link in a folded callout's title as its text and its target in
parentheses: `> [!faq]- See [x](http://y)` reads to the title `See x (http://y)`. A link whose text
is its target, with or without `mailto:`, keeps its text alone: `<http://y>` titles `http://y`,
`<a@b.c>` `a@b.c` — three persona readers agreeing, 2026-09-30.

## The plain flavour's spellings

2026-09-14, panels 2026-09-25 and 2026-09-29, the maintainer. Goals 5 and 6. Valid while GitHub's
renderer is the one the audience's markdown is read in.

README §Plain markdown's rows come from a survey of GitHub, GitLab, Gitea, Obsidian, Pandoc,
MkDocs, Docusaurus, Typora, Joplin, Logseq, Bear, Notion, Azure DevOps and Discord, GitHub's
renderer confirming each shape. Reader panels settled `error` as an error panel, the `==` bounds
(3 of 3) and a Han, Hangul, kana, Thai, Lao, Khmer or Myanmar character on either side bounding a
delimiter, so `は==日本語==で` (3 of 3), `==한국어==에서만` and `iPhone==専用==` (6 of 7) highlight,
the external image's two forms (6 of 7), a rule opening a list item dropping and the omission
notes (3 of 3), and a list's numbering overflowing into bullets (3 of 3, 5 of 7).
An omission note reads as the converter's, never as the author's.
Reading takes other tools' spellings, since it reads their output and writes none of them.
Rejected: `~sub~` and `^sup^` (`~2~` is a strike on GitHub, so `subsup` drops), underline and colour
spellings, raw HTML (`<details>`, `<mark>`), MkDocs `!!!` and the `:::` admonition family,
footnotes, definition lists, wikilinks, embeds, tags, comments, TOC tokens, spoilers, task states
past `[x]`/`[ ]`, and lifting bare URLs, `@name`, `:shortcode:` or ISO dates into nodes.

## The HTML dialect

2026-08-23, the maintainer. Goals 5 and 7. Valid while HTML output is read by consumers styling it
themselves.

The HTML dialect mirrors the markdown flavour: semantic elements, stable `adf-*` classes, `data-*`
for what HTML cannot express, text always escaped. No stylesheet ships.

## No runtime dependencies

2026-08-23, the maintainer. Goal 7. Valid while ~20 lines of own code, or a vendored table, do each
job a dependency would.

`dependencies` is empty. A runtime dependency enters only through an entry here stating why ~20
lines of own code cannot do the job, who maintains it, and what auditing it costs. So the CommonMark
and HTML parsers are written in this repo.

## Standards ship as data

2026-08-30, the CommonMark suite 2026-09-05 and ADF's schemas 2026-09-13, the maintainer. Goals 1,
4 and 7. Valid while each table is fixed data a dependency would only wrap.

A table a standard fixes is data rather than a dependency: HTML5's 2125 semicolon-terminated
character references ship packed in their own module, so entity decoding is complete without one.
The CommonMark spec suite is the same shape of data and ships vendored at `corpus/commonmark-spec/`
rather than as the `commonmark-spec` dev dependency — that package is CommonJS-only, and Renovate
auto-bumping a spec version would silently point the vendored exception list's example numbers at a
renumbered suite. A spec bump is a deliberate re-pin, exceptions re-derived by hand beside it.
Atlassian's ADF JSON Schemas ship vendored the same way, at `spec/adf-schema/`, rather than as the
`@atlaskit/adf-schema` dev dependency — CommonJS-only, some fifty packages with React among them,
and a release most days for Renovate to automerge — re-pinned by hand when a payload or a report
shows the need.

## fast-check

2026-09-14, the maintainer. Goal 1. Valid while a failing generated document needs shrinking by
hand otherwise.

`fast-check` earns its place as a devDependency shrinking a failing generated document to the
nodes that break it.

## Any ES2022 engine

2026-09-01, the maintainer. Goal 7. Valid while ES2022 is the floor browsers and servers share.

The library runs on any ES2022 engine, not only Node — a browser as readily as a server. The
shipped source is ECMAScript and nothing else: no host import, no host global, no DOM.
`tsconfig.build.json` is that gate, typechecking and emitting the shipped files alone, so
`node:fs`, `process` and an ES2024 method are compile errors here rather than a consumer's crash
there. The standard is the line, never an engine list: one implementing it in part — Hermes is the
live doubt, on the Unicode property escapes emphasis matching leans on and on lookbehind — is out
of scope rather than a bug. Node's test runner, the corpus reads and the build are the repo's own,
never the library's, and `engines.node` states the floor the shipped JavaScript needs — `>=18` —
never the higher one those repo-only tools want.

## ESM only

2026-08-23, the maintainer. Goal 7. Valid while the audience's toolchains all import ES modules.

No CommonJS build, no dual-package hazard.

## One built entrypoint

2026-08-23, the maintainer. Goal 7. Valid while Node refuses to type-strip under `node_modules`.

Built JavaScript, `.d.ts` beside it. Do not add a TypeScript-source entrypoint — Node refuses to
type-strip under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so it cannot serve
an npm consumer.

## Public on npm

2026-08-23, the name 2026-09-01, the maintainer. Goals 2 and 7. Valid while the package's source
stays public beside it.

Published to public npm as `@larvit/adf-codec`. Public source: the Gitea repo goes public,
LICENSE in place, before the first publish. A codec, since it converts both directions, and named
for the hub rather than the formats around it.

## The formats are API

2026-08-23, strict input 2026-09-01, content models 2026-09-16, the maintainer. Goal 1.
Valid while consumers store what the library emits.

The emitted markdown and HTML are contracts. After 1.0: previously-emitted output parsing
differently, or not at all, is MAJOR; new syntax while old output still round-trips is MINOR.
Pre-1.0, normal 0.x rules. A spelled node's content model is part of that contract — leaf or
container is the model, not the syntax — so giving a spelled node's model content it had not, or
taking it away, is MAJOR whatever ADF's own schema does. Input reads the canonical directive
spelling alone — spacing, key order, each value's spelling — since loosening it later is MINOR.

The error surface is a contract too; `README.md` §The errors states it to the consumer, and the
types in `src/result.ts` hold its shape.

## The code list

2026-08-25, the maintainer; dated below where a rule came later. Goal 1. Valid while a consumer
switches on `code` with no `default`.

- Adding, removing or renaming a code is breaking, so a new cause takes an existing code whose
  name reads true of it in both directions; where none does and a plain name exists, a new code —
  in any 0.x minor, and after 1.0 only in a MAJOR (2026-09-18).
- A refusal whose cause is this library's own invariant rather than the input takes the existing
  code nearest what the consumer sees — a document that does not convert is
  `unsupported-node-shape` — since a code no input reaches is one no consumer can switch on
  (2026-09-20).
- A refusal no spelling recovers from is a gap in the flavour rather than a code: give the flavour
  the spelling and the code goes (`unspellable-link`, 2026-09-13). A cause the carry answers gets
  no code: a mark no spelling writes rides the carry with its node.

## Which code a cause takes

2026-08-28, the maintainer; dated below where a rule came later. Goal 1. Valid while a consumer
handles one cause alike whichever node, attribute or direction raised it.

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
  missing its closer is (2026-09-16).
- A directive whose name reads back to no node is `unknown-directive-name` rather than a claim
  code — the spelling is well formed, and telling that apart from a typo is what a consumer
  switches on when a later MINOR gives the name meaning. A reserved name is a known name, so never
  that code, and the two the flavour reserves part on form: a form the grammar does not have is a
  claim code — `!adf:carry`, whose carry is the fence — and a well-formed form in the wrong place
  is `unsupported-node-shape`, `!adf:listBreak` parting anything but two adjacent lists of one
  type (2026-09-01).
- A well-formed directive the node tables refuse — an attribute a node does not hold or spells
  elsewhere, a value outside its kind or its canonical spelling, an argument, or a body of a shape
  its content model does not take — is `unsupported-node-shape`, the emitter's code for the same
  mismatch read the other way: one code across both directions for good, since the call site
  knows which direction it called and parting them after `0.1.0` is MAJOR (2026-09-23).
- A non-finite number takes two codes: `unsupported-node-shape` parsing, `not-an-adf-document`
  emitting — no document holds one, so no round-trip crosses them (2026-09-23).

## `message` and `path`

2026-09-03, the path 2026-09-23, the maintainer. Goals 1 and 4. Valid while a person fixing the
input reads `message`.

- A message names the violation, not the rule alone — a rule by itself states a truth the reader
  must invert before it reads as a failure — and where the flavour's claim refuses ordinary prose
  it names the escape that unclaims the form claimed: `\!adf:` for a directive, block line and
  inline alike, `\|` for every pipe row.
- `not-an-adf-document` carries the document's own path throughout: seven of the guard's eight
  branches read the document's own shape, and threading a path to the eighth — a malformed node
  anywhere in the tree — wants the manual stack §Nothing recurses unbounded forces. The message
  names the violation instead.

## Publish on a version bump

2026-08-23, converging 2026-09-03, the maintainer. Goal 7. Valid while CI on `main` holds the npm
token.

`package.json` version on `main` is the source of truth. CI on `main`: tests green and the version
not yet on npm → publish and tag `vX.Y.Z`. No bump, no deploy. `publish.sh` is that job.

The publish and the tag each check their own end state — the version on npm, the tag on the
remote — so a run that dies between them converges on the next push
to `main` rather than leaving npm ahead of the tags. An unanswered registry reads the same as an
unpublished version, which npm's own duplicate rejection is what catches. The job rebuilds rather
than taking the gate's `dist`: the lockfile is committed, the image is patch-pinned and `tsc` is
deterministic, so the two builds agree, and promoting an artifact would make the release path
depend on a store that the gate would then have to keep.

## Docs describe the release being built

2026-09-16, the maintainer. Goal 7. Valid while a bump on `main` publishes.

Docs on `main` describe the release being built rather than the version npm holds, so they match it
the moment the bump publishes; add no interim note marking the gap.

## No schema validation

2026-08-23, the mark refusal 2026-08-25, the maintainer. Goal 1. Valid while the site a document
is saved to validates it.

No ADF schema validation or exported validator. A refusal that keeps the round-trip is not schema
validation, so the one a spelled node carrying the same mark type twice earns stays, and input
nesting a spelling inside its own kind (`*(*a*)*`) names that mark once.

## The gate runs on Deno and Bun

2026-09-01, Deno's reason 2026-09-28, the maintainer. Goals 3 and 7. Valid while the library claims
any ES2022 engine.

The gate runs the suite under Deno and Bun as well as Node. Bun runs JavaScriptCore, the one engine
of the three that is not V8, where the Unicode property escapes emphasis matching leans on can
disagree. Deno shares Node's V8 and stays to prove the library runs there too, catching what the
two runtimes leave undocumented. Both refuse a run matching no test, so Node's is the only
vacuous-green guard, and `AGENTS.md` §3's `node:` shims rule is the price of proving those engines
over the corpus rather than over a smoke import.

## The gate installs the tarball

2026-09-03, the maintainer. Goal 7. Valid while consumers install the packed package.

The gate packs the build and installs the tarball under `package-tests/`, so `files`, `exports`
and `types` are proved on the artifact that ships rather than on the source tree a self-reference
would resolve against. `consumer.ts` typechecks the emitted `.d.ts` from outside
`tsconfig.build.json` — declaration emit leaves the `.ts` specifiers
`rewriteRelativeImportExtensions` rewrites in the JavaScript, and this is what says a consumer's
resolver maps them, under `NodeNext` alone; a `.d.ts` reader that is not `tsc` stays unproven.
`node-floor.js` round-trips the installed package under a Node pinned to `engines.node`'s floor.

## Firefox reads the build

2026-09-04, the maintainer. Goal 7. Valid while the library claims a browser and no other leg runs
SpiderMonkey.

A headless Firefox loads `dist/index.js` over HTTP and converts the round-trip, normalization and
error fixtures and the real payloads — the `commonmark-spec` sort is the Node suite's to check —
which is the browser half of §Any ES2022 engine and the only SpiderMonkey there is — the gate's
other engines are two V8s and a JavaScriptCore that is not Safari's. A WebDriver session is what
carries a verdict back out, the driver and the page's server sharing one network namespace so each
is the other's `127.0.0.1`; `--headless --screenshot` has no such channel, and loading
`dist/index.js` in a globals-stripped realm buys one by not running a browser. The leg re-checks
the conversions and nothing else — each fixture's emitted markdown, its parsed document, its error
code — leaving the corpus's pairing, uniqueness, source positions and byte-level equality to the
Node suite that owns them. `selenium/standalone-firefox` runs it over the smaller
`instrumentisto/geckodriver`: the leg is worth a current SpiderMonkey, and that image fell four
Firefox majors behind.

## The coverage floors

2026-08-24, the maintainer. Goal 1. Valid while `noUncheckedIndexedAccess` and ADF's optional keys
force guards with a half no valid document reaches.

The floors live in the `test` script, so `npm test` and the gate are one path: 100% of lines and
functions, and a branch floor that only ever moves upward. It sits below 100 because the guards
`noUncheckedIndexedAccess` and ADF's optional keys force — `?? []`, `?? {}`, `?.`, an index
compared against `undefined` — have a half no valid document reaches.

## The size ratchet

2026-09-20, the maintainer. KISS, a technical principle. Valid while no measure picks out what
readers find hard better than a function's length.

`.oxlintrc.json`'s single rule, over the files `tsconfig.build.json` builds, is a per-function line
ceiling, set at that set's worst and moving only downward. It covers the built files alone, since
one ceiling over the tests too would have to be their worst, loosening the guard over the shipped
code. It guards against drift and never drives a refactor, so no cyclomatic rule and no second lint
rule join it: neither measure picked out what nine readers found hard (the comprehension panel,
2026-09-20). `oxlint` measures it since TypeScript 7 is a native compiler publishing no in-process
parser, only the `unstable/` AST surface an out-of-process handshake reaches. Three switches guard
a silent green: `IIFEs: true`, since oxlint exempts an IIFE otherwise; an explicit `-c`, so a
config gone missing fails the leg instead of falling back to oxlint's own defaults; and
`--deny-warnings`, since a rule from a category this config never names arrives as a warning it
exits 0 on.

## Properties on a fixed seed

2026-09-14, the maintainer. Goal 1. Valid while a red gate must reproduce.

Beside the corpus, properties run over documents generated from the node tables and over generated
markdown, on a fixed seed in the gate; a counterexample found becomes a round-trip fixture.

## The CommonMark suite checks three ways

2026-08-27, the maintainer. Goals 1 and 3. Valid while the suite's answers are HTML ADF cannot be
compared against.

Each example is a named error or markdown that parses and emits to itself byte for byte; its
reference HTML's text, tags stripped and entities decoded, equals the parsed document's; and its
elements count the marks and nodes they map to. The fixpoint alone passes a parser returning the
empty document, the text alone one dropping every emphasis. An exception is the maintainer's to
add, and valid CommonMark parsing to a document `adfToMarkdown` refuses where a spelling could exist
is a bug to fix, never an exception.

## The flavour spec is read as a source

2026-09-01, the maintainer. Goal 1. Valid while `spec/flavour.md` restates the node tables in
prose.

`spec/flavour.md` is read as a source, so the node tables cannot drift from the prose they copy:
its node and mark bullets must equal the tables in `adf/`. It guards the attributes alone: nodes
that differ in content model share a bullet, and the argument attribute is spelled outside the
bullet's attribute list, so both answer to the round-trip corpus and to nothing else where a node
has no fixture.

## The node tables answer to Atlassian's schema

2026-09-13, the maintainer. Goal 1. Valid while a site's editor writes what Atlassian's schema
holds.

For every node and mark the tables spell, the attribute names and kinds equal what `full.json` and
`stage-0.json` (§Standards ship as data) hold between them. Value sets stay documentation, since
any value round-trips. What the schema holds and the tables do not spell is pinned by name — an
attribute as a gap, a type as carried — so a re-pin adding either goes red until someone spells it
or pins it.

## Nothing recurses unbounded

2026-08-25, the directive form's count 2026-09-18, the maintainer. Goal 1. Valid while an engine's
stack overflows near 2000 frames.

The guards walk iteratively, and blocks, marks and JSON values — an attribute's and a carried
node's alike — are all held to 500 levels (`largestNesting`), so a deep document is a `Result`
rather than the stack overflow that waits near 2000. An attribute is counted from its value; a
spelling that nests it deeper — the block directive's `marks`, the carry — refuses in its own
format, as its parser does. A list giving way to the directive form refuses at zero headroom rather
than walking again; counting every list twice halved the list limit, counting the directive form
once doubled the parser's frames per level.

## Nothing spreads an unbounded array

2026-09-18, the maintainer. Goal 1. Valid while engines cap a call's arguments.

Nothing spreads an unbounded array into a call — a node's siblings, a code block's held lines, a
mark run's segments: the argument list caps near 125k and throws a `RangeError` where a `Result` is
owed. A walk pushes one at a time. A literal spread (`[...value]`) is not the same thing and is
fine.

## A retry loop checks its own termination

2026-09-20, the maintainer. Goal 1. Valid while a fallback can fail to spell what it is handed.

A loop retrying an input until a fallback spells it refuses the pass taking no fallback, so its
termination is the loop's own check.

## Readers scan by index

2026-08-30, the kept scan 2026-09-18, the maintainer. Goal 8. Valid while the pipeline persona
feeds documents nobody typed.

A reader takes the text and an index — a sticky regex whose `lastIndex` the caller sets on the line
before it reads, `indexOf` — never a fresh slice per character, and a per-character walk hoists the
scan that does not vary with the character: a megabyte through a quadratic walk is a minute rather
than a millisecond. A scan may keep what it read for a later walk of the same text, and the
fallback where it kept nothing must be the same reader over the same text at the same index, so the
two cannot disagree — which is what makes the kept value a memo rather than a second spelling.

## The spelling memo

2026-09-19, the maintainer. Goal 8. Valid while the `commonMarkSpelling` ask spells a node once
per level above it otherwise.

The parse and the plain reduction keep each node's readable spelling in a memo, so the
`commonMarkSpelling` ask stops spelling a node once per level above it. `text` and `spelling` carry
no depth and `headroom` is affine in it, so a read at or above the depth that filled the entry
rebases; a read below re-spells, because a hit skips the depth guards the walk it replaces runs and
an ordered list past the marker cap gives way, spending two emitter levels where the parser spent
one. Only what succeeded is kept, so no path minted at another position is ever read.

## Cost fixes are measured, never timed

2026-09-18, the maintainer and the stability-reviewer. Goal 8. Valid while Goal 8 promises growth
rather than a figure.

A cost fix that changes no behaviour lands on the suite staying green with no fixture output
changed, and a before-and-after figure in its PR; the gate times nothing. Measured and kept:
`adfDocumentFault`'s shape and depth walks stay two — the parting gives depth its own code — at
52 ms for a 9 MB document the emit takes 314 ms over; and `continuesContainer`'s re-scan per item
level stays, linear in the lines and bounded in depth by the 500-level guard.

## Only the hard break holds a raw newline

2026-08-26, the maintainer. Goal 1. Valid while the whitespace carry finds a line edge by its raw
newline.

Only the hard break's inline segment holds a raw newline — every other spelling escapes one or
refuses it — which is how the whitespace carry finds a line edge.

## Emphasis follows CommonMark's matching

2026-08-27, the maintainer. Goals 1 and 3. Valid while CommonMark's emphasis rules are the
reader's.

Emphasis is spelled against CommonMark's matching, never flanking alone: a delimiter run in text
escapes wherever CommonMark could open or close with it, leaving the emitter's own delimiters the
only ones in play, and a pair that matching hands to another delimiter rides the carry instead.

## Readable spellings take the `try` prefix

2026-09-21, the maintainer. Goals 1 and 5. Valid while a readable spelling's refusal would cost a
document the general form spells.

A readable spelling tried ahead of a general one takes the `try` prefix and fails only where the
general form fails on the same node: refusing there refuses a document the general form spells, so a
refusal the general form does not share belongs in the general form or nowhere. A readable spelling
that must spell its subtree before it can give way — the list, whose thematic-break first line and
blank lines exist only spelled — hands that one walk to the general form instead: giving way after
the walk walks again at every level, doubling per level.

## The attribute vocabulary is ADF's

2026-08-27, the maintainer. Goal 2. Valid while every format spells the same ADF attributes.

`adf/` walks the attribute vocabulary and narrows each value to its kind, and a format spells the
narrowed value. A spelling that re-checks the type is the check's second copy. Reading a spelling
back is the format's own: the reader sits beside the spelling it inverts, so
decode-respell-compare cannot drift, and each format writes its own — canonical JSON for a number
is the markdown flavour's choice, not ADF's.

## The source parts by ADF and format

2026-08-27, placement 2026-09-18, `adf/`'s bar 2026-09-21, the maintainer. Goal 2. Valid while
each format has a reader and a writer through ADF.

`src/adf/` holds ADF's own knowledge, imports no format, and is where a construct both formats read
lives: the question is answered in ADF's vocabulary — a node type, an attribute kind, a content
model — and no delimiter, element name or escape reaches it. A helper that cannot answer that way
is two constructs, the ADF question there and the spelling in each format, the seam
`markAttributes` and `markSpellings` already draw; one that cannot be split is a gap to ask.
`markdown/` and `html/` are peers: neither imports the other, and no third directory sits between
them. A primitive knowing neither ADF nor a format stays at `src/` root. A construct rises to
`adf/` on its second consumer, not in anticipation of one. A directory follows a split
`spec/flavour.md` draws, and a placement nothing here settles goes beside its only reader, or in
what both read where there are two.

Each format directory parts into `emit/` (ADF→format) and `parse/` (format→ADF), the rest of it
holding what both directions read. A construct's reader lives there beside the regex the emitter
escapes against, so the two cannot drift; a reader with no emit counterpart goes in `parse/`,
unless it is part of a construct that side already holds — a grammar stays in one file rather than
splitting across the seam. A rule both directions must answer alike — whether a list marker
interrupts a paragraph — is one function there too, never a copy per direction, however
conservative the copy would be. Where the rule is the emitter's own choice, input consults it
rather than restating it, and that is the only import `parse/` takes from `emit/` —
`commonMarkSpelling` and `openingLinkTakesDirective` — so no fixture the emitter writes can be
refused, and a spelling the emitter refuses gives its own error rather than a second name for it.

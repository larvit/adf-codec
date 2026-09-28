# Decisions

## Plain markdown is a flavour of the grammar

2026-09-27, the maintainer. Goal 2. Valid while the plain flavour's spellings are ones the markdown
grammar can read and write.

The lossy pair is the plain flavour: the markdown grammar's reader and writer with the flavour set,
its spellings — alerts, callouts, task markers, `==` — read and written there, so a marker line and
a backslash reach them intact; what the flavour cannot spell reduces ADF→ADF ahead of the writer.

## The round-trip is the product

2026-08-23, the maintainer. Goal 1. Valid while a consumer saves back through the lossless pair.

`markdownToAdf(adfToMarkdown(doc))` and `htmlToAdf(adfToHtml(doc))` must equal `doc` — anything
less silently destroys content an editor could not represent, in a document it did not author.
When losslessness and readability conflict, losslessness wins. Round-trip equality is a property
tested over a corpus, not a claim made in prose.

## Markdown in is a canonical fixpoint

2026-08-23, the maintainer. Goals 1 and 3. Valid while markdown input may be written by hand.

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

## Unknown nodes ride the carry

2026-08-23, extended to misplaced known nodes 2026-08-26, the maintainer. Goal 1. Valid while ADF
holds nodes, or node positions, this library does not spell.

An unknown ADF node is carried opaquely — raw JSON rides a dedicated syntax in both formats and
restores to a deep-equal node. The round-trip holds for documents newer than the library. So does
a known node no section spells where it stands: a markdown serializer spells a node by type without
checking its position, and refusing loses a document ADF itself keeps in an `unsupportedBlock`.
Where a container's own spelling cannot hold the child it has — a `bulletList` outside `listItem`,
a `codeBlock` outside text — the error result names that instead.

## Foreign HTML is refused by name

2026-08-23, the maintainer. Goals 1 and 6. Valid until the HTML dialect's element set lands
(`todo.md`, 6).

An unmappable foreign HTML element is an error result naming the element — never a silent drop.

## Names stay text

2026-08-23, the maintainer. Goal 7. Valid while resolving a name to an id needs I/O.

A bare `@name` or `:smile:` in typed text stays a text node. Only directives produce
mention/emoji/media nodes; resolving names to ids is the consumer's job.

## Directives under `!adf:`

2026-08-23, prefixed `!adf:` 2026-09-16, the maintainer. Goals 3 and 4. Valid while prose does not
write `!adf:`.

Directives are one grammar for everything markdown lacks, namespaced under `!adf:`:
`!adf:panel info` … `!adf:/panel` blocks, `!adf:mention[@Mikael]{id=5b10a2}` inline, `\!adf:` the
one escape. Not CommonMark's generic-directives proposal: its `:::` claims a form prose writes, and
its fence-length discipline ties a container's opener to its own body, where closing from the
opener nests by itself and leaf versus container falls out of the node's content model.

## CommonMark is a subset

2026-08-23, the maintainer. Goal 3. Valid while prose rarely writes the shapes the carve-outs claim.

Plain CommonMark is a subset, with carve-outs (`spec/flavour.md`): literal text shaped like a
directive, a pipe table or a `~~` pair is claimed — plus one image gap.

## Tables

2026-08-23, the maintainer. Goal 4. Valid while a pipe table holds only one header row and inline
cells.

One header row plus plain inline cells → pipe table; anything richer → directive form.

## Links

2026-09-13, nesting 2026-09-17, the maintainer. Goals 1 and 4. Valid while CommonMark's link
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

## The HTML dialect

2026-08-23, the maintainer. Goals 4 and 7. Valid while HTML output is read by consumers styling it
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
3 and 7. Valid while each table is fixed data a dependency would only wrap.

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

2026-08-23, the maintainer. Goal 7. Valid while the audience installs from public npm.

Published to public npmjs as `@larvit/adf-codec`. Public source: the Gitea repo goes public,
LICENSE in place, before the first publish.

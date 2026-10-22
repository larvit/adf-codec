# Decisions

## Each call names its flavour

2026-10-09, the maintainer; names by a developer panel, 2026-10-09. Goals 4, 5 and 6.1. Valid while
each flavour has a standard or a spec of its own.

A function's name says which markdown it reads or writes, and a reader reads that flavour alone:

| Call | Flavour |
| --- | --- |
| `adfToLosslessMarkdown`, `losslessMarkdownToAdf` | the lossless flavour, `spec/flavour.md` |
| `commonMarkToAdf` | CommonMark as its spec says: a directive, a pipe table, `~~`, `==` and an `adf:` fence read as CommonMark reads them |
| `adfToPortableMarkdown`, `portableMarkdownToAdf` | CommonMark, GFM's pipe tables, `~~`, alerts and task markers, and Obsidian's callouts and `==`; no directive and no `adf:` fence |

The calls between markdown and HTML that `todo.md` item 7 ships take their flavour's name too. No
`adfToCommonMark`: the portable writer serves every persona a CommonMark writer would. The panel
picked `portable` 4 of 7 over `plain` 3, `gfm` and `rendered` none: the export readers read it as
"renders anywhere, lossy", and three readers read `plain` as holding no tables or alerts.

## Portable markdown is a flavour of the grammar

2026-09-27, the maintainer. Goal 2. Valid while the portable flavour's spellings are ones the
markdown grammar can read and write.

The lossy pair is the portable flavour: the markdown grammar's reader and writer with the flavour
set, its spellings — alerts, callouts, task markers, `==` — read and written there, so a marker line
and a backslash reach them intact; what the flavour cannot spell reduces ADF→ADF ahead of the
writer.

## The round-trip is the product

2026-08-23, real payloads 2026-09-15, the maintainer. Goal 1. Valid while a consumer saves back
through the lossless pair.

`losslessMarkdownToAdf(adfToLosslessMarkdown(doc))` and `htmlToAdf(adfToHtml(doc))` must deep-equal
`doc` — anything less silently destroys content an editor could not represent, in a document it did
not author. When losslessness and readability conflict, losslessness wins. Round-trip equality is a
property tested over a checked-in corpus (`corpus/README.md`), not a claim made in prose. Its real
payloads are invented content written in Atlassian's editor on the maintainer's test site, so none
is sanitized and a mention keeps the test user's real account id.

## Markdown in is a canonical fixpoint

2026-08-23, the maintainer; every parsed document has converted back since 2026-10-04. Goals 1 and
5. Valid while markdown input may be written by hand.

The other direction is a canonical fixpoint, not byte-identity: human markdown normalizes, the way
back yields the library's canonical spelling, and that spelling round-trips byte-identically.

## Equality is deep

2026-08-24, deep 2026-10-03, the maintainer. Goal 1. Valid while a pipeline or a bot can build a
shape the editor would not.

"Equals" is deep equality over the document's JSON values: `assert.deepStrictEqual` on plain objects
as `JSON.parse` builds them, since ADF is JSON. Every key and value in `doc` counts, including two
adjacent text nodes, an empty `attrs`, `content` or `marks`, and `-0`. Neither side is normalized.
CommonMark's spelling stays wherever a document holds none of those shapes. The portable reader
builds what is written, as `losslessMarkdownToAdf` does. Only the portable writer is lossy: its
reduction reads and writes editor-normal ADF — adjacent text nodes of identical marks and no
attributes merged, `-0` as `0`, and an empty `attrs`, `content` or `marks` the absent key, except
the doc's `content`, which ADF's schema requires — so two documents the editor holds equal write the
same portable markdown.

## `!adf:textBreak{}` parts text CommonMark would join

2026-10-03, the maintainer. Goal 1. Valid while CommonMark reads adjacent text as one run.

Two adjacent text nodes CommonMark would read back as one are parted by the reserved inline leaf
`!adf:textBreak{}`: a leaf building no node keeps both nodes and asks nothing of the text around it.
A code span holds no directive, so the spans close and reopen around the leaf. The grammar:
`spec/flavour.md` §Inline nodes, **Adjacent text nodes**.

## A list right after one of its kind takes the other marker

2026-10-04, ordered lists in portable markdown 2026-10-09, the maintainer. Goals 4 and 5. Valid
while CommonMark starts a new list where the bullet character or the ordered delimiter changes.

Every reader parts lists where the marker changes, as CommonMark does, so both writers alternate the
marker between adjacent lists of a kind and no directive parts them. `*` is the maintainer's pick.
For ordered lists in portable markdown, this overrides a reader panel's 2026-09-25 verdict, 5 of
7, for one bullet list with escaped numbers (`- 1\. a`). The panel chose that while no other
portable spelling parted the lists, so the maintainer overrode it without a new panel. The grammar: `spec/flavour.md` §Canonical form.

## An empty key spells `empty`

2026-10-03, a writer panel and the maintainer. Goals 1 and 6. Valid while no attribute value
spells an empty object or array.

An `attrs`, `content` or `marks` key holding an empty object or array is the reserved key with the
bare value `empty`, so a container opener and closer with nothing between them stays the node
holding no `content` key. A writer panel chose the spelling, 5 of 7. The grammar: `spec/flavour.md`
§Directives, **Attributes**, and §Marks.

## `-0` is spelled `-0`

2026-10-03, the maintainer. Goal 1. Valid while JSON's own serialization writes `-0` as `0`.

`-0` is spelled `-0` wherever the flavour writes a number or a JSON value, since JSON's grammar
reads it back as `-0`. The grammar: `spec/flavour.md` §Block nodes and §The CommonMark blocks.

## A block's marks are named, and `colwidth` is a comma list

2026-10-03 for `colwidth`, 5 of 7, and 2026-10-14 for `marks`, 3 of 3: writer panels of product
managers, engineers and support agents. Goal 6. Valid while ADF types these attributes as
`src/adf/` does.

`colwidth` is its widths joined by commas, `colwidth="340,420"`, where it was a JSON array. A
block's `marks` names each mark with its `{attrs}`, in order,
`marks="indentation{level=2} fragment{localId=f1 name=\"Price list\"}"`, chosen over the escaped
JSON array and the JSON array unquoted. All three writers first sketched a key per mark,
`{align=center}`, which loses the marks' order and can clash with the node's own attributes. Where
`src/adf/` does not type a mark or one of its attributes, or a value holds another type, the whole
array stays JSON, the general form (§Readable spellings take the `try` prefix).
The grammar: `spec/flavour.md` §Block nodes.

## Empty markdown is a document of no blocks

2026-10-03, a writer panel and the maintainer. Goals 1 and 6. Valid while ADF's schema requires
`content` on `doc`.

Markdown holding no block reads as `{ content: [], type: 'doc', version: 1 }`, the document
`spec/adf-schema/full.json` requires. A document holding no `content` key is
`!adf:doc {content=none}` as its only block, and a named error anywhere else. The writer panel split
4 for `none` and 3 for `absent`, and the maintainer chose `none`; all seven rejected a bare
`!adf:doc`.

## Unknown nodes ride the carry

2026-08-23, extended to misplaced known nodes 2026-08-26 and to code block children 2026-10-03, the
maintainer. Goal 1. Valid while ADF holds nodes, or node positions, this library does not spell.

An unknown ADF node is carried opaquely — raw JSON rides a dedicated syntax in both formats and
restores to a deep-equal node. The round-trip holds for documents newer than the library. So does
a known node no section spells where it stands: a markdown serializer spells a node by type without
checking its position, and refusing loses a document ADF itself keeps in an `unsupportedBlock`. A
`codeBlock` holding a child no fence holds — anything but a text node carrying no marks, `attrs` or
`content` — rides the carry whole.

## The carry fence names the node type

2026-10-03, the maintainer. Goals 1 and 6. Valid while a code fence's info string reads back
verbatim.

The block carry is a code fence whose info string `adf:<type>` names the node's type, its body the
node's JSON without `type`: ```` ```adf:blockCard ````. A type no info string carries back — by the
rule a code language follows — leaves the info string `adf:` and keeps `type` in the body. Every
info string opening `adf:` is reserved, so a `codeBlock` whose language opens so takes the
`language` attribute, and `carry` is an ordinary language. A body holding `type` under a named type,
or a fence whose info string is `adf:` alone while its body's `type` could be spelled in the info
string, is `unsupported-node-shape`. The reservation is the lossless flavour's alone.

## A code block is a fence per text node

2026-10-03, the maintainer. Goal 1. Valid while ADF holds a code block's text in more than one
node.

A `codeBlock` holding several text nodes is the `!adf:codeBlock` container holding one fence per
node, so each node keeps its own text. The fences carry one info string, since ADF holds one
language, and none is empty beside another, since a text node holds text. The grammar:
`spec/flavour.md` §The CommonMark blocks, the `codeBlock` bullet.

## Foreign HTML sorts three ways

2026-08-23, the sort 2026-09-20, the maintainer. Goals 1 and 5. Valid while ADF holds no node
for a bare container, a comment or a script. Lands with `todo.md` item 6.

Every foreign element `htmlToAdf` and the markdown readers read sorts one of three ways, never a
silent drop of content:

- A container around document content that ADF has no node for unwraps to its children, its own
  attributes dropped: `<div align="center">text</div>` keeps `text`, losing the alignment.
- Content ADF cannot hold is an error result naming it. A comment is one: a person wrote those
  words, and neither of Atlassian's schemas holds them — `annotation`'s `inlineComment` carries an
  id, `placeholder` is the editor's own hint, `extension` names a vendor app.
- What is not document content drops whole: `<script>` and `<style>`, their text with them.

`<details><summary>Title</summary>…</details>` is an `expand` titled by its summary, a
`nestedExpand` inside another; an empty one is refused, since `expand` requires content. A `style`
attribute is not read at `0.4.0`: the `textColor` and `backgroundColor` it could reach cost more
than they buy.
The three markdown readers share one parser, so they take the same set.

## Names stay text

2026-08-23, the maintainer. Goal 8. Valid while resolving a name to an id needs I/O.

A bare `@name` or `:smile:` in typed text stays a text node. Only directives produce
mention/emoji/media nodes; resolving names to ids is the consumer's job.

## Directives under `!adf:`

2026-08-23, prefixed `!adf:` 2026-09-16, the maintainer. Goals 5 and 6. Valid while prose does not
write `!adf:`.

Directives are one grammar for everything markdown lacks, namespaced under `!adf:`:
`!adf:panel info` … `!adf:/panel` blocks, `!adf:mention[@Mikael]{id=5b10a2}` inline, `\!adf:` the
one escape. Not CommonMark's generic-directives proposal: its `:::` claims a form prose writes, and
its fence-length discipline ties a container's opener to its own body, where closing from the
opener nests by itself and leaf versus container falls out of the node's content model.

## CommonMark is a subset

2026-08-23, the maintainer. Goal 5. Valid while prose rarely writes the shapes the carve-outs claim.

CommonMark is a subset of the lossless flavour, with carve-outs (`spec/flavour.md`): literal text
shaped like a directive, a pipe table or a `~~` pair is claimed, and so is a code fence whose info
string opens `adf:` (§The carry fence names the node type). `commonMarkToAdf` claims none of the
carve-outs (§Each call names its flavour).

## Tables

2026-08-23, the maintainer. Goal 6. Valid while a pipe table holds only one header row and inline
cells.

One header row plus plain inline cells → pipe table; anything richer → directive form.

## Links

2026-09-13, nesting 2026-09-17, the maintainer. Goals 1 and 6. Valid while CommonMark's link
syntax is what readers edit.

`[text](url "title")`, or `<url>` for a bare autolink-shaped text, wherever CommonMark spells the
mark; `!adf:link[text]{attrs}` where it does not — an attribute CommonMark cannot hold, an `href` or
`title` no canonical escape spells, a paragraph opening whose CommonMark spelling would read as a
link reference definition — and a directive link CommonMark could spell is refused. No link wraps a
link — the bracket form goes literal, the directive form refused — which is CommonMark's prose
where its reference implementation nests one `<a>` in another.

## An image reads as an image only alone in its paragraph, else as its alt text linked; a link text of hard breaks alone reads as its destination, then the breaks

2026-10-04, the maintainer and a writer panel, 3 of 3; `[]()` 2026-10-09, by Goals 4 and 7, as the
maintainer's plan item asked; a link text of hard breaks alone 2026-10-09, the maintainer; an image
inside a link 2026-10-22, a reader panel, 3 of 3 and 5 of 7. Goals 4, 5, 6 and 7. Valid while `mediaInline` carries no URL, ADF holds no empty text node, a hard break
takes no marks and no consumer has reported a link of hard breaks alone.

Every reader reads every CommonMark image and empty link, as `spec/flavour.md` §The CommonMark image
and §Marks spell out. An image alone in its paragraph reads as the image, its title as the caption.
Anywhere else it reads as its alt text linked to its URL, titled by its title. An empty alt text
reads as the URL, and an empty link text as its destination. A link text holding only hard breaks
reads as its destination, then those breaks: four of seven readers expected that over dropping them.
`[]()` reads as nothing: it renders nothing, so Goal 7 loses no content. A link alone in its
paragraph whose whole text is one image reads as that image, with the link marking its `media`.
Inside any other link, the alt text is plain text the link marks, and ` (image)` follows the link,
`image` linked to the image's URL and titled by its title, so Goal 7 keeps both. For a link whose
text is the image alone, the bot, the LLM pipeline and a support agent picked this 3 of 3. For a
link holding words beside the image they split on where `(image)` stands, and four more readers, the
bot, the LLM pipeline, a product manager and an engineer, made it 5 of 7 for after the whole link
over right after the alt text. Every reader rejected linking the alt text to the image: the words
lose the link they were written in.

In `portableMarkdownToAdf`, a `[!WORD]` marker with no `+` or `-` stands apart from the lines after
it, and so does a `+` or `-` callout's title line, so an image alone on the marker line or after the
title reads as the image: a reader panel of the bot, the LLM pipeline and a support agent, 3 of 3
on 2026-10-09, expected the picture in every case, a ticked task included. A task item holds no
image in Atlassian's schema, so the paragraph a task marker opens reads its image as linked alt
text, the fallback two of the three named.

The same panel confirmed the other readings on 2026-10-09: a title as the caption, an image amid
text as linked alt text, and an empty link text as its URL, each 3 of 3; `[]()` as nothing, 5 of 7.
Their CommonMark suite exceptions are `node-model` (§The CommonMark suite checks three ways).

The title's caption, and the reader panel of 2026-10-18 that tested it, are in §An image's title is its
caption when the image stands alone in its paragraph.

## An image's title is its caption when the image stands alone in its paragraph, since a title counts as content

2026-10-18, the maintainer. The 2026-10-09 panel read a title as the caption, 3 of 3, and the
2026-10-11 writer panel read it as hover text, so a reader panel tested the reading again. Seven
readers split: two picked the caption, two the picture alone, and three neither. Those three
described hover text. No output reached the five of seven that settles a panel, so Goal 7 decided:
a title counts as content, so it keeps its words. ADF holds no hover text for an image, so the
caption is the one ADF node that keeps them. Valid while a link's or an image's title counts as
content (`README.md` `## Goals`, Goal 7).

## A mark skips a node that cannot hold it, and a directive mark wrapping only such nodes is refused, as is a `[text](url)` link unless its text is hard breaks alone

2026-10-14, two reader panels of the viewer/editor app, the LLM pipeline and a support agent, 3 of 3
each. Goals 1, 4 and 6. Valid while Atlassian's schema withholds marks from inline nodes. Extended
to code text under this rule, without a panel, 2026-10-14; retitled by the maintainer the same day,
keeping the directive-mark refusal the old title held.

A mark spelling skips a node that takes none of its type, code text included, which takes only
`code`, `link` and `annotation`. So `**Ping !adf:mention[@A]{id=x} now**` reads as bold text around
a plain mention, and ``**`npm ci`**`` as plain code. A directive mark wrapping only nodes that take
none of its type is `unsupported-node-shape` in `losslessMarkdownToAdf`. So is a link whose text
holds something besides hard breaks but no node that takes a link: the panel refused to have
`[!adf:status[Done]{color=green}](/u)` read as `/u` linked beside the status. A link text of hard
breaks alone still reads as its destination, then the breaks (§An image reads as an image only alone
in its paragraph). `adfToLosslessMarkdown` writes a node holding a mark its type does not take as
`!adf:carry`, so the round-trip holds.

## A linked image is written `[![alt](url)](href)`, a captioned image as its directive

2026-10-11, a writer panel of a product manager, an engineer and a support agent, 3 of 3 on each.
Goal 6. Valid while the audience reads a title as hover text.

`adfToLosslessMarkdown` writes a `media` whose only mark is a link as `[![alt](url)](href)`, which
each reader expected before seeing the options. A captioned image keeps the `!adf:caption`
directive: each reader read `![alt](url "title")` as hover text, not a caption. The library's readers
build a title as the image's caption when the image stands alone in its paragraph, since a title
counts as content (§An image's title is its caption when the image stands alone in its paragraph).

## A linked image standing inline in portable markdown, its link to another target, is written `[alt](href) ([image](url))`

2026-10-14, a reader panel of the export tool, the LLM pipeline and a support agent, and a writer
panel of a product manager, an engineer and that support agent, 3 of 3 each. Goals 6 and 7. Valid
while ADF holds no inline external image, so the portable reader reads an image inside a link as
linked text.

Where `adfToPortableMarkdown` writes an external image inline, as in a table cell, and a link to
another target marks it, the link keeps its target and the image follows as a link reading `image`.
With no alt text, the link text is the link's target, which is how the reader reads `[](href)`, so
the rewrite holds. Every seat first wrote `[![alt](url)](href)`, which reads back as linked text
written in another spelling, and so breaks the byte-for-byte rewrite. Each then picked this over
`[alt](url)` and `[alt](href)`, which drop a target.

## Ids stay site-local

2026-08-23, the maintainer. Goal 1. Valid while ADF ids are minted per site.

Identity-bearing nodes carry their ids in attributes; a document is only portable within its site —
accepted.

## Portable task ids come from position

2026-09-26, spelling 2026-09-29, the maintainer. Goals 7 and 8. Valid while a site rejects a task
node with no `localId`.

`portableMarkdownToAdf` gives each `taskList`, `taskItem` and `blockTaskItem` a `localId` in the
editor's UUID v4 shape, hashed from the whole markdown and the node's order among those it mints:
the same markdown reads to the same ids every run, different markdown to different ids. The same
markdown pasted twice into one document repeats its ids: determinism wins over that case.

## A block a task item cannot hold stands after its task list

2026-10-09, a reader panel, 6 of 7. Goals 4, 6 and 7. Valid while Atlassian's schema holds a
`blockTaskItem` to paragraphs and extensions.

In `portableMarkdownToAdf` and `adfToPortableMarkdown`, a task item keeps its paragraphs, then its
nested task lists. The rest of the item stands after the task list. The list resumes at the next
task. The panel of two bots, two LLM pipelines, a support agent, a product manager and an engineer,
shown an image, a code block and a nested bullet list in a task item, picked this over turning those
blocks into text inside the item (1 of 7) and over a plain bullet list keeping the markers as text
(none): every reader wanted the checkboxes, and six wanted the blocks in their own form.

## A callout title keeps its link targets

2026-09-29, the maintainer. Goals 6 and 7. Valid while an expand's `title` is a string.

`portableMarkdownToAdf` writes a link in a folded callout's title as its text and its target in
parentheses: `> [!faq]- See [x](http://y)` reads to the title `See x (http://y)`. A link whose text
is its target, with or without `mailto:`, keeps its text alone: `<http://y>` titles `http://y`,
`<a@b.c>` `a@b.c` — three persona readers agreeing, 2026-09-30.

## The portable flavour's spellings

2026-09-14, panels 2026-09-25 and 2026-09-29, the maintainer. Goals 6 and 7. Valid while GitHub's
renderer is the one the audience's markdown is read in.

README §Portable markdown's rows come from a survey of GitHub, GitLab, Gitea, Obsidian, Pandoc,
MkDocs, Docusaurus, Typora, Joplin, Logseq, Bear, Notion, Azure DevOps and Discord, GitHub's
renderer confirming each shape. Reader panels settled `error` as an error panel, the `==` bounds
(3 of 3) and a Han, Hangul, kana, Thai, Lao, Khmer or Myanmar character on either side bounding a
delimiter, so `は==日本語==で` (3 of 3), `==한국어==에서만` and `iPhone==専用==` (6 of 7) highlight,
the external image's two forms (6 of 7), a rule opening a list item dropping and the omission
notes (3 of 3), and a list's numbering overflowing into bullets (3 of 3).
An omission note reads as the converter's, never as the author's.
Reading takes other tools' spellings, since it reads their output and writes none of them.
Rejected: `~sub~` and `^sup^` (`~2~` is a strike on GitHub, so `subsup` drops), underline and colour
spellings, raw HTML (`<details>`, `<mark>`), MkDocs `!!!` and the `:::` admonition family,
footnotes, definition lists, wikilinks, embeds, tags, comments, TOC tokens, spoilers, task states
past `[x]`/`[ ]`, and lifting bare URLs, `@name`, `:shortcode:` or ISO dates into nodes.

## The portable reader refuses what GFM's reading would drop

2026-10-14, the maintainer; the ruling of Goal 7 over Goal 4, 2026-10-17, the maintainer. Goals 4
and 7. Valid while a refusal is a result and the caller can fix the markdown it sent.

Where GFM's reading of a shape drops content, `portableMarkdownToAdf` refuses the shape. A pipe
table body row holding more cells than its header is `malformed-pipe-table`, where GFM cuts the
extra cells. Cutting the cells breaks Goal 7. Building a table GFM does not, such as a wider one, breaks
Goal 4. A refusal builds no table, but it still breaks Goal 4: a bot gets an error for a row GitHub
renders. Goal 7 is a Maintain goal, holding whatever it costs, so it wins over Goal 4, an Achieve
goal.

## The HTML dialect

2026-08-23, the maintainer. Goals 6 and 8. Valid while HTML output is read by consumers styling it
themselves.

The HTML dialect mirrors the markdown flavour: semantic elements, stable `adf-*` classes, `data-*`
for what HTML cannot express, text always escaped. No stylesheet ships.

## No runtime dependencies

2026-08-23, the maintainer. Goal 8. Valid while ~20 lines of own code, or a vendored table, do each
job a dependency would.

`dependencies` is empty. A runtime dependency enters only through an entry here stating why ~20
lines of own code cannot do the job, who maintains it, and what auditing it costs. So the CommonMark
and HTML parsers are written in this repo.

## Standards ship as data

2026-08-30, the CommonMark suite 2026-09-05 and ADF's schemas 2026-09-13, the maintainer. Goals 1,
5 and 8. Valid while each table is fixed data a dependency would only wrap.

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

2026-09-01, the maintainer. Goal 8. Valid while ES2022 is the floor browsers and servers share.

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

2026-08-23, the maintainer. Goal 8. Valid while the audience's toolchains all import ES modules.

No CommonJS build, no dual-package hazard.

## One built entrypoint

2026-08-23, the maintainer. Goal 8. Valid while Node refuses to type-strip under `node_modules`.

Built JavaScript, `.d.ts` beside it. Do not add a TypeScript-source entrypoint — Node refuses to
type-strip under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), so it cannot serve
an npm consumer.

## Public on npm

2026-08-23, the name 2026-09-01, the maintainer. Goals 2 and 8. Valid while the package's source
stays public beside it.

Published to public npm as `@larvit/adf-codec`. Public source: the GitHub repository, LICENSE in
place. A codec, since it converts both directions, and named for the hub rather than the formats
around it.

## GitHub is canonical

2026-10-04, the maintainer. Goal 3. Valid while developers search GitHub for a library.

`github.com/larvit/adf-codec` owns the history, its issues and its CI, and publishes to npm with the
organization's `NPM_TOKEN` secret. `gitea.larvit.se/larvit/adf-codec` becomes a read-only pull
mirror of it. A move back to Gitea stays possible, and Gitea never holds a commit, issue or pull
request of its own. Until `todo.md` item 72 re-creates it as that mirror, the Gitea copy is stale:
it holds the commits from before the 2026-10-04 history rewrite, its description points at GitHub,
and its issues and Actions are off. Push to GitHub only.

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
  the spelling and the code goes (`unspellable-link`, 2026-09-13; `unspellable-character` and
  `unspellable-line-start`, 2026-10-04). A cause the carry answers gets no code: a mark no
  spelling writes rides the carry with its node.

## Which code a cause takes

2026-08-28, the maintainer; dated below where a rule came later. Goal 1. Valid while a consumer
handles one cause alike whichever node, attribute or direction raised it.

- A code names the cause; where one cause recurs across node types, across one mark's attributes
  or across directions, one code covers them all and `path` and `message` say which —
  `unsupported-nesting-depth` is the 500-level guard whichever direction hits it.
- A claim code names the spelling claimed, never the node that spelling would have built: a
  malformed `!adf:table` is a `malformed-directive`. An alignment colon in `losslessMarkdownToAdf`
  is a `malformed-pipe-table`: the flavour's own delimiter row is `-` runs, so the grammar refuses
  the colon rather than ADF's missing column model doing it. `portableMarkdownToAdf` reads GFM's
  colon and drops the alignment (2026-10-14). What the grammar itself refuses stays a claim code,
  key order among it, and a leaf given a body is refused at its opener, as a container missing its
  closer is (2026-09-16).
- A directive whose name reads back to no node is `unknown-directive-name` rather than a claim code
  — the spelling is well formed, and telling that apart from a typo is what a consumer switches on
  when a later MINOR gives the name meaning. A reserved name is a known name, so never that code,
  and the names the flavour reserves part on form: a form the grammar does not have is a claim code
  — `!adf:carry`, whose carry is the fence — and a well-formed form in the wrong place is
  `unsupported-node-shape`, `!adf:textBreak{}` parting anything but two adjacent text nodes
  CommonMark would read back as one, `!adf:doc` standing beside another block (2026-09-01, the
  text break and `doc` 2026-10-03).
- A well-formed directive the node tables refuse — an attribute a node does not hold or spells
  elsewhere, a value outside its kind or its canonical spelling, an argument, or a body of a shape
  its content model does not take — is `unsupported-node-shape`, the emitter's code for the same
  mismatch read the other way: one code across both directions for good, since the call site
  knows which direction it called and parting them after `0.1.0` is MAJOR (2026-09-23). A line
  ending or a null character in an `emoji`, `mention` or `status` content slot is such a value; the
  emitter carries such a node (2026-10-14).
- A non-finite number takes two codes: `unsupported-node-shape` parsing, `not-an-adf-document`
  emitting — no document holds one, so no round-trip crosses them (2026-09-23).
- A document whose markdown would be longer than V8's longest string is `unsupported-node-shape`
  at the document's path, in either writer, and so is a directive `losslessMarkdownToAdf` reads
  whose CommonMark spelling would be: the document does not convert, and no spelling in the input
  causes the bound (§The code list). A carried node passes it on about 1 MB of deeply nested JSON,
  since the block carry indents two spaces a level; `todo.md` item 107 respells the carry in a
  length linear in its JSON (2026-10-11).
- A conversion the engine stops with a throw of its own, past its longest array, `Map` or `Set`
  or short of memory, is `engine-limit`, at the empty path. A retry may pass the memory case, so
  `unsupported-node-shape`, which no retry passes, cannot hold the class. JavaScriptCore throws the
  same `Out of memory` past its longest string as when its heap runs short. Nothing tells the two
  apart, so both are `engine-limit` (2026-10-13, the maintainer).
- The markdown readers and `htmlToAdf` refuse a value that is not a string as `not-a-string`, at
  position `{ line: 1, offset: 0 }` with an empty path: no existing code reads true of it, and
  `not-an-adf-document` names the emitters' input (2026-10-05).

## `message` and `path`

2026-09-03, the path 2026-09-23, the maintainer. Goals 1 and 5. Valid while a person fixing the
input reads `message`.

- A message names the violation, not the rule alone — a rule by itself states a truth the reader
  must invert before it reads as a failure — and where the flavour's claim refuses ordinary prose
  it names the escape that unclaims the form claimed: `\!adf:` for a directive, block line and
  inline alike, `\|` for every pipe row.
- `not-an-adf-document` carries the document's own path throughout: seven of the guard's nine
  branches read the document's own shape, and threading a path to the other two, which look anywhere
  in the tree — a malformed node, or an object holding itself — wants the manual stack §Nothing
  recurses unbounded forces. The message names the violation instead.

## Publish on a version bump

2026-08-23, converging 2026-09-03, the maintainer. Goal 8. Valid while CI on `main` holds the npm
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

2026-09-16, the maintainer. Goal 8. Valid while a bump on `main` publishes.

Docs on `main` describe the release being built rather than the version npm holds, so they match it
the moment the bump publishes; add no interim note marking the gap.

## Plan items rank by `rank_todo.py`'s goal weights, code health first

2026-10-20, the maintainer, asking that this repo follow `rank_todo.py`'s ranking after it
changed. It serves code health and the order `## Goals` gives its Achieve goals. Valid while
`rank_todo.py` sets the weights.

`rank_todo.py` is the maintainer's ranking script, kept outside this repo. The repo doesn't keep
any weights of its own. The script puts code health first, since every project pursues code health
above each achieve goal its README states. The README's Achieve goals follow in the order `## Goals`
gives them, and by position each weighs 0.97 times the one before. While the comprehension panel's
overall score is under 7.0, or `docs/comprehension-history.md` holds no scoring run, code health
weighs 4 times its position weight.

`todo.md`'s `## Scoring` keeps the formula and the bar, the lowest Score a non-exempt item may have.
Both are the project's to tune: the maintainer confirmed the bar at 0.1 on 2026-10-21.

## Posts announcing a release wait for its publish, and their drafts wait for the finished release

2026-10-21, the maintainer, asking for the choice that best reaches the goals. Serves Goal 3.
A post that goes out before its publish sends readers to a version without what the post describes.
They then open issues saying a call did something else, which Goal 3 counts as a counter-signal.
Drafts describe the finished release, so they wait for every item in it. Valid while a version bump on
`main` publishes (§Publish on a version bump).

## No schema validation

2026-08-23, the mark refusal 2026-08-25, the maintainer. Goal 1. Valid while the site a document
is saved to validates it.

No ADF schema validation or exported validator. A refusal that keeps the round-trip is not schema
validation, so the one a spelled node carrying the same mark type twice earns stays, and input
nesting a spelling inside its own kind (`*(*a*)*`) names that mark once.

## The gate runs on Deno and Bun

2026-09-01, Deno's reason 2026-09-28, the maintainer. Goals 4 and 8. Valid while the library claims
any ES2022 engine.

The gate runs the suite under Deno and Bun as well as Node. Bun runs JavaScriptCore, the one engine
of the three that is not V8, where the Unicode property escapes emphasis matching leans on can
disagree. Deno shares Node's V8 and stays to prove the library runs there too, catching what the
two runtimes leave undocumented. Both refuse a run matching no test, so Node's is the only
vacuous-green guard, and `AGENTS.md` §3's `node:` shims rule is the price of proving those engines
over the corpus rather than over a smoke import.

## The gate installs the tarball

2026-09-03, the maintainer. Goal 8. Valid while consumers install the packed package.

The gate packs the build and installs the tarball under `package-tests/`, so `files`, `exports`
and `types` are proved on the artifact that ships rather than on the source tree a self-reference
would resolve against. `consumer.ts` typechecks the emitted `.d.ts` from outside
`tsconfig.build.json` — declaration emit leaves the `.ts` specifiers
`rewriteRelativeImportExtensions` rewrites in the JavaScript, and this is what says a consumer's
resolver maps them, under `NodeNext` alone; a `.d.ts` reader that is not `tsc` stays unproven.
`node-floor.js` round-trips the installed package under a Node pinned to `engines.node`'s floor.

## Firefox reads the build

2026-09-04, the maintainer. Goal 8. Valid while the library claims a browser and no other leg runs
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

2026-09-20, the maintainer; the import boundaries, 2026-10-22, the maintainer. KISS, a technical
principle. Valid while no measure picks out what readers find hard better than a function's length.

`.oxlintrc.json` holds one size rule. It also holds the import boundaries §The source parts by ADF
and format draws. The size rule, over the files `tsconfig.build.json` builds, is a per-function line
ceiling, set at that set's worst and moving only downward. It covers the built files alone, since
one ceiling over the tests too would have to be their worst, loosening the guard over the shipped
code. It guards against drift and never drives a refactor, so no cyclomatic rule and no second size
rule join it: neither measure picked out what nine readers found hard (the comprehension panel,
2026-09-20). `oxlint` measures it since TypeScript 7 is a native compiler publishing no in-process
parser, only the `unstable/` AST surface an out-of-process handshake reaches. Three switches guard
a silent green: `IIFEs: true`, since oxlint exempts an IIFE otherwise; an explicit `-c`, so a
config gone missing fails the leg instead of falling back to oxlint's own defaults; and
`--deny-warnings`, since a rule from a category this config never names arrives as a warning it
exits 0 on.

## The project ships under the comprehension floor until item 95 lands

2026-10-03, the maintainer; item 95 in place of item 61, 2026-10-09, the maintainer; item 62
landed 2026-10-22. KISS, a technical principle, and its comprehension floor of 7.
Valid while `todo.md` item 95 is open.

A four-seat comprehension panel scored the project under the floor of 7. Its scoring run of
2026-10-08 is the baseline.

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Mid | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Senior | 7 | 5.5 | 6 | 5 | 6 |
| Architect | 6.5 | 6 | 6 | 6.5 | 6 |
| Mean | 6.88 | 5.63 | 6.25 | 5.63 | 6.00 |

Panels on near-identical code scored overall means of 5.75 to 6.00, and a seat moves ±0.5 between
runs. The maintainer shipped under a fall twice after three rounds: the move to GitHub, 2026-10-04,
whose chunk changed only comments in `src/`; and item 78, 2026-10-07, whose three runs fell below
the run before it on Navigation, Locality and Shape while the overall held. Item 94, 2026-10-10,
also shipped after three rounds: a definitions-only paragraph leaves no block, so ending the list it
follows takes state carried across lines, and every design read worse on Locality while the overall
held; the scores at 6182ba6 were Junior 5.5, Mid 5.5, Senior 6 and Architect 5.5, mean 5.63. Item
56, still open, is to give that state one owner. Items 85 and 86, 2026-10-11, shipped after three
rounds under a fall the seats laid on item 93's `splitPath` and `splitPlace`, which placed a refused
block's path by replaying `splitTaskList` on stand-in nodes until item 102, 2026-10-22, removed them; both seats read the chunk's own image
builder as a gain. The scores at be23835 were Junior 6.5, Mid 6, Senior 6 and Architect 6, mean
6.13. Item 106, 2026-10-13, shipped
after three rounds under a worse ruling, the maintainer's call: both paired seats read the overall
as the same, but Locality fell to a mean of 5.13, laid on the spelling memo the chunk splits between
the CommonMark ask, which fills it, and the walk, which drops each entry as it reads it. The overall
scores at 1f4551a were Junior 5.5, Mid 5.5, Senior 6 and Architect 5.5, mean 5.63.

## Properties on a fixed seed

2026-09-14, the maintainer. Goal 1. Valid while a red gate must reproduce.

Beside the corpus, properties run over documents generated from the node tables and over generated
markdown, on a fixed seed in the gate; a counterexample found becomes a round-trip fixture.

## The CommonMark suite checks three ways

2026-08-27, against `commonMarkToAdf` 2026-10-09, the maintainer. Goals 1 and 4. Valid while the
suite's answers are HTML ADF cannot be compared against.

Each example is a named error or markdown `commonMarkToAdf` reads to a document that
`adfToLosslessMarkdown` writes and `losslessMarkdownToAdf` reads back deep-equal, since CommonMark
has no writer of its own. The example's reference HTML's text, tags stripped and entities decoded,
equals the parsed document's; and its elements count the marks and nodes they map to. The fixpoint alone
passes a parser returning the empty document, the text alone one dropping every emphasis. An
exception is the maintainer's to add, and valid CommonMark parsing to a document
`adfToLosslessMarkdown` refuses is a bug to fix, never an exception. Kind `node-model` (2026-10-09,
the maintainer) is a permanent divergence where ADF holds no node for what CommonMark renders.

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
`stage-0.json` (§Standards ship as data) hold between them, and so do the mark types each inline
node takes. Value sets stay documentation, since any value round-trips. What the schema holds and the tables do not spell is pinned by name — an
attribute as a gap, a type as carried — so a re-pin adding either goes red until someone spells it
or pins it.

## Markdown past V8's longest string is refused on every engine

2026-10-11, the maintainer. Goals 1 and 6. Valid while V8's longest string, 2^29 − 24 characters,
is the shortest of the engines the library claims.

Every writer, and `losslessMarkdownToAdf`'s `commonMarkSpelling` ask, refuses markdown longer than
2^29 − 24 characters (`longestMarkdown`), so the same document converts alike everywhere. A writer
first refuses a document whose text alone passes the bound: the lossless writer spells every
character of it, and the portable reduction refuses on the caller's text, edge whitespace and all,
since merging that text first could build past the bound. Each block, the writer's result and the
CommonMark ask's spelling are held to the bound as they are built. V8 throws building the same
string past the bound, SpiderMonkey past its own longest string, and `withinEngineLimits` refuses
both throws as the same `tooLong`, so every engine stops at the same block with the same answer. The
carry's two-space JSON, which indents every value its depth over, stops at the bound unbuilt
(`joinedWithin`).

JavaScriptCore builds a joined block up to its own longest string, 2^31 − 1, before the check. Past
that, JavaScriptCore throws `Out of memory`, which is `engine-limit` (§Which code a cause takes).

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

## JSON text is read by `parseJsonText`

2026-10-08, a remedy the maintainer planned. Goal 1. Valid while a V8 engine with
https://issues.chromium.org/issues/521080746 unfixed can run the library.

The library reads JSON text with `parseJsonText`, never `JSON.parse`: from V8 13.6, `JSON.parse`
can read an escaped key as another key it read before, and the round-trip then refuses its own
output. A test fails on `JSON.parse(` in a shipped file. The tests' own oracles keep `JSON.parse`,
since a misread there fails the gate and never hides a bug.

## No value `JSON.parse` or `structuredClone` builds loops a call

2026-10-04, the maintainer. Goals 1 and 9. Valid until `todo.md` item 77 lands.

The guards walk a value by `Object.values` and refuse a cycle in it. An inherited or non-enumerable
key, a getter, a Proxy or a custom iterator is the caller's to rule out: no persona builds one. Goal
9's size counts ADF as JSON, so a shared object costs once per place it is held.

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

2026-08-30, the kept scan 2026-09-18, the maintainer. Goal 9. Valid while the pipeline persona
feeds documents nobody typed.

A reader takes the text and an index — a sticky regex whose `lastIndex` the caller sets on the line
before it reads, `indexOf` — never a fresh slice per character, and a per-character walk hoists the
scan that does not vary with the character: a megabyte through a quadratic walk is a minute rather
than a millisecond. A scan may keep what it read for a later walk of the same text, and the
fallback where it kept nothing must be the same reader over the same text at the same index, so the
two cannot disagree — which is what makes the kept value a memo rather than a second spelling.

## The spelling memo

2026-09-19, the maintainer. Goal 9. Valid while the `commonMarkSpelling` ask spells a node once
per level above it otherwise.

When the parse or the portable reduction asks `commonMarkSpelling` about a node, the node's readable
spelling goes into a memo, so the ask stops spelling a node once per level above it. Reading an
entry drops it, and no entry is kept for the nodes below the asked one: the walk above spells those
nodes into its own text, so keeping them would make every level of a deep subtree hold the subtree's
whole text (2026-10-11). `text`, `alternateText` and `spelling` carry no depth and `headroom` is
affine in it, so a read at or above the depth that filled the entry rebases; a read below re-spells,
because a hit skips the depth guards the walk it replaces runs and an ordered list past the marker
cap gives way, spending two emitter levels where the parser spent one. A refusal is never kept,
so no path minted at another position is ever read.

## Cost fixes are measured, never timed

2026-09-18, the maintainer and the stability-reviewer. Goal 9. Valid while Goal 9 promises growth
rather than a figure.

A cost fix that changes no behaviour lands on the suite staying green with no fixture output
changed, and a before-and-after figure in its PR; the gate times nothing. Measured and kept:
`adfDocumentFault`'s shape and depth walks stay two — the parting gives depth its own code — at
52 ms for a 9 MB document the emit takes 314 ms over. The 500-level guard runs after the block walk,
so it doesn't bound the walk's cost.

## Only the hard break holds a raw newline

2026-08-26, the maintainer. Goal 1. Valid while the whitespace carry finds a line edge by its raw
newline.

Only the hard break's inline segment holds a raw newline — every other spelling escapes one or
refuses it — which is how the whitespace carry finds a line edge.

## Emphasis follows CommonMark's matching

2026-08-27, the maintainer. Goals 1 and 4. Valid while CommonMark's emphasis rules are the
reader's.

Emphasis is spelled against CommonMark's matching, never flanking alone: a delimiter run in text
escapes wherever CommonMark could open or close with it, leaving the emitter's own delimiters the
only ones in play, and a pair that matching hands to another delimiter rides the carry instead.

## Readable spellings take the `try` prefix

2026-09-21, the maintainer. Goals 1 and 6. Valid while a readable spelling's refusal would cost a
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

2026-08-27, placement 2026-09-18, `adf/`'s bar 2026-09-21, `plain/` 2026-10-03, the import
boundaries' lint 2026-10-22, the maintainer; `parse/` and `emit/` free of `portable/`,
2026-10-22. Goal 2. Valid while each format has a reader and a writer through ADF.

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

A flavour's own code, both directions included, sits in its own directory: `markdown/portable/`. The
portable reader and writer hand `parse/` and `emit/` their own block readers and writers
(`FlavourBlockReaders`, `FlavourBlockWriters`), so neither imports `portable/`. Syntax that `parse/`
and `emit/` read under a `flavourClaims` claim, such as `==`, sits outside `portable/`. The
directive grammar, both directions included, sits in `markdown/directive/`, which imports neither
`emit/` nor `parse/`. Otherwise each format directory parts into `emit/` (ADF→format) and `parse/`
(format→ADF), the rest of it holding what both directions read. A construct's reader lives there
beside the regex the emitter escapes against, so the two cannot drift; a reader with no emit
counterpart goes in `parse/`, unless it is part of a construct that side already holds — a grammar
stays in one file rather than splitting across the seam. A rule both directions must answer alike —
whether a list marker interrupts a paragraph — is one function there too, never a copy per
direction, however conservative the copy would be. Where the rule is the emitter's own choice, input
consults it rather than restating it, so no fixture the emitter writes can be refused, and a
spelling the emitter refuses gives its own error rather than a second name for it. That consulting
is the only import `parse/` takes from `emit/`, through `emit/spelling-questions.ts`.

`.oxlintrc.json` enforces that limit for `markdown/parse/`, keeps `parse/` and `emit/` from
importing `markdown/portable/`, and keeps `markdown/directive/` from importing `emit/` or `parse/`,
as `no-restricted-imports` overrides. They are lint rules because the technical principles refuse a
test that scans the source, and a lint rule reads every import spelling: `from`, a bare `import`,
double quotes and a dynamic `import()`.

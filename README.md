# @larvit/adf-codec

Lossless conversion between **Atlassian Document Format** (ADF), an extended markdown flavour, and
an HTML dialect.

**Status: published — the markdown round-trip (`adfToMarkdown`, `markdownToAdf`); HTML at
`0.2.0`.**
Plan: `todo.md`. Decisions:
[`docs/decisions.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/docs/decisions.md). Changes:
[`CHANGELOG.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/CHANGELOG.md). The lossless flavour's grammar:
[`spec/flavour.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/spec/flavour.md).
Upgrading from `0.1.0`: [convert your markdown first](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/MIGRATION.md).

## What it is for

Atlassian Cloud REST APIs hand out rich text — issue descriptions, comments, pages — as ADF, a
ProseMirror-shaped JSON tree, and take it back the same way. No Atlassian endpoint converts it
(`pf-editor-service/convert` is decommissioned,
[JRACLOUD-77436](https://jira.atlassian.com/browse/JRACLOUD-77436) open), and the npm ecosystem is
one-directional and lossy. A consumer that shows a document and lets someone edit it needs both
directions lossless — otherwise saving destroys the panels, mentions and attachments it could not
represent.

## Goals

The most useful ADF conversion library available, by these goals in priority order:

1. **Lossless, and every call returns a result, never a throw.**
2. **ADF is the hub.**
3. **Each format reads and writes as its standard says.**
4. **Our markdown is CommonMark, extended only where CommonMark has no spelling.**
5. **No surprises: output reads and edits the way its audience expects.**
6. **Lossy conversion drops form, never content.**
7. **Runs in any JavaScript engine, with nothing to install, configure or connect.**
8. **Fast, and linear in the document's size.**
9. **Easy to find, and clear at a glance what it does.**

## Audience

Application developers embedding the library, in four personas. All four rely on the guarantees
below and on `code` being a closed list; none may rely on an error message's wording, which is
free text.

- **Viewer/editor app** — shows a document, lets a human edit, posts it back. Relies on the
  round-trip holding for whatever the site's editor wrote, unknown node types included, and on a
  refusal arriving before the save rather than after.
- **Bot posting content** — turns generated markdown into ADF. Relies on plain CommonMark being
  valid input, so nothing upstream has to learn a flavour.
- **Export/indexing tool** — converts ADF to markdown or HTML in bulk. Relies on readable output
  and on every refusal being deterministic, so a document that fails fails the same way next run.
- **LLM/agent pipeline** — hands documents to a model as markdown and writes the edits back.
  Relies on the round-trip and on markdown a reader half-knowing the lossless flavour can still edit.

## The shape

```sh
npm install @larvit/adf-codec
```

```ts
import { markdownToAdf } from '@larvit/adf-codec'

const result = markdownToAdf('# Release notes\n\n!adf:panel info\nShipped on Tuesday.\n!adf:/panel\n')
if (result.ok) {
  send(result.value)
} else {
  const { code, message, path, position } = result.error
  console.error(`${code} at line ${position.line}, ${path.map((step) => '/' + step).join('')}: ${message}`)
}
```

Serves Goals 1, 2 and 7. Pure functions, each taking a whole document and returning a whole
result; no I/O, no configuration. Every conversion goes through ADF, so `markdownToHtml` keeps
exactly what ADF holds.

```ts
adfToMarkdown(doc: AdfDocument): Result<string>
markdownToAdf(markdown: string): Result<AdfDocument, ParseError>
isAdfDocument(v: unknown): v is AdfDocument

adfToPlainMarkdown(doc: AdfDocument): Result<string>
plainMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError>

adfToHtml(doc: AdfDocument): Result<string>               // 0.2.0
htmlToAdf(html: string): Result<AdfDocument, ParseError>  // 0.2.0
markdownToHtml(markdown: string): Result<string>          // 0.2.0, via ADF
htmlToMarkdown(html: string): Result<string>              // 0.2.0, via ADF
```

`Result<T>` is `{ ok: true; value: T } | { ok: false; error: ConvertError }` — nothing throws.

## Plain markdown

Serves Goal 6. Plain markdown is a second flavour of the same grammar. `adfToPlainMarkdown` writes
markdown other tools render — GitHub, GitLab, Obsidian and the like — keeping the content and
dropping the rest: attributes, colours, layout, identity. Content is what a reader of the rendered
document sees or follows: its text, images and link targets. It refuses only
`not-an-adf-document`, `unsupported-document-version` and `unsupported-nesting-depth`, and writes
no directive.

`plainMarkdownToAdf` reads what `markdownToAdf` reads and refuses what it refuses, and reads the
conventions below as nodes, taking other tools' spellings too; a backslash keeps a marker as text:
`\==x==`, `> \[!NOTE]`, `- \[x]`. Markdown `adfToPlainMarkdown` wrote reads back and writes again
byte for byte; the document it came from does not come back.

To edit a document and save it back, use `adfToMarkdown` and `markdownToAdf`: saving what this pair
read replaces mentions, attachments and macros with text.

| ADF | Written | Read back |
| --- | --- | --- |
| `panel` | a GitHub alert, `> [!WARNING]`: info `NOTE`, note `IMPORTANT`, tip and success `TIP`, warning `WARNING`, error `CAUTION`, custom `NOTE` | `NOTE` info, `IMPORTANT` note, `TIP` tip, `WARNING` warning, `CAUTION` error, and Obsidian's: hint tip; success, check, done success; attention warning; danger, failure, fail, missing, bug, error error; any other word info — in any case; the rest of the marker's line is the first paragraph |
| `expand`, `nestedExpand` | Obsidian's folded callout, `> [!NOTE]- Title` | `-` or `+` after any word, the rest of the marker's line the title; a link reads `text (target)`, or its text alone where the text is the target with or without `mailto:`; an expand inside an expand is a `nestedExpand` |
| `taskList` | `- [x] Done`, `- [ ] Todo` | a bullet list whose every item is so marked, `[X]` too |
| `backgroundColor` | `==text==` | `==text==` on one line, the text touching both delimiters, bounded outside by whitespace, punctuation or a line edge, or touching a Han, Hangul, Hiragana, Katakana, Thai, Lao, Khmer or Myanmar character on either side, in the editor's default highlight `#f8e6a0` |
| `table` | a pipe table: the first row its header, a cell's blocks on one line, a span kept under its header by empty cells | — |
| `decisionList` | a bullet list | — |
| `mention`, `status`, `emoji`, `date` | their text: `@` kept, a mention with none `@` and its id, an emoji its `shortName` without, a date `2026-09-13` in UTC | — |
| `inlineCard`, `blockCard`, `embedCard` | a link to the card's URL, else its name | — |
| external `media` | `![alt](url)` in a block, `[alt](url)` inline | — |
| stored `media`, `mediaInline`, `extension`, `inlineExtension` | their `alt` or `text` | — |
| `layoutSection`, `bodiedExtension`, `bodiedSyncBlock`, `multiBodiedExtension`, `extensionFrame`, `caption`, a node this version does not know | its blocks or its text | — |
| `placeholder` | nothing | — |

- Content the document only references, with no text of its own to keep, leaves an italic note
  naming it where it stood: `_(image not included)_` for stored media with no `alt`,
  `_(link card not included)_` for a card with neither URL nor name, an extension with no `text`
  its key, `_(jira-issues-table not included)_`, or `_(extension not included)_` without one, and
  `_(synced block not included)_` for a `syncBlock`.
- `backgroundColor`, `code`, `em`, `link`, `strike` and `strong` stay; every other mark drops,
  keeping its text, and so does a mark the flavour cannot spell where it stands.
- A newline in text is a hard break and in an expand's title a space, edge whitespace outside a
  link or code span is trimmed, carriage returns and null characters are removed, and an empty
  paragraph drops.
- An ordered list numbered past `999999999`, or adjacent ordered lists whose numbering does not
  continue, is one bullet list keeping its numbers as text.
- A task list beside a bullet or decision list, or holding a block other than a task, joins one
  bullet list keeping its states as text: `- \[x] Done`.
- Text that would read as a marker takes a backslash: `==` wherever it could open or close a
  highlight, `[!…]` opening a quote, and `[x]` or `[ ]` opening any list item, since GitHub reads
  that marker per item.
- A node read back carries no `localId` except a `taskList`, `taskItem` or `blockTaskItem`, which
  Atlassian's schema requires one on: each gets a UUID v4 hashed from the whole markdown and its
  position, the same on every read. Join markdown bound for one document and read it once: the same
  markdown read twice into one document repeats its ids.

## The errors

Serves Goal 1. An ADF node type this version does not know is not an error: the lossless pair
carries it opaquely and restores it unchanged ([`docs/decisions.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/docs/decisions.md#unknown-nodes-ride-the-carry)).

`ConvertError` is `{ code, message, path, position? }`. `code` is the exported `ConvertErrorCode`,
stable across minors and safe to `switch` on exhaustively with no `default`; `message` is free text
and may change in any release. A parse always names a position, so `markdownToAdf` returns
`ParseError` and its `position` reads without a guard; an emit reads no source and carries `path`
alone; one handler typed on `ConvertError` takes both, which is what the composed `markdownToHtml`
and `htmlToMarkdown` hand back. `path` is the node's place from the document root, alternating
`'content'` and an index, so `path.map((step) => '/' + step).join('')` is a JSON Pointer at the
node — the empty path being the document itself.

A call reports the first refusal in document order and stops, so a document with several surfaces
them one per call. Every refusal is deterministic — there is no I/O anywhere — so a retry returns
the identical error: fix the input, or set the document aside.

`position` is `{ line, offset }` into the string passed in: `line` counted from 1, `offset` a
UTF-16 code unit, a JavaScript string index rather than a codepoint or a byte offset. It points at
or before the refusal — currently the start of the line the enclosing block begins on; a later
minor may narrow that, never widen it.

Parsing — `markdownToAdf` and `plainMarkdownToAdf`, and `htmlToAdf` at `0.2.0`:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `malformed-directive` | an `!adf:` the grammar cannot read — a prefix completing no directive, an unclosed container, `[content]` or `{attrs}`, a closer with no container of its name open, a leaf given a body, `{attrs}` out of order or duplicated, invalid JSON in a `carry` | write the spelling the message names, or escape the prefix — `\!adf:`, block and inline alike — to keep it literal text |
| `malformed-pipe-table` | a pipe row that is no pipe table — a missing or ragged `---` delimiter row, an alignment colon in it, or a row not opening with a pipe | open every row with a pipe and give the delimiter row the header's cell count; to keep the lines literal text instead, escape the leading pipe of every one — escaping a single row leaves the next to open a fresh table and fail the same way |
| `unknown-directive-name` | a directive whose name is no node or mark this version spells | check the name in `spec/flavour.md`, or escape the prefix as `\!adf:`; the spelling itself is well formed, so a later minor may give the name meaning |
| `unmappable-html` | the input holds an HTML construct the documented element set does not map, a comment and a processing instruction among them — at this version that is every raw HTML construct in markdown, the element set landing at `0.2.0` | remove the construct, or write what it holds in the lossless flavour |
| `unmappable-image` | an image sits inside other content that is not another image's description, or carries a title | give the image a paragraph of its own and drop the title |

Emitting — `adfToMarkdown`, and `adfToHtml` at `0.2.0`:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `not-an-adf-document` | the value handed in is no ADF document — a missing or wrong `type`, a stray key, a node that is not a node | guard the boundary you receive JSON at with `isAdfDocument`; the message names the branch that refused |
| `unsupported-document-version` | the document's `version` is not 1 | keep the ADF and pass the document over, or show it read-only; the version is the site's, not yours to change |

Either direction. The emitter's own refusals are in this group — a parse reaches them by asking it
which CommonMark spelling a node takes — so the two rows above are not the measure of how often an
emit refuses:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `unspellable-character` | text or a code block holds a carriage return or a null character, which CommonMark rewrites wherever it sits | strip or replace the character; no escape carries it through the round-trip |
| `unspellable-line-start` | a paragraph line begins with a code span whose backticks would read back as a code fence | put any text before the code span |
| `unspellable-whitespace` | an `emoji`, `mention` or `status` holds a newline in the text its inline directive spells in the content slot | replace it with a space — an inline directive never spans lines |
| `unsupported-nesting-depth` | blocks, marks, an attribute's JSON or a carried node's JSON nest past 500 levels | keep the ADF and pass the document over, or show it read-only; flatten the input where you are the one who wrote it |
| `unsupported-node-shape` | a node carries an attribute, value, argument or body its type does not take, or lacks one it needs — or markdown writes as a directive a node or mark the lossless flavour spells as CommonMark | write the shape the message names; `spec/flavour.md` lists every type's attributes and body |

## The guarantees

Serves Goals 1, 3 and 4.

- `markdownToAdf(adfToMarkdown(doc))` equals `doc` — unknown node types included, carried opaquely
  ([`docs/decisions.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/docs/decisions.md#unknown-nodes-ride-the-carry)).
- Markdown means what the CommonMark spec says — and, at `0.2.0`, well-formed HTML what the HTML
  standard parses — both in what this library reads and in what a conforming parser reads back
  from its output; the bullets below name every exception.
- Plain CommonMark is valid input to `markdownToAdf` apart from the raw HTML `unmappable-html`
  names, with three carve-outs — literal text matching directive, pipe-table or strikethrough
  syntax is claimed (escapable — `spec/flavour.md`) — and one gap: a CommonMark image fits only as
  its own title-less paragraph; mid-text and titled images are error results, save an image inside
  another's description, which flattens into the alt text. Converting back yields the library's
  canonical spelling, which round-trips byte-identically — where it converts back at all: a parse
  succeeding is no promise of that, so keep the source until the way back succeeds.
  ``` ` `` ` ``` reads cleanly and then refuses.
- Four CommonMark spellings parse without an error and build a document the reference
  implementation renders differently: `[](/url)` and `[]()` stay literal text against CommonMark's
  empty link, a list continuing past a marker change stays one list against CommonMark's two, a
  shortcut reference matching its definition only under Unicode case folding stays unresolved, and
  a link whose text holds an autolink keeps the inner link and leaves the outer brackets literal
  text, which the spec requires and the reference itself breaks, nesting one `<a>` in the other.
  The first three are pinned `pending` in `corpus/commonmark-spec/exceptions.json`; the suite
  holds no example of the fourth.
- Not every document converts back: `adfToMarkdown` is partial on valid ADF — a text node holding
  a carriage return, or a paragraph line beginning with a code span whose backticks read back as a
  fence. Show the refusal and keep the document read-only; saving markdown you could not produce
  is the loss the round-trip exists to stop.
- The pipe table narrows GFM's twice: every row opens with a pipe, so GFM's bare form is an error
  result rather than the prose it reads as, and an alignment colon in the delimiter row is an
  error too — ADF holds no column alignment. The trailing pipe is canonical output, optional in
  input.
- Past that and `~~`, no GFM: an autolink literal and a `- [ ]` marker stay text, and a checklist
  is the `taskList` directive — `plainMarkdownToAdf` turns the marker into a `taskList`.
- A document nested deeper than 500 levels is an error result, not a stack overflow, and no input
  makes a call loop forever.
- The emitted formats are semver surface
  ([`docs/decisions.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/docs/decisions.md#the-formats-are-api)).
- **`0.2.0`** — `htmlToAdf(adfToHtml(doc))` equals `doc`; fidelity HTML cannot express rides
  `data-*` attributes. Foreign HTML maps a documented element set, which markdown's raw HTML reads
  through as well, and a construct outside it is an error; well-formed HTML only — no tag-soup
  recovery.

## The package

Serves Goal 7. ESM only, no runtime dependencies, public npm. Built JavaScript with `.d.ts`
beside it. Pure ECMAScript at an ES2022 baseline, reaching for no host API; the test suite runs under Node,
Deno and Bun, and a headless Firefox converts the corpus through the built entrypoint.
Contract: [`docs/decisions.md`](https://gitea.larvit.se/larvit/adf-codec/src/branch/main/docs/decisions.md#any-es2022-engine), §Any
ES2022 engine to §Public on npm.

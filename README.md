# @larvit/adf-codec — ADF to markdown, markdown to ADF

[![npm](https://img.shields.io/npm/v/@larvit/adf-codec)](https://www.npmjs.com/package/@larvit/adf-codec)
[![CI](https://github.com/larvit/adf-codec/actions/workflows/ci.yml/badge.svg)](https://github.com/larvit/adf-codec/actions/workflows/ci.yml)

Convert Atlassian Document Format (ADF), the rich text of Jira and Confluence, to and from markdown, with a lossless round-trip.

For application developers whose app shows, edits, exports or generates the rich text Atlassian
products store as ADF.

- **Lossless round-trip:** `adfToLosslessMarkdown` and `losslessMarkdownToAdf` give back the
  document they started from — panels, mentions, statuses and node types this version does not know
  included.
- **Markdown in:** `portableMarkdownToAdf` reads a bot's or a model's markdown, including `~~` and
  pipe tables whose every row opens with a pipe and whose delimiter row holds no alignment colon.
  `commonMarkToAdf` reads strict CommonMark as its
  spec says: nothing becomes a table, task or panel.
- **Portable markdown out, lossy:** `adfToPortableMarkdown` writes the markdown that GitHub, GitLab
  and Obsidian render — GitHub Flavored Markdown's alerts, task lists and pipe tables, Obsidian
  Flavored Markdown's callouts and highlights. It keeps the text, images by URL and link targets and
  drops the rest.
- **No throws:** every call returns a result; a refusal carries a code from a closed list.
- **Runs anywhere:** pure functions with no runtime dependencies, in Node, Deno, Bun and browsers.
  TypeScript types ship beside the JavaScript.

## Install

```sh
npm install @larvit/adf-codec
```

ESM only, Node 18 or later ([The package](#the-package)). Upgrading from `0.1.0`:
[MIGRATION.md](https://github.com/larvit/adf-codec/blob/main/MIGRATION.md).

## Quick start

### ADF to markdown

Full reference: [The calls](#the-calls), [The lossless flavour](#the-lossless-flavour) and
[Portable markdown](#portable-markdown).

```ts
import { adfToLosslessMarkdown, adfToPortableMarkdown, type AdfDocument } from '@larvit/adf-codec'

const doc: AdfDocument = {
  content: [
    {
      attrs: { panelType: 'warning' },
      content: [{ content: [{ text: 'Check the collation before importing.', type: 'text' }], type: 'paragraph' }],
      type: 'panel',
    },
  ],
  type: 'doc',
  version: 1,
}

const lossless = adfToLosslessMarkdown(doc)
if (lossless.ok) console.log(lossless.value)
// !adf:panel warning
// Check the collation before importing.
// !adf:/panel

const portable = adfToPortableMarkdown(doc)
if (portable.ok) console.log(portable.value)
// > [!WARNING]
// >
// > Check the collation before importing.
```

### Markdown to ADF

Full reference: [The calls](#the-calls) and [Portable markdown](#portable-markdown).

```ts
import { portableMarkdownToAdf } from '@larvit/adf-codec'

const result = portableMarkdownToAdf('# Release notes\n\nRead the _manual_ before **wiring**.\n')
if (result.ok) {
  // result.value deep-equals:
  // {
  //   content: [
  //     { attrs: { level: 1 }, content: [{ text: 'Release notes', type: 'text' }], type: 'heading' },
  //     {
  //       content: [
  //         { text: 'Read the ', type: 'text' },
  //         { marks: [{ type: 'em' }], text: 'manual', type: 'text' },
  //         { text: ' before ', type: 'text' },
  //         { marks: [{ type: 'strong' }], text: 'wiring', type: 'text' },
  //         { text: '.', type: 'text' },
  //       ],
  //       type: 'paragraph',
  //     },
  //   ],
  //   type: 'doc',
  //   version: 1,
  // }
}
```

`portableMarkdownToAdf` also reads `> [!NOTE]` alerts, `- [x]` tasks, `==highlights==` and pipe
tables as nodes. For markdown that `adfToLosslessMarkdown` wrote, use `losslessMarkdownToAdf`. For
markdown known to be strict CommonMark, use `commonMarkToAdf`.

### The lossless round-trip

Full reference: [The guarantees](#the-guarantees).

```ts
import { adfToLosslessMarkdown, losslessMarkdownToAdf } from '@larvit/adf-codec'

const markdown = adfToLosslessMarkdown(doc)
if (!markdown.ok) {
  showReadOnly(doc, markdown.error) // saving markdown you could not produce would lose content
} else {
  const edited = await editInYourApp(markdown.value) // a human, a model, a template
  const saved = losslessMarkdownToAdf(edited)
  if (saved.ok) post(saved.value)
  else showError(saved.error) // the edit broke the markdown: the error names line and node
}
```

Unedited, the markdown reads back to a document that deep-equals `doc`, node types this version
does not know included.

### Handle a result's error

Full reference: [The errors](#the-errors).

```ts
import { losslessMarkdownToAdf } from '@larvit/adf-codec'

const result = losslessMarkdownToAdf('Part | Qty\n--- | ---\nBolt M8 | 40\n')
if (!result.ok) {
  const { code, message, path, position } = result.error
  // code: 'malformed-pipe-table' — the rows open with no pipe
  // position: { line: 1, offset: 0 }
  // path: ['content', 0]
  console.error(`${code} at line ${position.line}, ${path.map((step) => '/' + step).join('')}: ${message}`)
}
```

Nothing throws. `code` is from a closed list, so a `switch` with no `default` covers every case;
`message` is free text for a person fixing the input.

## Contents

- [Goals](#goals)
- [Audience](#audience)
- [The calls](#the-calls)
- [The lossless flavour](#the-lossless-flavour)
- [Portable markdown](#portable-markdown)
- [The errors](#the-errors)
- [The guarantees](#the-guarantees)
- [The package](#the-package)
- [Everything exported](#everything-exported)
- [Links](#links)

## Goals

The most useful ADF conversion library available, judged by these goals, in priority order:

1. **Lossless, and every call returns a result, never a throw.**
2. **ADF is the hub.**
3. **Easy to find, and clear at a glance what it does.**
4. **Each format reads and writes as its standard says.**
5. **Our markdown is CommonMark, extended only where CommonMark has no spelling.**
6. **No surprises: output reads and edits the way its audience expects.**
   1. **A function's name says which markdown it reads or writes.**
7. **Lossy conversion drops form, never content.**
8. **Runs in any JavaScript engine, with no runtime dependencies and nothing to configure or connect.**
9. **Fast, and linear in the document's size as JSON.**

## Audience

Application developers embedding the library, in four personas. All four rely on the guarantees
below and on an error's `code` being a closed list; none may rely on an error message's wording,
which is free text.

- **Viewer/editor app** — shows a document, lets a human edit, posts it back. Relies on the
  round-trip holding for whatever the site's editor wrote, unknown node types included, and on a
  refusal arriving before the save rather than after.
- **Bot posting content** — turns generated markdown into ADF. Relies on CommonMark being valid
  input, so nothing upstream has to learn a flavour.
- **Export/indexing tool** — converts ADF to markdown or HTML in bulk. Relies on readable output
  and on every refusal being deterministic, so a document that fails fails the same way next run.
- **LLM/agent pipeline** — hands documents to a model as markdown and writes the edits back.
  Relies on the round-trip and on markdown a reader half-knowing the lossless flavour can still edit.

Behind those apps, the people who read and write the markdown, and later the HTML: product
managers, engineers and support agents working in Atlassian products through a plugin or another
UI. They know markdown and not ADF, and rely on every spelling saying what it means to them.

## The calls

Serves [Goals](#goals) 1, 2 and 8. Pure functions, each taking a whole document and returning a
whole result; no I/O, no configuration.

```ts
adfToLosslessMarkdown(doc: AdfDocument): Result<string>
losslessMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError>
isAdfDocument(v: unknown): v is AdfDocument

commonMarkToAdf(markdown: string): Result<AdfDocument, ParseError>

adfToPortableMarkdown(doc: AdfDocument): Result<string>
portableMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError>
```

Each call's name says which markdown it reads or writes:

| Call | Markdown | Refuses with |
| --- | --- | --- |
| `adfToLosslessMarkdown` | writes the lossless flavour: CommonMark plus GFM's pipe tables and `~~`, with `!adf:` directives and `adf:` fences for everything else | `engine-limit`, `not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `adfToPortableMarkdown` | writes markdown GitHub, GitLab and Obsidian render; drops what they cannot show, and writes no directive | `engine-limit`, `not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `commonMarkToAdf` | reads strict CommonMark as its spec says: a directive, a pipe table, `~~`, `==` and an `adf:` fence read as text and code | `engine-limit`, `not-a-string`, `unmappable-html`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `losslessMarkdownToAdf` | reads the lossless flavour, markdown `adfToLosslessMarkdown` wrote, edited or not | every code in [The errors](#the-errors) except `not-an-adf-document` and `unsupported-document-version` |
| `portableMarkdownToAdf` | reads CommonMark, GFM's pipe tables and `~~`, alerts and task markers, Obsidian's callouts and `==`; a directive and an `adf:` fence read as text and code | `engine-limit`, `malformed-pipe-table`, `not-a-string`, `unmappable-html`, `unsupported-nesting-depth`, `unsupported-node-shape` |

`isAdfDocument` is the type guard for the boundary you receive JSON at. It checks the shape the
converters require: `type: 'doc'`, a finite `version` (the converters take only 1), nodes holding
only `attrs`, `content`, `marks`, `text` and `type`, attribute values that are JSON values, and no
object holding itself. It returns `true` for a document nesting past 500 levels; the converters
refuse that one with `unsupported-nesting-depth`.

The types:

```ts
type AdfDocument = { content?: AdfNode[]; type: 'doc'; version: number }
type AdfNode = { attrs?: AdfAttributes; content?: AdfNode[]; marks?: AdfMark[]; text?: string; type: string }
type AdfMark = { attrs?: AdfAttributes; type: string }
type AdfAttributes = { [key: string]: JsonValue }
type JsonValue = JsonValue[] | boolean | null | number | string | { [key: string]: JsonValue }

type Result<T, E extends ConvertError = ConvertError> = { error: E; ok: false } | { ok: true; value: T }
type ConvertError = { code: ConvertErrorCode; message: string; path: ConvertErrorPath; position?: SourcePosition }
type ParseError = ConvertError & { position: SourcePosition }
type ConvertErrorPath = readonly (number | string)[]
type SourcePosition = { line: number; offset: number }
```

## The lossless flavour

Serves [Goals](#goals) 1, 5 and 6. The lossless flavour is CommonMark plus GFM's pipe tables and
`~~`, with directives under one prefix, `!adf:`, and `adf:` code fences for everything else. The
complete grammar, with every node's attributes:
[`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md).

### What CommonMark and GFM spell

Where CommonMark or GFM holds what a node carries, the node keeps that spelling.
`adfToLosslessMarkdown` writes exactly one spelling of each; every CommonMark variant of the same
document normalizes to it through the round-trip.

| ADF | Markdown |
| --- | --- |
| `blockquote` | `> ` |
| `bulletList`, `listItem` | `- ` items; adjacent lists of a kind alternate `- ` and `* ` |
| `codeBlock` | a fenced code block, the language as info string, the fence longer than any backtick run inside; several text nodes are `!adf:codeBlock` holding one fence per node |
| `hardBreak` | a backslash at the end of the line; `!adf:hardBreak{}` where no backslash can stand: a block's end, inside a heading, or a break carrying an attribute |
| `heading` | `#` to `######` |
| `link` | `[text](url "title")`; `<url>` where the text is the destination and the destination is an absolute URI |
| `mediaSingle` holding an external `media`, centered, uncaptioned | `![alt](url)`; `[![alt](url)](href)` where a link marks the image |
| `orderedList` | `1.` `2.` `3.`, the first number the list's `order`; adjacent lists of a kind alternate `1.` and `1)` |
| `paragraph` | one line, no soft wraps |
| `rule` | `---` |
| `table` of one header row and plain inline cells | a pipe table, every row opening and closing with a pipe |
| `text` marked `code`, `em`, `strike`, `strong` | `` `code` ``, `_em_` (`*em*` inside a word), `~~strike~~`, `**strong**` |
| `text` holding a carriage return | `&#13;` |
| `text` holding a newline, a null character, or a space or tab CommonMark strips (a block's inline edges, either side of a hard break, a pipe cell's edges, an em, strong or strike spelling's inner edges) | that run as `!adf:text{text="…"}`, the rest plain: `!adf:text{text="  "}Two leading spaces` |

Input normalizes: setext headings become ATX, indented code becomes a fence, `*em*` becomes
`_em_` outside a word, entity references decode, a soft line break becomes a space.

### What directives spell

Three forms, one grammar. A directive's name is the ADF node or mark type:

```
!adf:name[content]{attrs}        inline, on one line
!adf:name arg {attrs}            a block leaf
!adf:name arg {attrs}            a block container, closed by
!adf:/name
```

A node's content model picks the block form: a node taking content is a container.

```
!adf:panel warning
Check the collation before importing.
!adf:/panel

!adf:expand {title="Full build log"}
…
!adf:/expand

Ping !adf:mention[@Mikael]{id=5b10a2} — !adf:status[In review]{color=yellow} — !adf:date{timestamp=1756080000000}
```

| ADF | Directive |
| --- | --- |
| `blockquote`, `bulletList`, `codeBlock`, `heading`, `listItem`, `orderedList`, `paragraph`, `rule` carrying `localId`, marks or a value CommonMark cannot spell | the same node in directive form, `!adf:paragraph {localId=…}` |
| `border`, `subsup`, `textColor`, `underline` | inline directive marks around their text, `!adf:textColor[**Overdue**]{color="#ae2e24"}` |
| `caption`, `media`, `mediaGroup`, `mediaSingle` | the media family; an image CommonMark cannot spell, a stored file, a caption |
| `date`, `emoji`, `inlineCard`, `mediaInline`, `mention`, `status` | inline leaves; `emoji`, `mention` and `status` spell their `text` in the `[content]` slot |
| `decisionList`, `decisionItem` | containers |
| `expand`, `nestedExpand` | containers, `title` an attribute |
| `extension`, `bodiedExtension`, `multiBodiedExtension`, `extensionFrame` | a leaf, containers, `parameters` as JSON in an attribute |
| `layoutSection`, `layoutColumn` | containers |
| `link` with an attribute besides `href` and `title`, or a target CommonMark cannot spell | `!adf:link[text]{attrs}` |
| `panel` | a container, the type its argument: `!adf:panel info` |
| `syncBlock`, `bodiedSyncBlock` | a leaf and a container |
| `table`, `tableRow`, `tableCell`, `tableHeader` richer than a pipe table | containers nesting block content |
| `taskList`, `taskItem`, `blockTaskItem` | containers, the state an argument: `!adf:taskItem DONE` |
| any other node type, or a node where its spelling cannot stand | the opaque carry: a code fence ```` ```adf:<type> ```` holding the node's JSON, or inline `!adf:carry{json="…"}` |

- Attributes are `{key=value key2="two words"}`: keys alphabetical, a value bare where it is
  `[A-Za-z0-9_-]+`, else double-quoted with JSON string escaping. A number or JSON value is spelled as
  canonical JSON. An empty `attrs`, `content` or `marks` key is spelled `{attrs=empty}`,
  `{content=empty}` or `{marks=empty}`.
- Three reserved names build no node: `!adf:carry` is the inline opaque carry, `!adf:doc {content=none}`
  spells a document holding no `content` key, and `!adf:textBreak{}` parts two adjacent text nodes
  CommonMark would read back as one.
- Input reads the canonical spelling alone: keys out of order, a value quoted where bare carries it,
  or a longer escape than needed is an error naming the spelling to write.
- To keep a literal `!adf:` as text, escape it: `\!adf:`, block and inline alike. A code span and a
  code block hold `!adf:` as content.

## Portable markdown

Serves [Goals](#goals) 7. Portable markdown is a second flavour of the same grammar.
`adfToPortableMarkdown` writes markdown other tools render — GitHub, GitLab, Obsidian and the like —
keeping the content and dropping the rest: attributes, colours, layout, identity. Content is what a
reader of the rendered document sees or follows: its text, images and link targets. It writes no
directive.

`portableMarkdownToAdf` reads CommonMark, pipe tables and `~~` as `losslessMarkdownToAdf` reads
them, and the conventions below as nodes, taking other tools' spellings too; a directive and an
`adf:` fence read as CommonMark reads them, as text and code. A backslash keeps a marker as text:
`\==x==`, `> \[!NOTE]`, `- \[x]`. Markdown `adfToPortableMarkdown` wrote reads back and writes again
byte for byte; the document it came from does not come back.

To edit a document and save it back, use `adfToLosslessMarkdown` and `losslessMarkdownToAdf`:
saving what this pair read replaces mentions, attachments and macros with text.

| ADF | Written | Read back |
| --- | --- | --- |
| `backgroundColor` | `==text==` | `==text==` on one line, the text touching both delimiters, bounded outside by whitespace, punctuation or a line edge, or touching a Han, Hangul, Hiragana, Katakana, Thai, Lao, Khmer or Myanmar character on either side, in the editor's default highlight `#f8e6a0` |
| `decisionList` | a bullet list | — |
| `expand`, `nestedExpand` | Obsidian's folded callout, `> [!NOTE]- Title` | `-` or `+` after any word, the rest of the marker's line the title; a link reads `text (target)`, or its text alone where the text is the target with or without `mailto:`; an expand inside an expand is a `nestedExpand` |
| external `media` | in a block `![alt](url)`, or `[![alt](url)](href)` where a link marks it; inline `[alt](url)` | — |
| `inlineCard`, `blockCard`, `embedCard` | a link to the card's URL, else its name | — |
| `layoutSection`, `bodiedExtension`, `bodiedSyncBlock`, `multiBodiedExtension`, `extensionFrame`, `caption`, a node this version does not know | its blocks or its text | — |
| `mention`, `status`, `emoji`, `date` | their text: `@` kept, a mention with none `@` and its id, an emoji its `shortName` without, a date `2026-09-13` in UTC | — |
| `panel` | a GitHub alert, `> [!WARNING]`: info `NOTE`, note `IMPORTANT`, tip and success `TIP`, warning `WARNING`, error `CAUTION`, custom `NOTE` | `NOTE` info, `IMPORTANT` note, `TIP` tip, `WARNING` warning, `CAUTION` error, and Obsidian's: hint tip; success, check, done success; attention warning; danger, failure, fail, missing, bug, error error; any other word info — in any case; the rest of the marker's line is the first paragraph |
| `placeholder` | nothing | — |
| stored `media`, `mediaInline`, `extension`, `inlineExtension` | their `alt` or `text` | — |
| `table` | a pipe table: the first row its header, a cell's blocks on one line, a span kept under its header by empty cells | — |
| `taskList` | `- [x] Done`, `- [ ] Todo`. An item keeps its paragraphs, then its nested task lists; the rest of the item stands after the list, which resumes at the next task | a bullet list whose every item is so marked, `[X]` too. An item keeps its paragraphs, then its nested task lists; the rest of the item stands after the list, which resumes at the next task |

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
- A text node's `content` drops: Atlassian's schema forbids it, so no rendered document shows it.
- Adjacent lists of a kind alternate markers, `- ` and `* `, `1.` and `1)`, since CommonMark
  starts a new list where the marker changes; a task list counts as a bullet list, `* [x] Done`.
- An ordered list numbered past `999999999` is a bullet list keeping its numbers as text.
- A task list holding a block other than a task is a bullet list keeping its states as text:
  `- \[x] Done`.
- Text that would read as a marker takes a backslash: `==` wherever it could open or close a
  highlight, `[!…]` opening a quote, asterisks that would read as a rule after a `* ` marker
  (`* \**`), and `[x]` or `[ ]` opening any list item, since GitHub reads that marker per item.
- A node read back carries no `localId` except a `taskList`, `taskItem` or `blockTaskItem`, which
  Atlassian's schema requires one on: each gets a UUID v4 hashed from the whole markdown and its
  position, the same on every read. Join markdown bound for one document and read it once: the same
  markdown read twice into one document repeats its ids.

## The errors

Serves [Goals](#goals) 1. An ADF node type this version does not know is not an error: the lossless
pair carries it opaquely and restores it unchanged ([Unknown nodes ride the
carry](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#unknown-nodes-ride-the-carry)).

### The error shape

`ConvertError` is `{ code, message, path, position? }`.

- `code` is from the exported closed list `ConvertErrorCode`, safe to `switch` on exhaustively with
  no `default`. Before 1.0 the list changes only in a minor release; from 1.0 only in a major
  release.
- `message` is free text for a person fixing the input. It may change in any release.
- `path` is the node's place from the document root, alternating `'content'` and an index, so
  `path.map((step) => '/' + step).join('')` is a JSON Pointer at the node, or at the list holding it
  where `adfToPortableMarkdown` unwraps a list into its items. The empty path is the document
  itself.
- `position` is `{ line, offset }` into the string passed in: `line` counted from 1, `offset` a
  UTF-16 code unit, which is a JavaScript string index. It points at or before the refusal —
  currently the start of the line the enclosing block begins on; a later minor may narrow that,
  never widen it. For `not-a-string` it is `{ line: 1, offset: 0 }`.

A parse always names a position, so the three markdown readers return `ParseError`, whose
`position` reads without a guard. An emit reads no source and carries `path` alone. One handler
typed on `ConvertError` takes both.

A call reports the first refusal in document order and stops, so a document with several surfaces
them one per call. Every refusal is deterministic — there is no I/O anywhere — so a retry returns
the identical error: fix the input, or set the document aside. The exception is `engine-limit`,
whose causes include memory running short: retry it once, and treat a repeat as lasting. On V8
(Node, Deno, Chrome) a heap that runs out ends the process instead, so convert input of unbounded
size in a worker.

### Parsing

Which reader raises which code: [The calls](#the-calls). Codes every direction raises:
[Either direction](#either-direction).

| Code | Fires when | What you can do |
| --- | --- | --- |
| `malformed-directive` | an `!adf:` the grammar cannot read — a prefix completing no directive, an unclosed container, `[content]` or `{attrs}`, a closer with no container of its name open, a leaf given a body, `{attrs}` out of order or duplicated, invalid JSON in an opaque carry | write the spelling the message names, or keep it literal: escape the prefix — `\!adf:`, block and inline alike — or, for a code fence whose info string opens `adf:`, drop the info string and wrap the fence in `!adf:codeBlock {language="adf:…"}` |
| `malformed-pipe-table` | a pipe row that is no pipe table — a missing or ragged `---` delimiter row, an alignment colon in it, or a row not opening with a pipe | open every row with a pipe and give the delimiter row the header's cell count; to keep the lines literal text, escape the leading pipe of every one — escaping a single row leaves the next to open a fresh table and fail the same way |
| `not-a-string` | the value handed in is not a string, such as `null`, a number or a `String` object | pass the input as a string, `String(value)` for a `String` object; the message names the value's type |
| `unknown-directive-name` | a directive whose name is no node or mark this version spells | check the name in [`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md), or escape the prefix as `\!adf:`; the spelling itself is well formed, so a later minor may give the name meaning |
| `unmappable-html` | the input holds raw HTML, a comment and a processing instruction among them | remove the construct, or write what it holds as markdown |
| `unspellable-whitespace` | an `emoji`, `mention` or `status` directive's content slot spells a newline or a carriage return — `&#10;`, `&#13;`, `!adf:text{text="\n"}` | replace it with a space, or write the node as `!adf:carry` — an inline directive never spans lines |

### Emitting

`adfToLosslessMarkdown` and `adfToPortableMarkdown` raise these, and the codes under
[Either direction](#either-direction):

| Code | Fires when | What you can do |
| --- | --- | --- |
| `not-an-adf-document` | the value handed in is no ADF document — a missing or wrong `type`, a stray key, a node that is not a node, an object in the document holding itself, an attribute value that is not a plain object, array or JSON primitive, such as a `Date` or `Map` | guard the boundary you receive JSON at with `isAdfDocument`; the message names the branch that refused. Build an attribute value as JSON holds it: `date.toISOString()`, `Object.fromEntries(map)`, `{ ...instance }` |
| `unsupported-document-version` | the document's `version` is not 1 | keep the ADF and pass the document over, or show it read-only; the version is the site's, not yours to change |

### Either direction

The emitter raises these, and so does a parse, which asks the emitter how to spell each node:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `engine-limit` | in every call: a conversion that passes the longest array, `Map` or `Set` the JavaScript engine builds, or that finds no memory for a buffer; on JavaScriptCore (Bun, Safari), also one that runs its heap short or passes its longest string, 2^31 − 1 characters | retry once; if it repeats, writing: set the document aside, keeping the ADF and passing it over or showing it read-only; reading: shorten the markdown, or nest its lists and quotes less deeply |
| `unsupported-nesting-depth` | blocks, marks, an attribute's JSON or a carried node's JSON nest past 500 levels | keep the ADF and pass the document over, or show it read-only; flatten the input where you are the one who wrote it |
| `unsupported-node-shape` | parsing, in `losslessMarkdownToAdf`: markdown spells a node with an attribute, value, argument or body its type does not take, or without one it needs, wraps a directive mark around nothing or only hard breaks, writes as a directive a node or mark the lossless flavour spells as CommonMark, or one that, written out as plain CommonMark, would be longer than 536870888 characters, or puts a reserved directive out of place: `!adf:textBreak{}` parting nothing, `!adf:doc` anywhere but as the whole document. Emitting, in `adfToLosslessMarkdown`: a node not riding the carry that carries one mark type twice, a block or a non-text inline node holding `text`, or a leaf block or a non-text inline node holding `content`. Emitting, in `adfToPortableMarkdown`: a line or task list the portable writer cannot spell, a bug in this library. Emitting, in both writers: a document whose markdown would be longer than 536870888 characters, V8's longest string, on every engine; in `adfToPortableMarkdown`, also a document whose text alone is that long, edge whitespace included. In every call: a conversion that passes V8's or SpiderMonkey's longest string | fix what the message names; [`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md) lists every type's attributes and body. For a portable line or task list, report it as a bug. Past 536870888 characters or the engine's longest string, writing: set the document aside, keeping the ADF and passing it over or showing it read-only; reading: shorten the markdown, or nest its lists and quotes less deeply |

## The guarantees

Serves [Goals](#goals) 1, 4 and 5.

- `losslessMarkdownToAdf(adfToLosslessMarkdown(doc))` deep-equals `doc` as JSON, for a document of
  plain objects as `JSON.parse` builds them — every key and value as `doc` holds it, adjacent text
  nodes, an empty `attrs`, `content` or `marks` and `-0` included, and unknown node types carried
  opaquely
  ([Unknown nodes ride the carry](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#unknown-nodes-ride-the-carry)).
- Markdown this library reads, and markdown it writes, means what the CommonMark spec says. The
  bullets below name every exception.
- CommonMark is valid input to `commonMarkToAdf`, apart from the raw HTML `unmappable-html` names,
  nesting past 500 levels, and input whose conversion `engine-limit` or the length bound refuses.
- The other readers claim shapes CommonMark reads as text or code. `losslessMarkdownToAdf` claims
  four: literal text matching directive, pipe-table or strikethrough syntax, and a code fence whose
  info string opens `adf:`. `portableMarkdownToAdf` claims what [Portable
  markdown](#portable-markdown) lists. A claimed shape that does not complete, such as a pipe row
  without a delimiter row, is an error result; each can be kept literal ([`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md)).
- A document any reader built, written back with `adfToLosslessMarkdown`, takes the library's
  canonical spelling, which round-trips byte-identically.
- These CommonMark spellings parse without an error but build a document the reference
  implementation renders differently, because ADF holds no node for what the reference renders:
  - An empty link text reads as its destination, `[](/url)` as `/url` linked to `/url`, and `[]()`
    as nothing. A link text holding only hard breaks reads the same, followed by its hard breaks.
  - An image reads as an image only alone in its paragraph. Anywhere else — beside other text, in
    a heading or a table cell, or in the paragraph a task marker opens — it reads as its
    alt text linked to its URL: `See ![the moon](moon.png).` reads as
    `See [the moon](moon.png).`. To keep an image an image, give it a paragraph of its own: a
    blank line between it and any other line.
  - Inside a link, an image reads as plain text the link marks. A link alone in its paragraph
    whose whole text is one image reads as that image, with the link marking it.
  - An image's title becomes its caption when the image stays an image, and its link's title when
    it becomes linked alt text. Inside another link, the title is dropped.

  And these, for other reasons: a shortcut reference matching its definition only under Unicode case
  folding stays unresolved, and a link whose text holds an autolink keeps the inner link and leaves
  the outer brackets literal text, which the spec requires and the reference itself breaks, nesting
  one `<a>` in the other.
- Not every document converts back: `adfToLosslessMarkdown` refuses a document nesting past 500
  levels, the node shapes the `unsupported-node-shape` row lists, and what `engine-limit` names. Show the refusal and keep the
  document read-only; saving markdown you could not produce is the loss the round-trip exists to
  stop.
- The pipe table that `losslessMarkdownToAdf` and `portableMarkdownToAdf` read narrows GFM's twice:
  every row opens with a pipe, so GFM's bare form is an error result, and an alignment colon in the
  delimiter row is an error too — ADF holds no column alignment. The trailing pipe is canonical
  output, optional in input.
- Past that and `~~`, `losslessMarkdownToAdf` reads no GFM: an autolink literal and a `- [ ]`
  marker stay text, and a checklist is the `taskList` directive — `portableMarkdownToAdf` turns the
  marker into a `taskList`.
- A document nested deeper than 500 levels is an error result, not a stack overflow, and no call
  loops forever on a string, or on a value `JSON.parse` or `structuredClone` builds.
- The emitted formats are semver surface
  ([The formats are API](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#the-formats-are-api)).

## The package

Serves [Goals](#goals) 8.

| Aspect | Contract |
| --- | --- |
| Dependencies | none at runtime |
| Engines | any ES2022 engine; `engines.node` is `>=18`. The test suite runs under Node, Deno and Bun, and a headless Firefox converts the corpus through the built entrypoint |
| Host APIs | none: pure ECMAScript, no DOM, no `node:` import |
| Module format | ESM only, one entrypoint |
| Registry | public npm, `@larvit/adf-codec` |
| Types | built JavaScript with `.d.ts` beside it |

Contract: [`docs/decisions.md`](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#any-es2022-engine),
§Any ES2022 engine to §Public on npm.

## Everything exported

| Export | Kind | What it is ([The calls](#the-calls)) |
| --- | --- | --- |
| `AdfAttributes` | type | a node's or mark's attributes |
| `AdfDocument` | type | an ADF document |
| `AdfMark` | type | an ADF mark |
| `AdfNode` | type | an ADF node |
| `ConvertError` | type | the error a failed call returns |
| `ConvertErrorCode` | type | the closed list of codes in [The errors](#the-errors) |
| `ConvertErrorPath` | type | an error's place in the document |
| `JsonValue` | type | an attribute value |
| `ParseError` | type | the error a markdown reader returns, its `position` always set |
| `Result` | type | every call's return value |
| `SourcePosition` | type | an error's place in the markdown |
| `adfToLosslessMarkdown` | function | ADF to the lossless flavour |
| `adfToPortableMarkdown` | function | ADF to portable markdown, lossy |
| `commonMarkToAdf` | function | strict CommonMark to ADF |
| `isAdfDocument` | function | type guard for `AdfDocument` |
| `losslessMarkdownToAdf` | function | the lossless flavour to ADF |
| `portableMarkdownToAdf` | function | portable markdown to ADF |

## Links

- [Changelog](https://github.com/larvit/adf-codec/blob/main/CHANGELOG.md)
- [Upgrading from `0.1.0`](https://github.com/larvit/adf-codec/blob/main/MIGRATION.md)
- [The lossless flavour's grammar, `spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md)
- [Decisions](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md)
- [Plan](https://github.com/larvit/adf-codec/blob/main/todo.md)
- [Issues](https://github.com/larvit/adf-codec/issues)

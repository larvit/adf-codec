# The markdown flavour

The grammar of the extended markdown `adfToMarkdown` emits and `markdownToAdf` parses. Plain
CommonMark is a subset with two carve-outs: literal text that matches directive syntax below or
opens a pipe table is claimed by the flavour (escape the `:` or `|` to keep it literal) — and
one gap: a CommonMark image fits only as its own title-less paragraph — mid-text and titled
images are named errors. The emitted form is contract (AGENTS.md §8). Per-node syntaxes build on
this grammar in the sections below (inline nodes and marks: todo.md 1c).

## Canonical form

`adfToMarkdown` emits exactly one spelling; every CommonMark variant of the same document
normalizes to it through the round-trip.

- Emphasis `_em_`, strong `**strong**`; `*` replaces `_` only where `_` cannot parse
  (intra-word).
- Bullet lists `- `; ordered lists incrementing `1.` `2.` `3.`, the first number taken from the
  node's `order` attribute. Continuation lines align with the first character after the marker
  (two spaces for `- `, three for `1. `); blank lines inside an item are empty lines. Lists are
  tight — blank lines between items normalize away; ADF does not record tightness.
- Blockquotes prefix lines with `> `; a blank line inside a blockquote is a bare `>`.
- ATX headings (`#` … `######`); setext input normalizes to ATX.
- Code fences ``` with the node's language as info string, the fence lengthened past any backtick
  run in the content; indented-code input normalizes to fences.
- Thematic break `---`.
- Hard break: backslash at end of line (survives editors that trim trailing spaces). Where
  CommonMark admits no spelling — the end of a block, inside a heading — it is `:hardBreak{}`.
- An empty paragraph — real payloads carry them — is `::paragraph`.
- Links `[text](url)`; `<…>` around a destination containing spaces; title in double quotes.
  `<url>` autolink form only when the text equals the destination and the destination is a valid
  CommonMark autolink (absolute URI).
- Paragraphs on one line — no soft wrapping; a soft line break in input becomes a single space.
- Entity references in input decode to their characters; output backslash-escapes only where text
  would otherwise parse as syntax.
- Blocks separated by one blank line, no trailing whitespace, single trailing newline.

## Directives

One grammar for everything CommonMark lacks. A directive name is `[a-z][A-Za-z0-9]*` — the ADF
node names. Recognition is syntactic and name-set-independent: anything matching the forms below
parses as a directive regardless of whether the name is known, and an unknown name is an error
result naming it — so output an old emitter escaped stays escaped, and erroring input gaining
meaning later is MINOR, never a reparse (§8). The name `adf` is reserved for the opaque carry, as
both directive name and fence info string.

**Inline**: `:name[content]{attrs}`, on one line — an inline directive never spans lines.
`[content]` is inline markdown; brackets inside balance as in CommonMark link text, `\]` for a
literal bracket. Each node's section says whether content and attrs are required. `:` opens a
directive only when the name is followed immediately by `[` or `{`, and `{attrs}` must follow
`]` (or the name) with no gap — anything else (`10:30`, `:smile:`, a stray `{…}` in text) is
literal text.

**Container block**:

```
:::name arg {attrs}
block content
:::
```

The fence is three or more colons. `arg` is one optional bare token whose meaning each node
defines (e.g. the panel type). The body is block markdown. The closing fence is a line of at
least the opening's length, and a container's fence is longer than every directive fence line in
its body — counting only lines that parse as directive fences in the body's block structure; a
colon run inside a code fence or opaque carry is content. Canonical form uses minimal lengths.
Directive fence lines follow code-fence indentation (up to three spaces relative to their
container); trailing whitespace on a fence line is tolerated in input, never emitted.

**Leaf block**: `::name {attrs}` — a block-position node with no body.

**Claiming at block level**, symmetric with inline: a line whose leading run of two or more
colons is followed immediately by a name character is claimed and must parse fully as a container
opening or a leaf, else it is a named error. A bare colon-run line is a closing fence while a
container is open, a named error otherwise.

**Attributes**: `{key=value key2="two words"}`. `{attrs}` is optional in every form, and `{}` is
valid — no attributes. A bare value matches `[A-Za-z0-9_-]+`; any other value is double-quoted
with JSON string escaping (`\"` `\\` `\n` `\t` `\uXXXX`, …) — total over
Unicode, and raw newlines never appear inside quotes. All values are strings at the grammar
level; each node's section assigns types. Canonical form orders keys alphabetically, spells
values bare wherever allowed, inside quotes escapes only what it must using the shortest escape
form, and omits empty `{attrs}` except where the `{` itself claims the directive
(`:hardBreak{}`).

**Escaping**: the emitter backslash-escapes whatever literal text would otherwise parse as
directive syntax — the leading `:` of a would-be directive, `]` inside content; a backslash
before `:` in input always yields a literal colon.

**Malformed directives are error results**, named: an unclosed container at end of input, a body
fence line of the container's length or longer, a bare colon-run line outside any container or
shorter than the fence it would close, an inline `[content]` or `{attrs}` left unclosed at end of
line, unparseable or duplicate-keyed attrs, invalid JSON in an opaque carry. Never a silent
literal-text fallback — a typo that reparses as prose is the silent loss §2 refuses.

## The opaque carry (AGENTS.md §3)

A node type the library does not know rides as its raw JSON and restores to a deep-equal node.
Block and inline positions canonicalize differently, each fitting where it sits:

- **Block position**: a fenced code block with info string `adf`, body = the node's JSON —
  two-space indent, object keys sorted.
- **Inline position**: `:adf{json="…"}` — compact serialization (keys sorted, no whitespace),
  JSON-string-escaped into the attribute.

The info string `adf` is reserved: a genuine `codeBlock` whose `language` is exactly `adf` is
itself emitted through the opaque carry, so the reservation stays absolute and stays lossless.
In block-directive positions (`::adf`, `:::adf`) the reserved name is a named error — the
carry's block form is the fence.

## Raw HTML in input

CommonMark input may contain raw HTML. `markdownToAdf` routes each construct through the foreign
HTML element mapping (AGENTS.md §3; specified with the HTML dialect, todo.md milestone 6) — ADF
has no raw-HTML node, so a construct without a mapping, comments and processing instructions
included, is an error result naming it. The flavour never emits raw HTML.

## Block nodes

The directive name is always the ADF node type. A container's body is the node's `content`; a
leaf has none. Every directive parses in any position — `markdownToAdf` builds exactly what is
written; validity against ADF's content models stays the author's business (AGENTS.md §14).

Each section lists attributes as `name (type)`. A parenthesized value set documents what real
payloads hold; the type stays string and any value round-trips verbatim. Values map to attrs by
type: strings verbatim, numbers and booleans in canonical JSON spelling — quoted where not bare
(`width="33.33"`) — and `json` values as the inline carry's serialization (compact, keys
sorted), quoted. `markdownToAdf` emits `attrs`, `content` and `marks` keys only when non-empty;
editor-normal ADF reads an empty attrs object, marks array or content array as the absent key
(AGENTS.md §2) — the grammar's empty-`{attrs}` omission already collapses the two spellings.

Marks on a block node ride the reserved attribute key `marks` — the node's marks array as a
`json` value: `::::layoutSection {marks="[{\"attrs\":{\"mode\":\"wide\"},\"type\":\"breakout\"}]"}`.
Three child nodes hold inline content rather than blocks (`caption`, `decisionItem`,
`taskItem`): their body is at most one paragraph, whose inline content becomes the node's
`content`; any other body is a named error.

A node the sections cannot spell rides the opaque carry: an attrs key its section does not
list, a value that is not the section's type, or an arg-slot value that is no bare token. In
markdown input the same mismatch is a named error.

### Panel

Container; the arg is `panelType` (`custom` `error` `info` `note` `success` `tip` `warning`).
Attributes: `localId` (string), `panelColor` (string), `panelIcon` (string), `panelIconId`
(string), `panelIconText` (string) — the editor writes the last four for `custom` panels.

```
:::panel warning
Check the collation before importing.
:::
```

### Expand

`expand` and `nestedExpand`: containers, no arg — same syntax, two node types, the name picks
which. Attributes: `localId` (string), `title` (string).

```
:::expand {title="Full build log"}
…
:::
```

### The media family

- `media` — leaf. Attributes: `alt` (string), `collection` (string), `height` (number), `id`
  (string), `localId` (string), `occurrenceKey` (string), `type` (`external` `file` `link`),
  `url` (string), `width` (number). `file` and `link` media carry `collection` + `id`;
  `external` media carry `url`.
- `mediaSingle` — container: one `::media`, then optionally one `:::caption`. Attributes:
  `layout` (`align-end` `align-start` `center` `full-width` `wide` `wrap-left` `wrap-right`),
  `localId` (string), `width` (number), `widthType` (`percentage` `pixel`).
- `caption` — container, inline body. Attributes: `localId` (string).
- `mediaGroup` — container of `::media` leaves, no attributes.

```
::::mediaSingle {layout=center width=50}
::media {collection=MediaServicesSample id=4478e39c-cf9b-41d1-ba92-68589487cd75 type=file}
:::caption
The moon, at night.
:::
::::
```

**The CommonMark image.** A paragraph whose entire inline content is one image `![alt](url)` is
a `mediaSingle` with attrs exactly `{"layout":"center"}` holding an `external` `media` — `url`
from the destination, `alt` the description's plain-text content when non-empty. `adfToMarkdown` emits the image
form for exactly that shape — those attrs and no others, no marks, no caption. An image amid
other text, or one carrying a title, is a named error (ADF has a slot for neither).

### Tables

One header row plus plain inline cells is a pipe table; anything richer is the directive form
(AGENTS.md §4). Precisely: a table emits as a pipe table exactly when the `table`, every row
and every cell carry no attrs and no marks, the first row is all `tableHeader` and the rest all
`tableCell`, every row has the header's cell count, and every cell holds exactly one attr-less,
mark-less paragraph — an empty cell holds one empty paragraph — with no `|` in a code span:
backslash escapes are inert there, so pipe form cannot spell that pipe and the table takes the
directive form. A pipe table parses back to exactly that shape.

```
| Part | Qty |
| --- | --- |
| Bolt M8 | 40 |
```

Claiming at block level, symmetric with directives: a line opening with an unescaped `|` is
claimed and must parse as part of a pipe table, else it is a named error — escape the pipe
(`\|`) to keep it literal text. A pipe table is a header row, a delimiter row whose cells are
runs of one or more `-` (canonical `---`), and body rows; rows follow code-fence indentation.
Cells split on unescaped `|` before inline parsing — `\|` stays in the cell text, and the
inline layer's ordinary CommonMark escaping yields the pipe; each cell is the inline content of
one paragraph, trimmed; canonical form pads cells with single spaces and ends rows with `|`
(optional in input). Named errors: a delimiter or body row whose cell count differs from the
header's, and an alignment colon in the delimiter row — ADF holds no column alignment. In a
pipe cell a hard break is `:hardBreak{}`, a literal `|` is `\|`, and `|` inside a quoted
attribute value is `\u007c` (JSON has no `\|`).

The directive form nests cells as containers of block content inside `tableRow` containers:

```
:::::table {isNumberColumnEnabled=true width=760}
::::tableRow
:::tableHeader {colspan=2 colwidth="[340,420]"}
Assembly
:::
::::
::::tableRow
:::tableCell {background="#deebff"}
Bolt M8
:::
:::tableCell {valign=top}
40
:::
::::
:::::
```

Attributes — `table`: `displayMode` (`default` `fixed`), `isNumberColumnEnabled` (boolean),
`layout` (`align-end` `align-start` `center` `default` `full-width` `wide`), `localId`
(string), `width` (number, pixels). `tableRow`: `localId` (string). `tableCell` and
`tableHeader`: `background` (string), `colspan` (number), `colwidth` (json, one pixel width per
spanned column), `localId` (string), `rowspan` (number), `valign` (`bottom` `middle` `top`).

### Task and decision lists

- `taskList` — container of `taskItem`, `blockTaskItem` and nested `taskList` directives.
  Attributes: `localId` (string).
- `taskItem` — container, inline body; the arg is the state (`DONE` `TODO`). Attributes:
  `localId` (string).
- `blockTaskItem` — container, block body; arg and attributes as `taskItem`.
- `decisionList` — container of `decisionItem` directives. Attributes: `localId` (string).
- `decisionItem` — container, inline body. Attributes: `localId` (string), `state` (string —
  free-form; the editor writes `DECIDED`).

```
::::taskList {localId=0198f3a2-7c41-7f2e-9b3a-4d8e2c1a6b90}
:::taskItem DONE {localId=0198f3a2-8d52-70b1-8c4f-5e9f3d2b7ca1}
Write the spec
:::
:::taskItem TODO {localId=0198f3a2-9e63-7d80-a15b-6fa04e3c8db2}
Ship it
:::
::::
```

### Layout

`layoutSection` — container of `layoutColumn` containers; attributes: `localId` (string).
`layoutColumn` — container, block body; attributes: `localId` (string), `valign` (`bottom`
`middle` `top`), `width` (number — percent).

```
::::layoutSection
:::layoutColumn {width=50}
Left.
:::
:::layoutColumn {width=50}
Right.
:::
::::
```

### Extensions

`extension` — leaf. `bodiedExtension` — container, block body. `multiBodiedExtension` —
container of `extensionFrame` containers; `extensionFrame` — container, block body, no
attributes. The other three share: `extensionKey` (string), `extensionType` (string), `layout`
(`default` `full-width` `wide`), `localId` (string), `parameters` (json), `text` (string).

```
::extension {extensionKey=toc extensionType="com.atlassian.confluence.macro.core" parameters="{\"maxLevel\":2}"}
```

### Sync blocks

`syncBlock` — leaf. `bodiedSyncBlock` — container, block body. Attributes: `localId` (string),
`resourceId` (string).

```
::syncBlock {localId=0198f3a2-af74-7e91-b26c-70b15f4d9ec3 resourceId="ari:cloud:confluence:site/page/123"}
```

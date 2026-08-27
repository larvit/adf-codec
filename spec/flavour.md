# The markdown flavour

The grammar of the extended markdown `adfToMarkdown` emits and `markdownToAdf` parses. Plain
CommonMark is a subset with three carve-outs: literal text that matches directive syntax below or
opens a pipe table is claimed by the flavour, and a matched `~~` pair spells `strike` (escape the
`:`, `|` or `~` to keep it literal) — and one gap: a CommonMark image fits only as its own
title-less paragraph — mid-text and titled images are named errors. The emitted form is contract
(AGENTS.md §8). Per-node syntaxes build on this grammar in the sections below.

## Canonical form

`adfToMarkdown` emits exactly one spelling; every CommonMark variant of the same document
normalizes to it through the round-trip.

- Emphasis `_em_`, strong `**strong**`, strike `~~strike~~`; `*` replaces `_` only where `_`
  cannot parse (intra-word). Strike is GFM strikethrough narrowed to exactly two tildes — a
  single tilde or a run of three or more is literal text — and block structure resolves before
  inline, so a `~~~` line opens a CommonMark tilde code fence.
- Bullet lists `- `; ordered lists incrementing `1.` `2.` `3.`, the first number the node's
  `order` attribute. Continuation lines align with the first character after the marker
  (two spaces for `- `, three for `1. `); blank lines inside an item are empty lines, none before
  a nested list. Blank lines between items normalize away; ADF does not record tightness.
- Blockquotes prefix lines with `> `; a blank line inside a blockquote is a bare `>`.
- ATX headings (`#` … `######`); setext input normalizes to ATX.
- Code fences ``` with the node's language as info string, the fence lengthened past any backtick
  run in the content — the longest run anywhere plus one, at least three, counting mid-line runs
  no closing fence could match; indented-code input normalizes to fences.
- Code spans: a backtick string one longer than the longest backtick run in the text, the text
  padded with one space on each side where it begins or ends with a backtick, or begins and ends
  with a space without being all spaces. The content is literal — inline parsing does not see
  inside it, directive syntax and `~~` included.
- Thematic break `---`.
- Hard break: backslash at end of line (survives editors that trim trailing spaces). Where
  CommonMark admits no spelling — the end of a block, inside a heading — or where the node carries
  an attribute, it is the inline directive.
- An empty paragraph — real payloads carry them — is `::paragraph`.
- Links `[text](url)`; `<…>` around a destination containing spaces; title in double quotes.
  `<url>` autolink form only when the text equals the destination and the destination is a valid
  CommonMark autolink (absolute URI).
- Paragraphs on one line — no soft wrapping; a soft line break in input becomes a single space.
- Entity references in input decode to their characters; output backslash-escapes only where text
  would otherwise parse as syntax, scanning the assembled line rather than each text node: escape
  the leading delimiter of a construct that would otherwise open, re-scan from there, and repeat.
  An emphasis delimiter run in text escapes where CommonMark can open **or** close with it, so
  `*not emphasis*` is `\*not emphasis\*` — no delimiter the emitter did not write reaches the
  matching below, which is what lets the emitter decide its own pairings.
- Blocks separated by one blank line at document level, inside a blockquote and between CommonMark
  blocks; two directive blocks inside a container take none. No trailing whitespace outside a code
  block's
  content, single trailing newline; a document with no blocks is the empty string.

## Directives

One grammar for everything CommonMark lacks. A directive name is `[a-z][A-Za-z0-9]*` — the ADF
node and mark names the sections below spell as directives. Recognition is syntactic and
name-set-independent: anything matching the forms below parses as a directive regardless of
whether the name is known, and an unknown name is an error result naming it — so output an old
emitter escaped stays escaped, and erroring input gaining meaning later is MINOR, never a reparse
(§8). The name `adf` is reserved for the opaque carry, as both directive name and fence info
string.

**Inline**: `:name[content]{attrs}`, on one line — an inline directive never spans lines.
`[content]` is inline markdown; brackets inside balance as in CommonMark link text, `\]` for a
literal bracket. Whitespace at either edge of `[content]`, space or tab, is part of it and
survives inline parsing. Each section below says whether content is required. `:` opens a
directive only when the name is followed immediately by `[` or `{`, and `{attrs}` must follow
`]` (or the name) with no gap — anything else (`10:30`, `:smile:`, a stray `{…}` in text) is
literal text. An inline directive binds as a unit before bracket matching, the way a code span
does: a `]` or `(` inside its `{attrs}` is the directive's, never the enclosing content's, and a
`(` after its closing `]` opens no link.

**Container block**:

```
:::name arg {attrs}
block content
:::
```

The fence is three or more colons. `arg` is one optional bare token whose meaning each node
defines (e.g. the panel type). The body is block markdown. The closing fence is a line of at
least the opening's length, and a container's fence is longer than every directive fence line
anywhere in its body, however deeply a list item or blockquote nests it; a colon run inside a code
fence or opaque carry is content. Canonical form uses minimal lengths.
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
Unicode, and raw newlines never appear inside quotes. A quoted value also escapes `` ` ``, `&`,
`<` and `|` as `\u0060`, `\u0026`, `\u003c` and `\u007c`; `*`, `_`, `~`, `[`, `]` and `(` resolve
after a directive binds and stay raw. The closing `}` is the first one outside quotes, since a
quoted value holds `}` unescaped. All values are strings at the grammar level; each node's section
assigns types.
Canonical form orders keys alphabetically, spells values bare wherever allowed, escapes inside
quotes in the shortest form each escape has, and omits empty `{attrs}` except where the `{` itself
claims the directive (`:hardBreak{}`).

**Escaping**: the emitter backslash-escapes whatever literal text would otherwise parse as
directive syntax — the leading `:` of a would-be directive, `]` inside content, a `{` right
after a directive's closing `]`, which would otherwise be read as the attributes it has none
of; outside code spans and code blocks, a backslash before `:` in input yields a literal colon.

**Malformed directives are error results**, named: an unclosed container at end of input, a body
fence line of the container's length or longer, a bare colon-run line outside any container or
shorter than the fence it would close, an inline `[content]` or `{attrs}` left unclosed at end of
line, unparseable or duplicate-keyed attrs, invalid JSON in an opaque carry. Never a silent
literal-text fallback — a typo that reparses as prose is the silent loss §2 refuses.

## The opaque carry (AGENTS.md §3)

A node no section spells where it stands — an unknown type, or a known one whose spelling belongs
to the other position — rides as its raw JSON and restores to a deep-equal node. Block and inline
positions canonicalize differently, each fitting where it sits:

- **Block position**: a fenced code block with info string `adf`, body = the node's JSON —
  two-space indent, object keys sorted.
- **Inline position**: `:adf{json="…"}` — compact serialization (keys sorted, no whitespace),
  JSON-string-escaped into the attribute.

The info string `adf` is reserved: a genuine `codeBlock` whose `language` is exactly `adf` takes
the attribute the section below keeps for a language no info string holds, so the reservation
stays absolute.
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

### The CommonMark blocks

CommonMark spells `blockquote`, `bulletList`, `codeBlock`, `heading`, `listItem`, `orderedList`,
`paragraph` and `rule`, and keeps that spelling wherever it holds what the node carries. What it
cannot — `localId` (string) on any of them, marks, and the values below — takes the directive
form.

- `blockquote`, `bulletList`, `listItem` — containers, block body; no attributes beyond `localId`.
- `codeBlock` — container, body one fenced code block whose info string is the language and whose
  content is the node's. Attributes: `hideLineNumbers` (boolean), `language` (string), `localId`,
  `uniqueId` (string), `wrap` (boolean). A language no info string holds — empty, or holding a
  backtick, edge whitespace, an entity reference or the reserved `adf` — rides the `language`
  attribute instead, and the fence carries no info string.
- `heading` — container, inline body. Attributes: `level` (number), `localId`. `level` is the `#`
  count, so a heading carrying none, or one outside 1-6, has no CommonMark spelling.
- `orderedList` — container of `listItem`, block body. Attributes: `localId`, `order` (number).
  `order` is the first marker, so a list carrying none, or one whose markers would run past
  999999999, has no CommonMark spelling.
- `paragraph` — container, inline body; holding no content it is the leaf `::paragraph`. No
  attributes beyond `localId`.
- `rule` — leaf; no attributes beyond `localId`.

````
:::codeBlock {localId=01a03d5c-9b21-73f4-8e6a-0c47b1d9e2f8 wrap=true}
```rust
fn main() {}
```
:::
````

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
from the destination, `alt` the description's plain-text content when non-empty. `adfToMarkdown`
emits the image form for exactly that shape — those attrs and no others, no marks on either
node, no caption, and a `media` carrying nothing beyond `alt`, `type` and `url` — and only where
CommonMark spells the pair: a destination or a description the image form cannot hold, an empty
`alt` included, takes the directive form instead. An image amid
other text, or one carrying a title, is a named error: `mediaInline` carries a media
`collection` + `id`, never a URL, and no media node carries a title.

### Tables

One header row plus plain inline cells is a pipe table; anything richer is the directive form
(AGENTS.md §4). Precisely: a table emits as a pipe table exactly when the `table`, every row
and every cell carry no attrs and no marks, the first row is all `tableHeader` and the rest all
`tableCell`, every row has the header's cell count, and every cell holds exactly one attr-less,
mark-less paragraph — an empty cell holds one empty paragraph — with no `|` anywhere the
inline layer spells as syntax: a code span, an autolink, a link destination or title. A `|` there
takes the directive form instead. A pipe table parses back to exactly that shape.

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
pipe cell a hard break is `:hardBreak{}` and a literal `|` is `\|`; a `|` inside a quoted
attribute value is already `\u007c`, so the split never reaches it.

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

## Inline nodes

Attributes and the carry fallback read as in the block sections, the carry in its inline form. Of
the nodes below, `emoji`, `mention` and `status` spell their `text` attribute in the content slot
as plain text: `[]` is the empty string, absent content is the absent attribute, non-empty content parsing to anything
but one unmarked text node — adjacent identical-mark text nodes merged first — is a named
error, and so is a `text` key in `{attrs}`. An enclosing mark spelling does not reach into the
slot. The rest take no content, `:text` included; content on a node that takes none is a named
error.

- `date` — `localId` (string), `timestamp` (string, epoch milliseconds).
- `emoji` — `id` (string), `localId` (string), `shortName` (string, `:name:`), `text` (string).
- `hardBreak` — `localId` (string), `text` (string).
- `inlineCard` — `data` (json), `localId` (string), `url` (string); real payloads carry one or
  the other.
- `mediaInline` — `alt` (string), `collection` (string), `data` (json), `height` (number), `id`
  (string), `localId` (string), `occurrenceKey` (string), `type` (`file` `image` `link`), `width`
  (number).
- `mention` — `accessLevel` (`APPLICATION` `CONTAINER` `NONE` `SITE`), `id` (string), `localId`
  (string), `text` (string), `userType` (`APP` `DEFAULT` `SPECIAL`).
- `status` — `color` (`blue` `green` `neutral` `purple` `red` `yellow`), `localId` (string),
  `style` (string), `text` (string).

```
:status[In review]{color=yellow} — :mention[@Mikael]{id=01a032c3-7a7c-775f-a730-2d79351338b4}

Shipped :emoji[🎉]{shortName=":tada:"} on :date{timestamp=1756080000000}.
```

**Whitespace CommonMark cannot hold.** A newline inside a text node, and a space or tab where
CommonMark strips or refuses one — a block's inline content edges, either side of a line break,
an em, strong or strike spelling's inner edges, a pipe cell's edges — is spelled
`:text{text="…"}`, the reserved key carrying the node's text, escaped by the attribute grammar
and never literal: pipe cells trim and pad. The emitter wraps the whitespace run alone and leaves
the rest plain text; `markdownToAdf` merges adjacent text nodes carrying identical marks
(AGENTS.md §2).

```
:text{text="  "}Two leading spaces held, and one text node split:text{text="\n"}over two lines.
```

## Marks

An inline node's marks ride the spelling wrapped around them, never the block sections' reserved
`marks` key. `code`, `em`, `link`, `strike` and `strong` keep their markdown spellings, which hold
no attributes beyond `link`'s `href` and `title`, and are not directive names: `:em[x]` is a named
error. The other four are inline directives, content required non-empty:

- `border` — `color` (string, `#rrggbb` or `#rrggbbaa`), `size` (number, 1–3).
- `subsup` — `type` (`sub` `sup`).
- `textColor` — `color` (string, `#rrggbb`).
- `underline` — no attributes.

A spelling adds its mark to every inline node it wraps, and nesting is the marks array in order,
outermost first: `_:underline[x]_` gives marks `[em, underline]`, `:underline[_x_]` the reverse.
`adfToMarkdown` nests in the order the array holds rather than sorting it — §2's equality
restores the array, not a set — and opens each spelling once over the longest run of adjacent
inline nodes carrying an identical mark, attributes included, at that depth. A run breaks at every
node the emitter carries, so no emitted carry sits inside a mark spelling.

An inline node whose marks no nesting spells — a mark type not listed here, an attrs key its
spelling does not list, a value that is not the spelling's type, an attribute the spelling needs
and the mark lacks, an order putting a code span outside another mark, `code` over anything but a
text node or over text holding a newline, or a spelling CommonMark's flanking rules cannot open or
close where the run sits (`un**-real**istic`), or one CommonMark's matching pairs elsewhere — the
intra-word `*` runs together with a neighbouring `**`, and the multiple-of-3 rule can leave the
merged run's pairing to another delimiter — rides the inline carry whole. A value the spelling
holds but CommonMark cannot write — a link destination or title — is a named error instead. An
opaque carry inside a mark spelling is a named error in input: the carry restores its node
exactly, marks included (AGENTS.md §3).

```
:textColor[**Overdue**]{color="#ae2e24"}, H:subsup[2]{type=sub}O, :underline[signed].

:border[:mediaInline{collection=contentId-98237 id=01a032c3-7a90-70c9-88f6-c60f710eda07}]{color="#091e42" size=2}
```

# The markdown flavour

The grammar of the extended markdown `adfToMarkdown` emits and `markdownToAdf` parses. Plain
CommonMark is a subset apart from raw HTML (below), with three carve-outs: literal text that matches
directive syntax below or reads as a pipe table is claimed by the flavour, and a matched `~~` pair
spells `strike` (escape the `!adf:`, `|` or `~` to keep it literal) — and one gap: a CommonMark
image fits only as its own title-less paragraph — mid-text and titled images are named errors. The
emitted form is contract (`docs/decisions.md` §The formats are API). Per-node syntaxes build on this
grammar in the sections below.

## Canonical form

`adfToMarkdown` emits exactly one spelling; every CommonMark variant of the same document
normalizes to it through the round-trip.

- Emphasis `_em_`, strong `**strong**`, strike `~~strike~~`; `*` replaces `_` only where `_`
  cannot parse (intra-word). Strike is GFM strikethrough narrowed to exactly two tildes — a
  single tilde or a run of three or more is literal text — and block structure resolves before
  inline, so a `~~~` line opens a CommonMark tilde code fence.
- Bullet lists `- `; ordered lists incrementing `1.` `2.` `3.`, the first number the node's
  `order` attribute. Continuation lines align with the first character after the marker
  (two spaces for `- `, three for `1. `); blank lines inside an item are empty lines, none
  between a nested list and a CommonMark block above it — one wherever the nested list's own
  marker cannot interrupt a paragraph (an ordered list whose first number is not 1, or a list
  whose first item is empty), whatever block sits above it. Blank lines between items normalize
  away, and no list opens beside one of its own kind — the marker change CommonMark starts a
  second list on merges instead: ADF records no tightness, so one `- ` spelling reads two
  adjacent lists of a kind back as one. The leaf `!adf:listBreak` parts them, taking the separation
  any directive block takes where it sits. It builds no node, and it reads only between two
  adjacent lists of one type: elsewhere, or carrying an argument, `{attrs}` or a body, it is a
  named error. A list whose item holds a line of spaces or tabs alone, which a list item reads
  back empty, takes the directive form.
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
  CommonMark admits no spelling — the end of a block, inside an ATX heading — or where the node
  carries an attribute, it is the inline directive.
- An empty paragraph — real payloads carry them — is an `!adf:paragraph` … `!adf:/paragraph` pair
  holding nothing, and one whose `content` is an empty array the pair
  `!adf:paragraph {content=empty}` … `!adf:/paragraph` (Attributes).
- Links `[text](url)`; `<…>` around a destination containing spaces, `<>` an empty one beside a
  title; title in double quotes. A backslash escapes a parenthesis the destination leaves
  unbalanced, and a quote inside the title; a balanced pair stays bare. `<url>` autolink form only
  when the text equals the destination and the destination is a valid CommonMark autolink
  (absolute URI) — inside an inline directive's `[content]`, one holding no backtick, no
  unbalanced bracket and no inline directive opener.
- Paragraphs on one line — no soft wrapping; a soft line break in input becomes a single space.
- Entity references in input decode to their characters; output backslash-escapes only where text
  would otherwise parse as syntax, scanning the assembled line rather than each text node: escape
  the leading delimiter of a construct that would otherwise open, re-scan from there, and repeat.
  A backtick run escapes whole, and a bare one escapes wherever a later backtick string of its
  length forms around an escape in the same inline content — an escaped backtick alone, one joined
  to the bare run after it, or a bare run an escape splits off: CommonMark reads no escape inside a
  code span, so such a string still closes one.
  Where a paragraph opens with what reads as a link reference definition, which resolves before
  any inline construct binds (a `]` inside a code span or `{attrs}` counts), an opening text `[`
  escapes and an opening link takes the directive link (Marks).
  An emphasis delimiter run in text escapes where CommonMark can open **or** close with it, so
  `*not emphasis*` is `\*not emphasis\*` — no delimiter the emitter did not write reaches the
  matching below, which is what lets the emitter decide its own pairings.
- Blocks separated by one blank line at document level, inside a blockquote and between CommonMark
  blocks; inside a directive container a pair holding a directive block takes none. No trailing
  whitespace outside a code block's content, single trailing newline. A document whose `content` is
  an empty array is the empty string, and markdown holding no block reads back to it; a document
  holding no `content` key is the leaf `!adf:doc {content=none}` as its only block, which is a
  named error anywhere else or spelled any other way.

## Directives

One grammar for everything CommonMark lacks, namespaced: every directive opens with the literal
`!adf:`. A directive name is `[a-z][A-Za-z0-9]*` — the ADF node and mark names the sections below
spell as directives. Recognition is syntactic and name-set-independent: anything matching the forms
below parses as a directive regardless of whether the name is known, and an unknown name is an error
result naming it at the opener, whatever follows it — so output an old emitter escaped stays
escaped, and erroring input gaining meaning later is MINOR, never a reparse (`docs/decisions.md`
§The formats are API). Each name belongs to one position, and a name the other one spells — a mark
or an inline node written as a block directive, a block node written inline — is a different error,
naming the spelling it takes. Four reserved names read back to no node: `carry` for the inline
opaque carry, `listBreak` for the leaf that parts two adjacent lists and `doc` for a document
holding no `content` key (Canonical form), and `textBreak` for the leaf that parts two text nodes
(Inline nodes). Every fence info string opening `adf:` is reserved for the block carry (The opaque
carry).

**Claiming**: an unescaped `!adf:` claims wherever it stands. What follows picks the form: `/name`
closes a container, and a name picks by what follows it in turn — a space or the line's end a block
line, `[` or `{` an inline directive. A `!adf:` completing none of the three is a named error, and
`\!adf:` is the literal, block and inline alike. A construct CommonMark binds first — a code span,
an autolink URI, a link destination or title — holds its `!adf:` as content; a directive's
`[content]`, which binds ahead of bracket matching, does not. A claimed block line also ends a lazy
continuation: the blockquote or list item whose paragraph CommonMark would fold it into closes
instead.

**Inline**: `!adf:name[content]{attrs}`, on one line — an inline directive never spans lines.
`[content]` is inline markdown; brackets inside balance as in CommonMark link text, `\]` for a
literal bracket. Whitespace at either edge of `[content]`, space or tab, is part of it and
survives inline parsing. Each section below says whether content is required, and `{attrs}` must
follow `]` (or the name) with no gap. An inline directive binds as a unit before bracket matching,
the way a code span does: a `]` or `(` inside its `{attrs}` is the directive's, never the enclosing
content's, and a `(` after its closing `]` opens no link.

**Block container**:

```
!adf:name arg {attrs}
block content
!adf:/name
```

`arg` is one optional bare token whose meaning each node defines (e.g. the panel type). The body is
block markdown. The closer names the innermost open container and carries nothing after the name;
one naming another node, or standing where no container is open, is a named error. Opening and
closing is what nests, so the opener reads the same at every depth, and a closer crosses no list
item or blockquote edge — a container opened inside one closes inside it. Directive block lines
follow code-fence indentation (up to three spaces relative to their container); an `!adf:` inside a
code fence or opaque carry is content.

**Block leaf**: `!adf:name arg {attrs}` — the same opener with no closer, `arg` reading as above.

Which of the two a node takes is its content model, never the spelling: a model taking content is
written as an opener–closer pair and one taking none as a leaf, so a leaf given a body and a
container missing its closer are each a named error. A node holding no content whose model takes
some is an empty pair. A spelled node's content model is contract in consequence — changing one is
MAJOR (`docs/decisions.md` §The formats are API).

Canonical spacing is the only spacing input reads: one space parts the name, `arg` and `{attrs}`,
and one parts each attribute pair, with no padding inside the braces. Trailing whitespace on a
directive block line is tolerated in input, never emitted.

**Attributes**: `{key=value key2="two words"}`. `{attrs}` is optional in every form, and `{}` is
valid — no attributes. A bare value matches `[A-Za-z0-9_-]+`; any other value is double-quoted
with JSON string escaping (`\"` `\\` `\n` `\t` `\uXXXX`, …) — total over
Unicode, and raw newlines never appear inside quotes. A quoted value also escapes `` ` ``, `&`,
`<` and `|` as `\u0060`, `\u0026`, `\u003c` and `\u007c`; `*`, `_`, `~`, `[`, `]` and `(` resolve
after a directive binds and stay raw. The closing `}` is the first one outside quotes, since a
quoted value holds `}` unescaped. All values are strings at the grammar level; each node's section
assigns types.
Canonical form orders keys alphabetically, spells values bare wherever allowed, escapes inside
quotes in the shortest form each escape has, and omits empty `{attrs}` except where the `{` is what
ends the name (`!adf:hardBreak{}`). Input reads that spelling alone: keys out of order, a value
quoted where bare carries it, an escape longer than it need be, an empty `{attrs}` on a block line
or after a `[content]`, and a number or `json` value outside its canonical JSON spelling are each a
named error naming the spelling to write instead.
`attrs`, `content` and `marks` are reserved keys on every directive — block, inline node and mark —
whose bare value `empty` spells the node's or mark's key holding an empty object or array:
`!adf:underline[a]{attrs=empty}`, `!adf:date{content=empty}`, `!adf:hardBreak{marks=empty}`. A
container spelling `content=empty` closes with no body; `attrs=empty` stands beside no other
attribute, argument or content slot; and an inline node spelling `marks=empty` stands inside no
mark spelling. Any other value of a reserved key is a named error, except on a block's `marks`
(Block nodes).

**Escaping**: the emitter backslash-escapes whatever literal text would otherwise parse as
directive syntax — every literal `!adf:`, `]` inside content, a bracket a link's destination and
title inside content leave unbalanced, a backtick there that would open a code span, a `{` right
after a directive's closing `]`, which would otherwise be read as the attributes it has none of;
outside code spans and code blocks, `\!adf:` in input yields the literal text.

**Malformed directives are error results**, named: an unclosed container at end of input, a closer
naming no open container or a node other than the innermost open one, a leaf given a body, an
`!adf:` completing no directive, an inline `[content]` or `{attrs}` left unclosed at end of line,
unparseable or duplicate-keyed attrs, invalid JSON in an opaque carry. Never a silent literal-text
fallback — a typo that reparses as prose is the silent loss the round-trip refuses.

## The opaque carry

A node no section spells where it stands (`docs/decisions.md` §Unknown nodes ride the carry) — an
unknown type, or a known one whose spelling belongs to the other position — rides as its raw JSON
and restores to a deep-equal node. A carry may hold a node the emitter spells natively: it restores
unreinterpreted, and the next emit spells it canonically (`docs/decisions.md` §The round-trip is the
product). Block and inline positions canonicalize differently, each fitting where it sits:

- **Block position**: a fenced code block with info string `adf:` and the node's type, body = the
  node's JSON without its `type` — two-space indent, object keys sorted: ```` ```adf:blockCard ````.
  A type no info string carries back, by the rule a `codeBlock`'s language follows, leaves the info
  string `adf:` and keeps `type` in the body. A body holding `type` under a named type, or an
  `adf:` fence whose type an info string carries, is a named error.
- **Inline position**: `!adf:carry{json="…"}` — compact serialization (keys sorted, no whitespace),
  JSON-string-escaped into the attribute.

Every info string opening `adf:` is reserved: a genuine `codeBlock` whose `language` opens so takes
the attribute the section below keeps for a language no info string holds, so the reservation
stays absolute. In block-directive position `!adf:carry` is a named error — the carry's block form
is the fence.

## Raw HTML in input

CommonMark input may contain raw HTML. `markdownToAdf` routes each construct through the foreign
HTML element mapping (`docs/decisions.md` §Foreign HTML sorts three ways; specified with the HTML
dialect, `todo.md` item 6) — ADF has no raw-HTML node, so a construct without a mapping, comments
and processing instructions included, is an error result naming it. The flavour never emits raw
HTML.

## Block nodes

The directive name is always the ADF node type. A container's body is the node's `content`; a leaf
has none. Every directive parses in any position — `markdownToAdf` builds exactly what is written;
validity against ADF's content models stays the author's business (`docs/decisions.md` §No schema
validation). It parses only in the form the emitter picks, though: a directive spelling a node the
emitter would have written as CommonMark is a named error.

Each section lists attributes as `name (type)`. A parenthesized value set documents what real
payloads hold; the type stays string and any value round-trips verbatim. Values map to attrs by
type: strings verbatim, numbers and booleans in canonical JSON spelling — quoted where not bare
(`width="33.33"`) — and `json` values as the inline carry's serialization (compact, keys sorted),
quoted, `-0` spelled `-0`. `markdownToAdf` builds an `attrs`, `content` or `marks` key only where the
markdown spells one, an empty one through its reserved key (Attributes), so a document reads back
deep-equal (`docs/decisions.md` §Equality is deep). A node CommonMark spells takes the directive
form to hold an empty key.

Marks on a block node ride the reserved attribute key `marks` — the node's marks array as a
`json` value, `marks=empty` where it is empty:
`!adf:layoutSection {marks="[{\"attrs\":{\"mode\":\"wide\"},\"type\":\"breakout\"}]"}`.
A section saying its body is inline takes at most one paragraph, whose inline content becomes
the node's `content`; any other body is a named error, and an empty pair is a node holding none.

A node the sections cannot spell rides the opaque carry: an attrs key its section does not
list, a value that is not the section's type, or an arg-slot value that is no bare token. In
markdown input the same mismatch is a named error.

### The CommonMark blocks

CommonMark spells `blockquote`, `bulletList`, `codeBlock`, `heading`, `listItem`, `orderedList`,
`paragraph` and `rule`, and keeps that spelling wherever it holds what the node carries. What it
cannot — `localId` (string) on any of them, marks, and the values below — takes the directive
form.

- `blockquote`, `bulletList`, `listItem` — containers, block body. Attributes: `localId` (string).
- `codeBlock` — container, body one fenced code block per text node, each fence's info string the
  language and its content the node's text; a node holding no `content` key is one empty fence.
  Attributes: `hideLineNumbers` (boolean), `language` (string), `localId` (string), `uniqueId`
  (string), `wrap` (boolean). A language no info string carries back — empty, opening the reserved
  `adf:`, or holding a backtick, a backslash, a control character, edge whitespace or an entity
  reference — rides the `language` attribute instead and the fences carry no info string, and so
  does a language beside `content=empty`, which has no fence; writing it in the slot that rule
  leaves empty, or in both, is a named error, and so are fences whose info strings differ and an
  empty fence beside another. Each fence is an ordinary code block, and its info string decodes
  escapes and entity references as any other does. A node holding a child no fence holds — any but
  a text node carrying no marks, `attrs` or `content` — rides the block carry.
- `heading` — container, inline body. Attributes: `level` (number), `localId` (string). `level` is
  the `#` count, so a heading carrying none, or one that is no whole number from 1 to 6, has no
  CommonMark spelling.
- `orderedList` — container of `listItem`, block body. Attributes: `localId` (string), `order`
  (number). `order` is the first marker, so a list carrying none, one that is no whole number
  from 0, or one whose markers would run past 999999999, has no CommonMark spelling.
- `paragraph` — container, inline body. Attributes: `localId` (string).
- `rule` — leaf. Attributes: `color` (string, `#rrggbb`), `localId` (string), `style` (`dashed`
  `dotted` `fade` `sketch` `solid`), `weight` (number, 1–3).

````
!adf:codeBlock {localId=01a03d5c-9b21-73f4-8e6a-0c47b1d9e2f8 wrap=true}
```rust
fn main() {}
```
!adf:/codeBlock
````

### Panel

- `panel` — container; the arg is `panelType` (`custom` `error` `info` `note` `success` `tip`
  `warning`). Attributes: `localId` (string), `panelColor` (string), `panelIcon` (string),
  `panelIconId` (string), `panelIconText` (string) — the editor writes the last four for `custom`
  panels.

```
!adf:panel warning
Check the collation before importing.
!adf:/panel
```

### Expand

- `expand`, `nestedExpand` — containers, no arg; same syntax, two node types, the name picks
  which. Attributes: `localId` (string), `title` (string).

```
!adf:expand {title="Full build log"}
…
!adf:/expand
```

### The media family

- `media` — leaf. Attributes: `alt` (string), `collection` (string), `height` (number), `id`
  (string), `localId` (string), `occurrenceKey` (string), `type` (`external` `file` `link`),
  `url` (string), `width` (number). `file` and `link` media carry `collection` + `id`;
  `external` media carry `url`.
- `mediaSingle` — container: one `!adf:media`, then optionally one `!adf:caption`. Attributes:
  `layout` (`align-end` `align-start` `center` `full-width` `wide` `wrap-left` `wrap-right`),
  `localId` (string), `width` (number), `widthType` (`percentage` `pixel`).
- `caption` — container, inline body. Attributes: `localId` (string).
- `mediaGroup` — container of `!adf:media` leaves. Attributes: none.

```
!adf:mediaSingle {layout=center width=50}
!adf:media {collection=MediaServicesSample id=4478e39c-cf9b-41d1-ba92-68589487cd75 type=file}
!adf:caption
The moon, at night.
!adf:/caption
!adf:/mediaSingle
```

**The CommonMark image.** A paragraph whose entire inline content is one image `![alt](url)` is
a `mediaSingle` with attrs exactly `{"layout":"center"}` holding an `external` `media` — `url`
from the destination, `alt` the description's plain-text content when non-empty — a link or image
inside it contributing its own text, a node spelling its text in the content slot contributing
that text, and a break of either kind a space. `adfToMarkdown` emits the image form for exactly
that shape — those attrs and no others, no marks on either node, no caption, and a `media`
carrying nothing beyond `alt`, `type` and `url` — and only where
CommonMark spells the pair: a destination or a description the image form cannot hold, an empty
`alt` included, takes the directive form instead. An image amid
other text, or one carrying a title, is a named error: `mediaInline` carries a media
`collection` + `id`, never a URL, and no media node carries a title.

### Tables

One header row plus plain inline cells is a pipe table; anything richer is the directive form
(`docs/decisions.md` §Tables). Precisely: a table emits as a pipe table exactly when the `table`,
every row and every cell carry no attrs and no marks, the first row is all `tableHeader` and the
rest all `tableCell`, every row has the header's cell count, and every cell holds exactly one
attr-less, mark-less paragraph — an empty cell holds one empty paragraph — with no `|` anywhere the
inline layer spells as syntax: a code span, an autolink, a link destination or title. A `|` there
takes the directive form instead. A pipe table parses back to exactly that shape.

```
| Part | Qty |
| --- | --- |
| Bolt M8 | 40 |
```

Claiming at block level, symmetric with directives: a line opening with an unescaped `|` is
claimed and must parse as part of a pipe table, else it is a named error — escape the pipe
(`\|`) to keep it literal text. The shape a missing leading pipe leaves is claimed too: a line
holding an unescaped `|`, followed inside one paragraph by a line whose cells are all `-` runs,
an alignment colon among them, and match it in count — GFM's table without the outer pipes — is
a named error rather than the prose it reads as. A pipe table is a header row, a delimiter row whose cells are
runs of one or more `-` (canonical `---`), and body rows; rows follow code-fence indentation.
Cells split on unescaped `|` before inline parsing — `\|` stays in the cell text, and the
inline layer's ordinary CommonMark escaping yields the pipe; each cell is the inline content of
one paragraph, trimmed; canonical form pads cells with single spaces and ends rows with `|`
(optional in input). Named errors: a delimiter or body row whose cell count differs from the
header's, and an alignment colon in the delimiter row — ADF holds no column alignment. In a
pipe cell a hard break is `!adf:hardBreak{}` and a literal `|` is `\|`; a `|` inside a quoted
attribute value is already `\u007c`, so the split never reaches it.

The directive form nests cells as containers of block content inside `tableRow` containers:

```
!adf:table {isNumberColumnEnabled=true width=760}
!adf:tableRow
!adf:tableHeader {colspan=2 colwidth="[340,420]"}
Assembly
!adf:/tableHeader
!adf:/tableRow
!adf:tableRow
!adf:tableCell {background="#deebff"}
Bolt M8
!adf:/tableCell
!adf:tableCell {valign=top}
40
!adf:/tableCell
!adf:/tableRow
!adf:/table
```

- `table` — container of `tableRow` containers. Attributes: `displayMode` (`default` `fixed`),
  `isNumberColumnEnabled` (boolean), `layout` (`align-end` `align-start` `center` `default`
  `full-width` `wide`), `localId` (string), `width` (number, pixels).
- `tableRow` — container of cells. Attributes: `localId` (string).
- `tableCell`, `tableHeader` — containers, block body. Attributes: `background` (string),
  `colspan` (number), `colwidth` (json, one pixel width per spanned column), `localId` (string),
  `rowspan` (number), `valign` (`bottom` `middle` `top`).

### Task and decision lists

- `taskList` — container of `taskItem`, `blockTaskItem` and nested `taskList` directives.
  Attributes: `localId` (string).
- `taskItem` — container, inline body; the arg is the state (`DONE` `TODO`). Attributes:
  `localId` (string).
- `blockTaskItem` — container, block body; the arg is the state as `taskItem`. Attributes:
  `localId` (string).
- `decisionList` — container of `decisionItem` directives. Attributes: `localId` (string).
- `decisionItem` — container, inline body. Attributes: `localId` (string), `state` (string —
  free-form; the editor writes `DECIDED`).

```
!adf:taskList {localId=0198f3a2-7c41-7f2e-9b3a-4d8e2c1a6b90}
!adf:taskItem DONE {localId=0198f3a2-8d52-70b1-8c4f-5e9f3d2b7ca1}
Write the spec
!adf:/taskItem
!adf:taskItem TODO {localId=0198f3a2-9e63-7d80-a15b-6fa04e3c8db2}
Ship it
!adf:/taskItem
!adf:/taskList
```

### Layout

- `layoutSection` — container of `layoutColumn` containers. Attributes: `columnRuleStyle` (`solid`),
  `localId` (string).
- `layoutColumn` — container, block body. Attributes: `localId` (string), `valign` (`bottom`
  `middle` `top`), `width` (number — percent).

```
!adf:layoutSection
!adf:layoutColumn {width=50}
Left.
!adf:/layoutColumn
!adf:layoutColumn {width=50}
Right.
!adf:/layoutColumn
!adf:/layoutSection
```

### Extensions

- `extension`, `bodiedExtension`, `multiBodiedExtension` — a leaf, a container with a block body,
  and a container of `extensionFrame` containers. Attributes: `extensionKey` (string),
  `extensionType` (string), `layout` (`default` `full-width` `wide`), `localId` (string),
  `parameters` (json), `text` (string).
- `extensionFrame` — container, block body. Attributes: none.

```
!adf:extension {extensionKey=toc extensionType="com.atlassian.confluence.macro.core" parameters="{\"maxLevel\":2}"}
```

### Sync blocks

- `syncBlock`, `bodiedSyncBlock` — a leaf and a container with a block body. Attributes:
  `localId` (string), `resourceId` (string).

```
!adf:syncBlock {localId=0198f3a2-af74-7e91-b26c-70b15f4d9ec3 resourceId="ari:cloud:confluence:site/page/123"}
```

## Inline nodes

Attributes and the carry fallback read as in the block sections, the carry in its inline form. Of
the nodes below, `emoji`, `mention` and `status` spell their `text` attribute in the content slot as
plain text: `[]` is the empty string, absent content is the absent attribute, non-empty content
parsing to anything but one text node carrying neither marks, attributes nor content is a named
error, and so is a `text` key in `{attrs}`. An enclosing mark spelling does not reach into the slot. The rest take no content,
`!adf:text` included; content on a node that takes none is a named error.

- `date` — Attributes: `localId` (string), `timestamp` (string, epoch milliseconds).
- `emoji` — Attributes: `id` (string), `localId` (string), `shortName` (string, `:name:`), `text`
  (string).
- `hardBreak` — Attributes: `localId` (string), `text` (string).
- `inlineCard` — Attributes: `data` (json), `localId` (string), `url` (string); real payloads
  carry one or the other.
- `mediaInline` — Attributes: `alt` (string), `collection` (string), `data` (json), `height`
  (number), `id` (string), `localId` (string), `occurrenceKey` (string), `type` (`file` `image`
  `link`), `width` (number).
- `mention` — Attributes: `accessLevel` (`APPLICATION` `CONTAINER` `NONE` `SITE`), `id` (string),
  `localId` (string), `text` (string), `userType` (`APP` `DEFAULT` `SPECIAL`).
- `status` — Attributes: `color` (`blue` `green` `neutral` `purple` `red` `yellow`), `localId`
  (string), `style` (string), `text` (string).

```
!adf:status[In review]{color=yellow} — !adf:mention[@Mikael]{id=01a032c3-7a7c-775f-a730-2d79351338b4}

Shipped !adf:emoji[🎉]{shortName=":tada:"} on !adf:date{timestamp=1756080000000}.
```

**Whitespace CommonMark cannot hold.** A newline inside a text node, and a space or tab where
CommonMark strips or refuses one — a block's inline content edges, either side of a line break, an
em, strong or strike spelling's inner edges, a pipe cell's edges — is spelled `!adf:text{text="…"}`,
the reserved key carrying the node's text, escaped by the attribute grammar and never literal: pipe
cells trim and pad. The emitter wraps the whitespace run alone and leaves the rest plain text, which
the spelled run joins on reading. Input reads that spelling alone: the value is one run of spaces
and tabs, or one run of newlines, and anything else — a mixed run, or text CommonMark carries
plainly — is a named error.

```
!adf:text{text="  "}Two leading spaces held, and one text node split!adf:text{text="\n"}over two lines.
```

**Adjacent text nodes.** CommonMark reads two adjacent text nodes back as one where neither is
carried, neither holds `attrs` or an empty key, and their marks are identical, attributes included.
The reserved leaf `!adf:textBreak{}` parts such a pair, inside every mark spelling the two share; a
code span holds no directive, so it closes and reopens. It builds no node and reads only between
two such nodes: elsewhere, or with `[content]` or `{attrs}`, it is a named error (`docs/decisions.md`
§`!adf:textBreak{}` parts text CommonMark would join). A text node holding `attrs` or an empty key
rides the inline carry.

```
Hello, !adf:textBreak{}world — **Hello, !adf:textBreak{}world** — `a`!adf:textBreak{}`b`
```

## Marks

An inline node's marks ride the spelling wrapped around them, never the block sections' reserved
`marks` key. `code`, `em`, `strike` and `strong` keep their markdown spellings, and are not
directive names: `!adf:em[x]` is a named error. `border`, `subsup`, `textColor` and `underline`
are inline directives, content required non-empty. `link` keeps its markdown spelling wherever
CommonMark holds it — `<url>` for a bare autolink-shaped text, else `[text](url "title")` — and is
the inline directive `!adf:link[text]{attrs}` only where CommonMark does not: an attribute besides
`href` and `title`, an `href` or `title` no canonical escape spells (a control character, a
backslash, an entity reference, an angle bracket beside a space or opening a bare destination, a
newline in the title), or a link opening a paragraph whose markdown spelling would read as a link
reference definition. Every such spelling carries an `href`: a directive link CommonMark could
spell is a named error, and so is one spelling none. No link wraps a link at any nesting, which is
CommonMark's own rule: a `[text]` already holding one leaves the outer brackets literal text, and
the directive form, open to no literal reading, is a named error.

- `border` — Attributes: `color` (string, `#rrggbb` or `#rrggbbaa`), `size` (number, 1–3).
- `code`, `em`, `strike`, `strong` — Attributes: none.
- `link` — Attributes: `collection` (string), `href` (string), `id` (string), `occurrenceKey`
  (string), `title` (string).
- `subsup` — Attributes: `type` (`sub` `sup`).
- `textColor` — Attributes: `color` (string, `#rrggbb`).
- `underline` — Attributes: none.

A spelling adds its mark to every inline node it wraps, and nesting is the marks array in order,
outermost first: `_!adf:underline[x]_` gives marks `[em, underline]`, `!adf:underline[_x_]` the
reverse. `adfToMarkdown` nests in the order the array holds rather than sorting it —
`docs/decisions.md` §Equality is deep restores the array, not a set — and opens each spelling once
over the longest run of adjacent inline nodes carrying an identical mark, attributes included, at
that depth: `attrs: {}` differs from no `attrs`, and a directive spells it `{attrs=empty}`. A run
breaks at every node the emitter carries, so no emitted carry sits inside a mark spelling.

An inline node whose marks no nesting spells — a mark type not listed here, an attrs key its
spelling does not list, a value that is not the spelling's type, an attribute the spelling needs
and the mark lacks, an empty `attrs` on a mark CommonMark spells, an order putting a code span outside another mark, `code` over anything but a
text node or over text holding a newline, or a spelling CommonMark's flanking rules cannot open or
close where the run sits (`un**-real**istic`), or one CommonMark's matching pairs elsewhere — the
intra-word `*` runs together with a neighbouring `**`, and the multiple-of-3 rule can leave the
merged run's pairing to another delimiter — rides the inline carry whole. An opaque carry inside a
mark spelling is a named error in input: the carry restores its node exactly, marks included
(`docs/decisions.md` §Unknown nodes ride the carry).

```
!adf:textColor[**Overdue**]{color="#ae2e24"}, H!adf:subsup[2]{type=sub}O, !adf:underline[signed].

!adf:link[the release]{collection=contentId-98237 href="https://example.com/release notes"}

!adf:border[!adf:mediaInline{collection=contentId-98237 id=01a032c3-7a90-70c9-88f6-c60f710eda07}]{color="#091e42" size=2}
```

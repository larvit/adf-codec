# Jira wiki markup

The wiki markup the lossless writer writes, the lossy writer writes and the reader reads, per node
and mark. Its source is Atlassian's "Text Formatting Notation Help", which every Jira site serves at
`/secure/WikiRendererHelpAction.jspa?section=all`; a spelling the help does not show is settled in
`docs/decisions.md` §Jira wiki markup spellings the help leaves open are a writer panel's picks. The
carry is in `docs/decisions.md` §Jira wiki markup carries what it cannot spell in Jira's `{adf}`
macro, and a lossy writer keeps only its content. The written form is contract
(`docs/decisions.md` §The formats are API).

## The carry

The lossless writer spells a node or mark wiki markup has no spelling for as Jira's own `{adf}`
macro around ADF JSON:

- A block node: `{adf:display=block}`, a line feed, the node's JSON, a line feed, `{adf}`.
- An inline node, or a run of inline nodes under a mark wiki markup cannot spell:
  `{adf:display=inline}`, the JSON of the node, or the array of the run's nodes, `{adf}`.

The JSON is compact, and a `{` inside a string is `\u007b`, so the closing `{adf}` stands nowhere
else. A node rides the carry where its type, an attribute or a mark has no spelling in the tables
below, or where its content holds a node that does. The carry holds the nearest block or inline node
that wiki markup can hold in its parent: a `listItem` and a `tableRow` cannot stand alone, so their
list or table rides it.

The lossy writer writes no `{adf}`. Where the lossless writer carries a node, the lossy writer keeps
what a reader of the rendered document sees, as `adfToPortableMarkdown` does (README §Portable
markdown): the node's text, link targets and titles, its blocks where it holds some, and nothing for
a `placeholder`. A mark the marks table does not spell drops, keeping its text. The lossy writer
also writes a table cell's blocks parted by `\\`.

## Blocks

Blocks are parted by one blank line. A document whose `content` is an empty array is the empty
string.

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `paragraph` | its inline content | the same; a line feed inside it is a `hardBreak`, as Jira renders it |
| `heading`, `level` 1 to 6 | `h1. ` to `h6. ` | the same |
| `blockquote` of one paragraph | `bq. `, the paragraph | the same |
| `blockquote`, any other | `{quote}`, a line feed, its blocks, a line feed, `{quote}` | the same |
| `bulletList`, `orderedList` | `* ` and `# `, one more mark per level, mixed as `#* ` and `*# `; an item holds a paragraph, then lists | also `- ` items, as `* ` |
| `codeBlock` with a `language` the help lists, one text node | `{code:java}`, a line feed, its text, a line feed, `{code}` | `{code}` reads `language` `java`, the help's default |
| `codeBlock` with no `language`, one text node | `{noformat}`, a line feed, its text, a line feed, `{noformat}` | the same |
| `panel` of `panelType` `info`, `note`, `tip`, `warning` | `{info}`, `{note}`, `{tip}`, `{warning}`, a line feed, its blocks, a line feed, the same macro | the same; a `title` parameter reads as the panel's first paragraph in `strong` |
| `rule` | `----` | the same |
| `table`, each cell one paragraph, a header row only first | `\|\|head\|\|`, then `\|cell\|` rows | the same |
| `mediaSingle`, centered, uncaptioned, holding an external `media` | `!url!`; `!url\|alt=text!` where it holds an `alt` with none of `!`, `\|`, `,` | the same |
| any other block node, a node of a type this version does not know | the carry | `{adf:display=block}` reads its node |

## Inline

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `text` | its text, a character wiki markup would read as markup where it stands taking a backslash; where a backslash cannot protect it, the run rides the inline carry | `\X` reads X |
| `hardBreak` | `\\` | the same |
| `mention` holding an `id` and no other attribute | `[~accountid:5b10ac8d82e05b22cc7d4ef5]` | the same; `[~name]` reads `id` `name` |
| any other inline node | the inline carry | `{adf:display=inline}` reads its nodes; `:)` and `:(` read `emoji` `:slight_smile:` and `:slight_frown:` |

## Marks

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `strong`, `em`, `strike`, `underline`, `code` | `*x*`, `_x_`, `-x-`, `+x+`, `{{x}}` | the same; `??x??` reads `em` |
| `subsup` | `^x^` for `sup`, `~x~` for `sub` | the same |
| `textColor` | `{color:#336699}x{color}` | the same; `{color:red}` reads `#ff0000` |
| `link` holding `href`, and `title` | `[text\|url]`, `[text\|url\|title]`; `[url]` where the text is the url | the same; `[#anchor]` and `[^name.ext]` read as targets `#anchor` and `^name.ext` |
| any other mark | the inline carry around the marked run | `{adf:display=inline}` reads its run |

A mark wiki markup spells opens and closes beside a character that bounds it. A run whose edge
touches a word character, or whose delimiters the reader would read another way, rides the inline
carry.

## What only the reader reads

- `{anchor:name}` reads as nothing: no ADF node holds a bookmark.
- `{panel}` reads as a `panel` of `panelType` `info`, as the table says of a title; its colours and
  border drop.
- `!name.ext!` reads as text: no ADF node holds an attachment by name.
- `---` and `--` read as `—` and `–`; `[file:///c:/temp/foo.txt]` reads as a `link`.
- A smiley other than `:)` and `:(` reads as text.

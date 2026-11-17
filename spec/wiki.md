# Jira wiki markup

What `adfToLosslessJiraWiki`, `adfToLossyJiraWiki` and the Jira wiki markup reader do with each ADF
node and mark. Each table's middle column is what both writers write, and the last is what the
reader reads; "The lossy writer" says where the lossy writer differs. The source is Atlassian's
"Text Formatting Notation Help", which Jira serves at `/secure/WikiRendererHelpAction.jspa?section=all`.
A spelling the help doesn't show is what a live Jira site reads and writes, else a writer panel's
pick, per `docs/decisions.md` §Jira wiki markup spellings the help leaves open are a writer panel's
picks. The written form is contract
(`docs/decisions.md` §The formats are API).

## The carry

Wiki markup has no spelling for some nodes, marks and attributes. The lossless writer writes each
such node as Jira's own `{adf}` macro around the node's ADF JSON, per `docs/decisions.md` §Jira wiki
markup carries what it cannot spell in Jira's `{adf}` macro, and a lossy writer keeps only its
content:

- A block node: `{adf:display=block}`, a line feed, the JSON, a line feed, `{adf}`.
- An inline node: `{adf:display=inline}`, the node's JSON, `{adf}`. The run of inline nodes under a
  mark with no spelling is one such macro per node, since Jira reads a node and never an array there.

The JSON is compact with its keys sorted, as `spec/flavour.md` writes the markdown carry's, and a
`{` inside a string is `\u007b`, so the closing `{adf}` is the only one the text holds. A document
holding no `content` key rides whole, as a block.

A node rides the carry when it, one of its attributes or one of its marks has no spelling below. It
also rides when it holds a block or inline node that rides, except that a node that rides inside a
paragraph stands on its own there, in the paragraph's text. A block that rides inside a list item or
a table cell makes the list or the table ride instead, since wiki markup can't hold a block macro
there. A `blockquote` written as `{quote}` that holds another at any depth rides, as does a `panel`
holding another `panel` at any depth, since a macro can't nest in its own kind. Any `localId` rides, since `docs/decisions.md`
§Ids stay site-local keeps ids in attributes.

## Blocks

Below, a markup character is a backslash, a bracket, a brace or `|`. Blocks are parted by one blank
line. A document whose `content` is an empty array is the empty
string.

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `blockquote` holding one paragraph | `bq. `, the paragraph | the same |
| `blockquote`, any other | `{quote}`, a line feed, its blocks, a line feed, `{quote}` | the same |
| `bulletList`, `orderedList` of `order` 1, its items each a paragraph then lists | `* ` and `# `, one more character per level, nested lists mixed as `#* ` and `*# ` | the same, and `- ` items as `* `; an `orderedList` reads `order` 1 |
| `codeBlock` holding one text node, of `language` `""` or a name below in lowercase | `{code:<language>}`, a line feed, the text, a line feed, `{code}`; for `""`, `{noformat}`, the text, `{noformat}` the same way | the same, reading a `{code:<language>}` name in lowercase and `{noformat}` as `language` `""`; `{code}` reads `java`; `title`, `borderStyle` and the other panel parameters drop |
| `heading` | `h1. ` to `h6. ` by `level` | the same |
| `mediaSingle` of `layout` `center`, holding one external `media` and no caption | `!<url>!`, or `!<url>\|alt=<alt>!` where `alt` isn't empty, holds no markup character, `!`, `,`, line feed or carriage return, and doesn't start or end with whitespace; a `url` that holds no `://`, or holds whitespace, `!` or a markup character, rides the carry | the same, reading `layout` `center`; `thumbnail`, `align` and the other parameters drop |
| `panel` of `panelType` `error`, `info`, `note`, `success` or `warning` | `{panel:bgColor=<colour>}`, a line feed, its blocks, a line feed, `{panel}`, the colour being `#ffebe6` for `error`, `#deebff` for `info`, `#eae6ff` for `note`, `#e3fcef` for `success` and `#fffae6` for `warning` | the same; a `title` parameter reads as the panel's first paragraph in `strong`; `{panel}` and any `bgColor` the five spellings leave out read as `info`, colours compared without case; the other parameters drop |
| `paragraph` holding content | its inline content | the same; a line feed in it reads as a `hardBreak`, as Jira renders it |
| `rule` | `----` | the same |
| `table` of `isNumberColumnEnabled` `false` and `layout` `default`, plain rows, each cell holding one paragraph | per cell, `\|\|` for a `tableHeader` and `\|` for a `tableCell`, then its paragraph, the row closed by the last cell's delimiter; an empty paragraph as a space | the same; a space-only cell reads as an empty paragraph, and a whitespace-only text rides the carry; reads `isNumberColumnEnabled` `false` and `layout` `default` |
| any other block node, including a `paragraph` holding no content or only whitespace outside a table cell, and a node of a type this version doesn't know | the carry | `{adf:display=block}` reads its node |

The names the help lists for a `codeBlock`: actionscript, ada, applescript, bash, c, c#, c++, css,
erlang, go, groovy, haskell, html, java, javascript, json, lua, nyan, objc, perl, php, python, r,
ruby, scala, sql, swift, visualbasic, xml and yaml. A `codeBlock` with any other `language`, none
included, or a text that is empty or holds `{code}` or `{noformat}`, rides the carry.

A value other than the one a table names, an absent attribute included, rides the carry: so does
a `width`, a merged cell and a colour.

## Inline

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `hardBreak` | `\\` | the same |
| `mention` holding `id` and `accessLevel` `""`, and no other attribute, the `id` not empty and holding no whitespace or markup character | `[~accountid:<id>]` | the same, reading `accessLevel` `""`; `[~name]` reads as text, since Jira Cloud names a user by account id |
| `text` | its text, escaped as below | `\\` reads as a `hardBreak` before `\X` reads `X`, except that Jira keeps the backslash before `:`, `;`, `.`, `,`, a letter, a digit or another backslash; a bare `http://` or `https://` address reads as a `link` |
| any other inline node | the carry | `{adf:display=inline}` reads its node |

A character takes a backslash where wiki markup would read it as markup. Here a line's edge counts
as whitespace, and a node's edge inside the line as punctuation:

- `[`, `]`, `{`, `}` and `|`, always. A text holding a `|` in a table cell rides the carry instead,
  since an escaped `|` still ends the cell.
- `*`, `+`, `-`, `^`, `_` and `~`, unless a letter or digit stands on both sides, or whitespace
  does.
- `?` before another `?`, and `!` before anything but whitespace.
- The `(` of a smiley listed under What only the reader reads, or the closing `)` of one that starts
  with `:` or `;`, where no letter or digit follows the smiley, or where the node's edge cuts it
  inside the line.
- At a line's start, `#`, `*` and `-`.

Jira keeps a backslash before `:`, `;`, `.`, `,`, a letter, a digit or another backslash as text.
So a backslash protects none of these, and a text holding one rides the carry:

- no character at all;
- a backslash, a line feed or a carriage return;
- `http://` or `https://`, which Jira would link;
- the `h` of `h1.` to `h6.` or the `b` of `bq.` at a line's start, in any case;
- a smiley that reads and that no backslash before its `(` or closing `)` stops: `:D` and `:P`
  where no letter or digit follows, and a `:` or `;` ending a node inside the line, where the next
  node's spelling may close a smiley.

A text that starts or ends its line with whitespace rides the carry too, and so does a text whose
marks are those of the text before it, which the reader would join. A `hardBreak` or `mention`
holding a mark rides as well.

## Marks

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `code`, `em`, `strike`, `strong`, `underline` | `{{x}}`, `_x_`, `-x-`, `*x*`, `+x+` | the same; `??x??` reads `em` |
| `link` holding `href` | `[<text>\|<href>]`, with `\|<title>` after the `href` where it holds a `title`; `[<href>]` where the link is the text's last mark, the text is the `href`, the link marks neither neighbour and holds no `title`, and the `href` doesn't start with `~`; an `href` that is empty or holds whitespace or a markup character rides the carry, as does a `title` that is empty, holds a markup character, a line feed or a carriage return, or starts or ends with whitespace | the same; `[#anchor]` and `[^name.ext]` read as `href` `#anchor` and `^name.ext` |
| `subsup` | `^x^` for `sup`, `~x~` for `sub` | the same |
| `textColor` | `{color:<hex>}x{color}` | the same; a CSS colour name reads as its hex code, so `red` as `#ff0000` |
| any other mark | the carry of each node of the marked run | `{adf:display=inline}` reads its node |

Marks nest in the order the node's array holds them, outermost first, and a run of nodes sharing
their outermost mark shares its delimiters. The delimiters of `code`, `em`, `strike`, `strong`,
`subsup` and `underline` each need whitespace, punctuation or the line's edge outside them, and no
whitespace inside them. A run where one fails rides the carry whole, as does a node holding two marks
of one type.

## The lossy writer

The lossy writer writes no `{adf}`. It writes the plain spellings above, and for what the lossless
writer carries it keeps the content, as `docs/decisions.md` §Plain text is blocks a blank line apart
says `adfToPlainText` does, in wiki markup:

- An attribute with no spelling drops. A node whose type has none is its text, or its blocks where
  it holds some.
- A `panel` of another type is `{panel}`. An `expand` is its title as a `*strong*` paragraph, then
  its body. A task item is `* `, then `☑ ` or `☐ ` and its text. A `status`, `date` and `emoji` are
  the text they show, and a `mention` that rides is its `text`.
- A `table` cell holding several blocks has them parted by `\\`; a `codeBlock` with a language the
  help doesn't list is `{noformat}`, and one whose text holds `{code}` or `{noformat}` is a
  paragraph of its lines parted by `\\`.
- A stored `media` is its `alt`, else `[image]`.
- A mark with no spelling drops, keeping its text.

## What only the reader reads

The writers never write these, and the reader reads them as follows:

- `{anchor:name}` reads as nothing, since no ADF node holds a bookmark.
- `!name.ext!`, an address holding no `://`, reads as its text: no ADF node holds an attachment by
  name. So does an image that shares its line with anything else.
- `{code}`, `{noformat}`, `{panel}` and `{quote}` open and close a block only at a line's start,
  and read as text inside a line. One left open holds the rest of the markup.
- An `{adf}` macro left open, or holding anything but one ADF node's JSON, is refused as
  `unsupported-node-shape`. An inline one closes on its line.
- `---` and `--` read as `—` and `–`.
- A smiley reads as the `emoji` Jira reads it as, wherever the next character is not a letter or a
  digit and whatever comes before it: `x:)` and `f(x)` read, `a:Pb` and `:)x` don't, and a backslash
  before its `(` or its closing `)` stops it: `\(y)` and `:\)` read as text. The `emoji`'s `text`
  is the character where its `id` is a code point, else its `shortName`.

  | Smiley | `shortName` | `id` |
  | --- | --- | --- |
  | `:)` | `:slight_smile:` | `1f642` |
  | `:(` | `:disappointed:` | `1f61e` |
  | `:P` | `:stuck_out_tongue:` | `1f61b` |
  | `:D` | `:smiley:` | `1f603` |
  | `;)` | `:wink:` | `1f609` |
  | `(y)` | `:thumbsup:` | `1f44d` |
  | `(n)` | `:thumbsdown:` | `1f44e` |
  | `(i)` | `:info:` | `atlassian-info` |
  | `(/)` | `:check_mark:` | `atlassian-check_mark` |
  | `(x)` | `:cross_mark:` | `atlassian-cross_mark` |
  | `(!)` | `:warning:` | `atlassian-warning` |
  | `(+)` | `:plus:` | `atlassian-plus` |
  | `(-)` | `:minus:` | `atlassian-minus` |
  | `(?)` | `:question:` | `atlassian-question_mark` |
  | `(on)` | `:light_bulb_on:` | `atlassian-light_bulb_on` |
  | `(off)` | `:light_bulb_off:` | `atlassian-light_bulb_off` |
  | `(*)` and `(*y)` | `:yellow_star:` | `atlassian-yellow_star` |
  | `(*r)` | `:red_star:` | `atlassian-red_star` |
  | `(*g)` | `:green_star:` | `atlassian-green_star` |
  | `(*b)` | `:blue_star:` | `atlassian-blue_star` |
  | `(flag)` | `:flag_on:` | `atlassian-flag_on` |
  | `(flagoff)` | `:flag_off:` | `atlassian-flag_off` |

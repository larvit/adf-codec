# Jira wiki markup

What `adfToLosslessJiraWiki`, `adfToLossyJiraWiki` and the Jira wiki markup reader do with each ADF
node and mark. Each table's middle column is what both writers write, and the last is what the
reader reads; "The lossy writer" says where the lossy writer differs. The source is Atlassian's
"Text Formatting Notation Help", which Jira serves at `/secure/WikiRendererHelpAction.jspa?section=all`.
A spelling the help doesn't show is a writer panel's pick, per `docs/decisions.md` §Jira wiki
markup spellings the help leaves open are a writer panel's picks. The written form is contract
(`docs/decisions.md` §The formats are API).

## The carry

Wiki markup has no spelling for some nodes, marks and attributes. The lossless writer writes each
such node as Jira's own `{adf}` macro around the node's ADF JSON, per `docs/decisions.md` §Jira wiki
markup carries what it cannot spell in Jira's `{adf}` macro, and a lossy writer keeps only its
content:

- A block node: `{adf:display=block}`, a line feed, the JSON, a line feed, `{adf}`.
- An inline node, or the run of inline nodes under a mark with no spelling, as an array:
  `{adf:display=inline}`, the JSON, `{adf}`.

The JSON is compact with its keys sorted, as `spec/flavour.md` writes the markdown carry's, and a
`{` inside a string is `{`, so the closing `{adf}` is the only one the text holds.

A node rides the carry when it, one of its attributes or one of its marks has no spelling below. It
also rides when it holds a block or inline node that rides, except that a node that rides inside a
paragraph stands on its own there, in the paragraph's text. A block that rides inside a list item or
a table cell makes the list or the table ride instead, since wiki markup can't hold a block macro
there. Any `localId` rides, since `docs/decisions.md` §Ids stay site-local keeps ids in attributes.

## Blocks

Blocks are parted by one blank line. A document whose `content` is an empty array is the empty
string.

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `blockquote` holding one paragraph | `bq. `, the paragraph | the same |
| `blockquote`, any other | `{quote}`, a line feed, its blocks, a line feed, `{quote}` | the same |
| `bulletList`, `orderedList` of `order` 1, its items each a paragraph then lists | `* ` and `# `, one more character per level, nested lists mixed as `#* ` and `*# ` | the same, and `- ` items as `* `; an `orderedList` reads `order` 1 |
| `codeBlock` holding one text node, of `language` `""` or a name below in lowercase | `{code:<language>}`, a line feed, the text, a line feed, `{code}`; for `""`, `{noformat}`, the text, `{noformat}` the same way | the same, reading a `{code:<language>}` name in lowercase and `{noformat}` as `language` `""`; `{code}` reads `java`; `title`, `borderStyle` and the other panel parameters drop |
| `heading` | `h1. ` to `h6. ` by `level` | the same |
| `mediaSingle` of `layout` `center`, holding one external `media` and no caption | `!<url>!`, or `!<url>\|alt=<alt>!` where `alt` holds none of `!`, `\|` and `,` | the same, reading `layout` `center`; `thumbnail`, `align` and the other parameters drop |
| `panel` of `panelType` `info`, `note`, `success`, `warning` or `error` | `{panel:bgColor=<colour>}`, a line feed, its blocks, a line feed, `{panel}`, the colour being `#deebff`, `#eae6ff`, `#e3fcef`, `#fffae6` or `#ffebe6` in that order | the same; a `title` parameter reads as the panel's first paragraph in `strong`; `{panel}` and any `bgColor` the five spellings leave out read as `info` |
| `paragraph` holding content | its inline content | the same; a line feed in it reads as a `hardBreak`, as Jira renders it |
| `rule` | `----` | the same |
| `table` of `isNumberColumnEnabled` `false` and `layout` `default`, plain rows, each cell holding one paragraph | per cell, `\|\|` for a `tableHeader` and `\|` for a `tableCell`, then its paragraph, the row closed by the last cell's delimiter; an empty paragraph as a space | the same; a space-only cell reads as an empty paragraph, and a whitespace-only text rides the carry; reads `isNumberColumnEnabled` `false` and `layout` `default` |
| any other block node, including a `paragraph` holding no content or only whitespace outside a table cell, and a node of a type this version doesn't know | the carry | `{adf:display=block}` reads its node |

The names the help lists for a `codeBlock`: actionscript, ada, applescript, bash, c, c#, c++, css,
erlang, go, groovy, haskell, html, java, javascript, json, lua, nyan, objc, perl, php, python, r,
ruby, scala, sql, swift, visualbasic, xml and yaml. A `codeBlock` with any other `language`, none
included, or a text holding `{code}` or `{noformat}`, rides the carry.

A value other than the one a table names, an absent attribute included, rides the carry: so does
a `width`, a merged cell and a colour.

## Inline

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `hardBreak` | `\\` | the same |
| `mention` holding `id` and `accessLevel` `""`, and no other attribute | `[~accountid:<id>]` | the same, reading `accessLevel` `""`; `[~name]` reads as text, since Jira Cloud names a user by account id |
| `text` | its text; a character wiki markup would read as markup where it stands takes a backslash, and a text no backslash protects, such as a backslash itself or a URL Jira would link, rides the carry | `\\` reads as a `hardBreak` before `\X` reads `X`; a bare `http://` or `https://` address reads as a `link` |
| any other inline node | the carry | `{adf:display=inline}` reads its nodes; a smiley in the table under "What only the reader reads" reads as that `emoji` |

## Marks

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `code`, `em`, `strike`, `strong`, `underline` | `{{x}}`, `_x_`, `-x-`, `*x*`, `+x+` | the same; `??x??` reads `em` |
| `link` holding `href` | `[<text>\|<href>]`, with `\|<title>` after the `href` where it holds a `title`; `[<href>]` where the text is the `href` and the link holds no `title` | the same; `[#anchor]` and `[^name.ext]` read as `href` `#anchor` and `^name.ext` |
| `subsup` | `^x^` for `sup`, `~x~` for `sub` | the same |
| `textColor` | `{color:<hex>}x{color}` | the same; a CSS colour name reads as its hex code, so `red` as `#ff0000` |
| any other mark | the carry around the marked run | `{adf:display=inline}` reads its run |

A mark's delimiters sit beside whitespace, punctuation or the line's edge, and the run's first and
last characters are not whitespace. A run where either fails rides the carry.

## The lossy writer

The lossy writer writes no `{adf}`. It writes the plain spellings above, and for what the lossless
writer carries it keeps the content, as `docs/decisions.md` §Plain text is blocks a blank line apart
says `adfToPlainText` does, in wiki markup:

- An attribute with no spelling drops. A node whose type has none is its text, or its blocks where
  it holds some.
- A `panel` of type `tip` is `{panel}`. An `expand` is its title as a `*strong*` paragraph, then
  its body. A task item is `* `, then `☑ ` or `☐ ` and its text. A `status`, `date` and `emoji` are
  the text they show, and a `mention` that rides is its `text`.
- A `table` cell holding several blocks has them parted by `\\`; a `codeBlock` with a language the
  help doesn't list is `{noformat}`, and one whose text holds `{code}` or `{noformat}` is a
  paragraph of its lines parted by `\\`.
- A stored `media` is its `alt`, else `[image]`.
- A mark with no spelling drops, keeping its text.

## What only the reader reads

Each of these has no ADF counterpart, so the reader keeps the text where there is some:

- `{anchor:name}` reads as nothing, since no ADF node holds a bookmark.
- `!name.ext!` reads as its text: no ADF node holds an attachment by name.
- `---` and `--` read as `—` and `–`.
- A smiley reads as the `emoji` Jira reads it as. `text` is the character where `id` is a code point,
  else the `shortName`.

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

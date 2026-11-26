# Jira wiki markup

What `adfToLosslessJiraWiki`, `adfToLossyJiraWiki` and the reader, `jiraWikiToAdf`, do with each ADF
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
included, or a text that is empty or holds a carriage return, `{code}` or `{noformat}`, rides the carry.

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
  inside the line. What the next node opens with continues no smiley starting with `:` or `;`, so
  a `:` or `;` ending a node stays plain, as in `*Environment:* Chrome`.
- At a line's start, `#`, `*` and `-`.

Jira keeps a backslash before `:`, `;`, `.`, `,`, a letter, a digit or another backslash as text.
So a backslash protects none of these, and a text holding one, or no character at all, rides the carry:

- a backslash, a line feed or a carriage return;
- `http://` or `https://`, which Jira would link;
- the `h` of `h1.` to `h6.` or the `b` of `bq.` at a line's start, in any case;
- a smiley that reads and that no backslash before its `(` or closing `)` stops: `:D` and `:P`
  where no letter or digit follows.

A text that starts or ends its line with whitespace rides the carry too, and so does a text whose
marks are those of the text before it, which the reader would join. A `hardBreak` or `mention`
holding a mark rides as well.

## Marks

| ADF | Wiki markup | Reader |
| --- | --- | --- |
| `code`, `em`, `strike`, `strong`, `underline` | `{{x}}`, `_x_`, `-x-`, `*x*`, `+x+` | the same; `??x??` reads `em` |
| `link` holding `href` | `[<text>\|<href>]`, with `\|<title>` after the `href` where it holds a `title`; `[<href>]` where the link is the text's last mark, the text is the `href`, the link marks neither neighbour and holds no `title`; an `href` that is no address of those below, or holds whitespace, a markup character, `"`, `<`, `>`, a backtick or `^`, rides the carry, as does a `title` that is empty, holds a markup character, a line feed or a carriage return, or starts or ends with whitespace | the same, the `href` holding the escapes below; `[#anchor]` reads as `href` `#anchor`; `[x]`, `[a\|x]` and `[a\|x\|t]` where `x` is no address of those below read as text, as `[^name.ext]` and `[~name]` do |
| `subsup` | `^x^` for `sup`, `~x~` for `sub` | the same |
| `textColor` | `{color:<hex>}x{color}` | the same; a CSS colour name reads as its hex code, so `red` as `#ff0000` |
| any other mark | the carry of each node of the marked run | `{adf:display=inline}` reads its node |

The reader reads `[x]` and `[a|x]` as a link where `x` is an address of one of these kinds, and as
text otherwise, brackets included; the writer carries any other `href`. The kinds come from probes
of a Jira Cloud site on 2026-11-25, over the URI schemes IANA registers, sixty more, and every path
and anchor of one or two characters drawn from twenty-three punctuation characters. A kind holds no
whitespace and no `[`, `]`, `{`, `}`, `|` or `\`:

- `/` or `#`, then anything, except the string `//`.
- A scheme, its case ignored, then `://` and at least one character: `file`, `ftp`, `ftps`,
  `gopher`, `hipchat`, `http`, `https`, `sftp`, `smb` and the schemes of the next kind.
- A scheme, its case ignored, then `:` and a rest that is neither empty nor starts with `#` or
  `//`: `callto`, `cvs`, `facetime`, `feed`, `git`, `irc`, `irc6`, `itms`, `magnet`, `mailto`,
  `mvn`, `news`, `nntp`, `notes`, `rdp`, `sip`, `sips`, `skype`, `slack`, `ssh`, `svn`, `tel`,
  `telnet`, `urn`, `vnc`, `whatsapp` and `xmpp`.

No address of any kind holds a second `#` or a `%` not followed by two hexadecimal digits. A `^`
followed by another character makes Jira read an attachment embed, which the reader leaves as text:
in an address with a scheme always, and in a path or anchor where the text after some `^` is
neither empty nor holds a `:`. So `/a^b` and `#a^^` read as text, and `/a^:b`, `#a^b:c` and `/a^`
read as links. A bare address links whatever its `^`. Jira shows a scheme outside these, such as
`javascript`, `data`, `ws` and `ldap`, as text.

Jira stores a linked `href` with `"` as `%22`, `<` as `%3C`, `>` as `%3E`, a backtick as `%60` and
every `^` as `%5E`, whether the address is bracketed or bare. The reader reads that `href`, and the
text of `[x]` and of a bare address keeps the characters as written.

Marks nest in the order the node's array holds them, outermost first, and a run of nodes sharing
their outermost mark shares its delimiters. The delimiters of `code`, `em`, `strike`, `strong`,
`subsup` and `underline` each need whitespace, punctuation or the line's edge outside them, and no
whitespace inside them. A run where one fails rides the carry whole, as does a node holding two marks
of one type.

## The lossy writer

The lossy writer writes no `{adf}`. It writes the plain spellings above, and for what the lossless
writer carries it keeps the content, as `docs/decisions.md` §Plain text is blocks a blank line apart
says `adfToPlainText` does, in wiki markup:

- An attribute with no spelling drops. An inline node whose type has none is its text, then its
  content. A block of such a type is its text, then its blocks. A block with no text or blocks, and a
  paragraph of whitespace alone, drop.
- A `panel` of a type the help doesn't list is an `info` panel. A `{quote}` inside a `{quote}`, or a
  `{panel}` inside a `{panel}`, stands as its blocks there. An `expand` is its title as a `*strong*`
  paragraph, then its body. A `taskList` is a bullet list, and a task item is `☑ ` or `☐ `, then its
  text.
- A table cell holding several blocks has their lines parted by `\\`, a list's items included.
- A `listItem` holding several blocks has its text blocks parted by `\\` on its marker's line, and
  each list it holds nested under it. A block after such a list starts an item of its own.
- What a list holds that is no item is an item of its own. What a table or a row holds that is no row
  or cell follows the table, as its blocks.
- A `codeBlock` with a language the help doesn't list is `{noformat}`, and one whose text holds `{code}`
  or `{noformat}` is a paragraph of its lines parted by `\\`. Each carriage return in its text is a
  line feed.
- A stored `media`, or an external one with no address, is its `alt`, else `[image]`. Any other
  external `media` is an image, its address's whitespace, `!` and markup characters percent-encoded;
  where that address holds no `://`, it is the `alt` and ` (address)` as text, else the address.
  Its `alt` is trimmed, then follows the image as a paragraph where the image spelling can't hold it.
  A link around a `media` follows it as a paragraph holding the link. A caption is a paragraph after
  the image. In a table cell or a list item an image is its `alt` and ` (address)`, else its address.
- A `status`, `date` and `emoji` are the text they show. A `mention` is `[~accountid:<id>]` where its
  `id` holds no whitespace or markup character, else its `text`. A card is its name and ` (address)`,
  else its address. A line feed in a text is `\\`, and a carriage return drops.
- A mark with no spelling drops, keeping its text, as does a second mark of one type on a node. A
  `textColor` of three hex digits is written as six. A link's `href` has its whitespace and `[`, `]`,
  `{`, `}`, `|` and `\` percent-encoded, then as Jira stores it (`storedHref`), and its `title` follows its text in parentheses, since Jira
  drops one written in the link. A link whose address Jira doesn't link, such as `a`, is its text,
  followed by ` (address)` unless the text is the address.
- Whitespace at a line's edges drops. Whitespace at the edge of a text a delimiter marks stands
  outside the delimiter. A run whose delimiters wouldn't read, such as `*` beside a letter, drops those
  marks.
- Text the lossless writer carries because no backslash protects it is written with the backslashes
  that do apply, and otherwise as it stands: a backslash, `http://`, a smiley, and `h1.` or `bq.` at a
  line's start. A backslash run Jira would read as something else is written between `{noformat}`:
  exactly two, one before a character the writer escapes, and one that ends a text unless it ends the
  line outside a table cell. A `|` in a table cell is written between `{noformat}`, since an escaped
  one still ends the cell. A run of `*`, `_`, `-` or `+` marks around a `{noformat}` drops those marks.

It refuses a document nested past 500 levels, each node counting one level. The lossless writer
writes such a document.

## What only the reader reads

The writers never write these, and the reader reads them as follows:

- `{anchor:name}` reads as nothing, since no ADF node holds a bookmark.
- An address standing bare, `http://` or `https://` first, reads as its text linked to its `href` as
  Jira stores it, less the run of `.`, `,`, `;`, `?`, `!`, `'` and `)` ending it, where a `?` stays
  in the link if a `,`, `;`, `'` or `)` follows it. It ends at whitespace, `"`, a backtick, `>`, `|`,
  `[`, `]`, `{`, `}` or `\`.
- `!name.ext!`, whose address holds no `://`, reads as text: no ADF node holds an attachment by
  name. So does an image that shares its line with anything else, its address read as a bare one.
- `{code}`, `{noformat}`, `{panel}` and `{quote}` open a block at a line's start or right after
  another of them, and read as text after anything else on a line. `{panel}` and `{quote}` close
  one in the same places, `{code}` and `{noformat}` wherever the closing macro stands. One left
  open holds the rest of the markup.
- An `{adf}` macro left open, or holding anything but one ADF node's JSON, is refused as
  `unsupported-node-shape`. So is one inside a line that closes on a later line.
- In a `{code}` or `{noformat}` text, a carriage return before a line feed reads as nothing, so
  markup whose lines end in both reads as markup whose lines end in a line feed.
- `---` and `--` with whitespace or the line's edge on each side read as `—` and `–`. So `-- ` at
  a line's start is no nested bullet.
- `h1.` to `h6.` and `bq.` read with a space after the dot or none, and in lower case alone, as
  Jira reads them.
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

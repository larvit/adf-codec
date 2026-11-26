# Changelog

## Unreleased

- Read `-- ` and longer dash runs in Jira wiki markup as nested bullets while a list is open, as Jira does, where the reader read them as dashes
- **Breaking:** `adfToLosslessMarkdown` indents the JSON in a carry fence two spaces a level for its first five levels and writes a value nested deeper compact on its line, where `0.3.1` indented every level. A carried node of deeply nested JSON, which `0.3.1` refused as `unsupported-node-shape`, now converts. `losslessMarkdownToAdf` still reads the carry `0.3.1` wrote, but `0.3.1` refuses a carry nested deeper than five levels that `0.4.0` wrote, so upgrade every reader before the writer (`MIGRATION.md`).
- The Jira wiki writers now write a hard break before a `{` or a backslash so Jira reads it as a break: the lossless writer carries it, the lossy one follows it with a space
- The gate bundles the installed package with Bun, esbuild, Rollup and webpack, fails on any bundler warning, such as webpack's "Critical dependency", and round-trips a document through each bundle in Node. The README's package table names the four.
- Document the Jira wiki calls `adfToLosslessJiraWiki`, `adfToLossyJiraWiki` and `jiraWikiToAdf` in the README, with a row comparing them with Atlassian's `WikiMarkupTransformer`.
- Read a Jira wiki link's `href` as Jira stores it, with `"`, `<`, `>`, a backtick and `^` as percent escapes, and carry in an `{adf}` macro a link whose `href` holds one of them.
- A lone surrogate no longer reaches markdown raw, where UTF-8 storage turned it into U+FFFD. `adfToLosslessMarkdown` writes a link, an image or a code block language holding one as its directive, its carry or its `language` attribute, so the document reads back equal. `adfToPortableMarkdown` drops one from text, a title and an alt text, and writes one in a link's or an image's address as `%EF%BF%BD`. A mention, emoji or extension key holding only lone surrogates, whitespace and null characters counts as empty in every format, and is written by its fallback.
- Make `adfToPortableMarkdown` linear in a run of spaces or tabs inside one text node, where 80 000 spaces between two letters took 7 s.
- Read no trailing `!adf:{…}` marker from inside a link destination, so `[a](<u !adf:{localId=">)"}` reads as a link followed by the text `"}`; the lossless writer spells a heading or paragraph id as the block's directive where its marker would join a link.
- **Breaking:** `adfToLosslessMarkdown` writes a paragraph, heading, quote, list, list item, code block or rule holding a `localId` in its CommonMark spelling, with the id in an `!adf:{localId=…}` marker, where `0.3.1` wrote a directive. An empty paragraph or heading, and a list with an item whose id has no first paragraph, keep the directive. `losslessMarkdownToAdf` still reads the directives `0.3.1` wrote; `0.3.1` can't read the markers.
- Add `jiraWikiToAdf`, which reads Jira wiki markup into ADF, `{adf}` macros included, and refuses only a broken `{adf}` macro and markup past the nesting or engine limits.
- Add `adfToLosslessJiraWiki`, which writes ADF as Jira wiki markup and carries each node or mark wiki markup cannot spell in Jira's `{adf}` macro, so nothing is lost.
- Add `adfToLossyJiraWiki`, which writes ADF as Jira wiki markup alone. It keeps the content of what wiki markup cannot spell, such as a custom panel, a task list or a table cell of several blocks, and drops only its form.
- **Breaking:** `commonMarkToAdf`, `losslessMarkdownToAdf` and `portableMarkdownToAdf` match a link reference to its definition under Unicode case folding, where `0.3.1` lowercased the label. `[ẞ]` with `[SS]: /url` reads as a link, and where two definitions' labels fold together, the first wins. `ı` and `I` stay two labels.
- `adfToPortableMarkdown` writes a line of whitespace-only text nodes beside a hard break, every other one linked, in time linear in the number of nodes, where `0.3.1` took time quadratic in it.
- `adfToPortableMarkdown` writes a line of code spans alternating with emphasized spaces in time linear in its length, where `0.3.1` took time quadratic in it.
- `adfToHtml` writes a media single, a media group and a caption as `<figure class="adf-media-single">` holding an
  `<img>` and a `<figcaption>`, and as `<div class="adf-media-group">` of `<span class="adf-file">` files, where
  `0.3.1` wrote the carry element, and `htmlToAdf` reads them back. A link around the image is the media's link
  mark. The carry element `0.3.1` wrote for them still reads.
- `adfToHtml` writes underline as `<u>`, subscript and superscript as `<sub>` and `<sup>`, a text colour as
  `<span data-text-color="…">`, a background colour as `<mark data-background-color="…">` and a paragraph's or
  heading's alignment as `data-align="center"` or `data-align="end"`, where `0.3.1` wrote the carry element,
  and `htmlToAdf` reads them back. The carry element `0.3.1` wrote for them still reads.
- **Breaking:** `adfToHtml` writes a table cell's background as `data-background-color="…"`, where `0.3.1` wrote
  `style="background-color:…"`, so the HTML holds no `style` attribute and a browser no longer shows the colour
  unaided. `htmlToAdf` still reads the `0.3.1` spelling. A table whose cell background isn't letters and digits after
  an optional `#` is written too, where `0.3.1` wrote the whole table as the carry element.
- `htmlToAdf` names every spelling of the dialect's `<div>`, `<span>` and `<mark>` in the refusal of one it can't
  read.
- `adfToHtml` writes a paragraph's or heading's indentation as `data-indent-level="2"`, where `0.3.1` wrote the carry
  element, and `htmlToAdf` reads it back. The carry element `0.3.1` wrote for it still reads.
- `htmlToAdf` reads an expand's `<details class="adf-expand" open="">`, as a browser writes one its user opened, as the same expand.
- `adfToHtml` writes a panel as `<div class="adf-panel">`, an expand and a nested expand as `<details>` with the
  title in a `<summary>`, a task list as `<ul class="adf-task-list">` of items each a checkbox then its text, and a
  decision list as `<ul class="adf-decision-list">`, where `0.3.1` wrote the carry element, and `htmlToAdf` reads
  them back. The carry element `0.3.1` wrote for them still reads.
- `adfToHtml` writes a `strike` mark as `<del>`, where `0.3.1` wrote the carry element, and `htmlToAdf` reads
  `<del>` as `strike`. The carry element `0.3.1` wrote for it still reads.
- `adfToPlainText` writes a document as text with no markup, for a search index, a notification or an
  email: blocks a blank line apart; `• ` and `1.` list markers, `☑ ` and `☐ ` for a done and an open
  task, nesting indented; a link's address and title in parentheses after its text; a hard break as a
  line feed; a mention, emoji, date or status as the text it shows; a table as a line per row, its
  cells apart by ` | `; an image as its alt text and address, the address alone with no alt text, `[image]`
  with neither; a card as its address, or its name then its address; an extension as its text; and an
  expand's title above its body. It refuses what `adfToHtml`
  refuses.
- `readAdfDocument` and the four writers name the node `not-an-adf-document` refuses: `path` leads
  to a node that is not an ADF node, and the message says what is wrong with it, such as which
  attribute holds a value that is not JSON. A getter, an object holding itself, a throwing Proxy
  and a bad array length are still refused at the empty path.
- **Breaking:** `portableMarkdownToAdf` reads more of GFM's pipe table. A body row holding fewer
  cells than the header is padded with empty cells, where `0.3.1` returned `malformed-pipe-table`;
  a table whose padding would add more cells than the table holds is `malformed-pipe-table`.
  A line after the table that holds no `|` and opens no other block is a row of one cell, where it
  was a paragraph. A row holding more cells stays an error result.
- **Breaking:** `a |` over `--- |` is a one-column table. `portableMarkdownToAdf` reads it as one,
  and `losslessMarkdownToAdf` returns `malformed-pipe-table` for it, as for any table without
  leading pipes, where `0.3.1` read both as a paragraph. `MIGRATION.md` shows the change.
- `adfToPortableMarkdown` keeps a link around the note standing in place of a node it marks, such
  as a stored image: `[_(image not included)_](https://example.com/a)`.
- **Breaking:** `readAdfDocument` replaces `isAdfDocument`: it returns a `Result<AdfDocument>` whose
  error names the branch that refused, and `MIGRATION.md` shows the change.
- `readAdfDocument`, `adfToHtml`, `adfToLosslessMarkdown` and `adfToPortableMarkdown` read the
  document once into a plain copy. A document holding an accessor property, or a Proxy that throws,
  returns `not-an-adf-document`, where `0.3.1` ran the getter, looped or threw. The copy keeps own
  enumerable keys alone, so an inherited or non-enumerable key drops. A document of more than
  10,000,000 JSON values returns `unsupported-node-shape`.
- The README states the package's minified and gzipped size, its tarball and its unpacked size, and gives each compared converter's minified and gzipped size in a column of the comparison table. The release fails where the package's stated size is more than a tenth off the build's.
- **Breaking:** `adfToLosslessMarkdown` writes a lone surrogate in a text node as `!adf:text{text="\ud800"}`, and one in a code span, a code block, an image's alt text or an `emoji`, `mention` or `status` as the carry, where `0.3.1` wrote it raw, which a UTF-8 encode turns into U+FFFD. `losslessMarkdownToAdf` reads the spelling, which `0.3.1` refuses as `unsupported-node-shape`, and refuses a raw lone surrogate in an `emoji`, `mention` or `status` slot, which `0.3.1` read.

## 0.3.1

- The README opens with a one-line description, a list of the calls and the package's perks, and
  `package.json`'s description, which npmjs shows, is now that same line, naming Jira and Confluence.

## 0.3.0

- **Breaking:** `adfToPortableMarkdown` refuses, as `unsupported-node-shape`, a known block holding
  `text`, a known non-text inline node holding `text` or non-empty `content`, and a known block that
  takes no content, such as `rule`, holding non-empty `content`. `adfToLosslessMarkdown` now refuses
  them inside a carried node too, and `losslessMarkdownToAdf` refuses a carry holding one.
  `MIGRATION.md` says how to convert stored markdown.
- **Breaking:** `losslessMarkdownToAdf` gives a `date`, `emoji`, `inlineCard`, `mention`, `status`
  or `mediaInline` only the marks Atlassian's schema lets it hold: `**!adf:mention[@A]{id=…}**` now
  reads as a plain mention. A link or directive mark around only nodes that cannot take it is
  `unsupported-node-shape`, even in markdown `adfToLosslessMarkdown` wrote. A link around hard
  breaks alone still reads as before. `adfToLosslessMarkdown` writes a node holding a mark its type
  cannot take as `!adf:carry{json="…"}`, except an inline card a link marks, which it refuses.
  `MIGRATION.md` says how to convert stored markdown.
- **Breaking:** `adfToLosslessMarkdown` and `adfToPortableMarkdown` refuse an inline card a link marks
  as `unsupported-node-shape` at the card's path, and `losslessMarkdownToAdf` refuses a carry
  holding one, since Atlassian's schema gives a card no link mark. `MIGRATION.md` says what to do.
- **Breaking:** every reader gives code text no mark but `link` and `annotation`, as Atlassian's
  schema requires: ``**`npm ci`**`` now reads as plain code, and a directive mark other than a link
  around only code spans is `unsupported-node-shape`. `adfToLosslessMarkdown` writes code text
  holding another mark as `!adf:carry{json="…"}`, and `adfToPortableMarkdown` drops that mark.
- **Breaking:** `losslessMarkdownToAdf` gives text no `border` mark, as Atlassian's schema requires:
  `!adf:border[x]{color="#091e42" size=2}` is `unsupported-node-shape`, and only a
  `mediaInline` takes `border`. `adfToLosslessMarkdown` writes text holding `border` as `!adf:carry{json="…"}`.
  `MIGRATION.md` says how to convert stored markdown.
- `docs/feature-table.md` sets example documents beside what `adfToLosslessMarkdown`,
  `adfToPortableMarkdown` and `adfToHtml` write for them, and says whether each output reads back to
  the same document.
- The package's description and keywords say it needs no React, Atlaskit or runtime dependency and
  runs in Node, Forge, Deno, Bun and browsers, and the README opens with the call to take for each
  need. The README's first comparison table lists the npm packages running in Node that convert ADF
  to or from markdown, wrappers and forks aside; its second table lists other ecosystems'
  libraries and Atlassian's own paths.
- `adfToHtml` writes ADF as HTML: paragraphs, headings, lists, quotes, tables, code blocks, rules,
  hard breaks, a centered, uncaptioned external image holding no attribute but its URL and alt, and
  `em`, `strong`, `code` and links as their elements. An unmarked emoji, mention, status, date
  and card holding a URL, or `data` holding one, not both, are `<span class="adf-emoji">`,
  `<span class="adf-mention">`, `<span class="adf-status">`, `<time class="adf-date">` and
  `<a class="adf-inline-card">`. A paragraph, heading, quote, list, list item, table, row, cell,
  code block, rule, emoji, mention, status, date or card writes its other attributes as `data-*` attributes,
  `localId` as `data-local-id`. Every other node is an element of class `adf-carry` holding the
  node's JSON in `data-adf` and showing its content, links included. Every URL is written as the
  ADF holds it, `javascript:` included: sanitize HTML from an author you do not trust before
  showing it.
  It refuses, carried or not and as `unsupported-node-shape`, a known block holding `text`, a known
  non-text inline node holding `text` or non-empty `content`, and a known block that takes no
  content, such as `rule`, holding non-empty `content`.
- `htmlToAdf` reads `adfToHtml`'s HTML back to the document it came from, a carry element from its
  `data-adf`. It reads that HTML as a browser's `innerHTML` writes it too (a raw `"` in text,
  `&nbsp;`, a raw `<` or `>` in an attribute value) and as a form post sends it (`\r\n` for each
  line feed). An edit to an emoji's, mention's or status's text becomes its `text`; an edit to a
  date's or a card's text alone is refused. It refuses any other HTML, including an edit to what a
  carry element shows, with the codes README §The calls lists.
  It also refuses a carry element holding a shape `adfToHtml` refuses.
- `adfToLosslessMarkdown` and `adfToPortableMarkdown` write an `em`, `strike`, `strong` or `link`
  mark once across the hard breaks between two texts it marks: `_One\` then `Two_`, where they
  wrote `_One_\` then `_Two_`. They write an `em`, `strike` or `strong` mark once around a code
  span: ``**Run `npm ci` first**``. `adfToLosslessMarkdown` also writes those three once across
  mentions, emoji, dates, statuses, inline cards and inline media, as
  `**Ping !adf:mention[@A]{id=x} now**`, and a link once across mentions, emoji, dates, statuses
  and inline cards. The markdown reads back to the same ADF as before, except that
  `adfToPortableMarkdown` drops whitespace beside a hard break a mark crosses, where CommonMark
  strips it. Where the joined line would not read back, the writers write the line as before.
- Every reader keeps the URL and title of an image inside a link's text, where it dropped them:
  after the link comes `(image)`, which links to the image, so
  `[look at ![the moon](moon.png "Full") tonight](/moon)` reads as
  `[look at the moon tonight](/moon) ([image](moon.png "Full"))`. A link to the image's own URL
  takes no `(image)`, unless the image's title is one the link lacks.
- `adfToPortableMarkdown` keeps both targets of a linked external image standing inline, as in a
  table cell: `[alt](href) ([image](url))`, where it wrote `[alt](url)` and dropped the link's target.
- `adfToPortableMarkdown` keeps a link title holding a backslash or an entity reference such as
  `&amp;`, and in a table cell one holding a `|`, where it dropped the title. It escapes the
  character where CommonMark would read it otherwise, as in `[docs](https://example.com "AT\&amp;T")`,
  and `portableMarkdownToAdf` reads the title back.
- `losslessMarkdownToAdf` names the CommonMark spelling to write when it refuses a directive whose
  node CommonMark spells, such as `[![alt](url)](href)` for a linked `!adf:mediaSingle`.
- Every reader and writer takes time linear in the text when it holds many `<!--`, `<?`,
  `<![CDATA[` or `<!` openers without a terminator, or many unclosed backtick runs outside a
  directive's `[content]`. Such a text took time quadratic in its length: 160000 characters of `<?`
  took seven seconds each way, now 50 ms.
- Every reader takes time linear in the markdown when it holds blank lines under list items nested
  deeply. Such a list is still refused as `unsupported-nesting-depth`, now after 40 ms where 20000
  nested items and as many blank lines took 10.7 seconds.
- Every reader takes time linear in the markdown when tab-indented lines sit under list items
  nested deeply. Such a list is still refused as `unsupported-nesting-depth`, now after 107 ms where
  20 lines of 40000 tabs under 80000 nested items took 1988 ms.
- `losslessMarkdownToAdf` takes time linear in the markdown when an inline directive's `[content]`
  holds many unclosed backtick runs: 640000 characters of them took one second, now 100 ms.
- Every reader takes time linear in the inline markdown when emphasis spans many links, or many
  closing brackets follow a link: 8000 links inside 8000 `*` took two seconds, now about 100 ms.
- Every reader takes time linear in the inline markdown when it holds many `](` that open no link,
  as in `[a](b` repeated: 16000 of them took 25 seconds, now 80 ms.
- `adfToLosslessMarkdown` and `adfToPortableMarkdown` write faster a line of many marked texts or
  inline nodes that need a carry or lose their mark, as in text `un` beside strong `-r`, repeated:
  1000 of them took 10 seconds, now 150 ms. They also write faster a line mixing em, strike and
  strong: text `un` beside `-r` marked em and strong, repeated 1000 times, took up to 9 seconds,
  now under 170 ms, and `(` marked em, strike and strong beside a mention, repeated 1000 times,
  took 18 seconds in `adfToPortableMarkdown`, now 150 ms. A line where em shares a delimiter run
  with strong takes time linear in its length: `~~` between spaces marked em and strong, `)` marked
  em, strike and strong, `a`, then `.unun` marked strike and strong, repeated 1000 times, took 56
  seconds in `adfToLosslessMarkdown` and 130 in `adfToPortableMarkdown`, now 2.6 and 1.5 seconds. A
  line still read back wrong after 32 tries is written with every node holding em, strike or
  strong as `!adf:carry{json="…"}` in `adfToLosslessMarkdown`, and without those marks in
  `adfToPortableMarkdown`.
- `adfToLosslessMarkdown` and `adfToPortableMarkdown` take time linear in the markdown when lists
  and quotes nest deeply, and so does `losslessMarkdownToAdf`: a list nested 480 levels around
  64 KB of paragraphs took 2 seconds to write, now 100 ms. A `!adf:blockquote` holding 2 MB of lines
  in a list nested 480 levels is still refused as `unsupported-node-shape`, now after 0.8 seconds
  where it took 2.6.
- Every reader leaves `[text]`, `[text][]`, `[text][label]` and a definition `[label]: url` literal
  when the label runs over 999 characters, where it read them as a link or a definition. CommonMark
  caps a label at 999 characters, an escape counting as two.
- Every reader leaves a link or a definition literal when its unbracketed destination holds a `(`
  that is neither escaped nor closed, as CommonMark requires: `[a](b(c "t")` is now text, where it
  read as a link to `b(c`. Markdown the writers wrote reads as before, since they escape such a
  parenthesis.
- `adfToLosslessMarkdown` and `adfToPortableMarkdown` escape every text `[` in a line where one
  would open a link, and every text backtick where one would open a code span: the text
  `[a](b) [c]` is now written `\[a](b) \[c]`, where it was `\[a](b) [c]`. A text `[` that opens
  nothing stays bare: `[a] b](c` is now written as is, where it was `\[a] b](c`. Markdown written
  by 0.2.0 reads the same in 0.3.0.
- The README compares the package with seven other ADF converters, each checked against its
  published version.

## 0.2.0

- **Breaking:** each call names the markdown it reads or writes. `adfToMarkdown` and `markdownToAdf`
  are now `adfToLosslessMarkdown` and `losslessMarkdownToAdf`. A bot's or a model's markdown reads
  in `portableMarkdownToAdf`, and markdown known to be strict CommonMark in the new
  `commonMarkToAdf`, where a directive, a pipe table, `~~` and an `adf:` fence read as text and
  code. `MIGRATION.md` says which call to take.
- **Breaking:** the markdown readers refuse a value that is not a string with the new code
  `not-a-string`; `MIGRATION.md` lists what each value did before.
- **Breaking:** every call returns the new code `engine-limit` where a conversion passes the
  JavaScript engine's longest array, `Map` or `Set`, or meets an out-of-memory throw the call can
  catch, and, on JavaScriptCore, its longest string. A retry may succeed. Every other refusal stays deterministic.
- **Breaking:** an attribute value that is not a plain object, array or JSON primitive, such as a
  `Date`, `Map`, typed array or class instance, makes `isAdfDocument` return `false` and the
  converters refuse it as `not-an-adf-document`. Before, the converters wrote it as `{}` or its own
  keys. Build it as JSON holds it: `date.toISOString()`, `Object.fromEntries(map)`,
  `Array.from(bytes)`, `{ ...instance }`.
- **Breaking:** directives, the inline opaque carry among them (now `!adf:carry{json="…"}`), are
  spelled under an `!adf:` prefix (`!adf:name … !adf:/name`, `!adf:name[content]{attrs}`,
  `!adf:name arg {attrs}`) in place of the `:::`/`::`/`:name` forms: text holding an unescaped
  `!adf:` is claimed. Convert stored markdown per `MIGRATION.md`.
- **Breaking:** the block carry is a code fence whose info string `adf:<type>` names the node's
  type, its body the node's JSON without `type`, and a code fence whose info string opens `adf:` is
  claimed, and `adf` is an ordinary code block language. Convert stored markdown per `MIGRATION.md`.
- **Breaking:** the markdown readers read markdown holding no block as a document whose `content` is
  empty, as Atlassian's schema requires; `!adf:doc {content=none}` spells a document holding no
  `content` key.
- **Breaking:** `unspellable-character`, `unspellable-line-start` and `unspellable-whitespace`
  leave `ConvertErrorCode`. A line ending in an `emoji`, `mention` or `status` directive's content
  slot is refused as `unsupported-node-shape`. A carriage return in text is spelled `&#13;` and a
  null character `!adf:text{text="\u0000"}`; a paragraph line opening with a code span is spelled
  as that code span, its backticks opening no fence; a code block holding either character, a code
  span holding a null character, a text node holding no text or holding `content`, and an `emoji`,
  `mention` or `status` whose `text` holds a line ending or a null character ride the carry. See
  `MIGRATION.md`.
- **Breaking:** `unspellable-link` leaves `ConvertErrorCode`; a link whose `href` or `title` no
  CommonMark escape spells is written as `!adf:link[text]{attrs}`.
- **Breaking:** some directive refusals carry `malformed-directive` where they carried
  `unsupported-node-shape`, and an empty node's leaf and closed spellings swap which one parses;
  `MIGRATION.md` lists each.
- **Breaking:** a link whose text holds another link keeps the inner link and leaves the outer
  brackets literal text, where `0.1.0` split the outer link around it; see `MIGRATION.md`.
- **Breaking:** `unmappable-image` leaves `ConvertErrorCode`, and every image reads. An image reads
  as an image only alone in its paragraph, and its title becomes the caption. Anywhere else, after
  a task marker too, it reads as its alt text linked to its URL; inside a link, as plain text the
  link marks. A link alone in its paragraph whose whole text is one image reads as that image, with
  the link marking it. To keep an image an image, give it a paragraph of its own. See
  `MIGRATION.md`.
- **Breaking:** an empty link text reads as its destination, `[](/url)` as `/url` linked, and
  `[]()` as nothing, where both spellings stayed literal text. See `MIGRATION.md`.
- **Breaking:** a hard break inside emphasis, strike, a link or a directive mark reads holding no
  marks, as Atlassian's schema requires, where every reader gave it the marks around it. A link
  whose text is only hard breaks reads as its destination linked, followed by those breaks, and
  `losslessMarkdownToAdf` refuses a directive mark wrapping only hard breaks as
  `unsupported-node-shape`. `adfToLosslessMarkdown` writes a hard break holding marks as
  `!adf:carry{json="…"}`. See `MIGRATION.md`.
- **Breaking:** a list whose bullet character or ordered delimiter changes reads as two lists, as
  CommonMark reads it: `- a` then `* b`, `1. a` then `1) b`. `adfToLosslessMarkdown` gives a list
  right after one of its kind the other marker, `* ` or `1)`, in place of the `::listBreak`
  separator. Convert stored markdown per `MIGRATION.md`.
- **Breaking:** a link reference definition between two list items, after a blank line and at the
  list's own indentation, ends the list, as CommonMark reads it; `0.1.0` read one list. See
  `MIGRATION.md`.
- **Breaking:** `adfToLosslessMarkdown` writes a centered, uncaptioned external image whose one
  mark is a link holding only `href` and `title` as `[![alt](url)](href "title")`, where it wrote the
  `mediaSingle` directive. Convert stored markdown per `MIGRATION.md`.
- **Breaking:** `adfToLosslessMarkdown` writes `colwidth` as its widths joined by commas,
  `colwidth="340,420"`, and a block's `marks` as each mark's type and attributes,
  `marks="breakout{mode=wide}"`, where it wrote both as JSON arrays, and `losslessMarkdownToAdf`
  refuses an array the new spelling holds. `marks` stays a JSON array where the flavour does not list
  a mark. Convert stored markdown per `MIGRATION.md`.
- Fix the time `adfToLosslessMarkdown` and `adfToPortableMarkdown` take on text holding a long run of
  `*`, `_`, `~` or backticks, or a heading ending in a long run of `#`: the time is linear in the
  run, and a run of 20000 `*` takes milliseconds where it took seconds.
- Fix the round-trip, so `losslessMarkdownToAdf(adfToLosslessMarkdown(doc))` deep-equals `doc` as
  `JSON.parse` builds it. Two adjacent text nodes CommonMark would read back as one are parted by
  `!adf:textBreak{}`, an empty `attrs`, `content` or `marks` is spelled `{attrs=empty}`,
  `{content=empty}` or `{marks=empty}`, `-0` is spelled `-0`, and a `codeBlock` of several text
  nodes is a fence per node. A `codeBlock` holding other than plain text nodes rides the block
  carry, where it was refused.
- Fix a link `title` holding a null character: it is written as `!adf:link[text]{attrs}`, where it
  read back as U+FFFD.
- Fix an image inside another image's description: it flattens into the alt text, where it was
  refused.
- Fix a JSON key holding an escape, in a carried node or a JSON attribute such as `parameters`:
  `losslessMarkdownToAdf` reads it as the key it spells, where on V8 13.6 and later (Node 24, Deno,
  Chrome) `markdownToAdf` could refuse markdown `adfToMarkdown` wrote, as `unsupported-node-shape`,
  once the process had read a key holding a backslash
  ([V8 bug](https://issues.chromium.org/issues/521080746)).
- Fix a cyclic document, in which an object holds itself: `adfToLosslessMarkdown` and
  `adfToPortableMarkdown` refuse it as `not-an-adf-document` and `isAdfDocument` returns `false`,
  where all three hung.
- Fix a document whose markdown would be longer than 536870888 characters, V8's longest string:
  `adfToLosslessMarkdown` and `adfToPortableMarkdown` refuse it as `unsupported-node-shape` on every
  engine, where they threw or ran out of memory.
- Fix a directive that, written out as plain CommonMark, would be longer than 536870888 characters:
  `losslessMarkdownToAdf` refuses it as `unsupported-node-shape`, where a few megabytes of nested
  list lines ran the call out of memory.
- Fix the markdown readers past V8's or SpiderMonkey's longest string: they return
  `unsupported-node-shape`, where they threw.
- Fix a paragraph of tens of millions of characters: `adfToLosslessMarkdown` and
  `adfToPortableMarkdown` need a few bytes a character on top of the document and its markdown,
  where they needed about 50. Before, 80 million characters ran Node's default heap out of memory
  and 20 million `*` threw `RangeError`. `losslessMarkdownToAdf` no longer throws `RangeError` on
  such a paragraph inside a directive.
- Fix deeply nested compact JSON in an `adf:` fence: `losslessMarkdownToAdf` refuses it as
  `unsupported-node-shape`, as it refuses any compact JSON there, where about a megabyte of it threw.
- Add `adfToPortableMarkdown` and `portableMarkdownToAdf`, a lossy pair converting ADF to and from
  markdown GitHub, GitLab and Obsidian render: alerts, callouts, task lists, `==highlights==` and
  pipe tables. A task item keeps its paragraphs, then its nested task lists; the rest of the item,
  such as an image or a code block, stands after the task list. `portableMarkdownToAdf` reads GFM's
  pipe table with or without leading pipes, and with alignment colons, dropping the alignment.
- Spell `rule`'s `color`, `style` and `weight`, `layoutSection`'s `columnRuleStyle` and a link's
  `collection`, `id` and `occurrenceKey` directly where they rode the opaque carry.
- The README opens with what the package does and for whom, and `package.json` carries search
  keywords.
- The source moves to [github.com/larvit/adf-codec](https://github.com/larvit/adf-codec), where
  issues and pull requests go.

## 0.1.0

- First release: lossless conversion between ADF and an extended markdown flavour —
  `adfToMarkdown`, `markdownToAdf` and `isAdfDocument`. Nothing throws, and every error carries a `code` from a
  closed list.

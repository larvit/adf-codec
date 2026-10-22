# Changelog

## Unreleased

- **Breaking:** `losslessMarkdownToAdf` gives a `date`, `emoji`, `inlineCard`, `mention`, `status`
  or `mediaInline` only the marks Atlassian's schema lets it hold: `**!adf:mention[@A]{id=…}**` now
  reads as a plain mention. A link or directive mark around only nodes that cannot take it is
  `unsupported-node-shape`, even in markdown `adfToLosslessMarkdown` wrote. A link around hard
  breaks alone still reads as before. `adfToLosslessMarkdown` writes a node holding a mark its type
  cannot take as `!adf:carry{json="…"}`. `MIGRATION.md` says how to convert stored markdown.
- **Breaking:** every reader gives code text no mark but `link` and `annotation`, as Atlassian's
  schema requires: ``**`npm ci`**`` now reads as plain code, and a directive mark other than a link
  around only code spans is `unsupported-node-shape`. `adfToLosslessMarkdown` writes code text
  holding another mark as `!adf:carry{json="…"}`, and `adfToPortableMarkdown` drops that mark.
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

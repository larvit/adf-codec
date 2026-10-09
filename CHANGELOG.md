# Changelog

## Unreleased

- **Breaking:** each call names the markdown it reads or writes. `adfToMarkdown` and `markdownToAdf`
  are now `adfToLosslessMarkdown` and `losslessMarkdownToAdf`. A bot's or a model's markdown reads
  in `portableMarkdownToAdf`, and markdown known to be strict CommonMark in the new
  `commonMarkToAdf`, where a directive, a pipe table, `~~` and an `adf:` fence read as text and
  code. `MIGRATION.md` says which call to take.
- **Breaking:** the markdown readers refuse a value that is not a string with the new code
  `not-a-string`; `MIGRATION.md` lists what each value did before.
- **Breaking:** an attribute value that is not a plain object, array or JSON primitive, such as a
  `Date`, `Map`, typed array or class instance, makes `isAdfDocument` return `false` and the
  converters refuse it as `not-an-adf-document`. Before, the converters wrote it as `{}` or its own
  keys. Build it as JSON holds it: `date.toISOString()`, `Object.fromEntries(map)`,
  `Array.from(bytes)`, `{ ...instance }`.
- The README opens with what the package does and for whom, and `package.json` carries search
  keywords.
- The source moves to [github.com/larvit/adf-codec](https://github.com/larvit/adf-codec), where
  issues and pull requests go.
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
- `losslessMarkdownToAdf(adfToLosslessMarkdown(doc))` deep-equals `doc` as `JSON.parse` builds it:
  two adjacent text nodes CommonMark would read back as one are parted by `!adf:textBreak{}`, an
  empty `attrs`, `content` or `marks` is spelled `{attrs=empty}`, `{content=empty}` or
  `{marks=empty}`, `-0` is spelled `-0`, and a `codeBlock` of several text nodes is a fence per
  node. A `codeBlock` holding other than plain text nodes rides the block carry, where it was
  refused.
- **Breaking:** `unspellable-character` and `unspellable-line-start` leave `ConvertErrorCode`, and
  `adfToLosslessMarkdown` no longer returns `unspellable-whitespace`. A carriage return in text is
  spelled `&#13;` and a null character `!adf:text{text="\u0000"}`; a paragraph line opening with a
  code span is spelled as that code span, its backticks opening no fence; a code block holding
  either character, a code span holding a null character, a text node holding no text or holding
  `content`, and an `emoji`, `mention` or `status` whose `text` holds a line ending or a null
  character ride the carry. See `MIGRATION.md`.
- Fix a link `title` holding a null character: it is written as `!adf:link[text]{attrs}`, where it
  read back as U+FFFD.
- **Breaking:** `unspellable-link` leaves `ConvertErrorCode`; a link whose `href` or `title` no
  CommonMark escape spells is written as `!adf:link[text]{attrs}`.
- **Breaking:** some directive refusals carry `malformed-directive` where they carried
  `unsupported-node-shape`, and an empty node's leaf and closed spellings swap which one parses;
  `MIGRATION.md` lists each.
- **Breaking:** a link whose text holds another link keeps the inner link and leaves the outer
  brackets literal text, where `0.1.0` split the outer link around it; see `MIGRATION.md`.
- Add `adfToPortableMarkdown` and `portableMarkdownToAdf`, a lossy pair converting ADF to and from
  markdown GitHub, GitLab and Obsidian render: alerts, callouts, task lists, `==highlights==` and
  pipe tables. A task item holds only paragraphs: from its first other block, such as an image or
  a code block, the rest of the item stands after the task list.
- Spell `rule`'s `color`, `style` and `weight`, `layoutSection`'s `columnRuleStyle` and a link's
  `collection`, `id` and `occurrenceKey` directly where they rode the opaque carry.
- Fix an image inside another image's description: it flattens into the alt text, where it was
  refused.
- **Breaking:** `unmappable-image` leaves `ConvertErrorCode`, and every image reads. An image reads
  as an image only alone in its paragraph, and its title becomes the caption. Anywhere else, after
  a task marker too, it reads as its alt text linked to its URL; inside a link, as plain text the
  link marks. A link alone in its paragraph whose whole text is one image reads as that image, with
  the link marking it. To keep an image an image, give it a paragraph of its own. See
  `MIGRATION.md`.
- **Breaking:** an empty link text reads as its destination, `[](/url)` as `/url` linked, and
  `[]()` as nothing, where both spellings stayed literal text. See `MIGRATION.md`.
- Fix a JSON key holding an escape, in a carried node or a JSON attribute such as `parameters`:
  `losslessMarkdownToAdf` reads it as the key it spells, where on V8 13.6 and later (Node 24, Deno,
  Chrome) `markdownToAdf` could refuse markdown `adfToMarkdown` wrote, as `unsupported-node-shape`,
  once the process had read a key holding a backslash
  ([V8 bug](https://issues.chromium.org/issues/521080746)).
- **Breaking:** a hard break inside emphasis, strike, a link or a directive mark reads holding no
  marks, as Atlassian's schema requires, where every reader gave it the marks around it. A link
  whose text is only hard breaks reads as its destination linked, followed by those breaks, and
  `losslessMarkdownToAdf` refuses a directive mark wrapping only hard breaks as
  `unsupported-node-shape`. `adfToLosslessMarkdown` writes a hard break holding marks as
  `!adf:carry{json="…"}`. See `MIGRATION.md`.
- Fix a cyclic document, in which an object holds itself: `adfToLosslessMarkdown` and
  `adfToPortableMarkdown` refuse it as `not-an-adf-document` and `isAdfDocument` returns `false`,
  where all three hung.

## 0.1.0

- First release: lossless conversion between ADF and an extended markdown flavour —
  `adfToMarkdown`, `markdownToAdf` and `isAdfDocument`. Nothing throws, and every error carries a `code` from a
  closed list.

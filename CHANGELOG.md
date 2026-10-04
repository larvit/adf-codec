# Changelog

## Unreleased

- The README opens with what the package does and for whom, and compares it with the other ADF
  converters on npm; `package.json` carries search keywords.
- The source moves to [github.com/larvit/adf-codec](https://github.com/larvit/adf-codec), where
  issues and pull requests go.
- **Breaking:** directives, the inline opaque carry among them (now `!adf:carry{json="…"}`), are
  spelled under an `!adf:` prefix (`!adf:name … !adf:/name`, `!adf:name[content]{attrs}`,
  `!adf:name arg {attrs}`) in place of the `:::`/`::`/`:name` forms: text holding an unescaped
  `!adf:` is claimed. Convert stored markdown per `MIGRATION.md`.
- **Breaking:** the block carry is a code fence whose info string `adf:<type>` names the node's
  type, its body the node's JSON without `type`, and a code fence whose info string opens `adf:` is
  claimed, and `adf` is an ordinary code block language. Convert stored markdown per `MIGRATION.md`.
- **Breaking:** `markdownToAdf` and `plainMarkdownToAdf` read markdown holding no block as a
  document whose `content` is empty, as Atlassian's schema requires; `!adf:doc {content=none}`
  spells a document holding no `content` key.
- `markdownToAdf(adfToMarkdown(doc))` deep-equals `doc` as `JSON.parse` builds it: two adjacent text
  nodes CommonMark would read back as one are parted by `!adf:textBreak{}`, an empty `attrs`,
  `content` or `marks` is spelled `{attrs=empty}`, `{content=empty}` or `{marks=empty}`, `-0` is
  spelled `-0`, and a `codeBlock` of several text nodes is a fence per node. A `codeBlock` holding
  other than plain text nodes rides the block carry, where it was refused.
- **Breaking:** `unspellable-character` and `unspellable-line-start` leave `ConvertErrorCode`, and
  `adfToMarkdown` no longer returns `unspellable-whitespace`. A carriage return in text is spelled
  `&#13;` and a null character `!adf:text{text="\u0000"}`; a paragraph line opening with a code span
  is spelled as that code span, its backticks opening no fence; a code block holding either
  character, a code span holding a null character, a text node holding no text or holding
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
- Add `adfToPlainMarkdown` and `plainMarkdownToAdf`, a lossy pair converting ADF to and from
  markdown GitHub, GitLab and Obsidian render: alerts, callouts, task lists, `==highlights==` and
  pipe tables.
- Spell `rule`'s `color`, `style` and `weight`, `layoutSection`'s `columnRuleStyle` and a link's
  `collection`, `id` and `occurrenceKey` directly where they rode the opaque carry.
- Fix an image inside another image's description: it flattens into the alt text, where it was
  refused.
- Fix a cyclic document, in which an object holds itself: `adfToMarkdown` and `adfToPlainMarkdown`
  refuse it as `not-an-adf-document` and `isAdfDocument` returns `false`, where all three hung.

## 0.1.0

- First release: lossless conversion between ADF and an extended markdown flavour —
  `adfToMarkdown`, `markdownToAdf` and `isAdfDocument`. Nothing throws, and every error carries a `code` from a
  closed list.

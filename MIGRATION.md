# Migrating

## From `0.1.0` to `0.2.0`

Each call names the markdown it reads or writes:

| `0.1.0` | `0.2.0` |
| --- | --- |
| `adfToMarkdown` | `adfToLosslessMarkdown` |
| `markdownToAdf`, for markdown `adfToMarkdown` wrote | `losslessMarkdownToAdf` |
| `markdownToAdf`, for markdown a person or a model wrote | `portableMarkdownToAdf`, which keeps GFM's pipe tables and `~~`; or `commonMarkToAdf`, which reads them, a directive and an `adf:` fence as CommonMark does, as text and code |

Directives moved under the `!adf:` prefix. `losslessMarkdownToAdf` reads `0.1.0`'s spelling without
an error, turning each directive into text and each carried node into an `adf` code block. Before
`0.2.0` reads any `0.1.0` markdown, convert what is stored or in flight (an open editor, a queue)
with the recipe below, and rewrite markdown your code writes or matches (templates, prompts,
patterns) by the tables below. Stored ADF needs one change: give a document holding no `content` key
`content: []`. `0.1.0` built that shape from empty markdown, meaning the empty document.

### Convert markdown

Read it with `0.1.0` and write it with `0.2.0`, installed side by side:

```sh
npm install @larvit/adf-codec@0.2.0 adf-codec-0.1@npm:@larvit/adf-codec@0.1.0
```

```ts
import { adfToLosslessMarkdown } from '@larvit/adf-codec'
import { markdownToAdf as markdownToAdf010 } from 'adf-codec-0.1'

function migrateMarkdown(stored: string) {
  const parsed = markdownToAdf010(stored)
  // 0.1.0 dropped an empty content array, so a document with no content key meant an empty one.
  return parsed.ok ? adfToLosslessMarkdown({ ...parsed.value, content: parsed.value.content ?? [] }) : parsed
}
```

- Convert each document once: a second pass can return ok while turning the directives into text.
  Stop `0.1.0` writing first, and record which documents are converted.
- A refusal carrying `position` is `0.1.0`'s parse, which refused that markdown before too. One
  without is `0.2.0`'s emit: store the document `markdownToAdf010` read as ADF, with
  `content: parsed.value.content ?? []` as the recipe gives it, rather than keeping the unconverted
  markdown.

### Spellings

| `0.1.0` | `0.2.0` |
| --- | --- |
| `:::panel info` … `:::`, the fence longer per nesting level | `!adf:panel info` … `!adf:/panel` at any depth |
| `::media {id=a type=file}` | `!adf:media {id=a type=file}` |
| `::taskItem TODO {localId=i}`: an empty `caption`, `decisionItem`, `paragraph` or `taskItem`, or an empty `heading` carrying `localId` | `!adf:taskItem TODO {localId=i}` then `!adf:/taskItem` |
| `:mention[@Mikael]{id=5b10a2}` | `!adf:mention[@Mikael]{id=5b10a2}` |
| the `adf` code fence and `:adf{json="…"}` | the `adf:<type>` code fence, its JSON without `type`, and `!adf:carry{json="…"}` |
| `\:` keeps a directive literal | `\!adf:` keeps a directive literal |
| `:adf{json="…"}` carrying a link for its `collection`, `id` or `occurrenceKey` | `!adf:link[text]{attrs}` |

A colon run and `:name[` are plain text now, and `adf` an ordinary code block language; text
holding an unescaped `!adf:` and a code fence whose info string opens `adf:` are claimed instead.

### Readings

Markdown the spelling table leaves alone, which `0.2.0` reads as a different document.

| Input | `0.1.0` | `0.2.0` |
| --- | --- | --- |
| a link whose text already holds one (`[a<https://example.com/>b](/v)`) | marks every node the inner link does not, splitting the outer link around it | leaves the outer brackets literal text; write the pieces as separate links to keep them |
| markdown holding no block (`""`) | `{ type: 'doc', version: 1 }` | `{ content: [], type: 'doc', version: 1 }`; `!adf:doc {content=none}` reads as the former |
| a code fence whose info string opens `adf:` (```` ```adf:x ````) | a `codeBlock` with that language | in `losslessMarkdownToAdf`, the block carry, refusing a body that is not one node's canonical JSON; write `!adf:codeBlock {language="adf:x"}` around a bare fence to keep the code block |

### Error codes

`unspellable-character`, `unspellable-line-start` and `unspellable-link` leave `ConvertErrorCode`
and `not-a-string` joins it: a `switch` naming one of the three stops compiling, and one naming
every code needs the new case. A document `adfToMarkdown` refused with one of the three now
converts in `adfToLosslessMarkdown`; markdown the parser refused with one of the three now refuses
with the code the table gives.

| Input | `0.1.0` | `0.2.0` |
| --- | --- | --- |
| a link whose `href` or `title` no CommonMark escape spells, on emit | `unspellable-link` | spells `!adf:link[text]{attrs}` |
| a carriage return in text, on emit | `unspellable-character` | spells `&#13;` |
| a null character in text, on emit | `unspellable-character` | spells `!adf:text{text="\u0000"}` |
| a carriage return or null character in a code block, or a null character in a code span, on emit | `unspellable-character` | rides the carry |
| a paragraph line opening with a code span of three or more backticks, on emit | `unspellable-line-start` | spells the code span |
| a block directive whose CommonMark spelling holds a carriage return, a null character or a code span opening a line, on parse | `unspellable-character`, `unspellable-line-start` | `unsupported-node-shape`; write the CommonMark spelling |
| an `emoji`, `mention` or `status` whose `text` holds a line ending or a null character, on emit | `unspellable-whitespace`, `unspellable-character` | rides the inline carry |
| a text node holding no text, or holding `content`, on emit | `unsupported-node-shape` | rides the carry |
| a `codeBlock` holding other than plain text nodes, on emit | `unsupported-node-shape` | rides the block carry |
| a leaf node given a body (`media`, `listBreak`) | `unsupported-node-shape` | `malformed-directive` |
| a node with a block body written as a leaf (`panel`) | `unsupported-node-shape` | `malformed-directive` |
| an empty node the `::taskItem` spelling row names, written as a leaf | parses | `malformed-directive` |
| an empty node the `::taskItem` spelling row names, written with a closer | `unsupported-node-shape` | parses |
| `null`, `undefined` or a non-empty array, on parse | throws a `TypeError` | `not-a-string` |
| a `String` object, on parse | the document its text spells | `not-a-string`; pass `String(value)` |
| any other value that is not a string, such as a number or `{}`, on parse | an empty document | `not-a-string` |

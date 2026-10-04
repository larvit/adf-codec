# Migrating

## From `0.1.0` to `0.2.0`

Directives moved under the `!adf:` prefix. `0.2.0` reads `0.1.0`'s spelling without an error,
turning each directive into text and each carried node into an `adf` code block. Before `0.2.0`
reads any `0.1.0` markdown, convert what is stored or in flight (an open editor, a queue) with the
recipe below, and rewrite markdown your code writes or matches (templates, prompts, patterns) by the
tables below. Stored ADF needs one change: give a document holding no `content` key `content: []`.
`0.1.0` built that shape from empty markdown, meaning the empty document.

### Convert markdown

Read it with `0.1.0` and write it with `0.2.0`, installed side by side:

```sh
npm install @larvit/adf-codec@0.2.0 adf-codec-0.1@npm:@larvit/adf-codec@0.1.0
```

```ts
import { adfToMarkdown } from '@larvit/adf-codec'
import { markdownToAdf as markdownToAdf010 } from 'adf-codec-0.1'

function migrateMarkdown(stored: string) {
  const parsed = markdownToAdf010(stored)
  // 0.1.0 dropped an empty content array, so a document with no content key meant an empty one.
  return parsed.ok ? adfToMarkdown({ ...parsed.value, content: parsed.value.content ?? [] }) : parsed
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
| markdown holding no block (`markdownToAdf("")`) | `{ type: 'doc', version: 1 }` | `{ content: [], type: 'doc', version: 1 }`; `!adf:doc {content=none}` reads as the former |
| a code fence whose info string opens `adf:` (```` ```adf:x ````) | a `codeBlock` with that language | the block carry, refusing a body that is not one node's canonical JSON; write `!adf:codeBlock {language="adf:x"}` around a bare fence to keep the code block |

### Error codes

`unspellable-character`, `unspellable-line-start` and `unspellable-link` leave `ConvertErrorCode`:
a `switch` naming one stops compiling, and the document it named converts.

| Input | `0.1.0` | `0.2.0` |
| --- | --- | --- |
| a link whose `href` or `title` no CommonMark escape spells, on emit | `unspellable-link` | spells `!adf:link[text]{attrs}` |
| a carriage return in text, on emit | `unspellable-character` | spells `&#13;` |
| a null character in text, on emit | `unspellable-character` | spells `!adf:text{text="\u0000"}` |
| a carriage return or null character in a code block or code span, on emit | `unspellable-character` | rides the carry |
| a paragraph line opening with a code span whose backticks read back as a fence, on emit | `unspellable-line-start` | rides the inline carry |
| an `emoji`, `mention` or `status` whose `text` holds a line ending or a null character, on emit | `unspellable-whitespace`, `unspellable-character` | rides the inline carry |
| a text node holding no text, or holding `content`, on emit | `unsupported-node-shape` | rides the carry |
| a `codeBlock` holding other than plain text nodes, on emit | `unsupported-node-shape` | rides the block carry |
| a leaf node given a body (`media`, `listBreak`) | `unsupported-node-shape` | `malformed-directive` |
| a node with a block body written as a leaf (`panel`) | `unsupported-node-shape` | `malformed-directive` |
| an empty node the `::taskItem` spelling row names, written as a leaf | parses | `malformed-directive` |
| an empty node the `::taskItem` spelling row names, written with a closer | `unsupported-node-shape` | parses |

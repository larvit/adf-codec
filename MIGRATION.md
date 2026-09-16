# Migrating

## From `0.1.0` to `0.2.0`

Directives moved under the `!adf:` prefix. `0.2.0` reads `0.1.0`'s spelling without an error,
turning each directive into text and each carried node into an `adf` code block. Before `0.2.0`
reads any `0.1.0` markdown, convert what is stored or in flight (an open editor, a queue) with the
recipe below, and rewrite markdown your code writes (templates, prompts, patterns matching
directives) by the spelling table. Stored ADF needs no change.

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
  return parsed.ok ? adfToMarkdown(parsed.value) : parsed
}
```

- Convert each document once: a second pass also returns ok, and turns the directives into text.
  Stop `0.1.0` writing first, and record which documents are converted.
- A refusal carrying `position` is `0.1.0`'s parse, which refused that markdown before too. One
  without is `0.2.0`'s emit: store the document `markdownToAdf010` read as ADF rather than keeping
  the unconverted markdown.

### Spellings

| `0.1.0` | `0.2.0` |
| --- | --- |
| `:::panel info` … `:::`, the fence longer per nesting level | `!adf:panel info` … `!adf:/panel` at any depth |
| `::media {id=a type=file}` | `!adf:media {id=a type=file}` |
| `::taskItem TODO {localId=i}`, an empty `caption`, `decisionItem`, `heading`, `paragraph` or `taskItem` | `!adf:taskItem TODO {localId=i}` then `!adf:/taskItem` |
| `:mention[@Mikael]{id=5b10a2}` | `!adf:mention[@Mikael]{id=5b10a2}` |
| the `adf` code fence and `:adf{json="…"}` | the `carry` code fence and `!adf:carry{json="…"}` |
| `\:` keeps a directive literal | `\!adf:` keeps a directive literal |

A colon run and `:name[` are plain text now, and `adf` an ordinary code block language; a literal
`!adf:` and a `carry` fence are claimed instead.

### Error codes

| Input | `0.1.0` | `0.2.0` |
| --- | --- | --- |
| a leaf node given a body (`media`, `listBreak`) | `unsupported-node-shape` | `malformed-directive` |
| a node with a block body written as a leaf (`panel`) | `unsupported-node-shape` | `malformed-directive` |
| an empty `caption`, `decisionItem`, `heading`, `paragraph` or `taskItem` written as a leaf | parses | `malformed-directive` |
| an empty `caption`, `decisionItem`, `heading`, `paragraph` or `taskItem` written with a closer | `unsupported-node-shape` | parses |

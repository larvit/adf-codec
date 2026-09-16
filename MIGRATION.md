# Migrating

## From `0.1.0` to `0.2.0`

Directives moved under the `!adf:` prefix. `0.2.0` reads markdown `0.1.0` wrote without an error
and turns every directive in it into plain text, so convert stored markdown before `0.2.0` reads
it. Stored ADF needs no change.

### Convert stored markdown

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

### Spellings

| `0.1.0` | `0.2.0` |
| --- | --- |
| `:::panel info` … `:::`, the fence longer per nesting level | `!adf:panel info` … `!adf:/panel` at any depth |
| `::media {id=a type=file}` | `!adf:media {id=a type=file}` |
| `::paragraph`, the empty paragraph | `!adf:paragraph` then `!adf:/paragraph` |
| `:mention[@Mikael]{id=5b10a2}` | `!adf:mention[@Mikael]{id=5b10a2}` |
| the `adf` code fence and `:adf{json="…"}` | the `carry` code fence and `!adf:carry{json="…"}` |
| `\:` keeps a directive literal | `\!adf:` keeps a directive literal |

A colon run and `:name[` are plain text now, and `adf` is an ordinary code block language.

### Error codes

| Input | `0.1.0` | `0.2.0` |
| --- | --- | --- |
| a leaf node given a body, `listBreak` included: `:::media {…}` … `:::`, `!adf:media {…}` … `!adf:/media` | `unsupported-node-shape` | `malformed-directive` |
| a container node with no closer: `::panel info`, `!adf:panel info` | `unsupported-node-shape` | `malformed-directive` |
| an empty paragraph with a closer: `:::paragraph` … `:::`, `!adf:paragraph` … `!adf:/paragraph` | `unsupported-node-shape` | parses |

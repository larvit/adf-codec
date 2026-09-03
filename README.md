# @larvit/adf-codec

Lossless conversion between **Atlassian Document Format** (ADF), an extended markdown flavour, and
an HTML dialect.

**Status: pre-release — the markdown round-trip (`adfToMarkdown`, `markdownToAdf`); HTML not
yet.**
Plan: `todo.md`. Decisions: `AGENTS.md`. The flavour's grammar:
[`spec/flavour.md`](spec/flavour.md).

## What it is for

Atlassian Cloud REST APIs hand out rich text — issue descriptions, comments, pages — as ADF, a
ProseMirror-shaped JSON tree, and take it back the same way. No Atlassian endpoint converts it
(`pf-editor-service/convert` is decommissioned,
[JRACLOUD-77436](https://jira.atlassian.com/browse/JRACLOUD-77436) open), and the npm ecosystem is
one-directional and lossy. A consumer that shows a document and lets someone edit it needs both
directions lossless — otherwise saving destroys the panels, mentions and attachments it could not
represent.

## The shape

Pure functions, no I/O, no configuration. ADF is the hub: markdown↔HTML compose through it.

```ts
adfToMarkdown(doc: AdfDocument): Result<string>
markdownToAdf(markdown: string): Result<AdfDocument, ParseError>
isAdfDocument(v: unknown): v is AdfDocument

adfToHtml(doc: AdfDocument): Result<string>               // 0.3.0
htmlToAdf(html: string): Result<AdfDocument, ParseError>  // 0.3.0
markdownToHtml(markdown: string): Result<string>          // 0.3.0, via ADF
htmlToMarkdown(html: string): Result<string>              // 0.3.0, via ADF
```

`Result<T>` is `{ ok: true; value: T } | { ok: false; error: ConvertError }` — nothing throws.

## The errors

An ADF node type this version does not know is not an error: it rides both formats opaquely and
restores unchanged (AGENTS.md §3).

`ConvertError` is `{ code, message, path, position? }`. `code` is stable across minors and safe to
`switch` on exhaustively with no `default`; `message` is free text and may change in any release.
A parse always names a position, so `markdownToAdf` returns `ParseError` and its `position` reads
without a guard; an emit reads no source and carries `path` alone; one handler typed on
`ConvertError` takes both, which is what the composed `markdownToHtml` and `htmlToMarkdown` hand
back. `path` is the node's place from the document root, alternating `'content'` and an index, so
`path.map((step) => '/' + step).join('')` is a JSON Pointer at the node — the empty path being the
document itself.

`position` is `{ line, offset }` into the string passed in: `line` counted from 1, `offset` a
UTF-16 code unit, a JavaScript string index rather than a codepoint or a byte offset. It points at
or before the refusal — currently the start of the line the enclosing block begins on; a later
minor may narrow that, never widen it.

Parsing — `markdownToAdf`, and `htmlToAdf` at `0.3.0`:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `malformed-directive` | a `:::` block or `:name[…]` inline directive the grammar cannot read — an unclosed fence or `[content]`, `{attrs}` out of order or duplicated, invalid JSON in an `adf` carry | write the spelling the message names, or escape the line — `\:::` for a block, `\:` for an inline one — to keep it literal text |
| `malformed-pipe-table` | a pipe row that is no pipe table — a missing or ragged `---` delimiter row, an alignment colon in it, or a row not opening with a pipe | open every row with a pipe and give the delimiter row the header's cell count; a backslash before a pipe keeps it literal text |
| `unknown-directive-name` | a directive whose name is no node or mark this version spells | check the name in `spec/flavour.md`, or escape the colon; the spelling itself is well formed, so a later minor may give the name meaning |
| `unmappable-html` | the markdown holds a raw HTML tag, comment or processing instruction | remove it or write it in the flavour — ADF holds no raw-HTML node, and the element mapping lands at `0.3.0` |
| `unmappable-image` | an image sits inside other content, or carries a title | give the image a paragraph of its own and drop the title, or write the `mediaSingle` directive form |

Emitting — `adfToMarkdown`, and `adfToHtml` at `0.3.0`:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `not-an-adf-document` | the value handed in is no ADF document — a missing or wrong `type`, a stray key, a node that is not a node | guard the boundary you receive JSON at with `isAdfDocument`; the message names the branch that refused |
| `unsupported-document-version` | the document's `version` is not 1 | convert a version-1 document — no markdown spelling carries another |

Either direction — a parse reaches the emitter's own refusals too, asking it which CommonMark
spelling a node takes:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `unspellable-character` | text or a code block holds a carriage return or a null character, which CommonMark rewrites wherever it sits | strip or replace the character; no escape carries it through the round-trip |
| `unspellable-line-start` | a paragraph line begins with a code span whose backticks would read back as a code fence | put any text before the code span |
| `unspellable-link` | a link `href` or `title` holds what no canonical escape spells — a backslash, a newline, a control character, an entity reference, an angle bracket beside a space | percent-encode the destination (`%5C` for the backslash, `%26` for the `&` that opens the entity), or drop the title |
| `unspellable-whitespace` | an `emoji`, `mention` or `status` holds a newline in the text its inline directive spells in the content slot | replace it with a space — an inline directive never spans lines |
| `unsupported-nesting-depth` | blocks, marks or a carried node's JSON nest past 500 levels | flatten the document; the limit is fixed, and it is what stands between a deep document and a stack overflow |
| `unsupported-node-shape` | a node carries an attribute, value, argument or body its type does not take — or markdown writes as a directive a node the flavour spells as CommonMark | write the shape the message names; `spec/flavour.md` lists every type's attributes and body |

## The guarantees

- `markdownToAdf(adfToMarkdown(doc))` equals `doc` — unknown node types included, carried opaquely
  (AGENTS.md §3).
- Plain CommonMark is valid input to `markdownToAdf` apart from the raw HTML below, with three
  carve-outs — literal text matching directive, pipe-table or strikethrough syntax is claimed
  (escapable — `spec/flavour.md`) — and one gap: a CommonMark image fits only as its own
  title-less paragraph; mid-text and titled images are error results. Converting back yields the
  library's canonical spelling, which round-trips byte-identically.
- Raw HTML in markdown input is an error result, never a silent drop — a tag, a comment and a
  processing instruction alike. ADF holds no raw-HTML node; the element mapping ships at `0.3.0`.
- Not every document converts back: `adfToMarkdown` is partial on valid ADF — a text node holding
  a carriage return, a link destination or title no canonical escape spells, a paragraph line
  beginning with a code span whose backticks read back as a fence. Show the refusal and keep the
  document read-only; saving markdown you could not produce is the loss the round-trip exists to
  stop.
- The pipe table narrows GFM's twice: every row opens with a pipe, so GFM's bare form is an error
  result rather than the prose it reads as, and an alignment colon in the delimiter row is an
  error too — ADF holds no column alignment. The trailing pipe is canonical output, optional in
  input.
- Past that and `~~`, no GFM: an autolink literal and a `- [ ]` marker stay text, and a checklist
  is the `taskList` directive.
- A document nested deeper than 500 levels is an error result, not a stack overflow.
- The emitted formats are semver surface (AGENTS.md §8).
- **`0.3.0`** — `htmlToAdf(adfToHtml(doc))` equals `doc`; fidelity HTML cannot express rides
  `data-*` attributes. Foreign HTML maps a documented element set, an unmappable element is an
  error, and well-formed HTML only — no tag-soup recovery.

## Who it is for

Personas, never named consumers (AGENTS.md §7):

- **Viewer/editor app** — shows a document, lets a human edit, posts back. Losslessness above all.
- **Bot posting content** — converts generated markdown to ADF; needs the CommonMark promise.
- **Export/indexing tool** — bulk ADF→markdown/HTML; needs readable output.
- **LLM/agent pipeline** — documents to a model as markdown, edits back; needs the round-trip and
  markdown legible to a reader that half-knows the flavour.

## The package

ESM only, no runtime dependencies, public npmjs. Built JavaScript with `.d.ts` beside it.
Pure ECMAScript at an ES2022 baseline, reaching for no host API; the test suite runs under Node,
Deno and Bun. Contract: `AGENTS.md` §5–6.

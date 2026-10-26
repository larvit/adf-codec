# @larvit/adf-codec — ADF to markdown and HTML, markdown to ADF

[![npm](https://img.shields.io/npm/v/@larvit/adf-codec)](https://www.npmjs.com/package/@larvit/adf-codec)
[![CI](https://github.com/larvit/adf-codec/actions/workflows/ci.yml/badge.svg)](https://github.com/larvit/adf-codec/actions/workflows/ci.yml)

Convert Atlassian Document Format (ADF), the rich text of Jira and Confluence, to and from markdown, with a lossless round-trip, and to HTML.

For application developers whose app shows, edits, exports or generates the rich text Atlassian
products store as ADF.

- **Lossless round-trip:** `adfToLosslessMarkdown` and `losslessMarkdownToAdf` give back the
  document they started from — panels, mentions, statuses and node types this version does not know
  included.
- **Markdown in:** `portableMarkdownToAdf` reads a bot's or a model's markdown, including `~~` and
  GFM's pipe tables whose rows hold as many cells as their header, their column alignment dropped.
  `commonMarkToAdf` reads strict CommonMark as its spec says: nothing becomes a table, task or
  panel.
- **Portable markdown out, lossy:** `adfToPortableMarkdown` writes the markdown that GitHub, GitLab
  and Obsidian render — GitHub Flavored Markdown's alerts, task lists and pipe tables, Obsidian
  Flavored Markdown's callouts and highlights. It keeps the text, images by URL and link targets and
  drops the rest.
- **HTML out:** `adfToHtml` writes paragraphs, headings, lists, quotes, code blocks, rules, line
  breaks, emphasis, inline code, links and a plain external image as their HTML elements. Every other
  node, an image Atlassian's editor wrote among them, becomes an element holding its JSON and showing
  its content. `htmlToAdf` reads that HTML back to the document it came from, and refuses any other
  HTML.
- **No throws:** every call returns a result; a refusal carries a code from a closed list.
- **Runs anywhere:** pure functions with no runtime dependencies, in Node, Deno, Bun and browsers.
  TypeScript types ship beside the JavaScript.

## Install

```sh
npm install @larvit/adf-codec
```

ESM only, Node 18 or later ([The package](#the-package)). Upgrading from `0.1.0`:
[MIGRATION.md](https://github.com/larvit/adf-codec/blob/main/MIGRATION.md).

## Quick start

### ADF to markdown

Full reference: [The calls](#the-calls), [The lossless flavour](#the-lossless-flavour) and
[Portable markdown](#portable-markdown).

```ts
import { adfToLosslessMarkdown, adfToPortableMarkdown, type AdfDocument } from '@larvit/adf-codec'

const doc: AdfDocument = {
  content: [
    {
      attrs: { panelType: 'warning' },
      content: [{ content: [{ text: 'Check the collation before importing.', type: 'text' }], type: 'paragraph' }],
      type: 'panel',
    },
  ],
  type: 'doc',
  version: 1,
}

const lossless = adfToLosslessMarkdown(doc)
if (lossless.ok) console.log(lossless.value)
// !adf:panel warning
// Check the collation before importing.
// !adf:/panel

const portable = adfToPortableMarkdown(doc)
if (portable.ok) console.log(portable.value)
// > [!WARNING]
// >
// > Check the collation before importing.
```

### Markdown to ADF

Full reference: [The calls](#the-calls) and [Portable markdown](#portable-markdown).

```ts
import { portableMarkdownToAdf } from '@larvit/adf-codec'

const result = portableMarkdownToAdf('# Release notes\n\nRead the _manual_ before **wiring**.\n')
if (result.ok) {
  // result.value deep-equals:
  // {
  //   content: [
  //     { attrs: { level: 1 }, content: [{ text: 'Release notes', type: 'text' }], type: 'heading' },
  //     {
  //       content: [
  //         { text: 'Read the ', type: 'text' },
  //         { marks: [{ type: 'em' }], text: 'manual', type: 'text' },
  //         { text: ' before ', type: 'text' },
  //         { marks: [{ type: 'strong' }], text: 'wiring', type: 'text' },
  //         { text: '.', type: 'text' },
  //       ],
  //       type: 'paragraph',
  //     },
  //   ],
  //   type: 'doc',
  //   version: 1,
  // }
}
```

`portableMarkdownToAdf` also reads `> [!NOTE]` alerts, `- [x]` tasks, `==highlights==` and pipe
tables as nodes. For markdown that `adfToLosslessMarkdown` wrote, use `losslessMarkdownToAdf`. For
markdown known to be strict CommonMark, use `commonMarkToAdf`.

### The lossless round-trip

Full reference: [The guarantees](#the-guarantees).

```ts
import { adfToLosslessMarkdown, losslessMarkdownToAdf } from '@larvit/adf-codec'

const markdown = adfToLosslessMarkdown(doc)
if (!markdown.ok) {
  showReadOnly(doc, markdown.error) // saving markdown you could not produce would lose content
} else {
  const edited = await editInYourApp(markdown.value) // a human, a model, a template
  const saved = losslessMarkdownToAdf(edited)
  if (saved.ok) post(saved.value)
  else showError(saved.error) // the edit broke the markdown: the error names line and node
}
```

Unedited, the markdown reads back to a document that deep-equals `doc`, node types this version
does not know included.

### ADF to HTML

Full reference: [HTML](#html).

```ts
import { adfToHtml, type AdfDocument } from '@larvit/adf-codec'

const page: AdfDocument = {
  content: [
    { attrs: { level: 2, localId: 'a1f3' }, content: [{ text: 'Release notes', type: 'text' }], type: 'heading' },
    {
      content: [
        { text: 'Read the ', type: 'text' },
        { marks: [{ attrs: { href: 'https://spec.commonmark.org/' }, type: 'link' }], text: 'spec', type: 'text' },
        { text: ', then ask ', type: 'text' },
        { attrs: { id: '5b10a2', text: '@Mikael' }, type: 'mention' },
      ],
      type: 'paragraph',
    },
  ],
  type: 'doc',
  version: 1,
}

// Sanitize HTML from an author you do not trust before showing it: URLs are written as the ADF holds them, javascript: included.
const html = adfToHtml(page)
if (html.ok) console.log(html.value)
// <h2 data-local-id="a1f3">Release notes</h2>
// <p>Read the <a href="https://spec.commonmark.org/">spec</a>, then ask <span class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;id&quot;:&quot;5b10a2&quot;,&quot;text&quot;:&quot;@Mikael&quot;},&quot;type&quot;:&quot;mention&quot;}">@Mikael</span></p>
```

### Handle a result's error

Full reference: [The errors](#the-errors).

```ts
import { losslessMarkdownToAdf } from '@larvit/adf-codec'

const result = losslessMarkdownToAdf('Part | Qty\n--- | ---\nBolt M8 | 40\n')
if (!result.ok) {
  const { code, message, path, position } = result.error
  // code: 'malformed-pipe-table' — the rows open with no pipe
  // position: { line: 1, offset: 0 }
  // path: ['content', 0]
  console.error(`${code} at line ${position.line}, ${path.map((step) => '/' + step).join('')}: ${message}`)
}
```

Nothing throws. `code` is from a closed list, so a `switch` with no `default` covers every case;
`message` is free text for a person fixing the input.

## Contents

- [Goals](#goals)
- [Audience](#audience)
- [Other ADF converters](#other-adf-converters)
- [The calls](#the-calls)
- [The lossless flavour](#the-lossless-flavour)
- [Portable markdown](#portable-markdown)
- [HTML](#html)
- [The errors](#the-errors)
- [The guarantees](#the-guarantees)
- [The package](#the-package)
- [Everything exported](#everything-exported)
- [Links](#links)

## Goals

The most useful ADF conversion library available, judged by these goals. A Maintain goal holds
whatever it costs; the Achieve goals are weighed against each other in the order listed.

1. **Maintain:** Lossless, and every call returns a result, never a throw.
2. **Maintain:** ADF is the hub.
3. **Achieve:** Easy to find, and clear at a glance what it does.
   - Signal: weekly npm downloads rise.
   - Counter-signal: issues asking what a call does, or saying it did something else, rise.
   - Why: users won by a vague pitch come back as confusion.
4. **Achieve:** Each format reads and writes as its standard says.
   - Signal: fewer exceptions are listed under [The guarantees](#the-guarantees).
   - Counter-signal: breaking releases rise.
   - Why: conformance bought by changing stored formats costs every consumer a migration.
5. **Maintain:** Our markdown is CommonMark, extended only where CommonMark has no spelling.
6. **Achieve:** No surprises: output reads and edits the way its audience expects.
   - Signal: readers shown the candidate outputs pick the one the library already writes.
   - Counter-signal: `spec/flavour.md` gains a special case for each such pick.
   - Why: output fitted case by case is output no reader can predict.
   1. **Maintain:** A function's name says which markdown it reads or writes.
7. **Maintain:** Lossy conversion drops form, never content. A link's or an image's title counts as content.
8. **Maintain:** Runs in any JavaScript engine, with no runtime dependencies and nothing to configure or connect.
9. **Maintain:** Fast, and linear in the document's size as JSON.

## Audience

Application developers embedding the library, in four personas. All four rely on the guarantees
below and on an error's `code` being a closed list; none may rely on an error message's wording,
which is free text.

- **Viewer/editor app** — shows a document, lets a human edit, posts it back. Relies on the
  round-trip holding for whatever the site's editor wrote, unknown node types included, and on a
  refusal arriving before the save rather than after.
- **Bot posting content** — turns generated markdown into ADF. Relies on CommonMark being valid
  input, so nothing upstream has to learn a flavour.
- **Export/indexing tool** — converts ADF to markdown or HTML in bulk. Relies on readable output
  and on every refusal but `engine-limit` being deterministic, so a document that fails fails the
  same way next run.
- **LLM/agent pipeline** — hands documents to a model as markdown and writes the edits back.
  Relies on the round-trip and on markdown a reader half-knowing the lossless flavour can still edit.

Behind those apps, the people who read and write the markdown and the HTML: product
managers, engineers and support agents working in Atlassian products through a plugin or another
UI. They know markdown and not ADF, and rely on every spelling saying what it means to them.

Contributors, human or agent, who change the source. They rely on each concern having one obvious
place, and on CI failing a change that breaks a guarantee.

## Other ADF converters

Serves [Goals](#goals) 3. The table lists every other npm package that converts ADF to or from
markdown and has over 1,000 downloads a week. On 2026-10-14,
[`converter-comparison/`](https://github.com/larvit/adf-codec/tree/main/converter-comparison) ran
each package's published code, at the version the table names, with its default options. A package
writing markdown got a document holding marks, a link, a mention, a status, a panel and a list, and
a document holding a node type it cannot know. A package reading markdown got markdown holding the
same marks and link.

| Package | Converts | ADF to markdown to ADF | A node type it does not know | Formats | Direct runtime dependencies |
| --- | --- | --- | --- | --- | --- |
| `@larvit/adf-codec` | both ways | the same document | kept | markdown: lossless, portable; CommonMark in; HTML out; its own HTML in | 0 |
| `@atlaskit/editor-markdown-transformer` 6.3.1 | markdown to ADF, through `@atlaskit/editor-json-transformer` 10.0.0; ADF to markdown throws "This is not implemented yet" | – | – | markdown | 5 |
| `adf-to-markdown` 1.0.1 | ADF to markdown | – | dropped with its text | markdown | 0 |
| `adf-to-md` 1.2.1 | ADF to markdown | – | dropped with its text, as are mentions, statuses and panels | markdown | 1 |
| `adf2markdown` 1.2.0 | ADF to markdown | – | its text kept | markdown | 0 |
| `extended-markdown-adf-parser` 2.4.0 | both ways | a different document: the mention comes back as linked text, the status without its `localId` | written as JSON, read back as a paragraph of that JSON's text | markdown | 9 |
| `marklassian` 1.2.1 | markdown to ADF | – | – | markdown | 1 |
| `md-to-adf` 0.6.4 | markdown to ADF | – | – | markdown | 2 |

## The calls

Serves [Goals](#goals) 1, 2 and 8. Pure functions, each taking a whole document and returning a
whole result; no I/O, no configuration.

```ts
adfToLosslessMarkdown(doc: AdfDocument): Result<string>
losslessMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError>
isAdfDocument(v: unknown): v is AdfDocument

commonMarkToAdf(markdown: string): Result<AdfDocument, ParseError>

adfToPortableMarkdown(doc: AdfDocument): Result<string>
portableMarkdownToAdf(markdown: string): Result<AdfDocument, ParseError>

adfToHtml(doc: AdfDocument): Result<string>
htmlToAdf(html: string): Result<AdfDocument, ParseError>
```

Each call's name says which format it reads or writes:

| Call | Reads or writes | Refuses with |
| --- | --- | --- |
| `adfToHtml` | writes HTML: the elements [HTML](#html) lists, and an `adf-carry` element holding everything else | `engine-limit`, `not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `adfToLosslessMarkdown` | writes the lossless flavour: CommonMark plus GFM's pipe tables and `~~`, with `!adf:` directives and `adf:` fences for everything else | `engine-limit`, `not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `adfToPortableMarkdown` | writes markdown GitHub, GitLab and Obsidian render; drops what they cannot show, and writes no directive | `engine-limit`, `not-an-adf-document`, `unsupported-document-version`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `commonMarkToAdf` | reads strict CommonMark as its spec says: a directive, a pipe table, `~~`, `==` and an `adf:` fence read as text and code | `engine-limit`, `not-a-string`, `unmappable-html`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `htmlToAdf` | reads the HTML `adfToHtml` writes, a carry element from its `data-adf` alone; refuses any other HTML | `engine-limit`, `not-a-string`, `unmappable-html`, `unsupported-nesting-depth`, `unsupported-node-shape` |
| `losslessMarkdownToAdf` | reads the lossless flavour, markdown `adfToLosslessMarkdown` wrote, edited or not | every code in [The errors](#the-errors) except `not-an-adf-document` and `unsupported-document-version` |
| `portableMarkdownToAdf` | reads CommonMark, GFM's pipe tables and `~~`, alerts and task markers, Obsidian's callouts and `==`; a directive and an `adf:` fence read as text and code | `engine-limit`, `malformed-pipe-table`, `not-a-string`, `unmappable-html`, `unsupported-nesting-depth`, `unsupported-node-shape` |

`isAdfDocument` is the type guard for the boundary you receive JSON at. It checks the shape the
converters require: `type: 'doc'`, a finite `version` (the converters take only 1), nodes holding
only `attrs`, `content`, `marks`, `text` and `type`, attribute values that are JSON values, and no
object holding itself. It returns `true` for a document nesting past 500 levels; the converters
refuse that one with `unsupported-nesting-depth`.

The types:

```ts
type AdfDocument = { content?: AdfNode[]; type: 'doc'; version: number }
type AdfNode = { attrs?: AdfAttributes; content?: AdfNode[]; marks?: AdfMark[]; text?: string; type: string }
type AdfMark = { attrs?: AdfAttributes; type: string }
type AdfAttributes = { [key: string]: JsonValue }
type JsonValue = JsonValue[] | boolean | null | number | string | { [key: string]: JsonValue }

type Result<T, E extends ConvertError = ConvertError> = { error: E; ok: false } | { ok: true; value: T }
type ConvertError = { code: ConvertErrorCode; message: string; path: ConvertErrorPath; position?: SourcePosition }
type ParseError = ConvertError & { position: SourcePosition }
type ConvertErrorPath = readonly (number | string)[]
type SourcePosition = { line: number; offset: number }
```

## The lossless flavour

Serves [Goals](#goals) 1, 5 and 6. The lossless flavour is CommonMark plus GFM's pipe tables and
`~~`, with directives under one prefix, `!adf:`, and `adf:` code fences for everything else. The
complete grammar, with every node's attributes:
[`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md).

### What CommonMark and GFM spell

Where CommonMark or GFM holds what a node carries, the node keeps that spelling.
`adfToLosslessMarkdown` writes exactly one spelling of each; every CommonMark variant of the same
document normalizes to it through the round-trip.

| ADF | Markdown |
| --- | --- |
| `blockquote` | `> ` |
| `bulletList`, `listItem` | `- ` items; adjacent lists of a kind alternate `- ` and `* ` |
| `codeBlock` | a fenced code block, the language as info string, the fence longer than any backtick run inside; several text nodes are `!adf:codeBlock` holding one fence per node |
| `hardBreak` | a backslash at the end of the line; `!adf:hardBreak{}` where no backslash can stand: a block's end, inside a heading, or a break carrying an attribute |
| `heading` | `#` to `######` |
| `link` | `[text](url "title")`; `<url>` where the text is the destination and the destination is an absolute URI |
| `mediaSingle` holding an external `media`, centered, uncaptioned | `![alt](url)`; `[![alt](url)](href)` where a link marks the image |
| `orderedList` | `1.` `2.` `3.`, the first number the list's `order`; adjacent lists of a kind alternate `1.` and `1)` |
| `paragraph` | one line, no soft wraps |
| `rule` | `---` |
| `table` of one header row and plain inline cells | a pipe table, every row opening and closing with a pipe |
| `text` marked `code`, `em`, `strike`, `strong` | `` `code` ``, `_em_` (`*em*` inside a word), `~~strike~~`, `**strong**` |
| `text` holding a carriage return | `&#13;` |
| `text` holding a newline, a null character, or a space or tab CommonMark strips (a block's inline edges, either side of a hard break, a pipe cell's edges, an em, strong or strike spelling's inner edges) | that run as `!adf:text{text="…"}`, the rest plain: `!adf:text{text="  "}Two leading spaces` |

Input normalizes: setext headings become ATX, indented code becomes a fence, `*em*` becomes
`_em_` outside a word, entity references decode, a soft line break becomes a space.

### What directives spell

Three forms, one grammar. A directive's name is the ADF node or mark type:

```
!adf:name[content]{attrs}        inline, on one line
!adf:name arg {attrs}            a block leaf
!adf:name arg {attrs}            a block container, closed by
!adf:/name
```

A node's content model picks the block form: a node taking content is a container.

```
!adf:panel warning
Check the collation before importing.
!adf:/panel

!adf:expand {title="Full build log"}
…
!adf:/expand

Ping !adf:mention[@Mikael]{id=5b10a2} — !adf:status[In review]{color=yellow} — !adf:date{timestamp=1756080000000}
```

| ADF | Directive |
| --- | --- |
| `blockquote`, `bulletList`, `codeBlock`, `heading`, `listItem`, `orderedList`, `paragraph`, `rule` carrying `localId`, marks or a value CommonMark cannot spell | the same node in directive form, `!adf:paragraph {localId=…}` |
| `border`, `subsup`, `textColor`, `underline` | inline directive marks around their text, `!adf:textColor[**Overdue**]{color="#ae2e24"}` |
| `caption`, `media`, `mediaGroup`, `mediaSingle` | the media family; an image CommonMark cannot spell, a stored file, a caption |
| `date`, `emoji`, `inlineCard`, `mediaInline`, `mention`, `status` | inline leaves; `emoji`, `mention` and `status` spell their `text` in the `[content]` slot |
| `decisionList`, `decisionItem` | containers |
| `expand`, `nestedExpand` | containers, `title` an attribute |
| `extension`, `bodiedExtension`, `multiBodiedExtension`, `extensionFrame` | a leaf, containers, `parameters` as JSON in an attribute |
| `layoutSection`, `layoutColumn` | containers |
| `link` with an attribute besides `href` and `title`, or a target CommonMark cannot spell | `!adf:link[text]{attrs}` |
| `panel` | a container, the type its argument: `!adf:panel info` |
| `syncBlock`, `bodiedSyncBlock` | a leaf and a container |
| `table`, `tableRow`, `tableCell`, `tableHeader` richer than a pipe table | containers nesting block content |
| `taskList`, `taskItem`, `blockTaskItem` | containers, the state an argument: `!adf:taskItem DONE` |
| any other node type, or a node where its spelling cannot stand | the opaque carry: a code fence ```` ```adf:<type> ```` holding the node's JSON, or inline `!adf:carry{json="…"}` |

- Attributes are `{key=value key2="two words"}`: keys alphabetical, a value bare where it is
  `[A-Za-z0-9_-]+`, else double-quoted with JSON string escaping. A number or JSON value is spelled as
  canonical JSON, with two exceptions. `colwidth` joins its widths with commas: `colwidth="340,420"`.
  A block's `marks` names each mark followed by its attributes, `marks="breakout{mode=wide}"`, and
  stays a JSON array where the flavour does not list a mark's type or one of its attributes, or a
  value holds another type than the flavour gives it. An empty `attrs`, `content` or `marks` key is
  spelled `{attrs=empty}`, `{content=empty}` or `{marks=empty}`.
- Three reserved names build no node: `!adf:carry` is the inline opaque carry, `!adf:doc {content=none}`
  spells a document holding no `content` key, and `!adf:textBreak{}` parts two adjacent text nodes
  CommonMark would read back as one.
- Input reads the canonical spelling alone: keys out of order, a value quoted where bare carries it,
  or a longer escape than needed is an error naming the spelling to write.
- To keep a literal `!adf:` as text, escape it: `\!adf:`, block and inline alike. A code span and a
  code block hold `!adf:` as content.

## Portable markdown

Serves [Goals](#goals) 7. Portable markdown is a second flavour of the same grammar.
`adfToPortableMarkdown` writes markdown other tools render — GitHub, GitLab, Obsidian and the like —
keeping the content and dropping the rest: colours, layout, identity and every other attribute.
Content is what a reader of the rendered document sees or follows: its text, images, link targets and
titles. It writes no directive.

`portableMarkdownToAdf` reads CommonMark and `~~` as `losslessMarkdownToAdf` reads them, and the
conventions below as nodes, taking other tools' spellings too. It reads GFM's pipe tables with or
without leading pipes and drops their column alignment. A directive and an `adf:` fence read as
CommonMark reads them, as text and code. A backslash keeps a marker as text:
`\==x==`, `> \[!NOTE]`, `- \[x]`. Markdown `adfToPortableMarkdown` wrote reads back and writes again
byte for byte; the document it came from does not come back.

To edit a document and save it back, use `adfToLosslessMarkdown` and `losslessMarkdownToAdf`:
saving what this pair read replaces mentions, attachments and macros with text.

| ADF | Written | Read back |
| --- | --- | --- |
| `backgroundColor` | `==text==` | `==text==` on one line, the text touching both delimiters, bounded outside by whitespace, punctuation or a line edge, or touching a Han, Hangul, Hiragana, Katakana, Thai, Lao, Khmer or Myanmar character on either side, in the editor's default highlight `#f8e6a0` |
| `decisionList` | a bullet list | — |
| `expand`, `nestedExpand` | Obsidian's folded callout, `> [!NOTE]- Title` | `-` or `+` after any word, the rest of the marker's line the title; a link reads `text (target)`, or its text alone where the text is the target with or without `mailto:`; an expand inside an expand is a `nestedExpand` |
| external `media` | in a block `![alt](url)`, or `[![alt](url)](href)` where a link marks it; inline `[alt](url)`, or `[alt](href) ([image](url))` where a link to another target marks it; an empty `alt` gives way to `href`, then `url` | — |
| `inlineCard`, `blockCard`, `embedCard` | a link to the card's URL, else its name | — |
| `layoutSection`, `bodiedExtension`, `bodiedSyncBlock`, `multiBodiedExtension`, `extensionFrame`, `caption`, a node this version does not know | its blocks or its text | — |
| `mention`, `status`, `emoji`, `date` | their text: `@` kept, a mention with none `@` and its id, an emoji its `shortName` without, a date `2026-09-13` in UTC | — |
| `panel` | a GitHub alert, `> [!WARNING]`: info `NOTE`, note `IMPORTANT`, tip and success `TIP`, warning `WARNING`, error `CAUTION`, custom `NOTE` | `NOTE` info, `IMPORTANT` note, `TIP` tip, `WARNING` warning, `CAUTION` error, and Obsidian's: hint tip; success, check, done success; attention warning; danger, failure, fail, missing, bug, error error; any other word info — in any case; the rest of the marker's line is the first paragraph |
| `placeholder` | nothing | — |
| stored `media`, `mediaInline`, `extension`, `inlineExtension` | their `alt` or `text` | — |
| `table` | a pipe table: the first row its header, a cell's blocks on one line, a span kept under its header by empty cells | — |
| `taskList` | `- [x] Done`, `- [ ] Todo`. An item keeps its paragraphs, then its nested task lists; the rest of the item stands after the list, which resumes at the next task | a bullet list whose every item is so marked, `[X]` too. An item keeps its paragraphs, then its nested task lists; the rest of the item stands after the list, which resumes at the next task |

- Content the document only references, with no text of its own to keep, leaves an italic note
  naming it where it stood: `_(image not included)_` for stored media with no `alt`,
  `_(link card not included)_` for a card with neither URL nor name, an extension with no `text`
  its key, `_(jira-issues-table not included)_`, or `_(extension not included)_` without one, and
  `_(synced block not included)_` for a `syncBlock`.
- `backgroundColor`, `code`, `em`, `link`, `strike` and `strong` stay; every other mark drops,
  keeping its text, and so does a mark the flavour cannot spell where it stands. Code text keeps
  no mark but `code` and `link`.
- A newline in text is a hard break and in an expand's title a space, edge whitespace outside a
  link or code span is trimmed, carriage returns and null characters are removed, and an empty
  paragraph drops.
- A text node's `content` drops: Atlassian's schema forbids it, so no rendered document shows it.
- Adjacent lists of a kind alternate markers, `- ` and `* `, `1.` and `1)`, since CommonMark
  starts a new list where the marker changes; a task list counts as a bullet list, `* [x] Done`.
- An ordered list numbered past `999999999` is a bullet list keeping its numbers as text.
- A task list holding a block other than a task is a bullet list keeping its states as text:
  `- \[x] Done`.
- Text that would read as a marker takes a backslash: `==` wherever it could open or close a
  highlight, `[!…]` opening a quote, asterisks that would read as a rule after a `* ` marker
  (`* \**`), and `[x]` or `[ ]` opening any list item, since GitHub reads that marker per item.
- A link title takes a backslash before a quote, before a backslash that ends the title or that
  CommonMark would read as an escape, before an `&` opening an entity reference such as `&amp;`, and
  in a table cell before a `|`: `[docs](https://example.com "AT\&amp;T")`.
- A node read back carries no `localId` except a `taskList`, `taskItem` or `blockTaskItem`, which
  Atlassian's schema requires one on: each gets a UUID v4 hashed from the whole markdown and its
  position, the same on every read. Join markdown bound for one document and read it once: the same
  markdown read twice into one document repeats its ids.

## HTML

Serves [Goals](#goals) 1, 6 and 7. `adfToHtml` writes the nodes and marks the table lists as their
HTML elements, and keeps every other node whole: an element of class `adf-carry` holds the node's JSON in
`data-adf` and shows the node's content, its links included, so a reader of the page loses no
content. No stylesheet ships. The complete dialect:
[`spec/html.md`](https://github.com/larvit/adf-codec/blob/main/spec/html.md).

| ADF | HTML |
| --- | --- |
| `blockquote` | `<blockquote>` |
| `bulletList`, `orderedList`, `listItem` | `<ul>`, `<ol>`, `<ol start="3">` for an `order` of 3, and `<li>`; an item's first paragraph stands bare, `<li>Bolt</li>`, or as `<li><p data-local-id="p1">Bolt</p></li>` where it holds an attribute |
| `codeBlock` | `<pre><code class="language-js">`, no `class` without a language |
| `hardBreak` | `<br>` |
| `heading` | `<h1>` to `<h6>` |
| `link` | `<a href="…" title="…">` |
| `mediaSingle` holding an external `media`, centered, uncaptioned, holding no other attribute such as `width` or `localId` | `<p><img src="…" alt="…"></p>`, the image inside `<a>` where a link marks it; an image holding such an attribute, as editor-written ones do, rides the carry element |
| `paragraph` | `<p>` |
| `rule` | `<hr>` |
| `text` marked `code`, `em`, `strong` | `<code>`, `<em>`, `<strong>`, the first mark outermost |
| an attribute its type holds that its element does not write, such as `localId`, on a paragraph, heading, quote, list, list item, code block or rule | `data-*` named as HTML's `dataset` names it: `<p data-local-id="a1f3">` |
| any other node, or a node holding what its element cannot | `<div class="adf-carry" data-adf="{…}"><p>its content</p></div>`, a `<span>` inline |

- Every URL is written as the ADF holds it, `javascript:` included: a link's, an image's, and a
  card's or a carried link's in the carry element. Sanitize the HTML before showing a document from
  an author you do not trust.
- Text and attribute values are escaped: `&`, `<`, `>` and `"`. A node holding what HTML cannot
  hold, such as a carriage return or a control character, rides the carry element.
- In a `<div>`, the carry element shows each block's content as a `<p>`, and a code block's as
  `<pre><code>` keeping its indentation; in a `<span>`, it parts blocks with `<br>`. It shows text a
  link marks as a link, a mention, status or emoji by its text, a date as `2026-09-13` in UTC, a
  card as a link to its URL, or to the target of a link marking it, an external image as a link to
  it, a stored one by its `alt`, and an expand by its title. An image marked by a link to another
  target shows that link, then `(image)` linking to the image. A node it cannot show leaves a note
  instead, such as `<em>(image)</em>`; a link marking the node goes around the note.

`htmlToAdf` reads exactly that HTML back, so `htmlToAdf(adfToHtml(doc))` deep-equals `doc`. A carry
element reads from its `data-adf` alone, so editing what it shows doesn't change the document read.
Any other HTML is refused as `unmappable-html`: another element, attribute or escape, such as `<b>`,
`<br/>` or `&#39;`.

## The errors

Serves [Goals](#goals) 1. An ADF node type this version does not know is not an error: the lossless
pair carries it opaquely and restores it unchanged ([Unknown nodes ride the
carry](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#unknown-nodes-ride-the-carry)).

### The error shape

`ConvertError` is `{ code, message, path, position? }`.

- `code` is from the exported closed list `ConvertErrorCode`, safe to `switch` on exhaustively with
  no `default`. Before 1.0 the list changes only in a minor release; from 1.0 only in a major
  release.
- `message` is free text for a person fixing the input. It may change in any release.
- `path` is the node's place from the document root, alternating `'content'` and an index, so
  `path.map((step) => '/' + step).join('')` is a JSON Pointer at the node, or at the list holding it
  where `adfToPortableMarkdown` unwraps a list into its items. The empty path is the document
  itself.
- `position` is `{ line, offset }` into the string passed in: `line` counted from 1, `offset` a
  UTF-16 code unit, which is a JavaScript string index. It points at or before the refusal —
  currently the start of the line the enclosing block begins on in markdown, and of the line the
  refusal stands on in HTML; a later minor may narrow that, never widen it. For `not-a-string` it is `{ line: 1, offset: 0 }`.

A parse always names a position, so the three markdown readers and `htmlToAdf` return `ParseError`, whose
`position` reads without a guard. An emit reads no source and carries `path` alone. One handler
typed on `ConvertError` takes both.

A call reports the first refusal in document order and stops, so a document with several surfaces
them one per call. Every refusal but `engine-limit` is deterministic — there is no I/O anywhere —
so a retry returns the identical error: fix the input, or set the document aside. `engine-limit`
can mean memory ran short: retry it once, and treat a repeat as lasting. Only an out-of-memory
throw the call can catch becomes `engine-limit`: on V8 (Node, Deno, Chrome), running out of
JavaScript heap ends the process. Convert input of unbounded size in a separate process with its
own memory limit where that must not take yours down.

### Parsing

Which reader raises which code: [The calls](#the-calls). Codes every direction raises:
[Either direction](#either-direction).

| Code | Fires when | What you can do |
| --- | --- | --- |
| `malformed-directive` | an `!adf:` the grammar cannot read — a prefix completing no directive, an unclosed container, `[content]` or `{attrs}`, a closer with no container of its name open, a leaf given a body, `{attrs}` out of order or duplicated, invalid JSON in an opaque carry | write the spelling the message names, or keep it literal: escape the prefix — `\!adf:`, block and inline alike — or, for a code fence whose info string opens `adf:`, drop the info string and wrap the fence in `!adf:codeBlock {language="adf:…"}` |
| `malformed-pipe-table` | a pipe row that is no pipe table — a missing `---` delimiter row, or a delimiter or body row whose cell count differs from the header's; in `losslessMarkdownToAdf` also an alignment colon, and a header or delimiter row not opening with a pipe | add a `---` row under the header and give every row the header's cell count; for `losslessMarkdownToAdf`, also open every row with a pipe and drop the colons. To keep the lines literal text, escape the leading pipe of every one — escaping a single row leaves the next to open a fresh table and fail the same way — or, for a table without leading pipes, write one `\|` of its delimiter row as `\\|` |
| `not-a-string` | the value handed in is not a string, such as `null`, a number or a `String` object | pass the input as a string, `String(value)` for a `String` object; the message names the value's type |
| `unknown-directive-name` | a directive whose name is no node or mark this version spells | check the name in [`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md), or escape the prefix as `\!adf:`; the spelling itself is well formed, so a later minor may give the name meaning |
| `unmappable-html` | the markdown holds raw HTML, a comment and a processing instruction among them; the HTML handed to `htmlToAdf` holds HTML `adfToHtml` does not write | remove the construct, or write what it holds as markdown; for `htmlToAdf`, write the HTML as [`spec/html.md`](https://github.com/larvit/adf-codec/blob/main/spec/html.md) spells it |

### Emitting

`adfToLosslessMarkdown`, `adfToPortableMarkdown` and `adfToHtml` raise these, and the codes under
[Either direction](#either-direction):

| Code | Fires when | What you can do |
| --- | --- | --- |
| `not-an-adf-document` | the value handed in is no ADF document — a missing or wrong `type`, a stray key, a node that is not a node, an object in the document holding itself, an attribute value that is not a plain object, array or JSON primitive, such as a `Date` or `Map` | guard the boundary you receive JSON at with `isAdfDocument`; the message names the branch that refused. Build an attribute value as JSON holds it: `date.toISOString()`, `Object.fromEntries(map)`, `{ ...instance }` |
| `unsupported-document-version` | the document's `version` is not 1 | keep the ADF and pass the document over, or show it read-only; the version is the site's, not yours to change |

### Either direction

Every call can raise these:

| Code | Fires when | What you can do |
| --- | --- | --- |
| `engine-limit` | in every call: a conversion that passes the longest array, `Map` or `Set` the JavaScript engine builds, or that the engine reports as out of memory; on JavaScriptCore (Bun, Safari), also one that passes its longest string, 2^31 − 1 characters | retry once; if it repeats, writing: set the document aside, keeping the ADF and passing it over or showing it read-only; reading: shorten the markdown, or nest its lists and quotes less deeply |
| `unsupported-nesting-depth` | blocks, marks, an attribute's JSON or a carried node's JSON nest past 500 levels | keep the ADF and pass the document over, or show it read-only; flatten the input where you are the one who wrote it |
| `unsupported-node-shape` | each cause listed below the table | the remedy beside each cause below |

- **Reading, in `losslessMarkdownToAdf`.** Fix what the message names;
  [`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md) lists every
  type's attributes and body. The markdown:
  - spells a node with an attribute, value, argument or body its type does not take, or without
    one it needs;
  - puts a line ending or a null character in an `emoji`, `mention` or `status` content slot:
    replace a line ending with a space, or, for either, write the node as `!adf:carry`;
  - wraps a directive mark around nothing, or only around nodes that take no such mark, such as a
    hard break, a mention or a code span;
  - writes a link whose text holds something besides hard breaks, but no node that takes a link,
    such as `[!adf:status[Done]{color=green}](/u)`: write the link around text beside them;
  - writes as a directive a node or mark the lossless flavour spells as CommonMark;
  - puts `!adf:textBreak{}` where it parts nothing, or `!adf:doc` anywhere but as the whole
    document.
- **Reading, in `htmlToAdf`.** Fix what the message names;
  [`spec/html.md`](https://github.com/larvit/adf-codec/blob/main/spec/html.md) lists each element's
  attributes. The HTML:
  - holds a `data-*` attribute naming no attribute its node holds, or holding a value outside that
    attribute's kind or not written as compact JSON, such as `data-wrap="yes"`;
  - holds a carry element whose `data-adf` is no ADF node's JSON, is not written compact with its
    keys sorted, or holds a number JSON cannot spell;
  - holds the document's own carry element beside another block.
- **Writing, in `adfToLosslessMarkdown`**: a node not riding the carry that carries one mark type
  twice, a block or a non-text inline node holding `text`, or a leaf block or a non-text inline node
  holding `content`. Keep the ADF and show the document read-only; where you built the ADF, fix
  what the message names.
- **Writing, in `adfToPortableMarkdown`**: a line or task list the portable writer cannot spell.
  This is a bug in this library: report it.
- **Past the engine's longest string**:
  - a writer's markdown or HTML would pass 536870888 characters, V8's longest string, on every
    engine;
  - in `adfToPortableMarkdown`, the document's text alone would, edge whitespace included;
  - in `losslessMarkdownToAdf`, a directive's plain CommonMark would;
  - in every call, a conversion passes V8's or SpiderMonkey's longest string.

  When writing, set the document aside: keep the ADF, and pass it over or show it read-only. When
  reading, shorten the markdown, or nest its lists and quotes less deeply.

## The guarantees

Serves [Goals](#goals) 1, 4 and 5.

- `losslessMarkdownToAdf(adfToLosslessMarkdown(doc))` deep-equals `doc` as JSON, for a document of
  plain objects as `JSON.parse` builds them — every key and value as `doc` holds it, adjacent text
  nodes, an empty `attrs`, `content` or `marks` and `-0` included, and unknown node types carried
  opaquely
  ([Unknown nodes ride the carry](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#unknown-nodes-ride-the-carry)).
- `htmlToAdf(adfToHtml(doc))` deep-equals `doc` on the same terms.
- Markdown this library reads, and markdown it writes, means what the CommonMark spec says. The
  bullets below name every exception.
- CommonMark is valid input to `commonMarkToAdf`, apart from the raw HTML `unmappable-html` names,
  nesting past 500 levels, and input whose conversion passes the engine's longest string, refused
  as `unsupported-node-shape`, or another engine limit, refused as `engine-limit`.
- The other readers claim shapes CommonMark reads as text or code. `losslessMarkdownToAdf` claims
  four: literal text matching directive, pipe-table or strikethrough syntax, and a code fence whose
  info string opens `adf:`. `portableMarkdownToAdf` claims what [Portable
  markdown](#portable-markdown) lists. A claimed shape that does not complete, such as a pipe row
  without a delimiter row, is an error result; each can be kept literal ([`spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md)).
- A document any reader built, written back with `adfToLosslessMarkdown`, takes the library's
  canonical spelling, which round-trips byte-identically.
- These CommonMark spellings parse without an error but build a document the reference
  implementation renders differently, because ADF holds no node for what the reference renders:
  - An empty link text reads as its destination, `[](/url)` as `/url` linked to `/url`, and `[]()`
    as nothing. A link text holding only hard breaks reads the same, followed by its hard breaks.
  - An image reads as an image only alone in its paragraph. Anywhere else — beside other text, in
    a heading or a table cell, or in the paragraph a task marker opens — it reads as its
    alt text linked to its URL: `See ![the moon](moon.png).` reads as
    `See [the moon](moon.png).`. To keep an image an image, give it a paragraph of its own: a
    blank line between it and any other line.
  - A code span inside emphasis reads as code without the emphasis, since ADF gives code text no
    mark but a link or an annotation: ``**`npm ci`**`` reads as `` `npm ci` ``.
  - Inside a link, an image reads as plain text the link marks. After the link comes `(image)`,
    which links to the image: `[look at ![the moon](moon.png) tonight](/moon)` reads as
    `[look at the moon tonight](/moon) ([image](moon.png))`. A link to the image's own URL takes
    no `(image)`, unless the image's title is one the link lacks. A link alone in its paragraph
    whose whole text is one image reads as that image, with the link marking it.
  - An image's title becomes its caption when the image stays an image, and otherwise the title of
    the link to the image.

  And these, for other reasons: a shortcut reference matching its definition only under Unicode case
  folding stays unresolved, and a link whose text holds an autolink keeps the inner link and leaves
  the outer brackets literal text, which the spec requires and the reference itself breaks, nesting
  one `<a>` in the other.
- Not every document converts back: `adfToLosslessMarkdown` refuses a document nesting past 500
  levels, a document meeting an `unsupported-node-shape` cause listed for it, for a writer or for
  every call, and a conversion `engine-limit` stops. Show the refusal and keep the document read-only; saving
  markdown you could not produce is the loss the round-trip exists to stop.
- Both readers narrow GFM's pipe table. A body row whose cell count differs from the header's is
  an error result, where GFM pads or cuts it. A line holding no `|` ends the table, where GFM reads
  it as a row.
- `losslessMarkdownToAdf` also needs a leading `|`: a header or delimiter row without one is an
  error result, and a later line without one ends the table. It refuses an alignment colon in the
  delimiter row too, since ADF holds no column alignment. `portableMarkdownToAdf` accepts both and
  drops the alignment. The trailing pipe is canonical output, optional in input.
- Past that and `~~`, `losslessMarkdownToAdf` reads no GFM: an autolink literal and a `- [ ]`
  marker stay text, and a checklist is the `taskList` directive — `portableMarkdownToAdf` turns the
  marker into a `taskList`.
- A document nested deeper than 500 levels is an error result, not a stack overflow, and no call
  loops forever on a string, or on a value `JSON.parse` or `structuredClone` builds.
- The emitted formats are semver surface
  ([The formats are API](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#the-formats-are-api)).

## The package

Serves [Goals](#goals) 8.

| Aspect | Contract |
| --- | --- |
| Dependencies | none at runtime |
| Engines | any ES2022 engine; `engines.node` is `>=18`. The test suite runs under Node, Deno and Bun, and a headless Firefox converts the corpus through the built entrypoint |
| Host APIs | none: pure ECMAScript, no DOM, no `node:` import |
| Module format | ESM only, one entrypoint |
| Registry | public npm, `@larvit/adf-codec` |
| Types | built JavaScript with `.d.ts` beside it |

Contract: [`docs/decisions.md`](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md#any-es2022-engine),
§Any ES2022 engine to §Public on npm.

## Everything exported

| Export | Kind | What it is ([The calls](#the-calls)) |
| --- | --- | --- |
| `AdfAttributes` | type | a node's or mark's attributes |
| `AdfDocument` | type | an ADF document |
| `AdfMark` | type | an ADF mark |
| `AdfNode` | type | an ADF node |
| `ConvertError` | type | the error a failed call returns |
| `ConvertErrorCode` | type | the closed list of codes in [The errors](#the-errors) |
| `ConvertErrorPath` | type | an error's place in the document |
| `JsonValue` | type | an attribute value |
| `ParseError` | type | the error a markdown reader or `htmlToAdf` returns, its `position` always set |
| `Result` | type | every call's return value |
| `SourcePosition` | type | an error's place in the markdown |
| `adfToHtml` | function | ADF to HTML |
| `adfToLosslessMarkdown` | function | ADF to the lossless flavour |
| `adfToPortableMarkdown` | function | ADF to portable markdown, lossy |
| `commonMarkToAdf` | function | strict CommonMark to ADF |
| `htmlToAdf` | function | the HTML `adfToHtml` writes to ADF |
| `isAdfDocument` | function | type guard for `AdfDocument` |
| `losslessMarkdownToAdf` | function | the lossless flavour to ADF |
| `portableMarkdownToAdf` | function | portable markdown to ADF |

## Links

- [Changelog](https://github.com/larvit/adf-codec/blob/main/CHANGELOG.md)
- [Upgrading from `0.1.0`](https://github.com/larvit/adf-codec/blob/main/MIGRATION.md)
- [The lossless flavour's grammar, `spec/flavour.md`](https://github.com/larvit/adf-codec/blob/main/spec/flavour.md)
- [Decisions](https://github.com/larvit/adf-codec/blob/main/docs/decisions.md)
- [Plan](https://github.com/larvit/adf-codec/blob/main/todo.md)
- [Issues](https://github.com/larvit/adf-codec/issues)

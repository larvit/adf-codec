# `kovetskiy/mark` compared with this package

Read and run on 2026-11-09 at `mark` v17.0.0 (`eacff19`): its README, the nine pages under its
`docs/`, `AGENTS.md`, `go.mod`, the issue search and the storage-format calls in its source. Run: the
program, built in a `golang:1.27.3` container, with `publish --compile-only` and no network, on 14
fixtures from `corpus/round-trip/` and on one file of its own syntax. Only read: everything that
needs a Confluence account (publishing, page lookup, link resolution, attachments, labels, `mark
export`).

## What it is

A Go program, Apache-2.0, 1,613 stars, 96 open issues, last push 2026-11-05. It publishes markdown
files as Confluence pages through the REST API, and `mark export` (experimental) writes a page
back as markdown.

## Which format

Not ADF. It parses markdown with goldmark and writes Confluence **storage format**, an XML dialect
(`ac:structured-macro`, `ac:task-list`, `<time datetime>`); the source holds no `atlas_doc_format`
and sends every body as `"representation": "storage"`. Confluence's editor turns that into ADF
itself, so mark never sees ADF.

It reads a page back only through `mark export`, from storage format, and writes storage format it
has no markdown for into the markdown as it is, much as the lossless flavour's carry holds a node
(`docs/export.md` §What stays storage format). Its list of what does not come back the same is
the same kind as ours.

## How its spellings differ from ours

Each row ran through `mark` and through `commonMarkToAdf`, `losslessMarkdownToAdf` and
`portableMarkdownToAdf` of v0.3.1.

| Confluence feature | `mark` spells | This package | Difference |
| --- | --- | --- | --- |
| Info, tip, note and warning boxes | `> [!NOTE]`, `> Note:`, `!!! note` | `portableMarkdownToAdf` reads `> [!NOTE]` as a `panel`; the lossless flavour spells `!adf:panel warning` | `[!IMPORTANT]`: blue info box in `mark`, `note` panel (purple, as on GitHub) here. `NOTE`, `TIP`, `WARNING` and `CAUTION` give the same box in both (`mark`'s note and warning boxes are ADF's `warning` and `error`). A colon marker and `!!! note` stay a quote and a paragraph here |
| Expand | `<details><summary>` | `!adf:expand {title="…"}` | `htmlToAdf` and the markdown readers refuse `<details>` as `unmappable-html` until items 137 and 138 |
| Task list | `- [x]` | `- [x]` in the portable flavour; `!adf:taskList` in the lossless one | the same spelling; `commonMarkToAdf` reads a bullet list, as CommonMark has no task |
| Date | `@date(2026-07-27)`, `<time datetime>` (behind `--features date`) | `!adf:date{timestamp=…}`; `<time class="adf-date">` in HTML | `<time datetime>` is refused as `unmappable-html`; `@date()` is text here (`docs/decisions.md` §Names stay text) |
| Emoji | `:tada:` (behind `--features emoji`) | `!adf:emoji[🎉]{…}` | text here, same entry |
| Link to a page | `[text](ac:Title)`, `./other.md` | a link with that destination | `mark` resolves it with Confluence; here it is a plain link |
| Status, Jira ticket, table of contents | a macro template: `<!-- Macro: … -->`, `ac:status`, `ac:jira:ticket` | `!adf:status[…]{color=…}`, `!adf:inlineCard{url=…}` | its templates are Go text templates writing storage format; ours are node directives |
| Mentions, panels with custom colours, media | storage format written by hand, or a template | `!adf:mention`, `!adf:panel custom`, `!adf:mediaSingle` | none in `mark`'s markdown |

What `mark` spells and ADF has no node for, so nothing here corresponds: page metadata in header
comments or YAML front matter (`Space`, `Parent`, `Title`, `Label`, `Attachment`, `Layout`,
restrictions, content properties), `<!-- Include: -->` and `<!-- Macro: -->`, attachments,
footnotes, definition lists, math, and Mermaid, D2 and PlantUML diagrams drawn into images.

Our directives written to `mark` come out as text: every `!adf:` line of the 14 fixtures is
published as a paragraph holding it. `commonMarkToAdf` refuses a `mark` document that opens with
`<!-- Space: DOCS -->`, as `unmappable-html`, because a comment is content ADF cannot hold
(`docs/decisions.md` §Foreign HTML sorts three ways); so does `<!-- Include: -->`. Neither is a
defect against that entry.

## Which the audience would expect

`mark`'s spellings are the ones the README's people already write: GitHub alerts, `<details>`,
`- [x]`. Ours agree for alerts and tasks in the portable flavour, and will for `<details>` once
items 137 and 138 land. The lossless flavour's `!adf:` directives are for what no
markdown spells, and `mark` spells none of those, so they never compete. The one divergence
that reads either way is `[!IMPORTANT]`; the README states ours (`README.md` § Portable markdown).

## Overlap

Product managers, engineers and support agents who write markdown for Confluence are the README's
second audience. `mark` serves them as a publishing pipeline for a repository of documents; this
package serves the four developer personas who embed a converter. The bot persona (generated
markdown to ADF) is the one overlap: both turn markdown into Confluence content, but `mark` needs
an account and the REST API, this package takes none (Goal 8). A user of `mark` who needs ADF can
publish with `mark` and fetch the page as ADF through the Confluence REST API, which converts
storage format to ADF; a user of this package who needs storage format has to go to that same API
(`README.md` § Other ADF converters).

## Does it belong in the comparison table

Neither table fits. The first lists npm packages that run in Node and convert ADF to or from
markdown; the second lists converters this comparison does not run, and every row of it converts
ADF. `mark` is a Go program that never touches ADF. Filed as item 177, a question to the maintainer, with the
options: leave it out, or add a row to the second table saying it converts markdown to storage
format and not ADF.

## Filed

Only item 177. The differences do not ask for a change to a spelling: `[!IMPORTANT]` is
an entry's choice to reopen, not a defect, and only a writer panel changes one (`AGENTS.md` §7).

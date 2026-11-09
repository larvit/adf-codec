# `kovetskiy/mark` compared with this package

On 2026-11-09, at `mark` v17.0.0 (`eacff19`), read: its README, the nine pages under its `docs/`,
`AGENTS.md`, `go.mod`, its issue tracker's search and the storage-format calls in its source. Run:
the program, built in a `golang:1.27.3` container, with `publish --compile-only` and no network, on
14 fixtures from `corpus/round-trip/` and on one file of its own syntax. Not run, only read: all
that needs a Confluence account (publishing, page lookup, link resolution, attachments, labels,
`mark export`).

## What it is

A Go program, Apache-2.0, 1,613 stars, 96 open issues, last push 2026-11-05. It publishes markdown
files as Confluence pages through the REST API, and `mark export` (experimental) writes a page
back as markdown.

## Which format

Not ADF. It parses markdown with goldmark and writes Confluence **storage format**, an XML dialect
(`ac:structured-macro`, `ac:task-list`, `<time datetime>`). The source holds no `atlas_doc_format`
and sends every body as `"representation": "storage"`, so `mark` never sees ADF.

It reads a page back only through `mark export`, from storage format. Storage format it has no
markdown for stays in the exported markdown as it is, much as the lossless flavour's carry holds a
node (`docs/export.md` in `mark`'s repo, §What stays storage format). Its list of what does not
come back the same from a publish after an export is like our list of exceptions under the README's
[The guarantees](../README.md#the-guarantees).

## How its spellings differ from ours

Each row ran through `mark` and through `commonMarkToAdf`, `losslessMarkdownToAdf` and
`portableMarkdownToAdf` of `@larvit/adf-codec` v0.3.1.

| Confluence feature | `mark` spells | This package | Difference |
| --- | --- | --- | --- |
| Info, tip, note and warning boxes | `> [!NOTE]`, `> Note:`, `!!! note` | `portableMarkdownToAdf` reads `> [!NOTE]` as a `panel`; the lossless flavour spells `!adf:panel warning` | `[!IMPORTANT]`: blue info box in `mark`, `note` panel (purple, as on GitHub) here. `NOTE`, `TIP`, `WARNING` and `CAUTION` give the same box in both: Confluence's note and warning macros are ADF's `warning` and `error` panels. A quote opening `Note:` (a colon marker) and `!!! note` stay a quote and a paragraph here |
| Expand | `<details><summary>` | `!adf:expand {title="…"}` | `htmlToAdf` and the markdown readers refuse `<details>` as `unmappable-html` until items 137 and 138 |
| Task list | `- [x]` | `- [x]` in the portable flavour; `!adf:taskList` in the lossless one | the same spelling; `commonMarkToAdf` reads a bullet list, as CommonMark has no task list |
| Date | `@date(2026-07-27)`, `<time datetime>` (behind `--features date`) | `!adf:date{timestamp=…}`; `<time class="adf-date">` in HTML | `<time datetime>` is refused as `unmappable-html`; `@date()` is text here (`docs/decisions.md` §Names stay text) |
| Emoji | `:tada:` (behind `--features emoji`) | `!adf:emoji[🎉]{…}` | `:tada:` is text here, same entry |
| Link to a page | `[text](ac:Title)`, `./other.md` | a link with that destination | `mark` resolves it with Confluence; here it is a plain link |
| Status, Jira ticket | a macro template: `<!-- Macro: … -->`, `ac:status`, `ac:jira:ticket` | `!adf:status[…]{color=…}`, `!adf:inlineCard{url=…}` | its templates are Go text templates writing storage format; ours are node directives |
| Mentions, panels with custom colours, media | storage format written by hand, or a template | `!adf:mention`, `!adf:panel custom`, `!adf:mediaSingle` | none in `mark`'s markdown |

What `mark` spells and ADF holds no node for, so nothing here corresponds: page metadata in header
comments or YAML front matter (`Space`, `Parent`, `Title`, `Label`, `Attachment`, `Layout`,
restrictions, content properties), `<!-- Include: -->`, `<!-- Macro: -->` as a mechanism, the table
of contents macro, attachments, footnotes, definition lists, math, and Mermaid, D2 and PlantUML
diagrams drawn into images.

Our directives written to `mark` come out as text: every `!adf:` line of the 14 fixtures is
published as a paragraph holding it. `commonMarkToAdf` refuses a `mark` document that opens with
`<!-- Space: DOCS -->` as `unmappable-html`, and refuses `<!-- Include: -->` the same way, because
a comment is content ADF cannot hold (`docs/decisions.md` §Foreign HTML sorts three ways). Both
refusals follow that entry.

## What the audience would expect

`mark`'s spellings for boxes, expands and tasks are ones the README's people already write: GitHub
alerts, `<details>`, `- [x]`. Ours agree for alerts and tasks in the portable flavour, and will for
`<details>` once items 137 and 138 land. For mentions, custom panels and media `mark` spells
nothing, so the lossless flavour's directives meet no spelling of its. For a date, an emoji, a
status and a card `mark` does spell something (`@date()`, `:tada:`, a macro template), and which
spelling the audience would expect there is for a writer panel, not this report. The one divergence
in a shared spelling is `[!IMPORTANT]`, which `README.md` §Portable markdown states for ours.

## Overlap

The people who write markdown for Confluence are the README's second audience. `mark` serves them
with a publishing pipeline for a repository of documents; this package serves the four developer
personas who embed a converter. Of those, the bot persona (generated markdown to ADF) is closest:
both tools turn markdown into Confluence content. `mark` needs an account and the REST API; this
package needs neither (Goal 8).

A user of `mark` who needs ADF can fetch the page as ADF through the Confluence REST API, which
converts storage format to ADF. A user of this package who needs storage format goes to that same
API (`README.md` §Other ADF converters).

## Does it belong in the comparison tables

`mark` never reads or writes ADF, so it is left out of both
(`docs/decisions.md` §The comparison tables list every ADF converter that starts and converts).

No spelling changes follow: `[!IMPORTANT]` is the README's choice to reopen, not a defect, and only
a writer panel changes a spelling (`AGENTS.md` §7).

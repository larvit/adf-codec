# @larvit/atlassian-adf-converter

Lossless conversion between **Atlassian Document Format** (ADF), an extended markdown flavour, and
an HTML dialect.

**Status: scaffold only, no conversion code yet.** Plan: `todo.md`. Decisions: `AGENTS.md`. The
flavour's grammar: [`spec/flavour.md`](spec/flavour.md).

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
markdownToAdf(markdown: string): Result<AdfDocument>
adfToHtml(doc: AdfDocument): Result<string>
htmlToAdf(html: string): Result<AdfDocument>
markdownToHtml(markdown: string): Result<string>   // via ADF
htmlToMarkdown(html: string): Result<string>       // via ADF
isAdfDocument(v: unknown): v is AdfDocument
```

`Result<T>` is `{ ok: true; value: T } | { ok: false; error: ConvertError }` — nothing throws.

## The guarantees

- `markdownToAdf(adfToMarkdown(doc))` equals `doc` — unknown node types included, carried opaquely
  (AGENTS.md §3).
- `htmlToAdf(adfToHtml(doc))` equals `doc` — fidelity HTML cannot express rides `data-*`
  attributes.
- Plain CommonMark is valid input to `markdownToAdf`, with two carve-outs — literal text
  matching directive or pipe-table syntax is claimed (escapable — `spec/flavour.md`) — and one
  gap: a CommonMark image fits only as its own title-less paragraph; mid-text and titled images
  are error results. Converting back yields the library's canonical spelling, which round-trips
  byte-identically.
- Foreign HTML maps a documented element set; an unmappable element is an error, never a silent
  drop. Well-formed HTML only — no tag-soup recovery.
- The emitted formats are semver surface (AGENTS.md §8).

## Who it is for

Personas, never named consumers (AGENTS.md §7):

- **Viewer/editor app** — shows a document, lets a human edit, posts back. Losslessness above all.
- **Bot posting content** — converts generated markdown to ADF; needs the CommonMark promise.
- **Export/indexing tool** — bulk ADF→markdown/HTML; needs readable output.
- **LLM/agent pipeline** — documents to a model as markdown, edits back; needs the round-trip and
  markdown legible to a reader that half-knows the flavour.

## The package

ESM only, no runtime dependencies, public npmjs. Built JavaScript with `.d.ts` beside it.
Contract: `AGENTS.md` §5–6.

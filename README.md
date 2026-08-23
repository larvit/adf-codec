# @larvit/atlassian-adf-converter

Lossless conversion between **Atlassian Document Format** (ADF), an extended markdown flavour, and
an HTML dialect.

**Status: specification only. No code is implemented yet.** `todo.md` holds the plan; `AGENTS.md`
holds the decisions already made.

## What it is for

Atlassian Cloud REST APIs (Jira v3, Confluence) hand out rich text — issue descriptions, comments,
pages — as ADF, a JSON node tree, ProseMirror-shaped, and take it back the same way. There is no
Atlassian endpoint that converts it: `pf-editor-service/convert` was decommissioned and
[JRACLOUD-77436](https://jira.atlassian.com/browse/JRACLOUD-77436) is still an open request. The npm
ecosystem covers one direction each, drops what markdown cannot express, and none of it round-trips.

A consumer that shows a document and lets someone edit it needs both directions, and needs them
lossless — otherwise saving an edit silently destroys the panels, mentions and attachments that were
in someone else's document. That is what this library is.

## The shape

Pure functions and their types. No I/O, no network, no configuration. ADF is the hub: the
markdown↔HTML directions compose through it.

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

- **`markdownToAdf(adfToMarkdown(doc))` equals `doc`** — including node types the library has never
  seen, which are carried opaquely (AGENTS.md §3).
- **`htmlToAdf(adfToHtml(doc))` equals `doc`** — fidelity HTML cannot express rides `data-*`
  attributes.
- **Plain CommonMark is valid input** to `markdownToAdf`: any ordinary markdown a human types
  converts per the CommonMark spec. Converting back yields the library's canonical spelling, which
  then round-trips byte-identically.
- **Foreign HTML** (not emitted by this library) maps a documented element set; an unmappable
  element is an error result, never a silent drop. The parser takes well-formed HTML, not
  WHATWG tag-soup recovery.
- **The emitted formats are semver surface** (AGENTS.md §8): after 1.0, output an old version
  emitted always parses under a newer one within the same major.

## Who it is for

No actual consumer is named here or anywhere in this repo (AGENTS.md §7). The personas the design
serves:

- **A viewer/editor app** — shows a document as markdown or HTML, lets a human edit, posts the
  result back. Needs losslessness above all.
- **A bot posting content** — generates ordinary markdown (templates, LLM output) and converts it
  to ADF. Needs the CommonMark input promise; never reads ADF back.
- **An export/indexing tool** — bulk-converts ADF to markdown or HTML for archives, search, static
  sites. Read-only; needs readable output.
- **An LLM/agent pipeline** — feeds documents to a model as markdown, converts the model's edits
  back. Needs the round-trip plus markdown that stays legible to a reader that half-knows the
  flavour.

## The package

ESM only, **no runtime dependencies**, published to public npmjs. Two entrypoints — built
JavaScript for ordinary consumers, TypeScript source for consumers running Node's type stripping —
with exported types either way. `AGENTS.md` §5–6 have the contract.

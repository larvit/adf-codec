# @larvit/atlassian-adf-converter

Lossless conversion between **Atlassian Document Format** (ADF) and an extended markdown flavour
that can carry the nodes plain markdown has no syntax for.

**Status: specification only. No code is implemented yet.** `todo.md` holds the plan and the design
questions still open; `AGENTS.md` holds the decisions already made.

## What it is for

Jira Cloud's REST v3 API hands out issue descriptions and comment bodies as ADF — a JSON node tree,
ProseMirror-shaped — and takes them back the same way. There is no Atlassian endpoint that converts
it: `pf-editor-service/convert` was decommissioned and
[JRACLOUD-77436](https://jira.atlassian.com/browse/JRACLOUD-77436) is still an open request. The npm
ecosystem covers one direction each, drops what markdown cannot express, and none of it round-trips.

A client that shows a ticket and lets someone edit it needs both directions, and needs them
lossless — otherwise saving an edit silently destroys the panels, mentions and attachments that were
in someone else's ticket. That is what this library is.

## The intended shape

Two pure functions and their types. No I/O, no network, no configuration:

```ts
adfToMarkdown(document: AdfDocument): string
markdownToAdf(markdown: string): AdfDocument
```

The published package is ESM only, has **no runtime dependencies**, and offers two entrypoints — the
built JavaScript for ordinary consumers, and the TypeScript source for consumers that run TypeScript
directly (Node's type stripping), with exported types either way. `AGENTS.md` §4 has the contract.

## The first consumer

[`plainpages-plugin-fastjira`](https://gitea.larvit.se/larvit/plainpages-plugin-fastjira) — a
server-rendered Jira client. Its read-only ticket view shows the markdown this library produces
verbatim, with no HTML rendering anywhere; its later write paths post back what this library
converts the other way. **That view is blocked on `0.1.0`,** and it needs `adfToMarkdown` first.

The library knows nothing about that consumer. No Jira, no HTTP, no REST shapes, no plainpages — a
document tree in, a string out, and the reverse.

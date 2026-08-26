# Working in this repo

Decisions a reader would otherwise relitigate, and the rules for every collaborator, human or
agent. Using the library: `README.md`. What is still to build: `todo.md`.

## 1. Three formats, ADF is the hub

ADF, one markdown flavour, one HTML dialect. Six directions exposed, but markdown↔HTML compose
through ADF: four conversions exist to keep correct — never write a fifth. No fourth format, ever;
each one doubles the directions.

## 2. The round-trip is the product

`markdownToAdf(adfToMarkdown(doc))` and `htmlToAdf(adfToHtml(doc))` must equal `doc` — anything
less silently destroys content an editor could not represent, in a document it did not author.
When losslessness and readability conflict, losslessness wins.

The other direction is a canonical fixpoint, not byte-identity: human markdown normalizes, the way
back yields the library's canonical spelling, and that spelling round-trips byte-identically.

"Equals" is structural equality over editor-normal ADF — adjacent text nodes with identical marks
merged, JSON number semantics, an empty attrs object, marks array or content array the absent
key — the only domain markdown can restore.

Round-trip equality is a property tested over a corpus, not a claim made in prose.

## 3. Unknown input policy

- Unknown ADF node: carried opaquely — raw JSON rides a dedicated syntax in both formats and
  restores to a deep-equal node. The round-trip holds for documents newer than the library. It is
  the node *type* that is unknown: a known type standing where its content model forbids stays an
  error result, never a carry.
- Unmappable foreign HTML element: error result naming the element — never a silent drop.
- Bare `@name` / `:smile:` in typed text: stays a text node. Only directives produce
  mention/emoji/media nodes; resolving names to ids needs I/O, which is the consumer's job.

## 4. The flavour

- Directives, one grammar for everything markdown lacks: `:::panel info` … `:::` blocks,
  `:mention[@Mikael]{id=5b10a2}` inline. Prior art: CommonMark's generic-directives proposal.
- Plain CommonMark is a subset, with carve-outs (`spec/flavour.md`): literal text shaped like a
  directive, a pipe table or a `~~` pair is claimed — plus one image gap.
- Tables: one header row plus plain inline cells → pipe table; anything richer → directive form.
- Identity-bearing nodes carry their ids in attributes; a document is only portable within its
  site — accepted.
- The HTML dialect mirrors this: semantic elements, stable `adf-*` classes, `data-*` for what HTML
  cannot express, text always escaped. No stylesheet ships.

## 5. Dependencies

`dependencies` is empty. A runtime dependency enters only through a decision entry here stating
why ~20 lines of own code cannot do the job, who maintains it, and what auditing it costs. So the
CommonMark and HTML parsers are written in this repo. `devDependencies`: few, each earning its
keep; they never reach a consumer.

## 6. The package contract

- ESM only — no CommonJS build, no dual-package hazard.
- One entrypoint: built JavaScript, `.d.ts` beside it. Do not add a TypeScript-source entrypoint —
  Node refuses to type-strip under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`),
  so it cannot serve an npm consumer.
- Published to public npmjs as `@larvit/atlassian-adf-converter`. Public source: the Gitea repo
  goes public, LICENSE in place, before the first publish.
- Exact versions: `save-exact=true` in `.npmrc`.

## 7. Nothing about any consumer

No Jira client, no HTTP, no REST shapes, no issue keys, no actual consumer named anywhere. Design
against the README's personas.

## 8. Semver: the formats are API

The emitted markdown and HTML are contracts. After 1.0: previously-emitted output parsing
differently, or not at all, is MAJOR; new syntax while old output still round-trips is MINOR.
Pre-1.0, normal 0.x rules.

The error surface is a contract too. `ConvertError` is `{ code, message, path }` — the code from a
closed list a consumer may switch exhaustively, the message free text, the path the node's position
from the document root. Adding, removing or renaming a code is breaking, so a milestone meeting a
new failure cause reuses a code where one fits; the list is complete at `0.1.0`. A code names the
cause; where one cause recurs across node types, one code covers them all and `path` and `message`
say which.

## 9. Release automation

- `package.json` version on `main` is the source of truth. CI on `main`: tests green and version
  differs from npm → publish and tag `vX.Y.Z`. No bump, no deploy; the bump is each shipping PR's
  deliberate semver judgment.
- Renovate watches devDependencies, Docker pins and action tags; automerges everything on green CI.
- Docker images pin the full patch version (`node:24.19.0-alpine3.24`, never `node:24`); actions
  pin semver tags.

## 10. Tests first, in Docker

Test for the behaviour wanted first, then implement until green. `node --test`, beside the code.
Node, tsc and npm never run on the host — only via the pinned images (§9). Tests are independent,
coverage does not decline, containers are torn down after a run.

The floors live in the `test` script, so `npm test` and the gate are one path: 100% of lines and
functions, and a branch floor that only ever moves upward. It sits below 100 because the guards
`noUncheckedIndexedAccess` and ADF's optional keys force — `?? []`, `?? {}`, `?.`, an index
compared against `undefined` — have a half no valid document reaches.

The corpus, all checked in: hand-built fixtures per node and combination; real sanitized ADF from
live Atlassian APIs; property-generated ADF trees; the CommonMark spec suite against
`markdownToAdf` and `markdownToHtml`.

## 11. Code rules

- Two-space indent, strict TypeScript, English everywhere. Alphabetical order wherever order
  carries no meaning.
- Failures are values: everything returns
  `Result<T>` — `{ ok: true; value } | { ok: false; error: ConvertError }` — nothing throws.
  `try/catch` only wrapped tightly around a call that genuinely throws, converted to a result on
  the spot.
- Only the hard break's inline segment holds a raw newline — every other spelling escapes one or
  refuses it — which is how the whitespace carry finds a line edge.
- A readable spelling tried ahead of a general one — the image, the pipe table, a pipe cell —
  returns `string | undefined`, never a `Result`: any failure is the fallback signal, and the
  general form owns the refusal. Refusing there refuses a document the general form spells.
- Nothing recurses unbounded: the guards walk iteratively, and blocks, marks, attribute values and
  a carried node's JSON are all held to 500 levels, so a deep document is a `Result` rather than the stack overflow that
  waits near 2000.
- No casts: `as`, `as unknown as`, non-null `!`. A boundary owes a type guard validating the
  fields it claims (`isAdfDocument`); past it everything is typed. Make invalid states
  unrepresentable.
- Explicit over implicit; descriptive names; no catch-all files (`utils`, `helpers`, `misc`).
- Reuse before adding; the smallest sufficient diff is the benchmark; no speculative generality —
  a second consumer, or it goes.

## 12. Prose to a minimum

Applies everywhere: comments, every markdown file in this repo (this one included), PR text.

- Default is no comment. One earns its single line only by naming an invariant, footgun or
  external constraint the code cannot show — never restatement, history, absence or arrangement.
  A second line belongs in the commit message or a decision entry here.
- Every prose comment in a diff is a review question; the default answer is delete.
- A doc paragraph says what the repo cannot say for itself, or it goes. The fix for a redundant
  one is deletion, not trimming. A false claim in any doc is a bug, fixed where found.
- Published text — npm README, error messages, API docs — never references internal systems,
  tickets or repos.

## 13. Commits and PRs

One-line commit messages and PR titles; short PR summaries. No AI-attribution markers, ever.

## 14. Non-goals

No wiki markup (§1), no network or filesystem I/O, no name→id resolution (§3), no ADF schema
validation or exported validator — a refusal that keeps the round-trip is not schema validation,
so the one a node carrying the same mark type twice earns stays, no shipped CSS (§4), no streaming APIs, no performance budget —
conversions are O(n), real documents are kilobytes. A CLI is a later goal (`todo.md`), not a
non-goal.

## 15. The working loop

One unchecked `todo.md` item per session, in the smallest PR-able chunk — split a big milestone
into sub-items in `todo.md` before starting it. Per chunk:

1. Fresh worktree off updated `origin/main`; implement tests-first (§10).
2. Run the larv-review flow until it passes and CI is green. A reviewer launch states the latest
   gate result (commit and outcome); a reviewer does not re-run `ci.sh` or the tests when a
   result exists for the commit under review, or when the diff since that result cannot affect
   it (docs-only) — re-run only what its own findings or fixes invalidate.
3. Merge the PR (standing authorization, this repo only, granted through the `0.1.0` release —
   PR #3), check the box in `todo.md`, report, stop. The next chunk gets a fresh session.

Ask, don't guess: any choice where what the maintainer would pick is not near-certain gets asked,
and the answer lands as a decision in this file. The confidence bar is very high — asking too
often is the accepted cost, guessing wrong is not.

Reserved for the maintainer, never the agent: changing `version` in `package.json` (a bump on
`main` publishes, §9 — every release including `0.1.0` is the maintainer's), making the repo
public, and creating the `NPM_TOKEN` secret.

A continuous loop session (`/loop`) counts as a chain of sessions: one chunk per iteration, each
iteration starting by re-reading `AGENTS.md` and `todo.md` and trusting them over anything
remembered from earlier iterations. The loop session is a thin driver: each chunk's work runs in
a fresh-context subagent holding this file as its charter, and the driver only relays maintainer
questions, runs the review flow, merges, and cleans up. The loop stops when only
maintainer-reserved acts remain.

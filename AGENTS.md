# Working in this repo

Decisions a reader would otherwise relitigate, and the rules every collaborator — human or agent —
works under. Everything about *using* the library is in `README.md`; what is still to build is in
`todo.md`.

## 1. Three formats, ADF is the hub

ADF, one markdown flavour, one HTML dialect. Six directions are exposed, but markdown↔HTML compose
through ADF, so four conversions exist to keep correct — never write a fifth. A fourth format
(wiki markup, anything else) is refused: each one doubles the directions again.

## 2. The round-trip is the product

`markdownToAdf(adfToMarkdown(doc))` and `htmlToAdf(adfToHtml(doc))` must equal `doc`. Anything less
and a consumer that lets someone edit a document destroys what it could not represent — a panel, a
mention, an attachment — in a document it did not author.

When losslessness and readability conflict, losslessness wins. A rare node may look ugly; nothing
is ever dropped for looks.

The other direction is a **canonical fixpoint**, not byte-identity: human markdown normalizes
(`*em*` and `_em_` become one ADF doc), converting back yields the library's canonical spelling,
and that spelling round-trips byte-identically. Byte-identity both ways would mean storing the
author's formatting choices in ADF, which has no place for them.

Round-trip equality is a property to test over a corpus, not a claim to make in prose.

## 3. Unknown input policy

- **Unknown ADF node** (Atlassian ships undocumented types and adds more): carried opaquely — the
  raw JSON rides a dedicated syntax in markdown and HTML, and converts back byte-for-byte. The
  round-trip holds even for documents newer than the library.
- **Unmappable foreign HTML element**: error result naming the element. Arbitrary HTML can express
  what ADF cannot hold, so import maps a documented element set and refuses the rest — never a
  silent drop.
- **Bare `@name` / `:smile:` typed as plain text**: stays a text node. Only the directive syntax
  produces mention/emoji/media nodes — resolving names to ids needs I/O, which is the consumer's
  job (e.g. an autocomplete that inserts the directive).

## 4. The flavour

- **Directives**, one grammar for everything markdown lacks: `:::panel info` … `:::` for blocks,
  `:mention[@Mikael]{id=5b10a2}` style inline. Prior art: CommonMark's generic-directives proposal.
- **Plain CommonMark is a subset.** Anything a human types converts per the spec; the flavour only
  adds syntax, never changes CommonMark meaning.
- **Tables**: a simple table (one header row, plain inline cells — no spans, widths, colours, block
  content) emits a pipe table; anything richer emits the directive form.
- **Identity-bearing nodes** (`mention`, `media`, `emoji`) carry their ids in attributes. A
  converted document is therefore only portable within the site it came from — accepted.

The HTML dialect mirrors this: semantic elements, stable `adf-*` class names, `data-*` attributes
for what HTML cannot express, text content always escaped. No stylesheet ships — styling is the
consumer's.

## 5. Dependencies

`dependencies` is empty. A runtime dependency may enter only through a decision entry here stating
why ~20 lines of our own code cannot do the job, who maintains it, and what auditing it costs;
until that entry exists the answer is no. So the CommonMark and HTML parsers are written in this
repo — a general parser would have to be extended into the flavour anyway.

`devDependencies`: few, each earning its keep. Tooling that genuinely helps (a property-test
generator) is welcome; it never reaches a consumer.

## 6. The package contract

- **ESM only.** No CommonJS build, no dual-package hazard.
- **Two entrypoints.** Built JavaScript for ordinary consumers; TypeScript source for consumers
  running TypeScript directly through Node's type stripping.
- **Types for both.** The JavaScript entrypoint ships `.d.ts` beside it; the TypeScript entrypoint
  is its own types.
- **Published to public npmjs as `@larvit/atlassian-adf-converter`**, matching `@larvit/log`.
  Public means the source is public: the Gitea repo starts private, and going public — LICENSE in
  place — is a step before the first publish, not after it.
- **Exact versions.** `save-exact=true` in `.npmrc`, as in every other repo here.

## 7. Nothing about any consumer

No Jira client, no HTTP, no REST response shapes, no issue keys — and no actual consumer named
anywhere in this repo. Design against the README's personas, not against a product. A consumer's
concern that leaks in here is a seam nobody declared.

## 8. Semver: the formats are API

The emitted markdown and HTML are contracts, not just the TypeScript surface. After 1.0: a change
that makes previously-emitted output parse differently, or stop parsing, is MAJOR; teaching the
parsers new syntax while old output still round-trips is MINOR. Documents in flight — stored,
cached, mid-edit — survive upgrades. Pre-1.0, normal 0.x rules apply.

## 9. Release automation

- `package.json` version on `main` is the source of truth. CI on every `main` push: tests green
  and version differs from npm's latest → publish and tag `vX.Y.Z`. A merge without a bump (docs,
  CI, dep bumps) deploys nothing; the bump in each shipping PR is a deliberate semver judgment.
- **Renovate** watches npm devDependencies, Docker image pins and action tags, and automerges
  every update — majors included — when CI is green.
- Docker images pin the **full patch version** (`node:24.19.0-alpine3.24`, never `node:24`);
  actions pin semver tags. Renovate raises the bumps as reviewable PRs.

## 10. Tests first, in Docker

Write the test for the behaviour wanted, then implement until it passes. `node --test`, beside the
code. Node, tsc and npm never run on the host — a compose service or `docker run` against a pinned
image (§9). Tests are independent: none passes because another ran first. Coverage does not
decline. Tear down test containers after a run.

The corpus, all checked in: hand-built fixtures per node and combination; real (sanitized) ADF
captured from live Atlassian APIs, including undocumented nodes; property-based generated ADF trees
(generator is a devDependency); the official CommonMark spec suite, run against `markdownToAdf`
(mapped) and `markdownToHtml`.

## 11. Code rules

- Two-space indent, strict TypeScript, English everywhere. Alphabetical order for object keys,
  lists and file lists wherever order carries no meaning.
- **Failures are values.** Every conversion returns
  `Result<T>` — `{ ok: true; value } | { ok: false; error: ConvertError }` — and nothing throws.
  `try/catch` only wrapped tightly around a call that genuinely throws, converted to a result on
  the spot; never for control flow.
- **No casts.** `as`, `as unknown as` and non-null `!` are banned — they silence the compiler
  exactly where it is needed. A boundary owes a type guard validating the fields it claims (that
  is what `isAdfDocument` is); past it everything is typed. Make invalid states unrepresentable:
  encode "one of these, never both" in the types, not in checks.
- Explicit over implicit. Descriptive names (`panelDirectiveParser`, not `helper`); no catch-all
  files or folders (`utils`, `helpers`, `misc`, `common`, `lib`).
- **Reuse before adding.** Extend an existing test or function before writing a new one; the
  smallest sufficient diff is the benchmark. No speculative generality: an interface with one
  implementation, an option with one used value, or a wrapper that only forwards waits for its
  second consumer — or goes.

## 12. Prose to a minimum

Stricter here than most repos. Applies to comments, docs and PR text alike.

- **Default is no comment.** One earns its single line only by naming an invariant, footgun or
  external constraint the code cannot show. Never a restatement, never history ("we used to…"),
  never why something is absent, never how a file is arranged. A second line means it belongs in
  the commit message or a decision entry here.
- Every prose comment in a diff is a review question, and the reviewer's default answer is delete.
- A doc paragraph clears the same bar: it says what the repo cannot say for itself, or it goes —
  and the fix for a redundant one is deletion, not trimming. A false claim in any doc is a bug,
  fixed in the change that finds it.
- Published text — the npm README, exported error messages, API docs — never references internal
  systems, tickets or repos.

## 13. Commits and PRs

One-line commit messages and PR titles; short PR summaries. No AI-attribution markers —
`Co-Authored-By` bots, "Generated with …" footers — in commits, PRs or comments, ever.

## 14. Non-goals

Stated so nobody builds them in: no wiki markup (§1), no network or filesystem I/O, no name→id
resolution (§3), no ADF schema validation or exported validator — whether Atlassian accepts a tree
is Atlassian's call — no shipped CSS (§4), no streaming APIs and no performance budget: conversions
are O(n) with no pathological blowups, and real documents are kilobytes. A CLI is a later goal
(`todo.md`), not a non-goal.

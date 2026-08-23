# Working in this repo

Decisions a reader would otherwise relitigate. Everything about *using* the library is in
`README.md`; what is still to build is in `todo.md`.

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

## 5. Zero runtime dependencies

Nothing in `dependencies`, ever. TypeScript and whatever the tests need are `devDependencies`, and
they never reach a consumer. This means the CommonMark parser and the (well-formed) HTML parser are
written in this repo — a general parser would have to be extended into the flavour anyway.

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

## 10. Tests first, in Docker

Write the test for the behaviour wanted, then implement until it passes. `node --test`, beside the
code. Node, tsc and npm never run on the host — a compose service or `docker run` against a
**full patch version** image tag (`node:24.19.0-alpine3.24`, never `node:24`).

The corpus, all checked in: hand-built fixtures per node and combination; real (sanitized) ADF
captured from live Atlassian APIs, including undocumented nodes; property-based generated ADF trees
(generator is a devDependency); the official CommonMark spec suite, run against `markdownToAdf`
(mapped) and `markdownToHtml`.

## 11. Style

Two-space indent, alphabetically sorted object keys, strict TypeScript. Failures are values:
every conversion returns `Result<T>` — `{ ok: true; value } | { ok: false; error: ConvertError }` —
and nothing throws. Input validation is structural only: what the walk needs (a node is an object
with a string `type`, known nodes have the attrs read from them), nothing more.

## 12. Non-goals

Stated so nobody builds them in: no wiki markup (§1), no network or filesystem I/O, no name→id
resolution (§3), no ADF schema validation or exported validator — whether Atlassian accepts a tree
is Atlassian's call — no shipped CSS (§4), no streaming APIs and no performance budget: conversions
are O(n) with no pathological blowups, and real documents are kilobytes. A CLI is a later goal
(`todo.md`), not a non-goal.

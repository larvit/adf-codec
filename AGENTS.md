# Working in this repo

The rules for every collaborator, human or agent, and an index of the decisions a reader would
otherwise relitigate. Using the library: `README.md`. What is still to build: `todo.md`; a bare
`(28)` cites that item's entry in `todo-history.md`.

## Decisions

In `docs/decisions.md`:

- Plain markdown is a flavour of the grammar
- The round-trip is the product
- Markdown in is a canonical fixpoint
- Equality is editor-normal
- Unknown nodes ride the carry
- Foreign HTML is refused by name
- Names stay text
- Directives under `!adf:`
- CommonMark is a subset
- Tables
- Links
- Ids stay site-local
- The HTML dialect
- No runtime dependencies
- Standards ship as data
- fast-check
- Any ES2022 engine
- ESM only
- One built entrypoint
- Public on npm
- The formats are API
- The code list
- Which code a cause takes
- `message` and `path`
- Publish on a version bump
- Docs describe the release being built
- No schema validation
- The gate runs on Deno and Bun
- The gate installs the tarball
- Firefox reads the build
- The coverage floors
- The size ratchet
- Properties on a fixed seed
- The flavour spec is read as a source
- The node tables answer to Atlassian's schema
- Nothing recurses unbounded
- Nothing spreads an unbounded array
- A retry loop checks its own termination
- Readers scan by index
- The spelling memo
- Only the hard break holds a raw newline
- Emphasis follows CommonMark's matching
- Readable spellings take the `try` prefix
- The attribute vocabulary is ADF's
- The source parts by ADF and format

## 7. Nothing about any consumer

No Jira client, no HTTP, no REST shapes, no issue keys, no actual consumer named anywhere. Design
against the README's personas.

## 9. Release automation

- The bump commit renames `CHANGELOG.md`'s `## Unreleased` to the version.
- Exact versions: `save-exact=true` in `.npmrc`.
- Renovate watches devDependencies, Docker pins and action tags; automerges everything on green CI.
- Docker images pin the full patch version (`node:24.19.0-alpine3.24`, never `node:24`), as
  specific as the publisher tags: `oven/bun:1.4.0-alpine` pins Bun's patch and leaves the base
  floating because Bun publishes nothing narrower. Actions pin semver tags.

## 10. Tests first, in Docker

Test for the behaviour wanted first, then implement until green. `node --test`, beside the code.
Node, tsc and npm never run on the host — only via the pinned images (§9). Tests are independent,
containers are torn down after a run. A test reaches only for what Node's, Deno's and Bun's `node:`
shims all carry.

Every leg announces its name and, where a container is in play, the image, before it runs and its
elapsed time after, `publish.sh` alongside `ci.sh`, so a long run reads as progress rather than as
a hang. A leg added later owes the same marker, and a function a leg reaches chains its statements
with `&&`, because the `||` that captures the leg's status suspends `set -e` for everything it
calls. A leg whose output is both streamed and grepped keeps the copy in a `mktemp`
file: `tee /dev/stderr` reopens fd 2, and under `./ci.sh > log 2>&1` the two offsets punch NUL
holes through each other's lines (4d).

`PROPERTY_RUNS=<runs>` raises the property runs and randomizes the seed for local digging. The
generators and run parameters properties share live in `src/conformance/property-harness.ts`,
outside the build and coverage.

Each `- ` bullet in `spec/flavour.md`'s `## Block nodes`, `## Inline nodes` and `## Marks` declares
the nodes named before its first em dash, with the attributes following `Attributes: ` — a
parenthesized value set reading `string`; fenced examples are skipped. Keep prose out of a bullet.

## 11. Code rules

- Two-space indent, English everywhere. Alphabetical order wherever order
  carries no meaning, keyed on the name a line introduces rather than where it came from: an
  import sorts on its first binding, type imports ahead of value imports, so moving or renaming a
  module reorders nothing (the maintainer, 2026-09-18).
- No casts: `as`, `as unknown as`, non-null `!`. A boundary owes a type guard validating the
  fields it claims (`isAdfDocument`); past it everything is typed. Make invalid states
  unrepresentable.
- Failures are values: everything returns `Result<T>`, nothing throws. `try/catch` only wrapped
  tightly around a call that genuinely throws, converted to a result on the spot. A reader with no
  path to name returns `Read<T>`, and the walk attaches the path where it knows it.
- Reuse before adding; the smallest sufficient diff is the benchmark; no speculative generality —
  a second consumer, or it goes.
- Explicit over implicit; descriptive names; no catch-all files (`utils`, `helpers`, `misc`); a file
  does not repeat its directory in its name — `adf/document.ts`, never `adf/adf-document.ts`. A name
  is the noun `spec/flavour.md` or ADF's schema uses for the thing; a directory follows a split the
  spec draws; a placement neither this section nor `docs/decisions.md` §The source parts by ADF and
  format settles goes beside its only reader, or in what both read where there are two (the
  maintainer, 2026-09-18).

## 12. Prose to a minimum

Applies everywhere: comments, every markdown file in this repo (this one included), PR text.

- Default is no comment. One earns its single line only by naming an invariant, footgun or
  external constraint the code cannot show — never restatement, history, absence or arrangement.
  A second line belongs in the commit message or a decision entry here.
- A doc paragraph says what the repo cannot say for itself, or it goes. The fix for a redundant
  one is deletion, not trimming. A false claim in any doc is a bug, fixed where found.
- Published text — npm README, error messages, API docs — never references internal systems,
  tickets or repos.

## 13. Commits and PRs

One-line commit messages and PR titles; short PR summaries. No AI-attribution markers, ever.

## 15. The working loop

`todo.md` lists what is left under the release that ships it, in shipping order. One item per
session — the first under the earliest release — in the smallest PR-able chunk; split a big item
into sub-items in `todo.md` before starting it. A chunk running a little over or under that is not
worth deliberating; what matters is that nothing is left undone in the end. The session stops there
whatever it was asked to finish: a release is a chain of sessions, so an instruction to work until a
release is done names the chain, not the session. An open PR is a chunk already in flight, and
finishing it is the session.
Per chunk:

1. Fresh worktree off updated `origin/main`; implement tests-first (§10).
2. Run the larv-review flow until it passes and CI is green. A reviewer launch states the latest
   gate result (commit and outcome); a reviewer does not re-run `ci.sh` or the tests when a
   result exists for the commit under review, or when the diff since that result cannot affect
   it (docs-only) — re-run only what its own findings or fixes invalidate.
3. Merge the PR (standing authorization, this repo only, granted through the `0.2.0` release —
   the maintainer, 2026-09-13), delete the item from `todo.md` — what a consumer sees of it is
   reworded for them into `CHANGELOG.md`'s `## Unreleased` — report, stop.

Reserved for the maintainer whatever any rule here says: changing `version` in `package.json` (a
bump on `main` publishes, `docs/decisions.md` §Publish on a version bump — every release is the
maintainer's) and the `NPM_TOKEN` secret.

### Ask, don't guess

Any choice where what the maintainer would pick is not near-certain gets asked. The confidence bar
is very high — asking too often is the accepted cost, guessing wrong is not.

An ask is a gap in this file, and its answer is the rule that closes it, landing here — never the
instance alone. Before asking, name the class the question belongs to and the earlier
`(the maintainer, …)` entries of that class; where a rule already decides it, apply it without
asking, and where the rule reads two ways on this input, that reading is the ask. Never ask "A or
B?": state the gap, the earlier asks of its class, the nearest text here, a candidate rule in this
file's voice and section, and the instance it yields. A rule that keeps collecting instances is
wrong: rewrite it.

Which output the audience expects — README goal 5 — is settled by a reader panel rather than
asked: three fresh-context readers, one per README persona the conversion serves, each given only
`## Audience` and the input, writing what they expect before picking among outputs the goals
allow, rendered, shuffled, with no rationale and nothing saying what is implemented. Three agreeing
settle it; otherwise four more read, five of seven settle it, and less is a missing goal, asked.
The verdict lands in the item it settles (the maintainer, 2026-09-25).

### Rules the loop has settled (the maintainer, 2026-09-18)

- A finding inside the chunk's item is fixed in the chunk. Outside it, a new `todo.md` item, always
  in a release, weighed against every item on that release by the personas and `docs/decisions.md`
  §Plain markdown is a flavour of the grammar through §Names stay text — an item it outweighs moves
  later. A weighing no rule decides is asked as a gap.
- A stated number — 500 levels, the branch floor — is kept; a chunk that cannot keep it asks,
  naming the number it can reach. A number the code needs and no rule states is a gap.
- An earliest release with no items left and nothing shipped toward it is planned as the chunk:
  every later item weighed as above, the order written in `todo.md`, and the maintainer's approval
  taken before any code. With work shipped toward it, it is ready to cut: report that and stop.

### The continuous loop

A `/loop` session counts as a chain of sessions, each iteration starting by re-reading `AGENTS.md`
and `todo.md` and trusting them over anything remembered from earlier iterations. The loop session
is a thin driver: each chunk's work runs in a fresh-context subagent holding this file as its
charter, and the driver only relays maintainer questions, runs the review flow, merges, and cleans
up. The loop stops when only maintainer-reserved acts remain.

# Working in this repo

The rules for every collaborator, human or agent, and an index of the decisions a reader would
otherwise relitigate. Using the library: `README.md`. What is still to build: `todo.md`.

## Decisions

In `docs/decisions.md`:

- Plain markdown is a flavour of the grammar
- The round-trip is the product
- Markdown in is a canonical fixpoint
- Equality is editor-normal
- Unknown nodes ride the carry
- Foreign HTML sorts three ways
- Names stay text
- Directives under `!adf:`
- CommonMark is a subset
- Tables
- Links
- Ids stay site-local
- Plain task ids come from position
- A callout title keeps its link targets
- The plain flavour's spellings
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
- The CommonMark suite checks three ways
- The flavour spec is read as a source
- The node tables answer to Atlassian's schema
- Nothing recurses unbounded
- Nothing spreads an unbounded array
- A retry loop checks its own termination
- Readers scan by index
- The spelling memo
- Cost fixes are measured, never timed
- Only the hard break holds a raw newline
- Emphasis follows CommonMark's matching
- Readable spellings take the `try` prefix
- The attribute vocabulary is ADF's
- The source parts by ADF and format

## 1. Nothing about any consumer

No Jira client, no HTTP, no REST shapes, no issue keys, no actual consumer named anywhere. Design
against the README's personas.

## 2. Release automation

- The bump commit renames `CHANGELOG.md`'s `## Unreleased` to the version.
- Exact versions: `save-exact=true` in `.npmrc`.
- Renovate watches devDependencies, Docker pins and action tags; automerges everything on green CI.
- Docker images pin the full patch version (`node:24.19.0-alpine3.24`, never `node:24`), as
  specific as the publisher tags: `oven/bun:1.4.0-alpine` pins Bun's patch and leaves the base
  floating because Bun publishes nothing narrower. Actions pin semver tags.

## 3. Tests first, in Docker

Test for the behaviour wanted first, then implement until green. `node --test`, beside the code.
Node, tsc and npm never run on the host — only via the pinned images (§2). Tests are independent,
containers are torn down after a run. A test reaches only for what Node's, Deno's and Bun's `node:`
shims all carry.

Every leg announces its name and, where a container is in play, the image, before it runs and its
elapsed time after, `publish.sh` alongside `ci.sh`, so a long run reads as progress rather than as
a hang. A leg added later owes the same marker, and a function a leg reaches chains its statements
with `&&`, because the `||` that captures the leg's status suspends `set -e` for everything it
calls. A leg whose output is both streamed and grepped keeps the copy in a `mktemp`
file: `tee /dev/stderr` reopens fd 2, and under `./ci.sh > log 2>&1` the two offsets punch NUL
holes through each other's lines.

`PROPERTY_RUNS=<runs>` raises the property runs and randomizes the seed for local digging. The
generators and run parameters properties share live in `src/conformance/property-harness.ts`,
outside the build and coverage.

Each `- ` bullet in `spec/flavour.md`'s `## Block nodes`, `## Inline nodes` and `## Marks` declares
the nodes named before its first em dash, with the attributes following `Attributes: ` — a
parenthesized value set reading `string`; fenced examples are skipped. Keep prose out of a bullet.

## 4. Code rules

- Two-space indent, English everywhere. Alphabetical order wherever order carries no meaning,
  keyed on the name a line introduces: an import sorts on its first binding, type imports ahead of
  value imports, so moving or renaming a module reorders nothing.
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
  is the noun `spec/flavour.md` or ADF's schema uses for the thing.

## 5. Prose to a minimum

Applies everywhere: comments, every markdown file in this repo (this one included), PR text.

- Default is no comment. One earns its single line only by naming an invariant, footgun or
  external constraint the code cannot show — never restatement, history, absence or arrangement.
  A second line belongs in the commit message or a `docs/decisions.md` entry.
- A doc paragraph says what the repo cannot say for itself, or it goes. The fix for a redundant
  one is deletion, not trimming. A false claim in any doc is a bug, fixed where found.
- Published text — npm README, error messages, API docs — never references internal systems,
  tickets or repos.

## 6. Commits and PRs

One-line commit messages and PR titles; short PR summaries. No AI-attribution markers, ever.

## 7. The working loop

`todo.md` lists what is left under the release that ships it, in shipping order. A session works
one chunk, starting from the first item under the earliest release, and stops when that chunk
merges, whatever it was asked to finish: a release is a chain of sessions, so an instruction to
work until a release is done names the chain, not the session. An open PR is a chunk already in
flight, and finishing it is the session.
Per chunk:

1. Fresh worktree off updated `origin/main`; implement tests-first (§3).
2. Run the larv-review flow until it passes and CI is green. A reviewer launch states the latest
   gate result (commit and outcome); a reviewer does not re-run `ci.sh` or the tests when a
   result exists for the commit under review, or when the diff since that result cannot affect
   it (docs-only) — re-run only what its own findings or fixes invalidate.
3. Merge the PR (standing authorization, this repo only, granted by the maintainer through the
   `0.2.0` release), delete the chunk's items from `todo.md` — what a consumer sees of them is
   reworded for them into `CHANGELOG.md`'s `## Unreleased` — report, stop.

Reserved for the maintainer whatever any rule here says: changing `version` in `package.json` (a
bump on `main` publishes, `docs/decisions.md` §Publish on a version bump — every release is the
maintainer's) and the `NPM_TOKEN` secret.

### Ask, don't guess

Any choice where what the maintainer would pick is not near-certain gets asked. The confidence bar
is very high — asking too often is the accepted cost, guessing wrong is not.

An ask is a gap in `docs/decisions.md`, and its answer is the entry that closes it, landing there —
never the instance alone; an answer that is a goal lands in the README, one that is a working rule
here. Before asking, name the class the question belongs to and the entries of that class; where
one already decides it, apply it without asking, and where it reads two ways on this input, that
reading is the ask. Never ask "A or B?": state the gap, the earlier entries of its class, the
nearest text, a candidate entry in that file's voice, and the instance it yields. An entry that
keeps collecting instances is wrong: rewrite it.

Which output the audience expects — README goal 5 — is settled by a reader panel rather than
asked: three fresh-context readers, one per README persona the conversion serves, each given only
`## Audience` and the input, writing what they expect before picking among outputs the goals
allow, rendered, shuffled, with no rationale and nothing saying what is implemented. Three agreeing
settle it; otherwise four more read, five of seven settle it, and less is a missing goal, asked.
The verdict lands in `docs/decisions.md`.

### Findings, numbers and empty releases

- A finding inside the chunk's items is fixed in the chunk. Outside them, a new `todo.md` item, always
  in a release, weighed against every item on that release by the personas and `docs/decisions.md`
  §Plain markdown is a flavour of the grammar through §Names stay text — an item it outweighs moves
  later. A weighing no entry decides is asked as a gap.
- A stated number — 500 levels, the branch floor — is kept; a chunk that cannot keep it asks,
  naming the number it can reach. A number the code needs and no entry states is a gap.
- An earliest release with no items left and nothing shipped toward it is planned as the chunk:
  every later item weighed as above, the order written in `todo.md`, and the maintainer's approval
  taken before any code. With work shipped toward it, it is ready to cut: report that and stop.

### The continuous loop

A `/loop` session counts as a chain of sessions, each iteration starting by re-reading `AGENTS.md`
and `todo.md` and trusting them over anything remembered from earlier iterations. The loop session
is a thin driver: each chunk's work runs in a fresh-context subagent holding this file as its
charter, and the driver only relays maintainer questions, runs the review flow, merges, and cleans
up. The loop stops when only maintainer-reserved acts remain.

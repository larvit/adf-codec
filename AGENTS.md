# Working in this repo

Decisions that a reader would otherwise relitigate. Everything about *using* the library is in
`README.md`; what is still to build, and what is still undecided, is in `todo.md`.

## 1. Two formats, never three

ADF and one markdown flavour. **No HTML** — not as an output, not as an intermediate, not as a
convenience export. A consumer that wants HTML renders the markdown itself, with its own escaping
and its own stylesheet; a consumer that wants neither shows the markdown verbatim, which is what the
first one does.

Three formats would mean six directions to keep lossless instead of two.

## 2. The round-trip is the product

`markdownToAdf(adfToMarkdown(doc))` must equal `doc`. Anything less and a consumer that lets someone
edit a ticket destroys what it could not represent — a panel, a mention, an attachment — in a
document it did not author.

That is why the flavour is *extended*: markdown has no syntax for most of what ADF holds, so the
flavour invents it. Designing that syntax is the first real task, and it is open (`todo.md`).

Two consequences to settle before any node is implemented, not after:

- **What happens to a node the library does not know.** The documented ADF node set is not the whole
  schema, and Atlassian adds to it. Whether an unknown node is carried opaquely, refused, or dropped
  is a correctness decision for the whole library, and it decides the return shape of both functions.
- **Whether a lossless document must stay readable to a plain markdown reader.** Anything the flavour
  invents is noise to a reader that does not know it. How much noise is acceptable bounds the syntax.

Round-trip equality is a property to test over a corpus, not a claim to make in prose.

## 3. Zero runtime dependencies

Nothing in `dependencies`, ever. TypeScript and whatever the tests need are `devDependencies`, and
they never reach a consumer. A markdown parser is exactly the dependency this rule exists to refuse:
the flavour is not CommonMark, so a general parser would have to be extended into one anyway.

## 4. The package contract

- **ESM only.** No CommonJS build, no dual-package hazard.
- **Two entrypoints.** The built JavaScript for ordinary consumers, and the TypeScript source for
  consumers that run TypeScript directly through Node's type stripping — the first consumer is one,
  which is why this exists.
- **Types for both.** The JavaScript entrypoint ships `.d.ts` beside it; the TypeScript entrypoint is
  its own types.
- **Published to public npmjs as `@larvit/atlassian-adf-converter`**, matching `@larvit/log`. Public
  means the source is public: the Gitea repo starts private, and going public — with the LICENSE in
  place — is a step before the first publish, not after it.
- **Exact versions.** `save-exact=true` in `.npmrc`, as in every other repo here.

## 5. Nothing about any consumer

No Jira, no HTTP, no REST response shapes, no plainpages, no issue keys. The library takes a document
tree and returns a string, or the reverse. A consumer's concern that leaks in here is a seam nobody
declared — and the reason this is a library at all rather than a file in the client that needed it.

## 6. Tests first, in Docker

Write the test for the behaviour wanted, then implement until it passes. `node --test`, beside the
code. Node, tsc and npm never run on the host — a compose service or a `docker run` against a
**full patch version** image tag (`node:24.19.0-alpine3.24`, never `node:24`), so the same commit
builds the same thing on a different day.

## 7. Style

Two-space indent, alphabetically sorted object keys, strict TypeScript. Failures are values, not
exceptions: a function that both returns a result and throws for some inputs has two error channels.

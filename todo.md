# Todo

The plan, in order. Nothing here is built yet.

## Open design questions — settle these first

None of them have an answer yet, and each one changes what every later milestone implements.

- [ ] **The flavour's syntax.** Markdown has no syntax for most of ADF. Every node in the inventory
      below that is not plain markdown needs one, and the set has to be internally consistent rather
      than invented node by node. Prior art worth reading before choosing: CommonMark's generic
      directives proposal, MDX, Obsidian's and Pandoc's extensions, and what Atlassian's own
      `editor-markdown-transformer` does (it is lossy — read it for the failure modes, not the design).
- [ ] **The unknown-node policy** (AGENTS.md §2). Carried opaquely, refused, or dropped — it decides
      the return shape of both functions, so it cannot be retrofitted.
- [ ] **How readable a converted document must stay** to a reader that does not know the flavour.
- [ ] **Whether plain CommonMark is valid input** to `markdownToAdf`. A human typing ordinary
      markdown into a comment box is the second consumer's whole write path.
- [ ] **Table fidelity.** ADF tables carry column widths, colspan, rowspan, header rows and cell
      background colours; markdown tables carry none of it.
- [ ] **Identity-bearing nodes.** `mention` holds an account id, `media` an attachment id, `emoji` a
      shortcode plus an id. The rendered text is not enough to reconstruct them, so the syntax has to
      carry the id — and then a document is only portable within the site it came from.

## Milestones

- [ ] **0 — Scaffold.** `package.json` with the §4 contract, `tsconfig.json`, `.npmrc`, LICENSE (MIT,
      Larv IT AB), the Docker tooling setup, and `.gitea/workflows/ci.yml` gating branches. Mirror
      `plainpages` for the workflow shape: `runs-on: docker-host`, actions pinned to semver tags.
- [ ] **1 — Settle the flavour.** Write the syntax down as this repo's specification before
      implementing it, and make the round-trip corpus from it.
- [ ] **2 — `adfToMarkdown`.** The direction the first consumer needs. Ships `0.1.0`.
- [ ] **3 — `markdownToAdf`.**
- [ ] **4 — Round-trip property tests** over a corpus of real Jira documents, both ways. Not a
      milestone that follows 2 and 3 so much as the thing that proves them.
- [ ] **5 — Release pipeline.** Tag-triggered publish to public npmjs, `NPM_TOKEN` secret, the repo
      made public with the LICENSE in place first (AGENTS.md §4).

## The ADF inventory to cover

From Atlassian's [structure
reference](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/). **It is
not the whole schema** — real payloads also carry `taskList`/`taskItem`, `decisionList`/`decisionItem`,
`layoutSection`/`layoutColumn`, `blockCard`/`embedCard`, `extension`/`bodiedExtension`/`inlineExtension`
and `placeholder`, none of which are documented there. Treat the documented set as the floor, not the
ceiling, and see the unknown-node policy above.

| | |
| --- | --- |
| Top-level block | `blockquote` `bodiedSyncBlock` `bulletList` `codeBlock` `expand` `heading` `mediaGroup` `mediaSingle` `multiBodiedExtension` `orderedList` `panel` `paragraph` `rule` `syncBlock` `table` |
| Child block | `blockTaskItem` `extensionFrame` `listItem` `media` `nestedExpand` `tableCell` `tableHeader` `tableRow` |
| Inline | `date` `emoji` `hardBreak` `inlineCard` `mediaInline` `mention` `status` `text` |
| Marks | `border` `code` `em` `link` `strike` `strong` `subsup` `textColor` `underline` |

Plain markdown already covers `blockquote`, `bulletList`, `codeBlock`, `heading`, `orderedList`,
`paragraph`, `rule`, `listItem`, `hardBreak`, `text`, and the `code`, `em`, `link`, `strike` and
`strong` marks. Everything else is what the flavour is for.

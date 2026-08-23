# Todo

The plan, in order. Nothing here is built yet. The design questions that used to be open are
settled in `AGENTS.md`; what remains open below is spec detail, settled at its own milestone.

## Milestones

- [ ] **0 — Scaffold.** `package.json` with the §6 contract, `tsconfig.json`, `.npmrc`
      (`save-exact=true`), the Docker tooling setup, `renovate.json` (automerge-on-green, §9), and
      `.gitea/workflows/ci.yml` gating branches: `runs-on: docker-host`, actions pinned to semver
      tags.
- [ ] **1 — The flavour spec.** Write the markdown flavour down as this repo's specification before
      implementing it: the exact directive grammar (attributes, escaping, nesting), each node's
      syntax from the inventory below, the opaque-carry spelling for unknown nodes, and the
      pipe-vs-directive table rule. Open detail to settle here: what CommonMark's raw-HTML
      constructs become in ADF, which has no raw-HTML node — likely the §3 element mapping, error
      otherwise. Start the corpus (§10) from this spec.
- [ ] **2 — `adfToMarkdown`.**
- [ ] **3 — `markdownToAdf`.** The CommonMark parser is the largest single component.
- [ ] **4 — Round-trip property tests** over the corpus, both ways. Not a milestone that follows
      2 and 3 so much as the thing that proves them.
- [ ] **5 — Release pipeline, ship `0.1.0`.** Publish-on-version-change on `main` (§9),
      `NPM_TOKEN` secret, the repo made public first (§6). `0.1.0` is the markdown round-trip:
      both markdown directions, the types, `isAdfDocument`.
- [ ] **6 — The HTML dialect spec.** Element-by-element mapping, the `data-*` fidelity scheme, the
      opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts.
- [ ] **7 — HTML, ship `0.2.0`.** `adfToHtml`, `htmlToAdf`, and the composed `markdownToHtml` /
      `htmlToMarkdown`. CommonMark spec suite runs against `markdownToHtml` from here (§10).
- [ ] **8 — CLI.** A later goal, deliberately unspecified until the library exists: shape it
      around the personas then.

## The ADF inventory to cover

From Atlassian's [structure
reference](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/). **It is
not the whole schema** — real payloads also carry `taskList`/`taskItem`, `decisionList`/`decisionItem`,
`layoutSection`/`layoutColumn`, `blockCard`/`embedCard`, `extension`/`bodiedExtension`/`inlineExtension`
and `placeholder`, none of which are documented there. Treat the documented set as the floor, not the
ceiling — the floor gets designed syntax, everything else rides the opaque carry (§3) until it too
gets syntax.

| | |
| --- | --- |
| Top-level block | `blockquote` `bodiedSyncBlock` `bulletList` `codeBlock` `expand` `heading` `mediaGroup` `mediaSingle` `multiBodiedExtension` `orderedList` `panel` `paragraph` `rule` `syncBlock` `table` |
| Child block | `blockTaskItem` `extensionFrame` `listItem` `media` `nestedExpand` `tableCell` `tableHeader` `tableRow` |
| Inline | `date` `emoji` `hardBreak` `inlineCard` `mediaInline` `mention` `status` `text` |
| Marks | `border` `code` `em` `link` `strike` `strong` `subsup` `textColor` `underline` |

Plain markdown already covers `blockquote`, `bulletList`, `codeBlock`, `heading`, `orderedList`,
`paragraph`, `rule`, `listItem`, `hardBreak`, `text`, and the `code`, `em`, `link`, `strike` and
`strong` marks. Everything else is what the flavour is for.

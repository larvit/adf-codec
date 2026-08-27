# Todo

The plan, in order. Nothing is built. Design questions are settled in `AGENTS.md`; remaining spec
detail is settled at its own milestone.

## Milestones

- [x] **0 — Scaffold.** `package.json` per §6, `tsconfig.json`, `.npmrc` (`save-exact=true`), the
      Docker tooling, `renovate.json` (§9), and `.gitea/workflows/ci.yml` gating branches:
      `runs-on: docker-host`, actions pinned to semver tags.
- [x] **1a — The directive grammar** (`spec/flavour.md`): inline/block/leaf directive forms,
      attributes, escaping, nesting, canonical form, the opaque-carry spelling, the raw-HTML
      input policy.
- [x] **1b — Block node syntaxes** in `spec/flavour.md`: panel, expand/nestedExpand, the media
      family, the pipe-vs-directive table rule and the directive table form, task and decision
      lists, layout, extensions, syncBlock.
- [x] **1c — Inline node syntaxes and marks** in `spec/flavour.md`: mention, emoji, status, date,
      inlineCard, mediaInline; underline, subsup, textColor, border; the spelling for text nodes
      whose whitespace CommonMark cannot hold (literal newlines, leading or trailing spaces) —
      escape-based, never literal, since pipe cells trim and pad. At `mediaInline`, check real
      payloads for external-URL support — if it exists, revisit the media section's
      mid-text-image error and its "no slot" ground.
- [x] **1d — Corpus start** (§10): checked-in fixtures per spec'd node, in `corpus/`, one
      directory per contract kind (`corpus/README.md`).
      **Settled** (the maintainer, 2026-08-26): the nodes CommonMark spells get directive sections
      of their own, rather than riding the opaque carry. Per `@atlaskit/adf-schema` 57.1.0 every
      block node it spells — `blockquote`, `bulletList`, `codeBlock`, `heading`, `listItem`,
      `orderedList`, `paragraph`, `rule` — carries a `localId` with no spelling, `codeBlock` also
      `hideLineNumbers`, `uniqueId` and `wrap`, `blockquote` also marks, and `hardBreak` `text`
      and `localId`; 2f gives each a place, and the plain spelling stays wherever the attributes
      are absent. That hands the two collision sites in `corpus/unspellable/` the second spelling
      they lacked, so each takes the directive form as a `media` with an empty `alt` already does
      (`spec/flavour.md`, the CommonMark image): a `codeBlock` whose info string is empty, and an
      `orderedList` starting at 1.
      **Also blocked**: the link rule covers destination spaces only, so two shapes
      have no spelling and are refused meanwhile — href `https://example.com/a)b` and title
      `He said "hi"`, both in `corpus/unspellable/`. Two defensible spellings each — angle
      brackets or a backslash escape, and for titles `'…'` or `(…)` besides — so §8 leaves
      the pick here. **Also blocked**: block separation is unstated for a CommonMark block beside a
      directive block in a container body — an `expand` whose content is `paragraph` "A" then a
      `panel` (`panelType` `warning`) holding "B" spells `A` and `:::panel warning` either on
      consecutive lines or with a blank line between. Two defensible spellings, so §8 leaves the
      pick here; the answer governs every unknown node type too, the block carry counting as a
      CommonMark block since its spelling is a fenced code block.
      `unspelled-block-separation` refuses the pair meanwhile, an empty paragraph's
      `::paragraph` beside a CommonMark block included — and, since a `mediaSingle`'s spelling now
      follows whether CommonMark can spell its URL, two sibling images differing only by an
      `&amp;` land in the same refusal.
  - [x] **1d1 — The CommonMark subset**: blockquote, bulletList, codeBlock, heading, orderedList,
        paragraph, rule, listItem, hardBreak, text, code spans, and the `code`, `em`, `link`,
        `strike` and `strong` marks — one mark per text node; nesting is 1d3's.
  - [x] **1d2 — Block nodes**: panel, expand/nestedExpand, the media family and the CommonMark
        image shape, both table forms, task and decision lists, layout, extensions, syncBlock —
        with the reserved `marks` attribute and the fence lengths nesting forces.
  - [x] **1d3 — Inline nodes and marks**: date, emoji, inlineCard, mediaInline, mention, status;
        border, subsup, textColor, underline; the content slot's `text` attribute and the
        `:text{text="…"}` whitespace spelling.
- [x] **2 — `adfToMarkdown`.** First real code. Each sub-item turns one corpus directory green;
      the two that have no fixtures yet write them in the same chunk, tests first (§10).
  - [x] **2a — The runner and the CommonMark subset.** The corpus runner: walk
        `corpus/round-trip/`, assert `adfToMarkdown` emits each `.md` byte for byte. Decide here
        where §10's coverage check lives, and gate that every `corpus/**/*.json` re-serializes to
        itself under the library's own canonical serializer — one implementation, keys sorted, two
        spellings: two-space indent for the corpus files and the block carry's body, compact for
        the inline carry. `commonmark-subset/` green.
  - [x] **2b — Block nodes.** `block-nodes/` green. A nested list that cannot interrupt the block
        above it is refused meanwhile, not spelled: the maintainer's answer on tight-versus-blank
        separation turns that refusal into an emission. The test is broader than the name it
        carries — `interruptsParagraph` reads the next list alone, so a list after a block no
        paragraph continues, a code block say, is refused too — and the same answer narrows it.
        Block separation becomes
        `separationBetween(previous, next, container)` here — a boolean cannot hold the third case
        `spec/flavour.md` states for two directive blocks in a container body, and the maintainer's
        answer on a CommonMark block beside a directive block (1d) drops into the same seam. Give
        the emitter's refusals a corpus home while the directories grow: `corpus/unspellable/`,
        a `.json` beside the `ConvertErrorCode` it must return, the emitter half of `corpus/errors/`.
  - [x] **2c — Inline nodes and marks.** `inline-nodes/` green. `InlineSegment` splits into its
        two axes — escapability (`backslash`, `bracketed`, `none`) and the emphasis role. A lone
        surrogate in a text node emits verbatim and becomes U+FFFD on any UTF-8 encode, a §2 break
        plain text still holds open — attribute values already escape it. The pipe form's fallback
        reads the emitted segments rather than naming the nodes whose attribute values spell a pipe
        as syntax, so 2e's `\u007c` narrows it in one place.
  - [x] **2d — The opaque carry** (§3). Fixtures and emitter together, into
        `corpus/round-trip/opaque-carry/`: an unknown node in both positions, the reserved `adf`
        info string, and the `codeBlock` whose language is `adf` — carried whole ahead of the
        attribute fallback 2e owes, since the reservation leaves that node no other spelling
        whatever 1d decides for its `localId`.
  - [x] **2e — Carve-outs and combinations.** Fixtures and emitter together, into
        `corpus/round-trip/combinations/`.
    - [x] **2e1 — The carve-outs and the claimed line.** The three carve-outs
          and their escapes, and a paragraph line inside a container body shaped like a closing
          fence (`:::`, `::: x`). Guard `fenceNestingFault`'s bare-run pop here too — a run shorter
          than the open fence is a fault, not a close — which today's emitter cannot reach.
    - [x] **2e2 — Mark runs and the runs a carry breaks.** The longest-run rule, attributes
          included, and a mark spelling that cannot open where it sits (`un**-real**istic`; the spec
          owes the carry a trigger). One mark vocabulary lands here, before 2e3 changes the
          attribute spelling: `emphasisSpellings`, `linkAttributes` and the `code`/`link` names join
          the mark table (3a parted it across `adf/mark-attributes.ts` and
          `markdown/mark-spellings.ts`), which holds four of the nine marks while the rest are
          branch literals in the emitter — and the parser (3) needs every name to make `:em[x]`
          the named error `spec/flavour.md` promises.
    - [x] **2e3 — Attribute canonicalization and the quoted value's escape.**
          **Settled** (the maintainer, 2026-08-26): a quoted attribute value escapes `` ` ``, `&`,
          `<` and `|` as `\u0060`, `\u0026`, `\u003c` and `\u007c`, in every directive, block and
          inline alike — the constructs those four open all bind at or before a directive does, and
          nothing else reaches into `{attrs}`. Emitted attributes being inert leaves 3 free to keep
          CommonMark's own precedence between a directive and a code span, and collapsed
          `escaping: 'attribute'` into `none`. The escaper's link-opener scan skips emitted syntax
          to match: a `](` inside a directive escapes no text `[`.
    - [x] **2e4 — The carry's fallback triggers.** `spec/flavour.md` carries a node its section
          cannot spell — an attrs key no section lists, a value that is not the section's type, an
          arg slot holding no bare token, marks no nesting spells — where the emitter still refuses,
          which leaves the refusals a container's own spelling owns. The flanking trigger 2e2
          added to that list is the odd one out: `unspellableMark` finds it after assembly and
          names a mark type against the line's path, so the failing run needs identifying before
          the carry can replace the refusal `mark-inside-word` pinned.
    - [x] **2e5 — Combined documents and the collision property.** Documents combining nodes rather
          than isolating one, and the gate's collision property: no two corpus documents may emit
          the same bytes — one spelling for two documents is a round-trip break no parser can undo,
          and it is provable without one.
          **Settled** (the maintainer, 2026-08-27): the approximation this item inherited — flanking
          exact, CommonMark's *matching* unmodelled — had two round-trip breaks reachable by hand,
          so the emitter now models the matching. `process_emphasis` runs over the runs the emitter
          wrote (`emphasis-matching.ts`) and a pair it hands to another delimiter rides the carry,
          which is what the multiple-of-3 rule did to the em in `un*a**b*****c**istic`. A delimiter
          run in text now escapes wherever CommonMark could open or close with it, not only open:
          one that could only close stole the spelling around it (`un*a* b*istic`), and escaping
          both ways keeps every delimiter the emitter did not write out of the matching. The
          canonical form gained a backslash where a run only closes — `\*not emphasis\*`, and
          2e1's `carve-out-strike` a third and fourth.
  - [x] **2f — The attributes CommonMark cannot hold.** 1d's settled answer: the block nodes
        CommonMark spells — `blockquote`, `bulletList`, `codeBlock`, `heading`, `listItem`,
        `orderedList`, `paragraph`, `rule` — get directive sections in `spec/flavour.md` carrying
        `localId`, `codeBlock`'s `hideLineNumbers`, `uniqueId` and `wrap`, and `blockquote`'s
        marks, while `hardBreak`'s `text` and `localId` join the inline directive it already has.
        The plain spelling stays wherever those attributes are absent, so only a node that carries
        one takes the directive form — which is what keeps a real payload readable rather than a
        page of carried JSON. Fixtures and emitter together, and the three documents the answer
        settles leave `corpus/unspellable/` as round-trip pairs: `block-local-id`,
        `code-block-empty-language`, `ordered-list-start-one`.
        **Settled** (the maintainer, 2026-08-27): the `codeBlock` directive's body is one fenced
        code block, the language staying on the fence line so every renderer still highlights it;
        a language no info string holds — empty, a backtick, edge whitespace, an entity reference
        or the reserved `adf` — rides the `language` attribute with the fence bare, which retires
        2d's carry for the reserved name along with the premise that left it no other spelling.
        The plain spelling gives way wherever it cannot render what the node carries rather than
        only where it has no place for it, so a heading level absent or outside 1-6 and an order
        whose markers would run past 999999999 take the directive form too, and
        `ambiguous-attribute-spelling`, `unspellable-code-block-language`,
        `unspellable-list-marker`, `unspelled-block-marks` and `unsupported-heading-level` leave
        `ConvertErrorCode`; content and placement refusals stay, which leaves the directive form
        spelling an empty list or a non-`listItem` child that the plain form refuses. `order` is
        the first marker, so `order: 1` keeps the plain `1.` — what a real payload carries — and a
        list carrying no `order` has no number to take and takes the directive form.
        2f raises what 1d's unspelled block separation costs: a single `localId` on a paragraph
        beside a plain one now refuses every container body that is a directive's — a panel, an
        expand, a table cell — where before 2f the attribute refused the document anyway.
- [ ] **3 — `markdownToAdf`.** Each sub-item lands the fixtures its own code reads, and the runner
      grows a parse half as they do: `parsingDirectories` beside `emittingDirectories`, a
      round-trip directory joining it only once every fixture in it reads back to its document,
      and readers for `corpus/normalization/` (setext, indented code, loose lists, `*`/`+`
      bullets, entity references, soft wraps — one-way, the markdown not canonical) and
      `corpus/errors/` (a markdown input per named error, the code in a `.error` beside it) with
      the first fixture each. `commonmark-subset/` cannot be the first to green — `::paragraph`
      and `:hardBreak{}` sit in it — so 3b through 3f answer to their own tests and the one-way
      fixtures they land, and 3g is where the first directory reads back. The raw-HTML element
      mapping is empty until milestone 6, so at `0.1.0` every raw-HTML construct in input — a
      block, an inline tag, a comment, a processing instruction — is a named error. Input is where
      unbounded nesting actually arrives, so §11's 500 binds all three of the emitter's guards
      here: block depth at 3c and again at 3f's container fences, inline and mark depth at 3f and
      3i, a carried value's JSON at 3j, where `isJsonValue` already bounds it.
  - [x] **3a — The hierarchy.** Mechanical, ahead of the first parser file: `src/adf/` and
        `src/markdown/` (`html/` arrives with its first file, 6-7), the grammar module shared
        inside `markdown/`, and `emphasis-matching.ts` beside it — the parser reuses it whole,
        `delimiterFlags` and `matchEmphasis` taking CommonMark's own run vocabulary rather than
        the emitter's, so no second `process_emphasis` exists to drift from the first.
        `block-directives.ts` and `inline-directives.ts` each part by file, a node table
        milestones 6-7 need in `adf/` beside a markdown spelling that belongs in `markdown/`.
        `directive-attributes.ts` cannot: `vocabularyPairs` walks the vocabulary and spells the
        value in one pass, the type check living inside `spellAttributeValue`, so the check comes
        out as its own predicate and goes to `adf/` with the walk while the spelling stays in
        `markdown/`, `isBareToken` with it — only spelling calls it. `markSpellings` is the one
        table whose keys part rather than its file, so key the markdown half off the ADF half's
        type: a mark named in one and not the other is then a compile error instead of a false
        refusal. `spellDestination`, `spellTitle` and `balanced` leave `markdown-inline.ts` here
        too — CommonMark destination spelling `emitLink` and `tryImageLine` share, and the six
        concerns that file carries are one fewer for it. `AttributeKind` and `AttributeVocabulary`
        follow the walk into `adf/`, the vocabulary a string-typed attribute grammar needs and
        HTML will want too, not a markdown spelling.
        **Settled** (the maintainer, 2026-08-27): `markdown/` parts here as well, into `emit/` and
        `parse/` with the shared set at the root — the grammar module, emphasis matching,
        the tables' markdown halves — and `parse/` arriving with 3b's first
        file, the rule `html/` already follows. And the node tables, a second copy of
        `spec/flavour.md`'s prose whose mistyped attribute name degrades into a false refusal no
        test catches, get their guard: a test reads the spec's node sections, takes each
        `name (type)` list and asserts it equals the table, leaving the spec the source a human
        writes with no build step and no generated file. It is built at 3g, where a wrong entry
        starts refusing documents.
  - [ ] **3b — The leaf blocks.** The line walk that opens and closes a block, ahead of any inline
        parsing: paragraph, ATX and setext heading, thematic break, fenced and indented code
        block, the HTML block whose lines it swallows whether or not the construct then errors,
        the link reference definitions a closing paragraph gives up, and the blank lines between
        them. The openers are `commonmark-grammar.ts`'s — one table answers both directions, or
        the emitter under-escapes a line the parser reads as a block and §2 breaks in silence —
        the HTML block's start conditions excepted, which are new here since the emitter writes
        none. Block-level claiming lands here too: a colon run or an unescaped leading `|` is
        claimed, the parse behind it 3f's and 3h's, a claim with nothing yet to parse it the named
        error the claim promises meanwhile. The runner's parse half comes with it, and the first
        `normalization/` fixtures, holding inline-trivial content so 3d and 3e add beside them
        rather than editing them.
  - [ ] **3c — The container blocks.** Blockquote, bullet and ordered list: the continuation a
        marker's width sets, lazy continuation, and the tightness ADF does not record — `> `
        repeated being two bytes a level, so this is the cheapest way to reach §11's 500. 3b's leaf
        readers scan the physical line themselves, so a container re-cuts the walk rather than adding
        to it: the open containers' prefix comes off the line first and the readers take one line at a
        time, `LeafBlock` renamed with the union they join and `blockNode`'s chain gaining their
        branches.
        **Settled** (the maintainer, 2026-08-27): a claimed line ends lazy continuation, so a
        closing fence on the line after a blockquote's open paragraph closes its container instead
        of continuing the paragraph CommonMark would fold it into. Claiming at block level is
        already absolute, and this binds input alone — 2e1's `closing-fence-line` orders the
        emitter's blockquote away from the edge either way — so `spec/flavour.md`'s claiming
        paragraph gains the case here. And 2b's tight-versus-blank, one answer for both
        directions: the tight spelling stays wherever it parses back, a blank line going in only
        where the nested list would be swallowed — `interruptsParagraph` inverted from a refusal
        into the separation it names, and `spec/flavour.md`'s "none between a nested list and a
        CommonMark block above it" gaining that exception. Every fixture spelled tight today keeps
        its bytes, and `nested-list-tight` becomes a round-trip pair.
  - [ ] **3d — Inline text.** The inline scanner over a block's content: backslash escapes, entity
        references decoding to their characters, code spans and the literal they hold — directive
        syntax and `~~` included — CommonMark's own hard breaks, a trailing backslash and two
        trailing spaces alike, a soft line break as one space, the fenced info string's own decoding
        the block walk leaves raw, and the raw inline tag, comment and processing instruction
        refused by name, recognized by the `commonmark-grammar.ts` predicates the emitter already
        escapes against, under 3b's one-table rule.
  - [ ] **3e — Emphasis and links.** `_`, `*` and `~~` runs through `matchEmphasis` to the `em`,
        `strong` and `strike` marks; links inline and reference, 3b's definitions resolved here,
        autolinks, and the image gap's named errors — a titled image, and one amid other text.
        `spec/flavour.md` does not yet pin `~`'s `can_open`/`can_close`, which is transcription
        rather than a decision: `delimiterFlags` already gives it CommonMark flanking, as for `*`,
        and §8 fixed that the moment the emitter shipped.
        **Settled** (the maintainer, 2026-08-27): 1d's deferred pair takes the backslash inside
        the delimiters it already has — `[a](https://example.com/a\)b)` and
        `[a](/url "He said \"hi\"")`. `<…>` stays reserved for the destination holding a space,
        where nothing else works, so each construct keeps one spelling and a destination holding
        both composes. `link-destination-parenthesis` and `link-title-quote` become round-trip
        pairs.
  - [ ] **3f — The directive grammar.** The three forms — inline `:name[content]{attrs}`,
        container `:::name arg {attrs}`, leaf `::name arg {attrs}` — the attribute grammar with
        its quoting and escapes, the fence-length and nesting rules, and the malformed list
        `spec/flavour.md` spells, each a named error. `corpus.test.ts`'s `fenceNestingFault` stays a
        second reading of the fence rule over emitted bytes: the double entry is the check.
        **Settled** (the maintainer, 2026-08-27): the code span, the entity and raw HTML bind
        first in input, as 2e3 already assumed of the emitted side — a raw `` ` ``, `&`, `<` or
        `|` inside `{attrs}` breaks the directive and is a named error, the author writing the
        `\u0060` the emitter writes. One precedence covers both directions, and CommonMark's own
        ordering stays untouched.
  - [ ] **3g — The node tables read backwards.** `commonmark-subset/` reads back, the first
        directory to. A parsed directive becomes its node: the name to the type and an unknown one
        to a named error, the arg to the attribute it names, each value to the type its section
        assigns, the body to `content`, the reserved `marks` key to the marks array. 3a's drift
        guard is built here if the answer there was yes.
  - [ ] **3h — The block nodes.** `block-nodes/` reads back: the plain-versus-directive choice 2f
        settles, read from the other side; the `codeBlock` directive's fenced body and the
        `language` attribute a bare fence leaves it; the media family's composition and the
        CommonMark image shape; both table forms, the pipe table's cell split and its named
        errors; and the one paragraph an inline body takes.
        **Settled** (the maintainer, 2026-08-27): 1d's last pick, the one
        `container-block-separation` holds — a CommonMark block and a directive block sit adjacent
        in a container body with no blank line between them. That reduces the three cases to one
        rule, separation only where its absence would merge the blocks: the `:::` fence is
        separation already, and 3c's claim ends the lazy continuation that would otherwise swallow
        it. The fixture becomes a round-trip pair, and with `nested-list-tight` and 3e's pair that
        empties `corpus/unspellable/`: this chunk settles the directory's own guard in
        `corpus.test.ts` too, and `unspelled-block-separation`, which loses its only cause here.
        The emitter's other refusals survive on causes no fixture in that directory covers, so
        3k's one-list pass is where they get fixtures or the directory goes.
  - [ ] **3i — The inline nodes and the marks.** `inline-nodes/` reads back: the content slot's
        `text` attribute and the error a slot holding anything but one unmarked text node is; the
        `:text{text="…"}` whitespace spelling; the four directive marks and their nesting order,
        outermost first; and `:em[x]` as the error `spec/flavour.md` promises. Editor-normal's
        merging half lands here, `text-whitespace` being the first fixture that forces it, and 4's
        `toEditorNormal` is built on it.
  - [ ] **3j — The carry and the combinations.** `opaque-carry/` and `combinations/` read back:
        the `adf` fence and `:adf{json="…"}` restoring a deep-equal node, invalid JSON in either a
        named error, a carry inside a mark spelling another, and the three carve-outs' escapes
        reading as the literal text they hold.
  - [ ] **3k — The CommonMark spec suite.** Checked in at `corpus/commonmark-spec/`, pinned to
        the version it ships — the one `html-blocks.ts` names for its start conditions —
        `corpus/README.md` gaining the kind.
        **Settled** (the maintainer, 2026-08-27): three checks an example must pass, the reference
        HTML each ships read as corpus data — which adds no format and no direction (§1). §2's
        canonical fixpoint: a named error, or markdown that parses and emits to itself byte for
        byte. That HTML's text, tags stripped and entities decoded, against the parsed document's
        concatenated `text`. And a count of the dozen elements the CommonMark subset covers
        against the marks and nodes they map to. The fixpoint alone is self-consistency a parser
        returning the empty document passes, and the text alone one dropping every emphasis; the
        counts close both. The exception list stays the maintainer's. One outcome is no
        exception and must not be filed as one: valid CommonMark parsing to a document
        `adfToMarkdown` refuses is a §2 hole, which is what three of `corpus/unspellable/`'s four
        hold until 3c, 3e and 3h land their answers. The parser's `ConvertErrorCode` additions
        are read here as one list before §8's freeze — nine sessions mint them independently, and
        one cause wearing two codes is breaking to undo after `0.1.0`. `index.ts` gains
        `markdownToAdf` here with the README's status line, neither waiting on the exception list:
        a parser still missing syntax is a claim the entrypoint cannot keep, and the corpus reads
        it from its module meanwhile.
- [ ] **4 — Round-trip property tests** over the corpus, both ways — the thing that proves 2 and
      3. Editor-normal (§2) is finished here, on 3i's merging — `toEditorNormal(doc)` and the
      equality the round-trip asserts, which over normalized input is the canonical serializer's
      compact spelling — rather than staying spelled inline as `?? []` at every reader. The
      reading half is `nodeContent`/`nodeAttrs`/`nodeMarks` over the ~28 sites spelling it
      inline today, which also lifts the branch floor §10 keeps below 100 for exactly those
      halves.
      Generators emit editor-normal ADF (§2). Real sanitized ADF from live Atlassian APIs lands
      here too (§10), in `corpus/real-payloads/`: an ADF→markdown→ADF check with no expected
      markdown, the payloads supplied by the maintainer. This subsumes 2e5's collision property —
      a document that round-trips proves no other document shares its spelling — so decide here
      whether that gate stays as the parser-free, faster-failing signal or goes; the half holding
      no fixture duplicates is hygiene rather than a round-trip claim, and stays either way.
- [ ] **5 — Release pipeline, ship `0.1.0`.** Publish-on-version-change (§9), `NPM_TOKEN` secret,
      the repo made public first (§6). The `ConvertErrorCode` freeze (§8) is checkable here: every
      `corpus/unspellable/` document is a decision or a deferred trigger this file names, so the
      directory empties as they land and whatever survives is permanent. `0.1.0` is the markdown round-trip: both markdown
      directions, the types, `isAdfDocument`. The build lands here: a build tsconfig emitting JS
      and `.d.ts` to `dist/` (the dev config's `allowImportingTsExtensions` forces `noEmit`, so
      the build config needs `rewriteRelativeImportExtensions`), plus `exports`/`files` in
      `package.json`. The maintainer's bump PR also removes `private: true`, the guard against any
      earlier publish.
- [ ] **6 — The HTML dialect spec.** Element-by-element mapping, the `data-*` fidelity scheme, the
      opaque-carry form, and the documented foreign-element set `htmlToAdf` accepts.
- [ ] **7 — HTML, ship `0.2.0`.** `adfToHtml`, `htmlToAdf`, the composed `markdownToHtml` /
      `htmlToMarkdown`. CommonMark spec suite runs against `markdownToHtml` from here (§10).
- [ ] **8 — CLI.** A later goal, shaped around the personas once the library exists.

## The ADF inventory to cover

From Atlassian's [structure
reference](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) — not the
whole schema: real payloads also carry `taskList`/`taskItem`, `decisionList`/`decisionItem`,
`layoutSection`/`layoutColumn`, `blockCard`/`embedCard`, `extension`/`bodiedExtension`/`inlineExtension`
and `placeholder`, none documented there. The documented set is the floor: the floor gets designed
syntax, the rest rides the opaque carry (§3) until it does too.

| | |
| --- | --- |
| Top-level block | `blockquote` `bodiedSyncBlock` `bulletList` `codeBlock` `expand` `heading` `mediaGroup` `mediaSingle` `multiBodiedExtension` `orderedList` `panel` `paragraph` `rule` `syncBlock` `table` |
| Child block | `blockTaskItem` `extensionFrame` `listItem` `media` `nestedExpand` `tableCell` `tableHeader` `tableRow` |
| Inline | `date` `emoji` `hardBreak` `inlineCard` `mediaInline` `mention` `status` `text` |
| Marks | `border` `code` `em` `link` `strike` `strong` `subsup` `textColor` `underline` |

Plain markdown covers `blockquote`, `bulletList`, `codeBlock`, `heading`, `orderedList`,
`paragraph`, `rule`, `listItem`, `hardBreak`, `text`, and the `code`, `em`, `link` and `strong`
marks; `strike` is the flavour's `~~` carve-out. Everything else is what the flavour is for.

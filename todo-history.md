# Todo history

The done `todo.md` items in full, as they were written. `todo.md` keeps a one-line summary of each.

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
- [x] **3 — `markdownToAdf` (`0.1.0`).** Each sub-item lands the fixtures its own code reads, and
      the runner grows a parse half as they do: readers for `corpus/normalization/` (setext,
      indented code, loose lists, `*`/`+`
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
  - [x] **3b — The leaf blocks.** The line walk that opens and closes a block, ahead of any inline
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
  - [x] **3c — The container blocks.** Blockquote, bullet and ordered list: the continuation a
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
        its bytes, and `nested-list-tight` becomes the round-trip pair `nested-list-separation`.
  - [x] **3d — Inline text.** The inline scanner over a block's content: backslash escapes, entity
        references decoding to their characters, code spans and the literal they hold — directive
        syntax and `~~` included — CommonMark's own hard breaks, a trailing backslash and two
        trailing spaces alike, a soft line break as one space, the fenced info string's own decoding
        the block walk leaves raw, and the raw inline tag, comment and processing instruction
        refused by name, recognized by the `commonmark-grammar.ts` predicates the emitter already
        escapes against, under 3b's one-table rule.
        **Settled** (the maintainer, 2026-08-30): entity references decode against HTML5's whole
        named table, checked in packed (§5) — a curated subset leaves 3k an exception class and a
        cutoff line nobody can defend. And the escape superset the emitter reads for raw HTML
        tightens into one precise CommonMark inline reader both directions share, the email
        autolink parting off as 3e's own predicate: refusing on the superset would refuse
        `1 <b 2`, a fourth carve-out §4 and the README do not list. `holdsEntityReference` reads
        the table for the same reason, so `&notareference;` is emitted bare.
  - [x] **3e — Emphasis and links.** `_`, `*` and `~~` runs through `matchEmphasis` to the `em`,
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
        **Settled** (the maintainer, 2026-08-31): the destination escapes only the parenthesis it
        leaves unbalanced, so `/wiki/Foo_(bar)` keeps its bytes, and the backslash stays refused in
        both the destination and the title — which leaves `[a](/a\b)` a §2 hole 3k's exception list
        answers, as `<http://x?a=1&amp;b=2>` is, autolinks decoding neither escapes nor references.
        The image gap mints `unmappable-image`, mirroring `unmappable-html` — a construct in input
        no ADF node carries. And the CommonMark image shape lands here rather than at 3h: once
        `[…](…)` reads, a lone `![alt](url)` would otherwise misparse as text plus a link, so 3h
        keeps the rest of the media family and loses only that line.
        **Settled** (the maintainer, 2026-08-31, on the review): an empty link text — `[](/u)` —
        leaves the brackets the text they are rather than minting a refusal or dropping the
        destination, giving the label back the way an unresolved pair does, so the shortcut behind
        `[][r]` still reads. A description holding an image flattens to that image's own alt, which
        is what alt text means and what keeps the documented gap to mid-text and titled images; a
        break of either kind inside one reads as a space. And a destination or title whose entity
        reference decodes to a control character — `[a](/x&#10;y)` — joins 3k's exception list
        beside the two above: the reader takes cmark's reading, the emitter has no spelling for it.
  - [x] **3f — The directive grammar.** The three forms — inline `:name[content]{attrs}`,
        container `:::name arg {attrs}`, leaf `::name arg {attrs}` — the attribute grammar with
        its quoting and escapes, the fence-length and nesting rules, and the malformed list
        `spec/flavour.md` spells, each a named error. `corpus.test.ts`'s `fenceNestingFault` stays a
        second reading of the fence rule over emitted bytes: the double entry is the check.
        **Settled** (the maintainer, 2026-08-27): the code span, the entity and raw HTML bind
        first in input, as 2e3 already assumed of the emitted side — a raw `` ` ``, `&`, `<` or
        `|` inside `{attrs}` breaks the directive and is a named error, the author writing the
        `\u0060` the emitter writes. One precedence covers both directions, and CommonMark's own
        ordering stays untouched.
        **Settled** (the maintainer, 2026-09-01): a directive whose name reads back to no node
        takes its own code, `unknown-directive-name` — a well-formed spelling the vocabulary does
        not hold is not a malformed one, and §8's "erroring input gaining meaning later is MINOR"
        is what a consumer switches the two apart for. And input reads canonical spacing only: one
        space parting the name, the argument, `{attrs}` and each attribute pair, no padding inside
        the braces, trailing whitespace on a directive block line tolerated — §8 makes loosening a
        MINOR, so strict is the reversible direction. `directive-attributes.ts` becomes
        `directive-syntax.ts` with the readers in it: the whole directive grammar, both
        directions, beside the escaping regexes and the spellings it must not drift from. And the
        500-level guards compose here for the first time — a recursive reader stacked on the block
        walk — so `nesting-depth-composed` pins both axes now rather than waiting for 3i's third.
        A closing fence closes the innermost open container however long its run, which
        `spec/flavour.md`'s closing-fence sentence now says: a run reaching past the innermost
        leaves the fence it did not close a named error, which §2 prefers to closing more than the
        author wrote.
  - [x] **3g — The node tables read backwards.** `commonmark-subset/` reads back, the first
        directory to. A parsed directive becomes its node: the name to the type and an unknown one
        to a named error, the arg to the attribute it names, each value to the type its section
        assigns, the body to `content`, the reserved `marks` key to the marks array. 3a's drift
        guard is built here if the answer there was yes.
        3f leaves two here: `Read<T>` moves to `src/result.ts` once a second reader takes it, and
        the reserved `adf` name in block position needs an error of its own — 3f reports it as
        `unknown-directive-name`, which §8 makes the signal that a later MINOR may give the name
        meaning, and `adf` never will.
        **Settled** (the maintainer, 2026-09-01): the reserved `adf` name in block position is a
        `malformed-directive` — the grammar section states the reservation, so it is that spelling
        the name breaks — and a well-formed directive the tables refuse is `unsupported-node-shape`,
        the emitter's code for the same mismatch read the other way; AGENTS.md §8 carries the
        split. And input reads canonical `{attrs}` alone, keys in order and every value spelled as
        the emitter spells it, the error naming the spelling to write instead: §8 makes loosening a
        MINOR, so strict is the reversible direction, as 3f already settled for spacing.
        **Settled** (the maintainer, 2026-09-01, on the review): 2f's plain-versus-directive
        choice is read back here rather than at 3h — a directive spelling a node CommonMark holds
        is refused, so `::rule` and `:::blockquote` are errors while `::rule {localId=…}` is not.
        The parser asks `spellsCommonMark`, the emitter's own choice, rather than restating the
        per-node conditions: a copy would refuse the list whose first item reads back as a
        thematic break, which the emitter does spell as a directive, and §2 breaks in silence.
        Two refusals land here for a later chunk to lift, on the same rule: the inline `[content]`
        slot, which 3i opens for `emoji`, `mention` and `status`, and the `codeBlock` content
        model's fenced body, 3h's. `Read<T>` stays where 3f left it — the node reader knows its
        path and returns `Result`, so no second reader took it. The drift guard earned itself on
        the way in: the spec's `text` attribute was missing from three inline table entries, which
        the content slot spells and the vocabulary walk already passes over.
  - [x] **3h — The block nodes.** `block-nodes/` reads back: the `codeBlock` directive's fenced
        body and the `language` attribute a bare fence leaves it; the media family's composition;
        and both table forms, the pipe table's cell split and its named errors. `fenceInfo` is a
        rule both directions answer alike and moves to the `markdown/` root with the language
        attribute.
        **Settled** (the maintainer, 2026-08-27): 1d's last pick, the one
        `container-block-separation` holds — a CommonMark block and a directive block sit adjacent
        in a container body with no blank line between them. That reduces the three cases to one
        rule, separation only where its absence would merge the blocks: the `:::` fence is
        separation already, and 3c's claim ends the lazy continuation that would otherwise swallow
        it. The fixture becomes a round-trip pair, and with `nested-list-separation` and 3e's pair
        that empties `corpus/unspellable/`: this chunk settles the directory's own guard in
        `corpus.test.ts` too, and `unspelled-block-separation`, which loses its only cause here.
        The emitter's other refusals survive on causes no fixture in that directory covers, so
        3k's one-list pass is where they get fixtures or the directory goes.
        **Settled** (the maintainer, 2026-09-01): losing that cause closed one of the shapes input
        accepted and emit refused, not the last. Two adjacent lists of a kind are what
        `adfToMarkdown` refuses and one `- ` spelling cannot hold apart, and the walk reached them
        two ways — a marker change, which CommonMark opens a second list on, and an empty last item,
        whose blank line pops the container the list's identity hung from. The parser opens no list
        beside one of its own kind instead, the way it already drops the blank lines between items;
        3k owes the CommonMark suite an exception where the reference HTML holds two `<ul>`. The
        `normalization/` arm emits each document and reads it back from here, so the population that
        class lives in is checked rather than read. The README's canonical-fixpoint sentence still
        claims more than the parser keeps — 3e's three shapes — which stays milestone 5's to
        narrow.
  - [x] **3i — The inline nodes and the marks.** `inline-nodes/` reads back: the content slot's
        `text` attribute and the error a slot holding anything but one unmarked text node is; the
        `:text{text="…"}` whitespace spelling; the four directive marks and their nesting order,
        outermost first; and `:em[x]` as the error `spec/flavour.md` promises. Editor-normal's
        merging half lands here, `text-whitespace` being the first fixture that forces it, and 4's
        `toEditorNormal` is built on it.
        3g's shape leaves three: `readInlineDirectiveNode` takes the name, the attributes and the
        slot's parsed text rather than the span, since `inline-content.ts` already imports it and
        parsing the slot inside it is a cycle; the four directive marks get `parse/directive-marks.ts`
        that `inline-content.ts` tries ahead of the node reader, as `mark-spellings.ts` sits apart
        from `emit/inline-directive-spelling.ts`; and the five markdown-spelled mark names in inline
        directive position take `unsupported-node-shape` rather than a code of their own — §8
        already answers a well-formed directive the node tables refuse, and the message names the
        spelling to use (`*x*`), while `unknown-directive-name`'s "a later MINOR may give the name
        meaning" stays the wrong signal, as it was for `adf`. `corpus/errors/directive-content-slot` goes when the slot opens.
        The marks a spelling wraps answer the same question 3g settled for a block's form: only the
        nesting the emitter writes parses back.
        **Settled** (the maintainer, 2026-09-01): `:text` reads back what the emitter writes and
        nothing else — one run of spaces and tabs, or one run of newlines. A mixed run, and text
        CommonMark carries plainly, are named errors, as 3g refuses the directive form of a node
        CommonMark spells. The reader takes the slot's parsed nodes rather than its text, so the
        rule refusing anything but one unmarked text node sits beside the node tables that own the
        slot. Only `text`, read ahead of the slot, names a refusal before the slot's own: a
        doubly-broken span reports what its content holds, `:date[<div>]{timestamp=1}` being
        `unmappable-html` rather than `date takes no content`, which the maintainer pinned with an
        assertion rather than reordering the readers. `directive-content-slot` stays with the
        fixtures, its cause now a marked slot rather than a slot at all. The slot's own whitespace
        answers the rule the spelling does: `:text{text="\n"}` and `&#10;` alike reach a slot the
        emitter refuses a line ending in, so one function answers both directions.
        **Settled** (the maintainer, 2026-09-01): a name the other position spells names that
        spelling rather than reading as unknown — `:::em` and `::date` take
        `unsupported-node-shape` naming the inline form, `:paragraph[a]` the block one — leaving
        `unknown-directive-name` for a name no table holds, which is the meaning §8 gives it. The
        two readers lean on the tables being disjoint, so that is a test beside the spec drift
        guard now.
        The same read found the hole the other way: `attemptLine` refused a line edged with a
        vertical tab or a form feed, where CommonMark strips spaces and tabs alone, so valid
        CommonMark parsed to a document `adfToMarkdown` then refused. The edges that check covered
        are carried before the line is assembled, so narrowing it to spaces and tabs left it no
        cause and it goes with them.
  - [x] **3j — The carry and the combinations.** `opaque-carry/` and `combinations/` read back:
        the `adf` fence and `:adf{json="…"}` restoring a deep-equal node, invalid JSON in either a
        named error, a carry inside a mark spelling another, and the three carve-outs' escapes
        reading as the literal text they hold. 3g refuses the `adf` fence rather than reading a
        `codeBlock` from it; the refusal goes when the carry reads it. 3i left the slot parse
        contextless, so the refusal a carry inside a mark spelling earns needs a channel — a reader
        context in place of `parseInline`'s `strip` flag, or a return arm from the slot — and
        `directiveNodes` takes its fourth reader beside it.
        `index.ts` gains `markdownToAdf` here, and the README's status line with it: this is the
        last parser chunk, so `parsingDirectories` becomes `emittingDirectories` and the whole
        corpus round-trips both ways — `0.1.0`'s proof, which 4 widens rather than replaces.
  - [x] **3k — The CommonMark spec suite (`0.2.0`).** Checked in at `corpus/commonmark-spec/`,
        pinned to the version it ships — the one `commonmark-grammar.ts` names for its start
        conditions — `corpus/README.md` gaining the kind.
        **Settled** (the maintainer, 2026-08-27): three checks an example must pass, the reference
        HTML each ships read as corpus data — which adds no format and no direction (§1). §2's
        canonical fixpoint: a named error, or markdown that parses and emits to itself byte for
        byte. That HTML's text, tags stripped and entities decoded, against the parsed document's
        concatenated `text`. And a count of the dozen elements the CommonMark subset covers
        against the marks and nodes they map to — counting distinct mark types per text node, since
        3e collapses a spelling nested inside its own kind and `*(*a*)*` is two `<em>` against one
        `em`. The fixpoint alone is self-consistency a parser
        returning the empty document passes, and the text alone one dropping every emphasis; the
        counts close both. The exception list stays the maintainer's, and one entry is owed
        already: 3h continues a list across the marker change CommonMark splits on, so an example
        the reference HTML gives two `<ul>` counts one `bulletList`. One outcome is no
        exception and must not be filed as one: a fixable §2 hole — valid CommonMark parsing to a
        document `adfToMarkdown` refuses — which is what `corpus/unspellable/` held until 3c, 3e
        and 3h landed their answers and emptied it. The permanent ones — a link destination or
        title no escape spells, a paragraph opening with a code span — are the exceptions, named
        by AGENTS.md §2.
- [x] **4 — Round-trip property tests (`0.2.0`)**, widening 3j's corpus round-trip past the
      documents a human wrote — the thing that proves 2 and 3 beyond them.
      **Settled** (the maintainer, 2026-09-13): `fast-check` generates and shrinks. The gate runs a
      fixed seed, the properties together adding about five seconds per engine; an environment
      variable raises the runs and randomizes the seed for local digging, and a counterexample
      found becomes a round-trip fixture. The generators draw from the node tables — each node's
      content model and attribute vocabulary as `adf/` records them, which 11 holds to Atlassian's
      schema — and misplace a share of nodes so the carry (§3) is exercised; no JSON Schema walker
      enters the tests. `toEditorNormal` stays internal. 2e5's collision test goes, since a
      collision already fails the round-trip on the same fixtures; the fixture-duplicate test
      stays.
  - [x] **4.1 — Editor-normal and the node accessors.** `toEditorNormal(doc)` in
        `src/adf/editor-normal.ts`, on 3i's merging: adjacent text nodes carrying identical marks and
        no attributes merged, an empty `attrs`, `marks` or `content` the absent key, `-0` read as `0`
        (§2); the round-trip tests compare the parser's output through it, and `serializeCanonicalJson`
        beneath it walks iteratively. `nodeContent`/`nodeAttrs`/`nodeMarks` replace the 46 inline
        `?? []`/`?? {}` reads in `src/` (23 `content`, 12 `marks`, 11 `attrs`) and the `attrs?.[key]`
        reads, and the branch floor rises to the integer floor of what the suite then measures.
        **Settled** (the maintainer, 2026-09-14): a text node carrying attributes never merges —
        `0.1.0` merged a carried one into its neighbour on read-back — and the fix lands here, as does
        the iterative serializer.
  - [x] **4.2 — The ADF property.** `fast-check` joins `devDependencies`, AGENTS.md §5 naming what
        it earns — shrinking a failing document to the nodes that break it — and §10 the properties
        beside the corpus. A generated editor-normal document either refuses in `adfToMarkdown`
        with a `ConvertError` or reads back through `markdownToAdf` to an equal document, and
        nothing throws, under Node, Deno and Bun alike. 2e5's collision test is deleted.
        **Settled** (the maintainer, 2026-09-14): about half the block positions draw attribute-less
        CommonMark shapes — single-type lists, headings, blockquotes, pipe-table-shaped tables — where
        the escaping lives. A round-trip break the property finds is fixed inside 4.2, one commit per
        break with its round-trip fixture seen red first, and 4.2 lands when a deep run of about
        10,000 per engine passes clean; a break needing design goes to the maintainer. The first two,
        both shipped in `0.1.0`: an empty `href` with a title spelled `[a]( "")`, which reads back as
        the href `""`, and a `[` or `]` in a link's destination or title inside a directive mark,
        refused as the emitter's own output or, with `]`, losing the link. Later, settled the same
        day: an autolink whose href holds a backtick takes the `[text](url)` form inside a
        directive's content; and a V8 fault the deep runs hit — once `JSON.parse` has read a key
        holding an escaped backslash, a later escaped quote or newline key comes back as that
        backslash, on Node and Deno but not Bun — is accepted rather than worked around, since the
        library only refuses such a document, so the generators' JSON keys avoid those characters; the
        fault is reported upstream (https://issues.chromium.org/issues/521080746, nodejs/node#63785),
        where the maintainer added to both on 2026-09-14. The review found one more break of the
        same class, fixed the same way: a would-be inline directive in a link target inside a
        directive's content.
  - [x] **4.3 — The markdown property.** Generated markdown through `markdownToAdf` never throws,
        and the runs fit the budget; where it parses and `adfToMarkdown` spells the result, that
        spelling parses and emits to itself byte for byte (§2).
        **Settled** (the maintainer, 2026-09-15): the generators and run parameters 4.2 and 4.3
        share live in one test-only module in `src/`, kept out of the build and coverage, with
        10c's properties as its third user. Under the gate seed the property asserts floors on the
        runs reaching the fixpoint and on the directive-shaped ones. It lands when hunts of several
        hundred thousand runs per engine pass clean, since the breaks hit once per ~150,000 runs,
        past a 10,000-run bar. Two breaks, both shipped in `0.1.0`, are fixed inside it. A backtick
        string an escape formed closed an earlier bare run's code span, since CommonMark reads no
        escape inside one: an escaped backtick alone or, as the review found, one joined to the bare
        run after it. A backtick run now escapes whole, and a bare run escapes wherever a later
        string of its length forms around an escape in the same inline content: the generalized pass
        the maintainer chose (2026-09-15). A paragraph's opening read as a link
        reference definition across a `]` the emitter spelled: the emitter now escapes the opening
        `[` exactly when the parser's own definition reader accepts the paragraph, and a link
        opening it rides the carry until 13b.
  - [x] **4.4 — The real payloads.** `corpus/real-payloads/` holds ADF Atlassian's editor wrote,
        each round-tripped ADF→markdown→ADF with no expected markdown.
        **Settled** (the maintainer, 2026-09-15): the chunk authors the payloads itself on the
        maintainer's Atlassian test site — invented content, so nothing needs sanitizing — driving the
        editor with Playwright, and reads the ADF back over REST. Only the documents are committed; no
        client or fetch script enters the repo (§7). Later, settled the same day: the mentions keep
        the test user's real account id (the maintainer, 2026-09-15).
- [x] **4b — The block walk's retry (`0.2.0`).** `emitBlock` walks a subtree twice wherever
      `readableBlock` reads it whole and then gives up — a list item whose first line reads back
      as a thematic break — and the walk below does the same, so the cost doubles per level:
      3.4kB of nested lists takes half a second, depth 20 about eight, depth 24 minutes. It
      predates 3g on both directions, and 3g's `commonMarkSpelling` gave it a second entry point.
      The README's bot and pipeline personas feed markdown nobody typed, so this ships as a hang
      on a small input; §11's scanning rule is the same argument one shape further in. The retry
      is what to remove — one walk answering both the readable question and the directive
      fallback. Memoizing `emitBlock` is the shortcut, and the node reference is the wrong key: a
      caller may hold one node object at two positions, where the cached depth and path are
      another node's. `0.1.0` ships with the retry in it, so a deep document is slow rather than
      wrong until the patch. `adfDocumentFault` is the second site to look at: `isNodeArray` reads
      every node and attribute value, then `nestingFault` reads them again, so the emit entry the
      export persona runs in bulk walks the document twice. Both walks are linear, so this is a
      constant factor rather than 4b's class change, and the parting is what gives depth its own
      code (§8) — measure before joining them back.
      **Settled** (the maintainer, 2026-09-18): the limit stays 500 readable lists, the walk
      reporting its headroom (§11). Counting every list twice was rejected for halving the limit,
      counting the directive form once for doubling the parser's frames per level.
      **Measured** (2026-09-18): `adfDocumentFault` walks a 9 MB document in 52 ms against 314 ms
      for the emit, so its two walks stay parted.
- [x] **4c — The scanning rule's remaining sites (`0.2.0`).** A trailing-anchored regex re-walks
      its run from every start position, so an interior whitespace run costs quadratic time rather
      than linear — 3h measured 80k spaces inside an ATX heading at 11.3s, and 3ms once the walk
      replaced the regex. The sites the same sweep did not reach: `normalizeLabel` in
      `link-syntax.ts`, whose shortcut-reference input is `scan.source.slice(...)` rather than the
      999-capped `readLabel` value, and `carryEdges` in `emit/inline-line.ts`. A third of another
      shape joins them: `readNestedDirective` restarts its depth counter per level, so each parse
      level re-scans the region below it and nested inline directives cost O(depth × content),
      bounded by the 500-level guard. A fourth predates 12c: the list-item walk re-scans the rest
      of a line once per item level — `isThematicBreak` in `containerStart` on an opener line,
      `isBlankLine` and `leadingColumns` in `continuesContainer` on a continuation line, and a
      blank line continues every open item without consuming input; 30000 nested items take 4.4s
      at 59 KB (the stability-reviewer, 2026-09-16). §11's scanning rule is the whole argument; the
      pipeline persona feeds documents nobody typed. A fifth is a throw rather than a cost:
      `adfDocumentFault` pushes a node's content with a spread, so past about 125k sibling nodes
      the guard throws a `RangeError` where §11 owes a `Result` (the stability-reviewer and the
      maintainer, 2026-09-18).
      **Settled** (the maintainer, 2026-09-18): the five sites land in one PR rather than split
      into sub-items, and a behaviour-preserving cost fix is accepted on the suite staying green
      with no fixture output changed, plus the measurement below — §14 promises no figure, so
      nothing times the gate. The guard's spread is the one behavioural fix and carries a test.
      **Corrected** (2026-09-18): the entry filed two sites in `emit/inline-line.ts` on 2026-09-01
      and the file has changed since — `tryImageLine`'s alternation measures linear (3.4 / 1.9 /
      5.3 ms over 10k / 20k / 40k spaces), leaving `carryEdges`' trailing trim the only one.
      **Measured** (2026-09-18), each at the size its filing named: `normalizeLabel` 1026 ms → 5 ms
      at 40k interior spaces, `carryEdges` 1024 ms → 7 ms (its heading path 978 ms → 5 ms),
      `readNestedDirective` 434 ms → 10 ms at 397 kB and 200 levels, the list-item walk 4196 ms →
      39 ms at 30000 items, and the document guard a `RangeError` → 42 ms at 200k siblings under
      one node. The list-item walk's mixed-marker shape, which the fix had to answer too, reads
      38 ms where the tail scan alone would have left it quadratic.
      The sixth site the sweep found went to 18 rather than landing here (the maintainer,
      2026-09-18).
      **Left as is** (the stability-reviewer, 2026-09-18): of the list-item walk's three re-scans
      only `containerStart`'s is fixed. `continuesContainer`'s pair costs the same either way — 400
      levels at 627 kB read 469 ms before and 448 ms after, linear in the line count and only
      mildly superlinear in a depth the 500-level guard bounds — so it is measured and left rather
      than made an item.
      **Widened** (the systems-architect, 2026-09-18): the guard's spread was a class rather than a
      site, and two more threw out of the public API — `readIndentedCodeLine` releasing the blank
      lines an indented code block held (200k of them at 200 kB), and `emitRun` joining a mark
      run's segments (200k nodes under one mark). Both fixed here with the same loop and a test
      each, and §11 gained the rule so the spelling cannot walk back in.
- [x] **4d — What the gate says while it runs (`0.2.0`).** `ci.sh` runs nine legs and announces
      none of them, so five minutes of a Gitea run read as silence and a hang cannot be told from
      a slow pull — the maintainer hit exactly this on the `0.1.0` release. Three causes, each its
      own fix. The legs need markers: `plainpages`' `ci.sh` prints a `step()` header per leg and
      this one prints nothing, so name the leg and the image before each. The longest leg is the
      quietest: `test_output=$(… npm test 2>&1)` buffers the whole Node run to replay it after,
      because the zero-test guard greps the count — stream it and grep a copy (`tee`), rather than
      trading the output for the guard. And two legs are silenced outright, `npm pack` and the
      tarball install, whose `>/dev/null` predates the offline install that made them quick and
      quiet. `publish.sh` owes the same: today it says nothing between reading `private` and the
      registry answering, which is where its `npm ci` and rebuild sit — the seconds §9 accepts
      rather than promoting the gate's `dist`, and unmeasured until the log shows them. Per-leg
      timing is what turns "slow or hung" from a guess into a reading; the browser leg's own
      5.4–7.9s against a 17s warm gate is the number that made it obviously cheap.
      **Measured** (2026-09-20): ten legs, not the nine counted above, each naming the image it runs
      in where it runs in one, on a 28.4 s warm gate — install 1.5 s, typecheck 1.2 s, Node tests
      4.9 s, Deno 6.0 s, Bun 4.5 s, build 1.0 s, pack and install 1.6 s, consumer typecheck 1.0 s,
      engines floor 0.4 s, browser 5.6 s. The browser leg lands in the 5.4–7.9 s the item quotes,
      and the markers cost nothing measurable: 28.9 s before against 28.4 s after. `publish.sh`
      reads its fields in 2.6 s and the registry in 1.4 s; its `npm ci` and rebuild are the gate's
      own 1.5 s and 1.0 s, so the seconds §9 accepts for rebuilding rather than promoting the gate's
      `dist` are about 2.5.
      Four things the writing turned up, three of them bash scoping a rule differently than it
      reads. The markers print to stderr, so a leg whose value is read — `publish.sh` asking npmjs —
      stays capturable. `leg`'s locals carry its own name because bash scopes them into whatever the
      leg runs: unprefixed, `name` was swallowed by the leg reading `package.json`. `leg` returns
      its command's status the way `with_firefox` already did, because the bare call dropped a
      non-zero one wherever `set -e` is suspended, which also gets the elapsed time printed for the
      leg that failed. And the `||` that captures that status suspends `set -e` for everything the
      leg calls, so a function a leg runs chains its statements with `&&` or every statement but the
      last runs unchecked: `read_package_fields` read on past a failed read, and `push_tag` pushed a
      tag the tag step had refused to write, both of which aborted before this chunk (the
      stability-reviewer, 2026-09-20). §10 carries the rule so the next leg cannot reintroduce it,
      and `EPOCHREALTIME` is guarded at `source` so an older bash names itself rather than dying as
      an unbound variable on the first leg.

- [x] **5a — Rename to `@larvit/adf-codec` (`0.1.0`).** Before the first publish, the name being
      the published identity: `package.json` `name` and `repository`, the Gitea repo and its
      remote, the README title, §6's published-as line, the checkout directory.
      **Settled** (the maintainer, 2026-09-01): ADF's own `A` is "Atlassian", and "converter" is
      the one-way lossy tool §2 exists to replace, where a codec is both directions. It names the
      hub, not the formats around it.
- [x] **5b — The consumer's error surface (`0.1.0`).** A product-owner read of the public surface
      found the error result legible to the library and opaque to the consumer holding it, and the
      README documenting no part of it. The sub-items are that read's answers, and they land before
      5 because §8 freezes the code list at `0.1.0` and 5b4's table is what reads the list before
      the freeze closes it.
  - [x] **5b1 — The error's source position.** A parse error names an ADF path into a document the
        caller does not hold yet — `unmappable-html` at `["content", 5]` for a `<span>` on line
        12 — and no coordinate into the markdown string it passed in. `ConvertError` gains an
        optional `position` the parser carries to every parse-side mint, and the README's published
        shape gains it.
        **Settled** (the maintainer, 2026-09-03): the position is the parse side's alone — an
        emitter has no source string to point into, so emit-side errors keep `path` unchanged. The
        representation and where the position is captured are implementation judgment.
        The block walk mints it and the node walk attaches it as results return — at `blockNodes`,
        and at the inline body a directive holds — so the innermost block wins and the emitter's
        own refusals, which the parser re-enters for the CommonMark spelling, get an input
        coordinate too. `markdownToAdf` wraps the walk once more, which is what turns the wide
        `Result<T>` into the `Result<T, ParseError>` its signature promises rather than guarding
        anything: the depth guard under it cannot fire at depth 0. A paragraph names the line its
        kept text starts on, never a link reference definition it gave up. Line endings stay as
        the input spells them, so an offset indexes the string the caller passed rather than a
        normalized copy of it. §8 records the framings the review settled beside it:
        `unsupported-node-shape` stays one code across the two directions, `unmappable-html` names
        the version rather than the element, and a direction that reads a source returns the
        narrowed error type.
  - [x] **5b2 — The error messages.** Most state the rule and leave the violation to be inferred —
        `a text node holds text` for a node holding none — so `rule: violation` becomes house style
        across the sites that do. `not-an-adf-document` gives one sentence of eight words to `null`,
        a string, a missing `version`, a `type` that is not `doc` and a REST envelope around the
        document; naming the check that failed makes the highest-frequency integrator mistake
        self-diagnosing without the library naming a REST shape (§7). The three carve-out claim
        messages name the escape that unclaims the line — `\|`, `\~~`, `\:::` — which today only
        `spec/flavour.md` holds. `unmappable-html` reads as §8 now frames it: this version converts
        no raw HTML, never a permanent judgment on the element.
        Thirty-odd sites gained the violation clause and §8 gained the house style. `isAdfDocument`
        parts into `adfDocumentFault`, the guard reading it, so the first failing check is the
        message — the wrapper mistake names the key it found. Two carve-outs claim a line, not
        three: a matched `~~` pair spells `strike` silently, so nothing refuses it and no message
        names `\~~`. The escape lands on the refusals a prose line hits, in the form that was
        claimed — `\:::` on the directive line's, `\|` on the pipe table's, `\:` on the inline
        directive's, the attribute-pair and unknown-name faults taking whichever form read them.
        `a pipe table row holds 1 cells` gained its plural.
  - [x] **5b3 — The code list and the flavour's gaps.** A second read of the surface, this one on
        the fifteen names §8 freezes at `0.1.0`: two pairs of them are one cause each, and one
        names a state the flavour leaves no way out of. `unspellable-character` and the text half
        of `unspellable-whitespace` are one refusal — a character CommonMark rewrites, the message
        naming it — and merge, `unspellable-whitespace` keeping the code for its other cause, the
        content slot no inline directive spans. `unspellable-link-destination` and
        `unspellable-link-title` become `unspellable-link`, the message naming the attribute.
        `unspellable-adjacent-lists` goes entirely: two adjacent `bulletList` nodes are valid ADF a
        site writes, and refusing them leaves the viewer persona a document it cannot render at
        all, so the flavour gains the separator that spells the pair apart, both directions,
        `spec/flavour.md` and fixtures. Thirteen codes stand — `unspellable-whitespace` keeps its own.
        The bare pipe table — `a | b` over `--- | ---`, GFM's shape without the leading pipes — is
        the one input that loses structure silently, reading back as a paragraph of prose; it
        becomes a `malformed-pipe-table` naming the form a row takes. That code keeps its name for
        the alignment colon: the flavour's own delimiter row is `-` runs, so the grammar is what
        refuses, and §8 records it rather than answering it again each review. The ninth
        `adfDocumentFault` branch names no node and carries the document's own path, the one branch
        the other eight outshine; §8 records why the guard stays a boolean.
        `::listBreak` is the separator's spelling: the grammar's leaf form, and a second reserved
        name beside `adf` — every other name is an ADF node or mark type, and this one builds none.
        It reads only between two adjacent lists of one type, and takes the separation any
        directive block takes where it sits, so a directive container holds it with no blank line.
        A hard break is the one spelling that can put a bare delimiter row under a row of its own,
        so the emitter escapes that line's first character rather than refusing the document.
        `spec/flavour.md` had two directive blocks inside a container taking no blank line; the
        rule both directions keep is that a pair holding one takes none.
  - [x] **5b4 — The README's consumer surface.** §8 invites an exhaustive switch on `code` and no
        code name appears in the README, so it gains a table — code, when it fires, what the
        consumer does — grouped by direction, over the thirteen names 5b3 settled. Four things a
        reader who has not opened the code cannot know: raw
        HTML is core CommonMark and every construct in input is an error until `0.3.0`, which the
        guarantees' "three carve-outs and one gap" denies and which is the bot and LLM personas'
        most common failure; `adfToHtml`, `htmlToAdf`, `markdownToHtml` and `htmlToMarkdown` sit
        unmarked in the code block people copy from, as do the two HTML guarantee bullets, and take
        a `0.3.0` mark or leave the block; `adfToMarkdown` is partial on valid ADF — a text node
        holding a carriage return, a link destination no canonical escape spells — which the viewer
        persona needs told along with
        what to do about it; and GFM past tables and strikethrough is literal text, task lists
        taking `:::taskList`. One sentence for the LLM persona: `code` is stable across minors,
        `message` is free text. The type-level surface freezes at the same moment and gets the same
        read: what `index.ts` exports and what it withholds, `ParseError` against `ConvertError`
        where a direction reads a source, and `ConvertFault` staying internal — the README table
        names the shapes a consumer switches on, so the two audits are one.
        The direction grouping is read off the call sites rather than the code prefixes, which do
        not partition by direction: the parser asks the emitter which CommonMark spelling a node
        takes (§11), so six codes reach a `markdownToAdf` caller as well as an `adfToMarkdown` one.
        The trailing pipe of a pipe-table row is optional in input, not required; the leading one
        is what every row must carry.
- [x] **5c — The build and the release pipeline.** Split out of 5, which kept only the
      maintainer's own acts. The build: `tsconfig.build.json` gains emit of JS and `.d.ts` to
      `dist/` (its own `allowImportingTsExtensions` forces `noEmit`, so
      `rewriteRelativeImportExtensions` lands beside it), plus `exports`/`files` in
      `package.json`. Publish-on-version-change (§9) as `publish.sh`, run by a `main`-only job
      needing the gate. The `ConvertErrorCode` freeze (§8) is checkable here: 3h landed the last
      decision `corpus/unspellable/` held and the directory went with it, so what the code list
      holds from here is permanent. The parser's own code additions are read here as one list
      before that freeze — nine sessions mint them independently, and one cause wearing two codes
      is breaking to undo after `0.1.0`. That read gets a test rather than an eye — every
      `ConvertErrorCode` member named at a production call site, the way `spec.test.ts` guards the
      node tables — since `unspelled-block-separation` outlived its cause until 3h went looking.
      All thirteen have a call site; the audit's find was the depth one 5 predicted, read wrong in
      its own text: an attribute value past 500 levels was `unsupported-node-shape` on parse and
      `not-an-adf-document` on emit, the document guard counting the `attrs` object as a level the
      parser does not, so a value at exactly 500 parsed into a document the emitter then refused.
      Depth left the shape predicates on both sides: `isJsonValue` structural and `overNested`
      beside it, `adfDocumentFault` returning the code with the message and `attributeValue` the
      reason it refused, so both directions answer with `unsupported-nesting-depth` naming the
      attribute, and `isAdfDocument` calls a deep document a document as it always did a deep
      block.
      `engines.node` gets its one-line proof too — the built entrypoint imported and round-tripped
      under a pinned Node 18 image, which cannot run the suite that type stripping wants 22+ for,
      but proves exactly what the field claims. Beside it, the emitted `.d.ts` typechecked from a
      consumer's position: declaration emit leaves the `.ts` specifiers `rewriteRelativeImportExtensions`
      rewrites in the JavaScript, and nothing else in the repo reads them the way an installed
      consumer would. 3k's exception list landing after the release left the README's
      canonical-fixpoint sentence claiming more than `0.1.0` keeps — 3e names three shapes that
      parse and then refuse — so it now says a parse succeeding is no promise of a way back, and
      names them.
- [x] **5d — The browser leg.** §6's browser half is checkable on the emitted `dist/index.js` a
      browser can load — the compile gate names no host API, and a real page converting the corpus
      is the other half. Headless Firefox is that page, settling both at once: the browser proof,
      and the only SpiderMonkey there is, the gate's three engine legs being two V8s and a
      JavaScriptCore that is not Safari's. The mechanism is the decision this item opens with: a
      browser leg wants an image, a driver and a way to carry a verdict back out, none of which
      the gate's plain `docker run` per engine has. The answer is `with_firefox`, which runs the
      Firefox image beside the node one in a shared network namespace, so the page's server and
      the driver are each other's `127.0.0.1` and no user-defined network, container name or
      geckodriver `--allow-hosts` entry is wanted; its `EXIT INT TERM` trap bakes in the container
      id, since the `local` holding it is gone by the time the trap fires. `browser-tests/run.js`
      serves the repo, drives one `execute/sync` and asserts the results against the corpus with the
      Node-side `assert.deepEqual` the corpus runner uses, so the browser page holds no second copy
      of the comparison. The whole corpus fits: 118 fixtures in 8s warm against a 120s script
      timeout — no slice was worth choosing. A `try` around the dynamic import is what turns a
      broken build into SpiderMonkey's own message rather than an undefined global.
      **Settled** (the maintainer, 2026-09-04): `selenium/standalone-firefox` over the smaller
      `instrumentisto/geckodriver`, currency over size — the leg's whole worth is a real
      SpiderMonkey, which decays the moment the pin stops moving, and the smaller image was four
      Firefox majors behind with a publisher that may go quiet while Renovate stays silent.
- [x] **11 — Atlassian's ADF schema as the tables' truth (`0.2.0`).** `@atlaskit/adf-schema`'s two
      JSON Schemas vendored rather than the package installed (AGENTS.md §5), and the node tables
      gated against them (§10). **Settled** (the maintainer, 2026-09-13): vendored at
      `spec/adf-schema/` and re-pinned by hand when a need shows; the gate compares attribute names
      and kinds, never value sets, over `full.json` and `stage-0.json` together.
  - [x] **11a — The vendored schema.** `full.json` and `stage-0.json`, byte-exact from
        `@atlaskit/adf-schema@57.4.9`'s `dist/json-schema/v1/`, at `spec/adf-schema/`, each pinned
        by its SHA-256 in a test the way `spec.json` is. The version, the source and the Apache-2.0
        attribution sit beside them with the licence text; no gate re-serializes either file.
  - [x] **11b — The gate.** For each node and mark type the tables spell, the attribute names and
        kinds equal the union over every definition in both files whose `type` enum names it,
        `anyOf`/`allOf` branches included, the argument slot (`panelType`, `state`) counting as
        spelled. Kinds: `string`; `number`, `integer` included; `boolean`; `json` for an object, an
        array or an untyped value; an `enum`-only attribute takes its values' kind. What the schema
        holds past the tables is pinned in two exact lists — an entry the schema no longer needs is
        red, like a difference neither list names: gaps, attributes of a spelled type (57.4.9:
        `link` `collection` `id` `occurrenceKey`, `rule` `color` `style` `weight`, `layoutSection`
        `columnRuleStyle`), emptied by 13; and carried, types the tables do not spell (`alignment`
        `annotation` `backgroundColor` `blockCard` `bodiedRule` `breakout` `dataConsumer`
        `embedCard` `fontSize` `fragment` `indentation` `inlineExtension` `placeholder`), `doc` and
        `text` counting as the grammar's own.
- [x] **12 — The `!adf:` re-spelling (`0.2.0`).** Replace the colon directive grammar with the
      namespaced prefix, a breaking change to the emitted contract (shipped `0.1.0`, so §8 makes it
      `0.2.0`). Forms: block container `!adf:name arg {attrs}` … `!adf:/name` — the `/` parts open
      from close, nestable without a fence-length discipline, so the `::::`/`:::::` runs and their
      length rule go and every container opens the constant `!adf:`; block leaf `!adf:name arg
      {attrs}` with no closer; inline node `!adf:name[content]{attrs}`; directive marks
      `!adf:border`/`subsup`/`textColor`/`underline` `[content]{attrs}`. Attributes and their
      escaping stay `{key=value}`; the literal escape is `\!adf:`. Leaf vs container is decided by
      the node's content model rather than syntax — the `::`/`:::` split goes, a simplification the
      carry makes safe (an unknown *block* node already rides the fence, not the directive). The
      carry's reserved name becomes `carry`, both spellings — the block fence info string `carry`
      and the inline `!adf:carry{json="…"}` — named for what it does: it carries a node verbatim,
      never "unknown-node", since a known node no section spells where it stands rides it too. No
      `ConvertErrorCode` is added, removed or renamed, and the round-trip guarantee and the carry
      both hold through it. Mechanical surface: the grammar in `spec/flavour.md`,
      `src/adf/block-directives.ts` + `inline-directives.ts`, `src/markdown/`'s
      `directive-syntax.ts`, `opaque-carry.ts` and the `emit/` + `parse/` readers, every corpus
      fixture (round-trip, normalization and `errors/`), the prose reader over `spec/flavour.md`,
      the markdown property's generator, and the README's examples.
      **Settled** (the maintainer, 2026-09-13):
      - A line opening `!adf:name` is a block line when a space or the line's end follows the name,
        and a paragraph when `[` or `{` does. Claiming stays syntactic and structure comes from the
        tables: an unknown name is `unknown-directive-name` at the opener, whatever follows it.
      - An unescaped `!adf:` claims on its own anywhere inline: one completing no directive is
        `malformed-directive`, the emitter escapes every literal `!adf:`, and `!adf:hardBreak{}`
        keeps its braces. Block and inline share the one `\!adf:` escape hint.
      - A closer names the innermost open container, crosses no list-item or blockquote edge,
        indents as a fence does and carries nothing after the name; anything else is
        `malformed-directive`.
      - A node holding no content whose content model takes some is an empty opener–closer pair,
        never a leaf.
      - A spelled node's content model is frozen with its spelling: changing it is MAJOR (§8).
      - The colon spellings are dropped, not refused: `0.1.0` markdown reads back as prose, `adf`
        is no longer a reserved language, and `MIGRATION.md` tells a consumer to convert stored
        markdown through `0.1.0`'s parser and `0.2.0`'s emitter.
      - Inputs moving between codes ride the break: a leaf given a body, a container missing its
        closer and `listBreak` with a body are `malformed-directive`, and an empty inline-body
        container parses.
      - Split by construct, each sub-item both directions: 55 of 78 round-trip fixtures feed both
        the emit and the read-back test, so an emit-only chunk cannot land green.
      - The spec leads the code from 12a to 12d: `spec/flavour.md` and `AGENTS.md` §4 spell the
        `!adf:` grammar whole, while code and fixtures reach it one form at a time. A reader landing
        in either without `todo.md` sees a gap that is the plan, not a defect.
  - [x] **12a — The spec and the decision.** `spec/flavour.md` rewritten to the `!adf:` grammar and
        the settled answers above, no colon directive form left in it; AGENTS.md §4's directive
        bullet and prior-art line, and §8's escape hints and `::adf`/`::listBreak` examples, name
        the new forms, §8 gaining the frozen content model.
  - [x] **12b — The inline form.** Inline nodes, directive marks, `text` and the inline carry
        `!adf:carry{json=…}` spelled and read as `!adf:name[content]{attrs}`, with the prefix claim
        and its escape; the round-trip, normalization and `errors/` fixtures holding inline forms
        re-spelled, and the gate green. The content slot of `emoji`, `mention` and `status` refuses a
        text node carrying attributes as `unsupported-node-shape`, which it drops silently today (the
        maintainer, 2026-09-14).
  - [x] **12c — The block form.** Openers and `!adf:/name` closers, leaf vs container by content
        model, empty pairs, `listBreak` and the `carry` fence, spelled and read; the fence-length
        rule and the corpus test's fence nesting check deleted; the remaining fixtures re-spelled
        and `errors/` re-derived under the shifted codes, and the gate green.
        12b's two temporary seams expire here: `carryFence` folds back into `carryName` once the
        fence reads `carry`, and `directiveLineEscape` into `inlineDirectiveEscape` once one escape
        serves both forms. `spellLeafDirective` takes the `Inline` its reader-side regex already
        carries, and `header` versus `opener` settles as one word in spec and code. While
        `readNestedDirective` is open, its `[content]` and `{attrs}` reads lift out as named steps,
        and the two `charAt`-against-`!` fast paths ahead of `claimsDirectivePrefix` — in
        `readDirectiveContent` and `line-escaping`'s `bracketed-link-target` arm — either earn a
        reason or go (the systems-architect, 2026-09-16).
  - [x] **12d — The README, `MIGRATION.md` and the sweep.** The README's examples and error tables
        follow, `MIGRATION.md` linked from one README line; docs and fixtures swept for any stale
        `::`/`:name` spelling.
- [x] **13 — The schema's gap attributes (`0.2.0`).** Spell the attributes 11b pins as gaps, in
      12's grammar, and empty the list.
      **Settled** (the maintainer, 2026-09-13): a link `[text](url "title")` cannot hold takes the
      directive mark `!adf:link[text]{attrs}` — one carrying `collection`, `id` or `occurrenceKey`,
      or an `href` or `title` no CommonMark escape writes — and a directive link CommonMark could
      spell is `unsupported-node-shape`. That leaves `unspellable-link` no cause, so it leaves
      `ConvertErrorCode` in `0.2.0`, §8 recording the removal.
  - [x] **13a — `rule` and `layoutSection`.** `rule`'s `color`, `style` and `weight` and
        `layoutSection`'s `columnRuleStyle` join their tables and `spec/flavour.md` bullets, with
        round-trip fixtures; their gap entries go.
  - [x] **13b — The directive link.** `link` spelled as above in both directions, with a round-trip
        fixture per trigger, `spec/flavour.md`'s Marks section following; `unspellable-link` removed
        from the code list, its `errors/` fixtures and the CommonMark suite's `unspellable`
        exceptions it cures re-derived, the README's code table and its "not every document
        converts back" guarantee following, and `MIGRATION.md` naming the removed code; the gap
        list is empty. A round-trip fixture holds the shape 4.2's review left refused until then:
        an autolink-shaped link under a directive mark whose href holds `\!adf:name{`. A link
        opening a paragraph whose opening reads as a link reference definition, which 4.3 leaves
        riding the carry, takes the directive link too, with its round-trip fixture (the
        maintainer, 2026-09-15).

- [x] **14 — The CommonMark subset's directory (`0.2.0`).** `src/markdown/` holds 16 source
      files at its root and 10 adds more there. The CommonMark subset moves under
      `src/markdown/commonmark/` — `backtick-runs.ts`, `commonmark-grammar.ts` as `grammar.ts`,
      `emphasis-matching.ts`, `entity-references.ts` with its test, `link-reference-definitions.ts`
      and `link-syntax.ts` — leaving the flavour's own constructs at the root, the split
      `spec/flavour.md` draws between the subset and the flavour (the systems-architect and the
      maintainer, 2026-09-16).
- [x] **15 — The href-less directive link (`0.2.0`).** Refuse `!adf:link[text]` spelling no `href`
      with `unsupported-node-shape` naming the attribute, so the mark has one spelling: today it
      parses to a mark the emitter writes back as a carry, while the schema requires `href` and
      every other directive mark spells without attributes in both directions alike (the
      stability-reviewer, 2026-09-16; the maintainer, 2026-09-17).
- [x] **16 — The link wrapping a link (`0.2.0`).** Read `[<http://x/>](/v)` and
      `[!adf:link[a]{href="/u"}](/v)` as `[[a](/u)](/v)` reads — the inner link wins and the outer
      brackets stay literal text, CommonMark's rule that no link holds another — rather than
      dropping the outer link silently as `closeLink`'s `applyMark` does today, with a
      normalization fixture per shape (the stability-reviewer, 2026-09-16; the maintainer,
      2026-09-17).
- [x] **17 — A machine-enforced size ratchet (`0.2.0`).** Add a per-function line ceiling to the
      gate, set at today's worst and only ever moving down, so the largest body of new code cannot
      exceed what is already here (the systems-architect, 2026-09-16; narrowed by the comprehension
      panel, 2026-09-20). oxlint's `eslint/max-lines-per-function` measures it — one devDependency,
      carrying the musl binding the gate's image needs, since TypeScript 7 is the native compiler
      and exposes no parser to write the check against. No cyclomatic rule: `eslint/complexity`
      charges `?.` and `??` a point each, the guards §10 already exempts from the branch floor, and
      its two worst functions, `readBlockLine` and `parseInline`, went unnamed by all nine readers
      while `isNodeArray` and `blockNode` were volunteered as among the clearest code here. Length
      ranks no better: `emitList` and `blockNode` are both 26 lines, one the panel's unanimous top
      four and the other the clearest map of the format in the repo. So the ceiling guards against
      drift and never drives a refactor — 19 to 27 are where the hard work actually is.
      **Done** (2026-09-20): `.oxlintrc.json` carries the one rule, `correctness` off so nothing
      else runs, over the 40 files `tsconfig.build.json` builds — the tests and
      `property-harness.ts` out, five functions over the ceiling with them, the worst 64. The
      ceiling is 52, `parseInline`'s length and the built set's worst; at 51 the gate reddens on
      it. `skipBlankLines` and `skipComments` are spelled at oxlint 1.83.0's defaults, so a changed
      default cannot move what 52 counts. The leg runs `npm run size-ratchet` beside the typecheck
      at 0.8s, and the lockfile carries every platform binding, so `npm ci` resolves the musl one
      inside the image. §10 holds the rule and what each switch guards (the stability-reviewer,
      2026-09-20).
- [x] **18 — The subtree the directive spelling asks about (`0.2.0`).** The parser asks
      `commonMarkSpelling` at every directive-spelled block and the answer emits the whole subtree
      below, so a node at depth d is spelled d times: three nested rule-first directive lists cost
      18 asks over 10 nodes, and 250 levels parse in 1.2 s at 16.4 kB, 4.9 s at 261 kB with a
      kilobyte of content per level. The depth guard bounds the levels at about 250, never the
      content, so this is the pipeline persona's hang on an input nobody typed (§11). Keeping each
      child's emitted result for its parent's ask is not a straight handover: the same node object
      is asked at different depths — 4, 3 and 2 for the innermost list of three — because the
      parser counts a list and its item as two levels where the emitter's readable list counts one
      (4b), and `headroom` is that guard's slack. The parts that survive the measurement: the paths
      agree, `text` and `spelling` carry no depth, `headroom` is affine in it, and the parser asks
      first at the deepest of them, so a kept result rebases by the difference. Either rebase and
      record that argument in `AGENTS.md`, or give both directions one list accounting so a node
      has one depth and nothing needs rebasing — which reopens 4b. A single post-build walk was
      rejected: it reports the outer offender where the build reports the inner one (the
      maintainer, 2026-09-18).
      **Measured** (2026-09-19): the parse keeps each node's readable spelling (AGENTS.md §11), and
      250 nested directive lists fall from 1.22 s to 0.04 s at 16.1 kB and from 5.20 s to 0.12 s at
      261 kB; a panel between every pair of lists 1.00 s to 0.05 s, an opaque carry in every item
      1.08 s to 0.03 s. No figure enters the gate (§14), as 4c settled for a behaviour-preserving
      cost fix; what the gate holds is the refusal. An ordered list past the marker cap gives way,
      so the emitter spends two levels where the parser spent one: one such list between an ask and
      a kept entry cancels the credit the directive form starts with, and two put the read below the
      depth that filled it — which a hit would answer without the depth guards the walk runs. That
      read re-spells. Three cases hold the arithmetic between them: the two depth-boundary tests
      already there pin the sign, the two-overflow case pins the guard, and the one-overflow case
      pins the magnitude, a constant rebase accepting there a document the emitter then refuses
      (the stability-reviewer, 2026-09-19). The one list accounting was not
      taken: 4b settled that accounting the day this was filed, and reopening it is an ask rather
      than a chunk.
- [x] **19 — A home for what both formats read (`0.2.0`).** Settle where a construct both formats
      need lives, and say so in AGENTS.md §11. Today `adf/` may hold no format knowledge and each
      format directory holds its own shared layer, so there is no third place; the first ADF-shaped
      but format-touching helper either breaks the layering or becomes a second spelling of one
      rule, which is the loss §2 exists to stop. Both architects ranked this first and the only
      item cheaper before the feature than after.
      **Settled** (the maintainer, 2026-09-21): `adf/` is that place, and the test is the vocabulary
      the answer is in — a node type, an attribute kind, a content model, never a delimiter, an
      element name or an escape. A helper that cannot answer that way is the ADF question there and
      a spelling per format, the seam `markAttributes` and `markSpellings` already draw; one that
      cannot be split is a gap to ask. `markdown/` and `html/` are peers with no third directory
      between them, and `src/` root keeps the primitives knowing neither ADF nor a format. No code
      moved: a construct rises on its second consumer, so `linkHref` (`markdown/mark-spellings.ts`)
      and the external-image read (`markdown/emit/image.ts`), both pure ADF attribute reads, move
      when `html/` reads them (7).
- [x] **20 — The give-way channel is unmistakable (`0.2.0`).** `emitBlockquote`, `emitCodeBlock`,
      `emitHeading`, `emitList`, `emitParagraph` and `emitRule` return
      `Result<EmittedBlock> | undefined`, where `undefined` gives way to the directive form and an
      error refuses the document. Give the six the `try` prefix the repo already uses for
      `tryImage`, `tryPipeTable` and `tryPipeCell`, or a return type that cannot hold both, so a
      newcomer meeting an unspellable shape cannot reach for `failure` and silently narrow what
      converts. Named as the first thing a new senior would break, and it lands on §1.
      **Done** (2026-09-21): both answers, each where it fits. Five of the six reach a refusal the
      directive form shares — a walk, `codeBlockText`, `emitInlineLine` — so moving it out is the
      second walk 4b removed, and they take the prefix alone. `tryRule` refuses nothing, so it
      takes the narrower type as well, `string | undefined` through `readableText`, which is what
      `tryImage` and `tryPipeTable` already return. `emitLink` and `listItemLines` are the same
      channel outside the six — the CommonMark link and the tight list item, each tried ahead of a
      directive form — so they take the prefix too, and the comment naming `emitLink`'s `undefined`
      arm goes with the rename. §11's readable-spelling rule carries the prefix and gave up the set
      it enumerated: the prefix is the set now, which is what stops the next spelling being named
      by the eight beside it. The same rule's nested-list carve-out went with it, naming a refusal
      2b's tight-versus-blank answer had already removed — `unspellable-adjacent-lists` is gone from
      `result.ts` and `separationBetween` returns a `string`.
- [x] **28 — `emitLine`'s retry loop cannot spin (`0.2.0`).** `emit/inline-line.ts:67` is a
      `for (;;)` that re-emits the line until every unspellable node has been carried, and its
      termination rests on a comment: each pass carries at least one more node, or flips
      `openingLinkAsDirective`, which happens once. Ten `return success({ carry: … })` sites in
      that file have to honour it and nothing checks them — a range already inside `carried` loops
      forever. The library has no I/O and no timeout, so that is a hung caller rather than an
      error result, and §1's pipeline persona feeds documents nobody typed. Make the loop hold its
      own guarantee: refuse a carry that adds no node and return an error. Reads first in `0.2.0`
      because it is the only known way this library fails without a `Result`. Found by the
      comprehension panel, 2026-09-20; the ten sites are confirmed, a document that reaches the
      spin is not.
      **Done** (2026-09-20): the loop's progress is one named state and every pass takes a
      fallback through `takeFallback`, which refuses a carry adding no node and an opening link
      asked for the directive form a second time. Both are `unsupported-node-shape` under §8's
      rule that a new cause takes an existing code reading true of it: the emitter has no spelling
      left for that node arrangement, and a code a consumer can never switch on costs a removal
      later. Neither refusal is reachable — a carried node takes `emitLeaf`'s carried branch
      before any run forms, so every range a site names holds an uncarried node, and the
      directive-spelled opening link leaves the first segment with no node range for `escape` to
      ask about — so both are uncovered branches like the repo's other guards, 98.92% to 98.84%
      against the floor of 98.
- [x] **29 — The README reads raw HTML as refused for good (`0.2.0`).** §Goals 3 says "the three
      carve-outs and the one gap below are the whole of the exception" and §The guarantees says
      "Raw HTML in markdown input is an error result", both reading as settled, where
      `spec/flavour.md` §Raw HTML in input says the opposite: `markdownToAdf` routes each construct
      through the foreign HTML element mapping, and only a construct without one is refused. The
      spec stands — commonplace markdown is accepted, and every tool writes some HTML (the
      maintainer, 2026-09-20). So rewrite the two README texts to name the exception that survives
      6 and 7, a construct outside the documented element set, and state it in one place, since
      three already spell this one rule. `markdown-to-adf.ts:73` and `inline-content.ts:158` are
      the whole of the refusal and already say "at this version"; 7 is what makes them route.
      **Done** (2026-09-20): the rule has one home, the `unmappable-html` row, naming the element
      set and what its absence covers at this version; §Goals 3 bounds the exceptions without
      listing them, the standalone raw-HTML guarantee goes, and the `0.2.0` guarantee says
      markdown's raw HTML reads the same set. That guarantee's "never a silent drop" went with it:
      6 settled that `<script>` and `<style>` drop whole, so the claim does not survive 7.
- [x] **30 — AGENTS.md says each thing once (`0.2.0`).** §15's ask protocol — name the class, cite
      the earlier asks of it, never "A or B?" — is the rule reviewers cite most and has no heading,
      two thirds down a 50-line section in a file with no index. Give it one. §15 also offers "the
      gate's seconds" as a stated number that is kept, and no such number is stated anywhere, §14
      forbidding the category outright; drop the example. Then the restatements: §15 repeats the
      one-chunk rule three times and `version`/`NPM_TOKEN` twice, §12 says the default is delete
      twice, and §5's "few, each earning its keep; they never reach a consumer" is npm's own
      definition of the field. Cut to one copy each, the one carrying the why.
      **Done** (2026-09-20): §15 gains three sub-headings — Ask, don't guess; Rules the loop has
      settled; The continuous loop — so the protocol is one of four entries rather than a
      paragraph two thirds down. The one-chunk rule keeps the head paragraph, which now carries
      the chain-of-sessions why the settled bullet held; `version`/`NPM_TOKEN` keeps the reserved
      paragraph, which carries §9's publish-on-bump why, and moves up beside the chunk steps.
      §12's "every prose comment in a diff is a review question" and §5's devDependencies clause
      go whole. The gate's seconds is confirmed stated nowhere: `docker-runner.sh` measures each
      leg's elapsed time and no number bounds it.

- [x] **21 — The ADF tables carry ADF's nouns (`0.2.0`).** `adf/block-directives.ts` and
      `adf/inline-directives.ts` hold the ADF node tables — `paragraph`, `heading`, `blockquote`
      and `rule` among them — under the markdown flavour's word, inside the directory §11 forbids
      to know a format. Rename to the noun `spec/flavour.md` uses, types and accessors with them.
      Before 7 doubles the import sites.
      **Done** (2026-09-21): the tables are `adf/block-nodes.ts` and `adf/inline-nodes.ts`,
      `blockNodes` and `inlineNodes` — `spec/flavour.md`'s own headings — each row a
      `BlockNodeModel` or `InlineNodeModel` read by `blockNodeModel` and `inlineNodeModel`. The row
      is the node's model, never the node: `BlockNode` beside `AdfNode` put two kinds of thing one
      lookup apart in every signature the rename touched, where §8 already calls the content model
      the model. `markdown-to-adf.ts`'s own `blockNodes`/`blockNode` walk became
      `readBlocks`/`readBlock`, so the table's name means one thing repo-wide. `BlockType` stays:
      it names a node type, the parallel of `mark-attributes.ts`'s `MarkType`. `markdown/`'s
      `blockDirectiveForm`, `blockArgument` and the `spell*Directive*` family keep the word,
      naming the spelling rather than the node.

- [x] **22 — `LineContainer` sits at the markdown level (`0.2.0`).** Two of the four
      `parse/` → `emit/` imports fetch this type from `emit/line-escaping.ts`, camouflaging the two
      that are the deliberate spelling consultation. Move it, and name those two in §11 as the whole
      of that surface, so a reviewer checks the seam with one grep.
      **Done** (2026-09-21): the type is `markdown/line-container.ts`, read by both directions, so
      `parse/` imports `emit/` twice — `commonMarkSpelling` and `openingLinkTakesDirective` — and
      §11 says those two are the whole of the seam a `../emit/` grep under `parse/` reads.

- [x] **32 — The mark depth `adf/` counts is stated in ADF's terms (`0.2.0`).**
      `document.ts`'s `markAttributeNesting` is `largestNesting - 3`, and both the comment above it
      and AGENTS.md §8 give the reason as markdown's: the block directive spells the whole mark set
      as one JSON attribute, so the parser reads the value at the bottom of array, mark and
      `attrs`. That is a format's spelling deciding a constant inside the directory §11 forbids to
      know a format. Move the derivation to where that spelling lives, or state the three levels in
      ADF's own vocabulary. Before 7 gives the constant a second format whose spelling may not
      spend the same three levels.
      **Done** (2026-09-23): `adf/` counts a mark's attribute from its value at 500, as a node's;
      the block directive's `marks` spelling refuses its own over-deep JSON with the parser's
      message and the node's path, and §8 says a deeper spelling refuses in its own format.

- [x] **23 — The block-directive fragments are one file (`0.2.0`).** `block-directive-arguments.ts`,
      `-forms.ts` and `-marks.ts` are three files under 25 lines answering one question. Fold them,
      and take `src/markdown/` — the worst level both architects named, 13 entries with no
      organising question — down with them.
      **Done** (2026-09-23): `markdown/block-directive.ts` holds the form, the argument, the `marks`
      attribute and the `listBreak` spelling — what the block directive spells of a node that the
      grammar does not — and `src/markdown/` drops from 15 entries to 12.

- [x] **24 — The conformance gates have a directory (`0.2.0`).** Six root tests with no sibling
      source (`adf-property`, `adf-schema`, `commonmark-spec`, `corpus`, `flavour`,
      `markdown-property`) plus `property-harness.ts` are the machinery that makes the docs
      executable, and they read as leftovers. Give them one, so `src/` root shows what it holds.
      **Done** (2026-09-23): `src/conformance/` holds the six gate tests and the property harness,
      so `src/` root is the four primitives and the entrypoint.

## 5 — Ship `0.1.0`

- [ ] **5 — Ship `0.1.0`.** Only the maintainer's own acts are left (§15): make the Gitea repo
      public (§6), create the `NPM_TOKEN` secret, confirm the Actions token may push tags — the
      publish succeeds and the tag push then reddens the run, though the next push to `main`
      retries the tag alone — and open the bump PR that sets `version` to `0.1.0` and drops
      `private: true`, the guard against any earlier publish. The bump and the drop go in one
      commit: dropping `private` alone publishes `0.0.0`, which also differs from npm's nothing. `0.1.0` is the
      markdown round-trip: both markdown directions, the types, `isAdfDocument`, proved over the
      checked-in corpus.
      **Settled** (the maintainer, 2026-09-01): the round-trip proved over the checked-in corpus
      is what `0.1.0` ships on, and the open-ended proof work follows it rather than gating it —
      3k's spec suite and 4's generators and maintainer-supplied payloads are `0.2.0`, 4b's retry
      `0.1.1`. A consumer using the library is worth more than a wider proof nobody has needed
      yet, and §8's pre-1.0 rules cover what the wider proof then finds.

**Shipped** 2026-09-05: `@larvit/adf-codec@0.1.0` published and `v0.1.0` tagged on `8a847de`. Publishing needed a
bypass-2FA token — the account carrying no write-2FA requirement was not enough, npm demanded an
OTP until the token itself bypassed it.

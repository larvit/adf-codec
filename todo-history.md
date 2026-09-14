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
- [ ] **4 — Round-trip property tests (`0.2.0`).**
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

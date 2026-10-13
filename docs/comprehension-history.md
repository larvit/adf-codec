# Comprehension history

## 2026-10-09T00:41:03Z, PR #19 at 859c952, against 9519606

Ruling: better

| Seat | Vote |
|---|---|
| Mid A | better |
| Inherited architect | better |

Mid A, decided by:

- `src/markdown/portable/task-ids.ts:7` `mintTaskIds`: one walk, no carried set filled by the parser as a side effect
- `src/markdown/parse/markdown-to-adf.ts:26` `Reading`: plain data, `codeBlockNode` no longer mutates `carried`
- `src/markdown/portable/conventions.ts:8` `flavourClaims`: one table states what each reader claims; branches name the claim they test
- `src/markdown/parse/markdown-to-adf.ts:161` `quoteNode`: the title is read in the reader's own flavour, no hop through `inlineLeaves`
- `src/index.ts:5` exports: each call named by its flavour; "plain" no longer means two things

Inherited architect, decided by:

- `src/markdown/parse/markdown-to-adf.ts:26` `Reading`: the hidden `carried` set and the retrying `mintTaskIds` are gone
- `src/markdown/parse/markdown-to-adf.ts:161` `quoteNode`: parser and emitter no longer correct only together
- `src/markdown/parse/markdown-to-adf.ts:113` `readBlock`: branches name the claim (`claims.alerts`, `claims.taskMarkers`)
- `src/index.ts:5` exports: flavour names say which file to open
- `src/markdown/portable/conventions.ts:3` `flavourClaims`: cost, all three flavours' rows live under `portable/`

## 2026-10-09T00:56:04Z, PR #19 at 5fc877e, against 9519606

Ruling: better

| Seat | Vote |
|---|---|
| Mid A | better |
| Inherited architect | better |

Mid A, decided by:

- `src/markdown/portable/conventions.ts:8` `flavourClaims`: one table says what each flavour reads; every gate reads a named field
- `src/markdown/portable/task-ids.ts:7` `mintTaskIds`: one pass, no carried set crossing modules
- `src/index.ts:5` exports: each name says which markdown it means
- `src/markdown/parse/markdown-to-adf.ts:161` `quoteNode`: no reach into the portable writer's reduction
- `src/markdown/portable/conventions.ts:20` `ReadClaims`: cost, `directiveNode` leans on a type in another file

Inherited architect, decided by:

- `src/markdown/portable/task-ids.ts:6` `mintTaskIds`: the retry loop and the parser-filled set are gone
- `src/markdown/parse/markdown-to-adf.ts:26` `Reading`: no hidden state; branches name the feature they gate
- `src/markdown/portable/conventions.ts:8` `flavourClaims`: cost, the table for all three flavours lives under `portable/`
- `src/markdown/emit/line-escaping.ts:92` `escapeClaims`: directive escaping under the flag the parser checks
- `src/markdown/emit/adf-to-markdown.ts:146` `spellPortableBlock`: no hard-coded lossless title

## 2026-10-09T01:43:11Z, PR #21 at c45320b, against 9a242c7

Ruling: better

| Seat | Vote |
|---|---|
| Mid A | better |
| Inherited architect | better |

Mid A, decided by:

- `src/markdown/parse/markdown-to-adf.ts:23` `MarkerParagraph`: the block kind says a marker's paragraph holds no lone image, where `readMarked` scanned its output afterwards
- `src/markdown/emit/image.ts:7` `tryImage`: builds what the reader would build and compares, where `imageShape` restated the shape by hand
- `src/markdown/parse/inline-content.ts:25` `InlineContent`: one rule replaces five image refusal sites over two files
- `src/markdown/external-image.ts:4` `centeredImage`: one builder for the shape three literals held
- `src/markdown/parse/inline-content.ts:550` `pieceNodes`: costs more — its image arm relies on `assemble` having linked every top-level image

Inherited architect, decided by:

- `src/markdown/external-image.ts:4` `centeredImage`: the image's ADF shape is defined once for reader, emitter and portable reducer
- `src/markdown/parse/markdown-to-adf.ts:23` `MarkerParagraph`: replaces `readMarked`'s after-the-fact search and its caller-computed flag
- `src/result.ts:1` `ConvertErrorCode`: `unmappable-image` and its refusal paths are gone
- `src/markdown/parse/inline-content.ts:43` `Image`: costs more — four functions must agree on the image's `link`
- `src/markdown/parse/inline-content.ts:26` `InlineContent`: costs more — no longer image xor nodes

## 2026-10-09T08:38:28Z, PR #21 at 1098b5e, against 9a242c7

Ruling: better

| Seat | Vote |
|---|---|
| Mid A | better |
| Inherited architect | better |

Mid A, decided by:

- `src/markdown/external-image.ts:4` `centeredImage`: one builder where three places built the image node by hand
- `src/markdown/emit/image.ts:7` `tryImage`: compares against what the reader builds, where `imageShape` restated the shape
- `src/markdown/parse/markdown-to-adf.ts:26` `TaskParagraph`: a named block kind replaces `readMarked`'s after-the-fact index search
- `src/markdown/parse/inline-content.ts:302` `assemble`: costs more — which of three readings an image takes hangs on a one-line condition and the `inLink` flag
- `src/markdown/parse/inline-content.ts:26` `InlineContent`: costs more — no longer image xor nodes

Inherited architect, decided by:

- `src/markdown/external-image.ts:4` `centeredImage`: the image shape is defined once for reader and both writers
- `src/markdown/emit/image.ts:7` `tryImage`: the emitter cannot drift from the reader
- `src/markdown/parse/markdown-to-adf.ts:136` `readBlock`: the task paragraph is routed where the block is classified
- `src/markdown/parse/inline-content.ts:302` `assemble`: costs more — the most expensive line to decode
- `src/markdown/parse/markdown-to-adf.ts:154` `paragraphsOf`: costs more — the name does not say it splits the marker line

## 2026-10-09T08:46:45Z, PR #21 at e7029c1, against 9a242c7

Ruling: better

| Seat | Vote |
|---|---|
| Mid A | better |
| Inherited architect | better |

Mid A, decided by:

- `src/markdown/emit/image.ts:7` `tryImage`: builds what the reader would build and compares, where `imageShape` restated the shape
- `src/markdown/external-image.ts:4` `centeredImage`: the image shape lives in one named file
- `src/markdown/parse/markdown-to-adf.ts:26` `TaskParagraph`: a typed block kind replaces `readMarked`'s after-the-fact search
- `src/markdown/parse/inline-content.ts:302` `assemble`: costs more — one dense ternary over `inLink`
- `src/markdown/parse/inline-content.ts:26` `InlineContent`: costs more — no longer a discriminated union

Inherited architect, decided by:

- `src/markdown/external-image.ts:4` `centeredImage`: one builder where three had to stay in step
- `src/markdown/parse/markdown-to-adf.ts:136` `readBlock`: the task paragraph is routed by a named block kind
- `src/result.ts:1` `ConvertErrorCode`: one rule no longer enforced at five sites
- `src/markdown/parse/inline-content.ts:26` `InlineContent`: costs more — `contentNode` drops `image` silently
- `src/markdown/parse/inline-content.ts:302` `assemble`: costs more — three routes from an image piece to text

## 2026-10-09T09:00:13Z, PR #22 at fe5c731, against 78655bc

Ruling: same

| Seat | Vote |
|---|---|
| Mid A | same |
| Inherited architect | same |

## 2026-10-09T09:52:41Z, PR #22 at 6f1a16b, against 78655bc

Ruling: worse

| Seat | Vote |
|---|---|
| Mid A | worse |
| Inherited architect | worse |

Mid A, decided by:

- `src/markdown/emit/inline-line.ts:106` `takeFallback`: a range may part joined breaks or carry, decided by state an earlier pass built
- `src/markdown/emit/inline-line.ts:316` `emitMarkedRun`: a carry that signals parting to `takeFallback` two levels up
- `src/markdown/emit/inline-line.ts:233` `joinsRun`: a lookahead whose shortcut holds only by `inlineRuns`' call order
- `src/markdown/emit/inline-line.ts:58` `portableLineFallback`: a second retry loop sharing the parting
- `src/adf/inline-nodes.ts:5` `InlineNodeModel.marks`: reads as "has marks", not "takes marks"
- `src/markdown/parse/inline-content.ts:328` `linkTo`: the comment hides that the breaks stay after the destination

Inherited architect, decided by:

- `src/markdown/emit/inline-line.ts:331` `emitMarkedRun`: the newline check returns a carry that is a parting signal, one fact over three functions
- `src/markdown/emit/inline-line.ts:106` `takeFallback`: two growing sets whose order matters
- `src/markdown/emit/inline-line.ts:58` `portableLineFallback`: a second retry loop with its own exit rule
- `src/markdown/emit/inline-line.ts:233` `joinsRun`: lookahead, shortcut and three conditions per break; `inlineRuns` takes the whole context
- `src/adf/inline-nodes.ts:5` `InlineNodeModel.marks`: the name hides "takes marks"
- `src/markdown/parse/inline-content.ts:328` `linkTo`: the comment no longer says an empty destination reads as nothing

## 2026-10-09T09:57:25Z, PR #22 at 45b5446, against 78655bc

Ruling: worse

| Seat | Vote |
|---|---|
| Mid A | worse |
| Inherited architect | worse |

Mid A, decided by:

- `src/markdown/emit/inline-line.ts:100` `takeFallback`: the first fallback is discarded to stop joining, known only from a comment
- `src/markdown/emit/inline-line.ts:200` `inlineRuns`: an indexed loop moving its own counter by `joinedBreaks`' result
- `src/markdown/emit/inline-line.ts:226` `joinedBreaks`: six positional parameters and two jobs

Inherited architect, decided by:

- `src/markdown/emit/inline-line.ts:101` `takeFallback`: a hidden first step that takes no fallback
- `src/markdown/emit/inline-line.ts:200` `inlineRuns`: runs built by a forward scan the reader steps through by hand
- `src/markdown/emit/inline-line.ts:56` `portableLineFallback`: checks an unjoined line while the final emit starts joined
- `src/markdown/emit/inline-line.ts:40` `LineFallbacks.joinsBreaks`: a fallbacks field whose fallback value is false

## 2026-10-09T10:02:23Z, PR #22 at f195ebd, against 78655bc

Ruling: same

| Seat | Vote |
|---|---|
| Mid A | same |
| Inherited architect | same |

## 2026-10-09T10:07:15Z, PR #22 at 37629e4, against 78655bc

Ruling: same

| Seat | Vote |
|---|---|
| Mid A | same |
| Inherited architect | same |

## 2026-10-09T10:19:03Z, PR #22 at 239218f, against 78655bc

Ruling: same

| Seat | Vote |
|---|---|
| Mid A | same |
| Inherited architect | same |

## 2026-10-09T12:13:22Z, PR #24 at d109199, against 78655bc

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | same | same | better | better |
| Inherited architect | same | same | same | worse | same |
| Maintainability senior | same | better | worse | same | same |
| Junior A | better | better | same | same | better |

Mid A, decided by:

- Navigation, Self-sufficiency: `src/markdown/portable/task-list.ts:5` `splitTaskList`: the split rule is one named unit both directions import, where it sat in `bulletNode` and `reduceTaskList`/`nestIn`
- Self-sufficiency, Navigation: `src/adf/inline-nodes.ts:12` `inlineNodes`: "a hard break takes no marks" is the field `takesMarks: false`, read by parser and emitter
- Shape: `src/markdown/portable/adf-to-portable-markdown.ts:289` `reduceTaskList`: the loop lost its `nested` accumulator and `nestIn`; line 303 packs the split and a merge into one expression
- Shape, Locality: `src/markdown/portable/task-list.ts:8` `splitTaskList`: a `standing` flag across iterations and `stands` overwritten mid-iteration; `heldTask` says little
- Locality: `src/markdown/parse/markdown-to-adf.ts:86` `readBlocks`: `bulletNode` returns a schema-breaking task list that its caller splits, and neither says so
- Self-sufficiency: `src/markdown/parse/inline-content.ts:328` `linkTo`: the comment covers the hard-break case

Inherited architect, decided by:

- Self-sufficiency: `src/markdown/portable/task-list.ts:5` `splitTaskList`: the comment states the schema constraint, not the rule; the loop must be traced by hand
- Locality: `src/markdown/parse/markdown-to-adf.ts:201` `bulletNode`: builds a schema-breaking intermediate that only `readBlocks` repairs under an unexplained guard
- Locality: `src/markdown/portable/adf-to-portable-markdown.ts:311` `reduceTask`: dropping `blankedCode` rests on a guarantee neither unit states
- Locality: `src/markdown/portable/adf-to-portable-markdown.ts:317` `nestIn`: two hand-mirrored halves of one rule became one function
- Self-sufficiency, Locality: `src/adf/inline-nodes.ts:12` `inlineNodes`: `takesMarks: false` makes the hard-break rule checkable at its source
- Self-sufficiency: `src/markdown/portable/adf-to-portable-markdown.ts:288` `reduceTaskList`: the comment no longer prepares the reader for line 303
- Shape: `src/markdown/portable/task-list.ts:12` `splitTaskList`: `standing`/`stands` reuse a word `reduceStanding` uses for another meaning

Maintainability senior, decided by:

- Locality: `src/markdown/portable/task-list.ts:5` `splitTaskList`: the stay-or-stand rule lives once, where the reader's `bulletNode` and the writer's `nestIn` mirrored it
- Locality: `src/markdown/parse/markdown-to-adf.ts:86` `readBlocks`: `bulletNode` returns a shape the caller quietly replaces, behind an unexplained `block.kind` guard
- Shape: `src/markdown/portable/task-list.ts:9` `splitTaskList`: two cross-iteration accumulators, a negated compound ternary, near-synonym names, and `heldTask` hides the taskItem conversion
- Shape: `src/markdown/portable/adf-to-portable-markdown.ts:303` `reduceTaskList`: one 180-character line maps the split and re-merges
- Shape: `AGENTS.md:28` decision index: a title grew into a two-clause sentence

Junior A, decided by:

- Locality, Navigation: `src/markdown/portable/task-list.ts:5` `splitTaskList`: one function decides for reader and writer, where each had its own rule
- Locality: `src/markdown/parse/markdown-to-adf.ts:86` `readBlocks`: `bulletNode` returns an unfinished shape only the caller completes
- Locality: `src/adf/inline-nodes.ts:3` `InlineNodeModel.takesMarks`: the hard break's rule lives in one row both directions read
- Shape: `src/markdown/portable/task-list.ts:5` `splitTaskList`: a carried `standing` flag, a reassigned `stands`, and `heldTask`'s name hides the conversion
- Navigation: `src/markdown/parse/markdown-to-adf.ts:22` imports: both converters lead to the same named file

## 2026-10-09T12:35:05Z, PR #24 at e487fa4, against 78655bc

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | better | same | same | better |
| Inherited architect | better | better | same | better | better |

Mid A, decided by:

- Locality, Overall: `src/markdown/portable/adf-to-portable-markdown.ts:289` `reduceTaskList`: a plain collect loop handing the list to `splitTasks`, where the base carried a `nested` accumulator and `nestIn` mutated `tasks`
- Locality: `src/markdown/portable/task-list.ts:6` `splitTaskList`: reader and writer share one rule, where `bulletNode` and `nestIn` each encoded it
- Locality, Shape: `src/markdown/parse/markdown-to-adf.ts:84` `readBlocks`: the portable task list is caught before `readBlock`, which depends on that order
- Shape: `src/markdown/portable/task-list.ts:33` `itemParts`: `paragraphs` and `nested` are indices named like collections, and the demotion to `taskItem` is unnamed
- Navigation, Shape: `src/adf/block-nodes.ts:92` `isTaskItem`: one findable predicate, against one more hop from a parse symptom

Inherited architect, decided by:

- Locality, Navigation, Overall: `src/markdown/portable/task-list.ts:6` `splitTaskList`: one unit decides where a task item's blocks go, for reader and writer
- Locality, Shape: `src/markdown/portable/adf-to-portable-markdown.ts:289` `reduceTaskList`: one pass then one call, no state carried across iterations
- Self-sufficiency, Locality: `src/adf/inline-nodes.ts:5` `takesMarks`: the hard-break rule is a field both directions read
- Shape: `src/markdown/portable/task-list.ts:33` `itemParts`: an index over `content` used over `run`, and `nested` running into the siblings
- Shape, Locality: `src/markdown/parse/markdown-to-adf.ts:84` `readBlocks`: a third special case ahead of the dispatch
- Shape: `src/adf/block-nodes.ts:92` `isTaskItem`: one predicate replaces two copies
- Self-sufficiency: `src/markdown/portable/task-list.ts:5` comment: states the schema limit and what follows from it

## 2026-10-09T13:03:22Z, PR #25 at 2b211e9, against 875c0e5

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | same | better |
| Inherited architect | same | better | better | same | better |

Mid A, decided by:

- Locality, Shape, Overall: `src/markdown/portable/adf-to-portable-markdown.ts:118` `portableSequence`: a plain splice with `index -= 1`, where the base merged neighbours after every splice through `spliced`, `mergedLists`, `joinedLists` and `splitTasks`
- Locality, Navigation: `src/markdown/parse/markdown-to-adf.ts:98` `listBreakFault`: gone, with the base's look at `blocks[index - 1]` and `blocks[index + 1]` and the separator spelled in four places
- Navigation, Shape: `src/markdown/parse/blocks.ts:232` `continuesList`: one named predicate on kind and delimiter that `itemStart` and `openedList` share
- Locality: `src/markdown/emit/adf-to-markdown.ts:73` `joinBlocks`: a toggled `alternated` flag decides each list's text from the one before it, and `isOrdered` counts a task list as a bullet list unsaid
- Shape: `src/markdown/emit/adf-to-markdown.ts:334` `spelledList`: `tryList` builds both spellings then falls back once, and `tryTaskList` shares the helper

Inherited architect, decided by:

- Locality, Shape, Overall: `src/markdown/portable/adf-to-portable-markdown.ts:118` `portableSequence`: a filter and a loop ending in `index -= 1`, where the base kept the splice window, the merge rules and the renumbering-as-text rule together
- Locality, Shape: `src/markdown/parse/markdown-to-adf.ts:79` `readBlocks`: reads one block at a time, where the base judged a separator by its siblings
- Locality: `src/markdown/emit/adf-to-markdown.ts:73` `joinBlocks`: a toggle carried across iterations sends a third adjacent list back to `-`, seen only by tracing
- Shape: `src/markdown/emit/adf-to-markdown.ts:334` `spelledList`: the both-or-neither rule is one uncommented expression
- Self-sufficiency: `src/markdown/emit/adf-to-markdown.ts:369` `tryListItemLines`: `inner.startsWith('*')` depends on the alternate bullet being `*`, and the comment needs the inline escaping worked out
- Self-sufficiency: `src/markdown/parse/blocks.ts:232` `continuesList`: states the rule the base sent the reader to the spec for

## 2026-10-09T13:37:16Z, PR #25 at ca3d703, against 875c0e5

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | better | better |
| Inherited architect | better | better | better | same | better |

Mid A, decided by:

- Locality, Shape, Overall: `src/markdown/portable/adf-to-portable-markdown.ts:118` `portableSequence`: a worklist that keeps a block that spells or pushes its items back, where the base spliced, merged neighbours and stepped the index back by hand
- Navigation, Locality: `src/markdown/parse/markdown-to-adf.ts:70` `readBlocks`: handles each block alone, where the base judged a separator by its neighbours across five places
- Shape, Self-sufficiency: `src/markdown/parse/blocks.ts:232` `continuesList`: one named predicate on kind and delimiter, its rule stated in place
- Self-sufficiency, Locality: `src/markdown/emit/adf-to-markdown.ts:27` `SpelledBlock`: its comment states why `alternateText` exists, though `joinBlocks` now carries a toggle across siblings
- Shape: `src/markdown/emit/adf-to-markdown.ts:334` `spelledList`: line building in small units, the fallback once after the loop, shared by `tryTaskList`
- Self-sufficiency: `src/markdown/emit/adf-to-markdown.ts:369` `tryListItemLines`: the `*` branch's comment needs a reread

Inherited architect, decided by:

- Locality, Shape, Overall: `src/markdown/portable/adf-to-portable-markdown.ts:118` `portableSequence`: a work stack replacing six helpers and the base's cursor rewind
- Locality, Navigation: `src/markdown/parse/markdown-to-adf.ts:70` `readBlocks`: each block reads alone, and two merged lists lead to one emitter and one parser unit
- Locality, Navigation: `src/markdown/parse/blocks.ts:232` `continuesList`: a list continues exactly where CommonMark says, checkable without the spec
- Locality: `src/markdown/emit/adf-to-markdown.ts:72` `joinBlocks`: a block's spelling depends on the run before it, where the base's separation was a pure function of a pair
- Shape: `src/markdown/emit/adf-to-markdown.ts:334` `spelledList`: one exit to the directive form, though bullets pass `() => ''` as the number
- Self-sufficiency: `src/markdown/emit/adf-to-markdown.ts:369` `tryListItemLines`: the `*` branch needs the spec open, cancelling the spec pointers removed

## 2026-10-09T14:50:52Z, PR #27 at 2378782, against a9fedb3

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | better | better |
| Inherited architect | better | better | better | same | better |

Mid A, decided by:

- Locality, Self-sufficiency: `src/markdown/inline-tokens.ts:20` `readInlineToken`: the parser and the escaper ask one function what the reader takes at a character, where each held its own copy of the rules
- Locality, Shape: `src/markdown/emit/line-escaping.ts:102` `escapeClaims`: the order-dependent `afterEscape` and `pairsEquals` flags are gone; runs go whole to `escapeRun` and fixed inputs ride one `EscapeWalk` record
- Shape, Navigation: `src/markdown/parse/inline-content.ts:110` `scanInline`: a two-level character dispatch and eight helpers became one switch over token kinds
- Shape: `src/markdown/emit/line-escaping.ts:158` `claimsCharacter`: switches on `token.kind` in place of a chain of character tests

Inherited architect, decided by:

- Navigation, Shape: `src/markdown/inline-tokens.ts:20` `readInlineToken`: one tokenizer answers what the reader sees at an index, where two parallel implementations had to agree
- Locality: `src/markdown/emit/line-escaping.ts:112` `escapeClaims`: each step reads on its own, no flag carried from the previous character
- Shape: `src/markdown/emit/line-escaping.ts:158` `claimsCharacter`: switches on the token kind and takes the shared record; the heading closer is worked out once in `closingHashes`
- Shape, Navigation: `src/markdown/parse/inline-content.ts:121` `readToken`: one exhaustive switch over `InlineToken['kind']` replaces a two-level dispatch
- Locality: `src/markdown/emit/line-escaping.ts:173` `claimsCharacter`: `default: return true` claims every kind it does not name, so a new kind is escaped without its author deciding

## 2026-10-09T17:14:17Z, PR #27 at 65d2a26, against a9fedb3

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | same | better |
| Inherited architect | better | better | better | same | better |

Mid A, decided by:

- Navigation, Locality: `src/markdown/inline-tokens.ts:21` `readInlineToken`: the one place that says what a character opens, which the reader and the escaper both dispatch on, where each held a copy that could drift
- Locality, Shape: `src/markdown/emit/line-escaping.ts:156` `claimsCharacter`: a flat switch on the token kind over a readonly `EscapeWalk`, where one character's escape hung on flags the previous iteration set
- Shape: `src/markdown/parse/inline-content.ts:121` `readToken`: one flat switch, recognition in the tokenizer and action here, where a two-level character switch fanned out to eight helpers
- Locality: `src/markdown/directive-syntax.ts:14` `ClaimedPrefix`: the directive read can no longer answer that no prefix stands there
- Shape: `src/markdown/emit/line-escaping.ts:147` `claimsRunRest`: re-reading each suffix of a run is a step the name does not say

Inherited architect, decided by:

- Navigation, Locality: `src/markdown/inline-tokens.ts:21` `readInlineToken`: the 3am symptom of an unescaped character leads to one file both directions ask
- Locality, Shape: `src/markdown/emit/line-escaping.ts:156` `claimsCharacter`: an exhaustive switch read one case at a time, where the decision needed replaying the loop for `pairsEquals`
- Shape, Locality: `src/markdown/parse/inline-content.ts:121` `readToken`: one pure tokenizer and one switch that applies tokens
- Shape: `src/markdown/directive-syntax.ts:14` `ClaimedPrefix`: the directive read needs proof of its prefix, and the misnamed `opensConstruct` is gone
- Locality: `src/markdown/emit/line-escaping.ts:112` `escapeClaims`: the escaper steps one character at a time while the reader steps by token, which only the `==` comment explains

## 2026-10-10T09:16:56Z, PR #30 at 6182ba6, against c11aa91

Ruling: worse

Fell: Locality. Under the floor of 7.0: Locality 5.63, so the same ruling counts as worse.

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | same | same | same |
| Inherited architect | better | worse | same | same | same |

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior A | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Mid A | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Maintainability senior | 7 | 6 | 6.5 | 6 | 6 |
| Inherited architect | 6.5 | 5.5 | 6 | 6 | 6 |
| Mean | 6.88 | 5.63 | 6.38 | 5.75 | 6.00 |

Mid A, decided by:

- Locality: `src/markdown/parse/blocks.ts:79` `Walk.endedByDefinitions`: written in `closeLeaf` at `:469` and read in `openedList` at `:257`, never cleared, correct only by identity with `blocks.at(-1)`; `closeLeaf` takes on recording where definitions ended a list

Inherited architect, decided by:

- Locality: `src/markdown/parse/blocks.ts:79` `Walk.endedByDefinitions`: a never-reset field `closeLeaf` writes and `openedList` reads, right only by identity and by `openContainers` closing before it opens; reordering those steps breaks the split silently
- Locality: `src/markdown/parse/blocks.ts:432` `readLineBlock`: a second path that can find a paragraph emptied by definitions records nothing, which a reader must prove harmless by hand
- Navigation: `src/markdown/parse/blocks.ts:252` `openedList`: the comment names the exception, so a reader of two lists merged or not lands on the right unit
- Navigation: `README.md:242` the CommonMark exceptions bullet: each exception is named rather than counted by position
- Navigation: `CHANGELOG.md:5` `## Unreleased`: breaking entries come first, other changes last

## 2026-10-11T10:33:32Z, PR #32 at be23835, against c11aa91

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | same | worse | worse |
| Inherited architect | same | worse | worse | worse | worse |

Mid A, decided by:

- Overall, Locality, Self-sufficiency: `src/markdown/parse/markdown-to-adf.ts:229` `splitPath`: builds stand-in nodes and replays `splitTaskList` to place a refused block's path, checkable only by knowing how the split moves blocks
- Locality, Self-sufficiency: `src/markdown/portable/task-list.ts:23` `splitPlace`: finds the stand-in by object identity, which holds only while `taskOfParagraphs` keeps the original children, and nothing there says so
- Locality: `src/markdown/parse/blocks.ts:262` `endList`: `closeLeaf` fills `Walk.endedLists` and `openedList` reads it, where `openedList` looked only at the previous block

Inherited architect, decided by:

- Locality, Self-sufficiency, Overall: `src/markdown/parse/markdown-to-adf.ts:229` `splitPath`: a fake task list replayed through `splitTaskList` and found again by identity; if `taskOfParagraphs` ever copies nodes the old wrong path returns silently
- Shape, Locality: `src/markdown/parse/markdown-to-adf.ts:203` `bulletBlocks`: one `readBlocks` call became a per-block loop with a hand-built failure, a second depth check and a fan-out through `taskItems`, `splitPath`, `childType` and `splitPlace`; `Refusal` names a context bag
- Locality: `src/markdown/parse/blocks.ts:78` `Walk.endedLists`: identity-keyed walk state that `closeLeaf` writes and `openedList` reads
- Shape: `src/markdown/portable/adf-to-portable-markdown.ts:354` `reduceMedia`: the callback's `held` shadows the alt's, and the link goes mark to definition to mark

## 2026-10-11T10:33:35Z, PR #32 at be23835

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior A | 7 | 6 | 6.5 | 6 | 6.5 |
| Mid A | 7 | 6 | 6.5 | 5.5 | 6 |
| Maintainability senior | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Inherited architect | 6.5 | 5.5 | 6 | 6 | 6 |
| Mean | 6.88 | 5.75 | 6.38 | 5.75 | 6.13 |

Junior A, hardest first:

- Locality: `src/markdown/parse/markdown-to-adf.ts:229` `splitPath`: replays `splitTaskList`'s internals to name a path
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:189` `escapeClosedRuns`: the escaping rule lives in `spec/flavour.md`

Mid A, hardest first:

- Locality: `src/markdown/emit/adf-to-markdown.ts:30` `SpellingMemo`: reference-keyed memo shared by parse and emit
- Self-sufficiency: `src/markdown/parse/inline-content.ts:62` `Scan`: rules read with `spec/flavour.md` open alongside

Maintainability senior, hardest first:

- Locality: `src/markdown/parse/markdown-to-adf.ts:257` `directiveNode`: the parser asks the emitter whether input was legal
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:189` `escapeClosedRuns`: needs `spec/flavour.md` Escaping open

Inherited architect, would restructure first:

- Navigation: `src/markdown/portable/conventions.ts:23` `flavourClaims`: every flavour's switchboard sits in `portable/`
- Locality: `src/markdown/emit/adf-to-markdown.ts:117` `readableBlock`: reader acceptance hangs on emitter verdicts

## 2026-10-11T11:29:00Z, PR #32 at 27c8f9b, against c11aa91

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | same | same | worse |
| Inherited architect | same | worse | same | same | worse |

Mid A, decided by:

- Locality, Overall: `src/markdown/parse/markdown-to-adf.ts:229` `splitPath`: rewrites a refused path by replaying `splitTaskList` on stand-in nodes, so a change to the split moves error paths quietly
- Locality: `src/markdown/parse/blocks.ts:262` `endList`: `closeLeaf` writes `Walk.endedLists` and `openedList` reads it later

Inherited architect, decided by:

- Locality, Overall: `src/markdown/parse/markdown-to-adf.ts:229` `splitPath`: four facts held at once, the mutated `task.content`, the path slice, the stand-ins and a second parse in `childType`
- Locality: `src/markdown/portable/task-list.ts:23` `splitPlace`: finds the refused node by object identity, right only while `taskOfParagraphs` keeps its children

## 2026-10-11T11:29:02Z, PR #32 at 27c8f9b

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior A | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Mid A | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Maintainability senior | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Inherited architect | 6.5 | 6 | 6 | 6.5 | 6.5 |
| Mean | 6.88 | 5.63 | 6.38 | 5.75 | 6.13 |

Junior A, hardest first:

- Locality: `src/markdown/parse/inline-content.ts:62` `Scan`: a mutable bag many functions change
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:189` `escapeClosedRuns`: the rule lives in `spec/flavour.md`

Mid A, hardest first:

- Locality: `src/markdown/parse/markdown-to-adf.ts:257` `directiveNode`: the parser asks the emitter for verdicts
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:100` `escapeClaims`: needs the spec open alongside

Maintainability senior, hardest first:

- Locality: `src/markdown/parse/inline-content.ts:62` `Scan`: flags that act at a distance between escaper, emitter and parser
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:189` `escapeClosedRuns`: no local statement of the escaping contract

Inherited architect, would restructure first:

- Navigation: `src/markdown/portable/conventions.ts:23` `flavourClaims`: the table for all three flavours sits in `portable/`
- Shape: `src/markdown/emit/adf-to-markdown.ts:131` `spellReadableBlock`: the flavour concern spread over three directories

## 2026-10-11T18:44:18Z, PR #35 at 0227c0b, against 4f00e60

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | same | same | same | better |
| Inherited architect | same | worse | worse | same | same |
| Maintainability senior | better | worse | same | same | same |
| Junior A | better | same | same | same | better |

Mid A, decided by:

- Navigation, Overall: `README.md:211` "The calls": each public call sits in one row with the codes it refuses, where the base split that knowledge across prose bullets and the feature list
- Navigation: `README.md:384` "The errors": parsing, emitting and either direction have their own sub-headings, and the error shape is a bulleted list
- Navigation: `src/result.ts:49` `withinEngineLimits`: the refusal for output too long is visible at both public entry points, its message in one place

Inherited architect, decided by:

- Locality, Shape: `src/result.ts:49` `withinEngineLimits`: one try/catch wraps each writer's whole call and matches four exact engine messages; a concatenation deep in the emitter does not show it is caught at the top, a reworded engine message turns the refusal back into a throw, and `engineLimitFaults` borrows "fault" from `ConvertFault` while holding plain strings
- Shape: `src/result.ts:54` `withinEngineLimits`: an engine overflow is reported as `unsupported-node-shape` at an empty path, though the node shapes are fine and the output is what is too big
- Locality: `src/canonical-json.ts:30` `writeCanonicalJson`: one walker serves two callers through a stop-returning `write` callback, one more contract to hold when editing `schedule`

Maintainability senior, decided by:

- Locality: `src/result.ts:49` `withinEngineLimits`: the guard sits only at the two public writers while `writeMarkdown` stays exported and unguarded and the readers rely on another mechanism; nothing states which paths can outgrow the engine's longest string
- Locality: `src/result.ts:46` `engineLimitFaults`: errors match exact engine strings, and why a stack overflow stays a throw is not said
- Navigation: `README.md:211` "The calls": one table maps each call to its refusal codes, where the base spread them over prose that was wrong for `adfToPortableMarkdown`
- Navigation: `src/markdown/opaque-carry.ts:78` `readCarriedJson`: `spellsCanonicalJson` reads as plainly at the call site, with its reason beside it

Junior A, decided by:

- Navigation, Overall: `README.md:193` "The calls": a table pairs each call with what it reads or writes and what it refuses, and a node-to-spelling table turns a symptom into a concept to grep for

## 2026-10-11T19:02:20Z, PR #35 at 90de6cb, against 4f00e60

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | same | same | same | better |
| Inherited architect | better | same | worse | better | better |

Mid A, decided by:

- Navigation, Overall: `README.md:211` "The calls": each call's row says what it reads or writes and what it refuses, and the errors split by direction, where the base spread the codes across a prose list and paragraphs
- Navigation: `src/result.ts:49` `withinEngineLimits`: the engine-limit refusal lives in one wrapper, called once at each public writer

Inherited architect, decided by:

- Navigation, Self-sufficiency: `README.md:211` "The calls": one row per call gives what it reads or writes and its refusal codes, where the base split them and left out `unsupported-node-shape` for the portable writer
- Self-sufficiency: `README.md:241` "The lossless flavour": two tables map ADF types to their spellings, so the 3am case reads without the spec open
- Shape: `src/result.ts:55` `withinEngineLimits`: a length failure is reported under `unsupported-node-shape` at an empty path, and the README cell explaining it holds four cases
- Shape: `src/result.ts:45` `engineLimitThrows`: matching exact engine message text rots silently when an engine rewords, and JavaScriptCore's `Out of memory` blurs a heap shortage with length

## 2026-10-12T15:56:53Z, PR #36 at 584b214, against 7a27f6b

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | worse | worse | same | worse |
| Inherited architect | better | worse | worse | same | worse |

Mid A, decided by:

- Locality, Shape, Overall: `src/markdown/emit/adf-to-markdown.ts:61` `walkBlocks`: a running forecast depends on `Writing.indent`, which each container must pass correctly, `tryList` deliberately not indenting
- Shape, Locality: `src/markdown/emit/adf-to-markdown.ts:398` `spelledList`: template strings became `joinedWithin` piped through nested `boundedThen` callbacks, and `joinedItems` repeats the counting loop
- Locality: `src/markdown/emit/adf-to-markdown.ts:147` `readableBlock`: the memo is filled in `commonMarkSpelling` and emptied on read, so when an entry is present depends on call order across two functions
- Shape: `src/markdown/directive-syntax.ts:114` `spellAttributes`: each spelling exists twice, as a string and as a generator of pieces
- Locality: `src/markdown/portable/editor-normal.ts:26` `toEditorNormal`: editor normalization imports the markdown length bound
- Locality: `src/markdown/portable/adf-to-portable-markdown.ts:126` `portableSequence`: each block carries its source path, rebuilt by hand for a replacement
- Navigation: `src/markdown/length-bound.ts:1` `withinEngineLimits`: the bound, its refusal and the catch share one module named for them

Inherited architect, decided by:

- Locality, Shape: `src/markdown/emit/adf-to-markdown.ts:61` `walkBlocks`: the forecast is a second length bound beside `joinedWithin`, whose never-overcount rule fixes how every container walks
- Locality: `src/markdown/emit/adf-to-markdown.ts:377` `tryList`: whether items walk indented depends on what `spelledOrDirectiveList` may decide later
- Locality: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: the emitter's `indent` leaks into the parser and the portable reduction
- Locality: `src/markdown/emit/adf-to-markdown.ts:147` `readableBlock`: filling and emptying the memo split across two functions
- Shape: `src/markdown/emit/adf-to-markdown.ts:194` `quotedBlock`: nested `boundedThen` reads as continuation passing where a template stood
- Shape, Locality: `src/markdown/emit/pipe-table.ts:9` `tryPipeTable`: the sum-then-check rule appears in seven shapes, and a reader cannot tell which is the real bound
- Navigation, Shape: `src/markdown/length-bound.ts:41` `withinEngineLimits`: a too-long symptom leads straight to the module named for it
- Shape: `src/markdown/directive-syntax.ts:133` `spellDirectiveOpener`: each spelling is a string function and a pieces generator
- Shape: `src/markdown/opaque-carry.ts:64` `carriedJson`: the lambda parameter `spelled` shadows the function's own

## 2026-10-12T16:40:52Z, PR #36 at acd22aa, against 7a27f6b

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | worse | worse | same | worse |
| Inherited architect | better | worse | worse | same | worse |

Mid A, decided by:

- Locality, Shape: `src/markdown/emit/adf-to-markdown.ts:374` `spelledList`: a builder's `undefined` now means either no list spelling or past the length bound, and every caller of `joinBlocks` must remember which it holds
- Shape: `src/markdown/emit/adf-to-markdown.ts:383` `listLines`: split, map and join became generators yielding pieces into `separatedBy` and `joinedWithin`, so a reader rebuilds the string in their head
- Locality: `src/markdown/emit/adf-to-markdown.ts:125` `readableBlock`: the memo is filled in `commonMarkSpelling` and deleted on read, a one-shot cache whose hits depend on which walk came first
- Navigation: `src/markdown/length-bound.ts:41` `withinEngineLimits`: a too-long refusal leads to a module named for it

Inherited architect, decided by:

- Locality, Shape: `src/markdown/emit/adf-to-markdown.ts:374` `spelledList`: `undefined` means two things a few lines apart, told apart only by the side of a nested `boundedThen` callback
- Locality: `src/markdown/emit/adf-to-markdown.ts:125` `readableBlock`: reading the memo is a mutation, and a second read spells again
- Shape: `src/markdown/pipe-table-syntax.ts:43` `pipeRowPieces`: one-line templates became generators whose output cannot be read off one line
- Locality, Shape: `src/markdown/emit/block-directive-spelling.ts:27` `spellBlockDirectiveOpener`: the opener's layout is known here and in `spellDirectiveOpener`
- Shape: `src/markdown/portable/adf-to-portable-markdown.ts:231` `reduceCodeBlock`: an ADF-to-ADF reducer carries a markdown length bound through a callback
- Navigation: `src/markdown/length-bound.ts:41` `withinEngineLimits`: a too-long refusal leads straight to one small, well-named module

## 2026-10-12T19:45:45Z, PR #36 at 1f4551a, against 7a27f6b

Ruling: worse

Fell: Locality. Under the floor of 7.0: Locality 5.13, so the same ruling counts as worse.

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | worse | better | same | same |
| Inherited architect | better | worse | better | same | same |

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior A | 6.5 | 5 | 6 | 5.5 | 5.5 |
| Mid A | 7 | 5 | 6 | 5 | 5.5 |
| Maintainability senior | 7 | 5.5 | 6.5 | 6 | 6 |
| Inherited architect | 6.5 | 5 | 5.5 | 6.5 | 5.5 |
| Mean | 6.75 | 5.13 | 6.00 | 5.75 | 5.63 |

Mid A, decided by:

- Locality: `src/markdown/emit/adf-to-markdown.ts:114` `commonMarkSpelling`: the memo is filled here and read-and-deleted in `readableBlock`, a write-once, read-once protocol whose order is set in another module
- Locality: `src/markdown/emit/adf-to-markdown.ts:52` `writeMarkdown`: one rule, output past `longestMarkdown` is refused, is checked in six places with different triggers
- Navigation, Shape: `src/markdown/length-bound.ts:1` `tooLong`: a too-long refusal leads to one small module holding the bound, its message and the engine guard
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator replaces a boolean-returning callback, and both readers become plain loops
- Shape, Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a refused spelling is returned where it is produced, and each block carries its own path
- Shape: `src/markdown/emit/inline-line.ts:235` `emitLeaf`: one content-or-text check, and the path is built only to refuse

Inherited architect, decided by:

- Locality: `src/markdown/emit/adf-to-markdown.ts:114` `commonMarkSpelling`: filling and consuming the memo split across an exported predicate and a private reader, a consume-once protocol among three callers
- Locality: `src/markdown/emit/adf-to-markdown.ts:52` `writeMarkdown`: one bound enforced at five sites in four files, and a new builder has nothing nearby saying whether it needs a check
- Navigation, Shape: `src/markdown/length-bound.ts:1` `withinEngineLimits`: an output-too-long symptom leads straight to a module named for it
- Navigation: `src/markdown/parse/markdown-to-adf.ts:47` `readDocument`: the parse takes the same guard as both writers
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: plain loops replace a boolean-returning callback
- Shape: `src/markdown/emit/inline-line.ts:235` `emitLeaf`: both leaf emitters return a plain emission, the path built only on refusal

Junior A, hardest first:

- Locality: `src/markdown/emit/adf-to-markdown.ts:114` `commonMarkSpelling`: a mutable memo shared by three walks, deleted on read and rebased by depth

Mid A, hardest first:

- Locality: `src/markdown/emit/adf-to-markdown.ts:125` `readableBlock`: shared mutable state with no single owner, parse and emit coupled both ways

Maintainability senior, hardest first:

- Locality: `src/markdown/emit/adf-to-markdown.ts:114` `commonMarkSpelling`: the parser and the portable reducer call into the emitter and share a reference-keyed, delete-on-read memo

Inherited architect, would restructure first:

- Locality: `src/markdown/emit/adf-to-markdown.ts:126` `readableBlock`: the memo is mutated and deleted across parse, emit and portable, and the length bound is applied at five sites

## 2026-10-13T14:48:38Z, PR #37 at ecd695a, against 7a27f6b

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | worse | better | worse | worse |
| Inherited architect | better | worse | same | worse | worse |

Mid A, decided by:

- Locality, Self-sufficiency: `src/markdown/emit/adf-to-markdown.ts:116` `commonMarkSpelling` / `readableBlock` / `takeKeptSpelling`: only commonMarkSpelling fills the memo and a read empties it, so whether an entry exists depends on which caller ran first; the reason lives only behind a pointer to docs/decisions.md
- Locality: `src/markdown/emit/line-escaping.ts:229` `escapeClosedRuns`: both steps write one shared Uint8Array, and correctness rests on the scan order a second comment line must defend
- Navigation, Shape: `src/markdown/length-bound.ts:30` `withinEngineLimits`: the engine-limit catch moves out of result.ts into one well-named file, with string-length and engine limits apart and `engine-limit` a code of its own
- Locality: `src/markdown/emit/adf-to-markdown.ts:51` `writeMarkdown` / `walkBlocks` / `commonMarkSpelling`: the length bound is enforced in layers a reader changing it must hold together
- Shape: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: undefined is wrapped into a Result to pass the engine guard, then unpicked
- Shape: `src/markdown/emit/line-escaping.ts:35` `Escapings`: the type is a lookup function, its comment describes the Uint8Array behind it; `backslashed` adds 4096-piece chunking
- Shape, Locality: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator replaces a boolean-continue callback
- Shape: `src/markdown/emit/inline-line.ts:235` `emitLeaf`: the content-or-text refusal moves into one place
- Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a spelling refusal propagates where it was swallowed, at the cost of Sourced path plumbing

Inherited architect, decided by:

- Locality, Self-sufficiency: `src/markdown/emit/adf-to-markdown.ts:139` `takeKeptSpelling`: reading deletes the entry and only commonMarkSpelling fills it, so readableBlock is right only if another file's caller asked first, once per node; explained only by a pointer to docs/decisions.md
- Locality, Shape: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: a second withinEngineLimits inside readDocument's, fed `?? success(undefined)`, so null and undefined carry meaning the reader must remember
- Locality: `src/markdown/emit/adf-to-markdown.ts:58` `walkBlocks`: the length bound is enforced at about six sites across three files
- Navigation: `src/markdown/length-bound.ts:30` `withinEngineLimits`: engine-limit handling sits in a file named for it, and the engine-limit code parts memory from the length bound
- Shape, Locality: `src/markdown/emit/line-escaping.ts:229` `escapeClosedRuns`: mutates its input in place and needs a two-line comment arguing it is safe; output joined in batches of 4096
- Locality, Shape: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a refusal propagates with its source path, where it was swallowed
- Shape: `src/markdown/emit/inline-line.ts:235` `emitLeaf`: one place refuses content and text, and a generator replaces the boolean-callback JSON writer

## 2026-10-13T15:35:32Z, PR #37 at 025ccc0, against 7a27f6b

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | worse | same | same | worse |
| Inherited architect | better | worse | same | worse | worse |

Mid A, decided by:

- Locality: `src/markdown/emit/adf-to-markdown.ts:58` `walkBlocks`: the length bound is enforced at six sites across four files, each comment giving only its own reason, where one wrapper covered the conversion
- Locality: `src/markdown/emit/adf-to-markdown.ts:126` `readableBlock`: the memo is emptied on read and filled only when `asked`, so whether a spelling is cached depends on call order and caller
- Navigation: `src/markdown/length-bound.ts:1` `withinEngineLimits`: a refused long document leads to a file named for the problem, holding the bound, both throw lists and both messages
- Locality: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: `success(undefined)` and `success(null)` encode the ask's answer, decoded only by tracing commonMarkSpelling
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator replaces a boolean-continue callback
- Shape: `src/markdown/emit/line-escaping.ts:38` `PlacedSegment`: segment placements drop the cursor arithmetic two functions repeated
- Shape: `src/markdown/emit/line-escaping.ts:113` `backslashed`: byte flags, codes and 4096-piece joins read harder than a character loop
- Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a refused spelling propagates where it was silently swallowed

Inherited architect, decided by:

- Locality: `src/markdown/emit/adf-to-markdown.ts:58` `walkBlocks`: one rule, no markdown past longestMarkdown, is checked at about seven places across four files
- Locality, Shape: `src/markdown/emit/adf-to-markdown.ts:126` `readableBlock`: a read deletes the entry and a bare positional `asked` boolean decides what is stored, so results depend on call order
- Locality, Self-sufficiency: `src/markdown/emit/line-escaping.ts:113` `backslashed`: flags, byte codes, a lookup closure and batched joins take more passes to read as putting a backslash before characters
- Self-sufficiency: `src/markdown/emit/adf-to-markdown.ts:65` `walkBlocks`: the refusal's comment makes sense only once you know V8's limit applies on every engine, which lives in docs/decisions.md; tooLong carries path [] though the walk knows the path
- Shape: `src/markdown/length-bound.ts:17` `tooLong`: the length refusal keeps unsupported-node-shape while engine-limit got a name of its own; directiveNode folds three outcomes into one Result to fit the wrapper
- Navigation: `src/markdown/length-bound.ts:37` `withinEngineLimits`: the engine guard moves out of the Result module, and engine-limit leads from the symptom to it
- Shape, Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a refusal propagates with its block's path, where it was silently swallowed
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator, emitLeaf's one refusal and PlacedSegment each read simpler than before

## 2026-10-13T15:41:57Z, PR #37 at f1ea9fd, against 7a27f6b

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | worse | better | same | same |
| Inherited architect | better | worse | same | same | worse |
| Maintainability senior | better | worse | better | same | same |
| Junior A | better | worse | better | same | same |

Mid A, decided by:

- Locality: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: a second engine guard inside the parse's own, explained by how each engine overflows
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: a caller flag decides the fill and every read deletes, so what a later call sees depends on who called first
- Locality: `src/markdown/emit/adf-to-markdown.ts:66` `walkBlocks`: the length bound is checked at four points, each relying on the others to cover what it skips
- Navigation, Shape: `src/markdown/length-bound.ts:37` `withinEngineLimits`: engine and length refusals have their own file and code, and result.ts is back to types
- Shape: `src/markdown/length-bound.ts:17` `tooLong`: a string overflow keeps unsupported-node-shape while array and memory take engine-limit, explained only by a comment
- Shape, Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a failed spelling returns early with each block's own path, where it was swallowed
- Shape: `src/markdown/emit/adf-to-markdown.ts:117` `commonMarkSpelling`: returns Result<boolean>, which says what it means, where undefined and success(null) encoded the answer
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator replaces a boolean early-stop callback
- Shape: `src/markdown/emit/line-escaping.ts:113` `backslashed`: PlacedSegment drops repeated cursor arithmetic, at the cost of byte codes, chunked joins and RunEscapes

Inherited architect, decided by:

- Locality: `src/markdown/emit/adf-to-markdown.ts:126` `readableBlock`: a read deletes and only an asked caller fills, so whether a node is spelled again depends on call order; the first place to rot
- Locality, Navigation: `src/markdown/length-bound.ts:36` `withinEngineLimits`: wrap-every-builder is a project-wide duty, and six sites refuse with one message and path [], so a report cannot say which fired
- Navigation: `src/markdown/length-bound.ts:1` `withinEngineLimits`: the size concern has a file named for it and engine refusals their own code
- Locality: `src/markdown/parse/markdown-to-adf.ts:265` `directiveNode`: a nested engine guard mid-walk, there only to place V8's throw at this directive
- Shape: `src/markdown/emit/adf-to-markdown.ts:117` `commonMarkSpelling`: Result<boolean> tells the truth and a refusal now propagates with its path; line 134's conditional is dense
- Shape: `src/markdown/emit/line-escaping.ts:40` `RunEscapes`: byte flags, codes and batched joins read less directly, and `escapable` reads close to backwards; PlacedSegment is a real gain

Maintainability senior, decided by:

- Navigation, Shape: `src/markdown/length-bound.ts:37` `withinEngineLimits`: guard, bound and refusals share one file, and result.ts is back to describing results
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: deletes on every read and writes only when asked, so a hit depends on call order across the parser, the portable reduction and the walk
- Locality, Self-sufficiency: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: a check's place is justified by where V8 would throw, with a nested engine guard, so moving one needs V8's behaviour reconstructed
- Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: a refused spelling comes back as a value with its block's path, where it was swallowed
- Shape: `src/markdown/emit/adf-to-markdown.ts:117` `commonMarkSpelling`: Result<boolean> where absence coded both answers
- Shape: `src/markdown/length-bound.ts:17` `tooLong`: a length refusal under unsupported-node-shape with path [], and the README row grown into a catch-all
- Shape: `src/markdown/emit/line-escaping.ts:113` `backslashed`: byte codes and chunked joins against PlacedSegment removing duplicated cursor arithmetic, about even
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator replaces a boolean-returning callback
- Locality: `src/markdown/emit/inline-line.ts:235` `emitLeaf`: the content-or-text refusal is hoisted once, a small gain

Junior A, decided by:

- Navigation, Shape: `src/markdown/length-bound.ts:37` `withinEngineLimits`: the engine-overflow catch moves out of result.ts into a file named for the job, with the two message lists saying which throw means what
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: a read deletes and a caller flag decides the store, an order dependence across three files
- Locality: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: a nested engine guard to pin V8's throw, and the bound checked in five places
- Shape, Locality: `src/markdown/emit/adf-to-markdown.ts:117` `commonMarkSpelling`: Result<boolean> matches its name, and portableSequence propagates a refusal with each block's path
- Shape: `src/markdown/emit/line-escaping.ts:38` `PlacedSegment`: replaces a parallel placements array and hand-advanced cursor, against byte codes and chunked joins
- Shape: `src/canonical-json.ts:23` `canonicalJsonPieces`: a generator replaces a write callback threading a keep-going flag
- Shape: `src/markdown/emit/inline-line.ts:175` `heldContentOrText`: the content-or-text refusal checked once in emitLeaf

## 2026-10-13T18:05:39Z, PR #37 at 3ba3a82, against 7caa823

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | same | better |
| Inherited architect | better | better | better | better | better |

Mid A, decided by:

- Shape: `src/markdown/emit/adf-to-markdown.ts:117` `commonMarkSpelling`: returns Result<boolean>, where undefined and success(null) had to be decoded from the callers
- Shape, Locality: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: one boolean test where a typed guard, a fallback and an undefined check decoded the tri-state again
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: every memo read, delete and write sits in one function, where three held its life cycle
- Navigation: `src/markdown/length-bound.ts:52` `engineLimit`: an engine-limit refusal has its own code and constructor, where it shared unsupported-node-shape with shape refusals
- Shape, Locality: `src/markdown/portable/adf-to-portable-markdown.ts:128` `portableSequence`: one check on spelled.value, and a flatMap replaces listItemBlocks
- Locality: `src/markdown/emit/line-escaping.ts:38` `PlacedSegment`: computed once and passed on, where three functions each re-derived starts with their own cursor
- Shape: `src/markdown/emit/line-escaping.ts:52` `escapingCodes`: byte codes, flags and a 4096-piece join, and the RunEscapes union, read harder than a plain list

Inherited architect, decided by:

- Navigation, Self-sufficiency: `src/result.ts:2` `ConvertErrorCode`: engine-limit names its cause and points at one function, where the most overloaded code hid whether the document or the runtime failed
- Shape, Locality: `src/markdown/emit/adf-to-markdown.ts:117` `commonMarkSpelling`: Result<boolean>, so directiveNode tests one boolean where it decoded a tri-state
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: the memo's read, delete and write sit in one function under one comment, at the cost of a caller flag
- Shape, Self-sufficiency: `src/markdown/portable/adf-to-portable-markdown.ts:134` `portableSequence`: one boolean test, though the list's own path for its items is now stated only in the README
- Locality: `src/markdown/emit/line-escaping.ts:38` `PlacedSegment`: each segment arrives with its start, so two functions no longer walk in step; backslashed itself reads costlier
- Shape: `src/markdown/emit/line-escaping.ts:41` `RunEscapes`: its field collides with isEscapable and the call site handles false first, the slowest spot to read
- Self-sufficiency: `src/markdown/length-bound.ts:43` `withinEngineLimits`: the stack-overflow comment sits on its line, the carry comment says why the join is bounded

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

## 2026-10-13T22:23:11Z, PR #40 at 8d14bbf, against 341280d

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | same | better | same | same |
| Inherited architect | same | better | better | same | better |
| Maintainability senior | worse | same | better | same | same |
| Junior A | same | same | better | better | better |

Mid A, decided by:

- Shape: `src/markdown/directive-syntax.ts:109` `slotFault`: both branches return unsupported-node-shape through its constructor, where one small function returned two codes and the old name sounded like a writer's failure

Inherited architect, decided by:

- Shape, Locality: `src/markdown/directive-syntax.ts:109` `slotFault`: one rule with one code, where two branches gave the same kind of problem different codes and the reason lay outside the function
- Shape: `src/result.ts:1` `ConvertErrorCode`: the list loses a code named for writing that only the parser raised, so every name matches its producer

Maintainability senior, decided by:

- Shape: `src/markdown/directive-syntax.ts:109` `slotFault`: the two checks raise one code, where sibling refusals of one slot took different codes under a name untrue twice over
- Navigation: `README.md:451` `unsupported-node-shape`: a symptom arrives as a code many sites raise, and its longest cell grows, so a reader searches on the message text where one row and one producer led straight there

Junior A, decided by:

- Shape: `src/result.ts:1` `ConvertErrorCode`: the list loses a writer-named code only the parser raised
- Shape, Self-sufficiency: `src/markdown/directive-syntax.ts:109` `slotFault`: one code for both branches, and the message states the rule and the fix that lived only in the README

## 2026-10-13T23:14:24Z, PR #41 at d1dc155, against e0ead52

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | same | same | better | same |
| Inherited architect | same | worse | worse | better | worse |
| Maintainability senior | same | same | worse | same | same |
| Junior A | same | same | same | better | same |

Mid A, decided by:

- Self-sufficiency: `src/markdown/directive-syntax.ts:108` `slotFault`: the comment now names the node the emitter carries, where "such" pointed at nothing in view
- Self-sufficiency: `src/markdown/portable/conventions.ts:13` `Claims.pipeTables`: the three-valued claim's comment says what each value accepts, so every check in blocks.ts reads without the spec

Inherited architect, decided by:

- Locality, Overall: `src/markdown/parse/blocks.ts:381` `readBlockLine` / `openLeaf` / `openGfmTable` / `pipeTableRow` / `pipeTableBlock` / `bareTableFault`: a three-valued claim tested in six places with four comparisons, and no single place states what each mode does to a table
- Locality: `src/markdown/parse/blocks.ts:497` `openGfmTable`: cuts the open paragraph through walk.leaf, closes it, then sets walk.leaf again, an order on shared state; its call must precede the pipeCells branch and nothing says so
- Shape: `src/markdown/portable/conventions.ts:14` `Claims.pipeTables`: `'flavour'` names the lossless rule though every reader is a flavour, so `=== 'flavour'` needs the field's comment to decode
- Shape: `src/markdown/parse/blocks.ts:514` `pipeTableRow`: one `if` merges three reasons into "return cells", two of which mean "end the table"; the indentation guard is duplicated at two call sites
- Self-sufficiency: `src/markdown/parse/blocks.ts:496` `openGfmTable`, `pipeTableRow`: each opens with a "GFM, Tables:" line stating the rule it enforces

Maintainability senior, decided by:

- Shape: `src/markdown/portable/conventions.ts:14` `Claims.pipeTables`: `'flavour'` names only the lossless reader's strict rule though portable is a flavour too, and blocks.ts tests the three states three ways
- Locality: `src/markdown/parse/blocks.ts:497` `openGfmTable`: rewrites walk.leaf, closes it, then installs the table, and its call must precede the pipeCells claim and the setext check with no comment saying so
- Locality: `src/markdown/parse/blocks.ts:63` `ParagraphLine`: each line keeps its position, where two parallel arrays had to stay the same length

Junior A, decided by:

- Self-sufficiency: `src/markdown/directive-syntax.ts:108` `slotFault`: the comment says on its own which node the emitter carries
- Self-sufficiency: `src/markdown/portable/conventions.ts:13` `Claims.pipeTables`: the comment says what each mode reads, so the branches in blocks.ts read without the spec

## 2026-10-14T08:45:14Z, PR #43 at b83adc4, against e193536

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | worse | same | worse |
| Inherited architect | same | worse | worse | same | worse |

Mid A, decided by:

- Locality: `src/markdown/parse/directive-nodes.ts:140` `readNamedMark`: words its error by deleting `; ${directiveEscape}` from a fault built in directive-syntax.ts, so rewording that message silently changes this one
- Shape, Locality: `src/markdown/parse/directive-nodes.ts:100` `readMarks` / `readMarkArray` / `readNamedMarks` / `readNamedMark`: one attribute's parse now spans four units and three modules, a cursor-driven list parser in a file about directive nodes
- Shape: `src/markdown/directive-syntax.ts:299` `readAttributes` / `readDirectiveName`: exported but left among the private helpers, below the file's export block
- Locality: `src/markdown/directive-syntax.ts:69` `attributeValue`: the numbers branch reads a JSON array only for a respelling check that lives in another file

Inherited architect, decided by:

- Locality, Overall: `src/markdown/parse/directive-nodes.ts:140` `readNamedMark`: strips the escape hint with a string replace tied to the wording of pairFault and prefixFault in directive-syntax.ts, which nothing there warns of
- Locality, Shape: `src/markdown/parse/directive-nodes.ts:117` `readNamedMarks` / `readNamedMark`: a grammar inside a quoted attribute value, two levels of escaping held at once, the reader in a file otherwise about building nodes and the writer in block-directive.ts
- Shape: `src/adf/mark-attributes.ts:22` `markVocabularies` / `markAttributes` / `isMarkType`: markAttributes silently means inline marks beside markVocabularies meaning all, and isMarkType('alignment') is false

## 2026-10-14T08:45:16Z, PR #43 at b83adc4

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior A | 6.5 | 5 | 6 | 5 | 5.5 |
| Mid A | 6 | 5 | 5.5 | 5 | 5.5 |
| Maintainability senior | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Inherited architect | 7 | 6 | 6 | 6.5 | 6.5 |
| Mean | 6.63 | 5.38 | 6.00 | 5.50 | 5.88 |

Junior A, hardest first:

- Locality, Overall: `src/markdown/parse/markdown-to-adf.ts:237` `splitPath`: builds stand-in nodes and re-runs splitTaskList to find an error path, the comments naming the trick but not why it is correct
- Locality, Self-sufficiency: `src/markdown/emit/line-escaping.ts:230` `escapeClosedRuns` / `escapeClaims`: per-character flags in Uint8Arrays and a backward-filled set of backtick lengths, opaque without the spec open
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: an identity-keyed memo deleted on read and filled by the parser and the portable writer, action at a distance
- Locality: `src/markdown/parse/inline-content.ts:330` `closeBracket`: mutable Scan flags set mid-scan and read later, then a call back into the emitter to decide a parse error
- Shape: `src/markdown/emit/inline-line.ts:82` `emitLine`: a retry loop widening a carried index set threaded through nested emitRun calls
- Shape: `src/markdown/portable/inline-reduction.ts:194` `trimmedEdges`: two nested fixpoint loops and a number-or-undefined edge depth

Mid A, hardest first:

- Locality, Self-sufficiency: `src/markdown/emit/line-escaping.ts:142` `escapeClaims` / `escapeClosedRuns`: three passes over a Uint8Array whose conditions tie escaping kind, token kind and position, unverifiable against the spec's prose
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: filled only on an asked call, deleted on any read, so correctness depends on the order two directions call it
- Locality: `src/markdown/parse/markdown-to-adf.ts:237` `splitPath`: stand-in nodes and a re-run split to report an error path
- Locality: `src/markdown/emit/inline-line.ts:82` `emitLine`: a fixpoint loop the parser re-enters through openingLinkTakesDirective
- Shape: `src/markdown/portable/conventions.ts:24` `flavourClaims`: the switch every reader and writer uses lives under portable/
- Shape: `src/markdown/directive-syntax.ts:32` `Read`: the general reader-failure type defined in the directive grammar file

Maintainability senior, hardest first:

- Locality, Overall: `src/markdown/parse/markdown-to-adf.ts:237` `splitPath`: rebuilds a fake task list to place a refusal, correct only by knowing how splitTaskList and splitPlace move children
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:142` `escapeClaims` / `escapeClosedRuns`: four escaping kinds and three special cases at once, complete only against spec §Canonical form
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: a reference-keyed memo with delete-on-read and depth rebasing, called from the parser and the portable reducer
- Shape: `src/markdown/parse/inline-content.ts:443` `resolveNodes` / `pairedHighlights`: parallel pieces and nodes arrays, a cursor advanced inside an index expression, and a seven-way Piece union
- Shape: `src/markdown/portable/conventions.ts:8` `Claims`: sets all three readers' behaviour yet lives under portable/

Inherited architect, would restructure first:

- Shape, Navigation: `src/markdown/portable/conventions.ts:8` `Claims` / `flavourClaims`: the switch for all three flavours filed under the portable directory
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: the parse-to-emit dependency runs through a reference-keyed SpellingMemo shared across calls
- Shape: `src/markdown/parse/markdown-to-adf.ts:143` `quoteNode` / `splitPath`: the portable reader lives in parse/ and reaches back into portable/
- Shape: `src/markdown/emit/adf-to-markdown.ts:157` `spellPortableBlock`: portable-only writing in a file whose name matches neither flavour
- Locality: `src/markdown/emit/line-escaping.ts:260` `unspellableRuns`: the 3am unit, concentrated escaping that needs spec §Canonical form and §Marks open to change safely

## 2026-10-14T13:01:12Z, PR #46 at 1e8fa26, against 06739b40b7e20ae09a36dbc98a8111e81ca6b9c6

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | same | better |
| Inherited architect | better | better | same | better | better |

Mid A, decided by:

- Locality, Shape: `src/adf/inline-nodes.ts:37` `takesMark`: the per-node mark types say which marks each node takes, and one predicate serves the parser and the emitter where each worked it out differently
- Locality: `src/markdown/parse/directive-nodes.ts:138` `readNamedMark`: the caller passes the message it wants instead of cutting text out of another module's message
- Locality: `src/markdown/parse/markdown-to-adf.ts:280` `commonMarkSpellings`: a new hand-kept table the parser must keep in step with the emitter's `commonMarkSpelling`
- Navigation: `src/markdown/emit/inline-line.ts:224` `carries`: "withheld-mark" names the carry the same way as the corpus fixture and the decision index
- Shape: `src/markdown/parse/inline-content.ts:405` `linkPiece`: refusals name the fix, though `marksItem` returning true for a non-node and the hard-break carve-out read a little harder

Inherited architect, decided by:

- Navigation, Self-sufficiency: `README.md:455` `unsupported-node-shape`: each cause sits beside its own remedy, grouped by direction, where one cell held them all
- Locality, Self-sufficiency: `src/adf/inline-nodes.ts:37` `takesMark`: one predicate and a per-type mark list replace a boolean read two ways by the parser and the emitter
- Locality: `src/markdown/parse/directive-nodes.ts:137` `readNamedMark`: the caller passes its message rather than editing another module's text
- Locality: `src/markdown/parse/markdown-to-adf.ts:279` `commonMarkSpellings`: a hand-kept list of the emitter's CommonMark spellings in another file, where the new version rots first
- Shape: `src/markdown/parse/inline-content.ts:294` `marksItem`: reads as a verb phrase and returns true for items no mark lands on
- Locality: `src/markdown/parse/inline-content.ts:400` `linkPiece`: `linkTo`'s destination-ahead-of-hard-breaks branch is right only because `linkPiece` refused every other unlinkable node first, and neither says so
- Navigation: `MIGRATION.md:3` `From 0.2.0 to 0.3.0`: a reader starting from a mark lost after upgrading finds a table and a fixture named after the cause

## 2026-10-14T13:02:45Z, PR #46 at 1e8fa26

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Junior A | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Mid A | 7 | 5 | 6 | 5 | 5.5 |
| Maintainability senior | 7 | 5.5 | 6.5 | 5.5 | 6 |
| Inherited architect | 6.5 | 6 | 5.5 | 7 | 6 |
| Mean | 6.88 | 5.50 | 6.13 | 5.75 | 5.88 |

Junior A, hardest first:

- Self-sufficiency, Overall: `src/markdown/emit/line-escaping.ts:230` `escapeClosedRuns` / `escapeClaims`: three parallel per-character arrays and a backward-built set of backtick lengths, opaque without spec §Canonical form open
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: a memo filled by the parser and the portable reducer and drained by the walk, deleted on read
- Locality: `src/markdown/parse/markdown-to-adf.ts:237` `splitPath`: stand-in nodes and a re-run split to place an error path
- Locality, Shape: `src/markdown/parse/inline-content.ts:449` `resolveNodes` / `pairedHighlights`: placeholder text nodes until a highlight pairs, counters and in-place overwrites
- Shape: `src/markdown/emit/inline-line.ts:82` `emitLine`: a retry loop whose outcome also flows back into the parser

Mid A, hardest first:

- Locality, Overall: `src/markdown/parse/markdown-to-adf.ts:237` `splitPath`: fake taskList and bulletList stand-ins and a probe node re-run through the split to name a path
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:230` `escapeClosedRuns`: why a right-to-left walk suffices lives only in the spec
- Locality: `src/markdown/parse/inline-content.ts:332` `closeBracket` / `truncatePieces`: four sites mutate `scan.pieces` and `deactivatedBefore`
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: filled from the parser and the portable reducer, the clearest action at a distance
- Shape: `src/markdown/portable/inline-reduction.ts:194` `trimmedEdges`: two fixpoint loops with no termination argument and a number-or-undefined edge depth

Maintainability senior, hardest first:

- Self-sufficiency, Overall: `src/markdown/emit/line-escaping.ts:142` `escapeClaims` / `unspellableRuns`: three passes whose sufficiency no statement gives, and an opening-link signal read from segment structure
- Locality: `src/markdown/parse/inline-content.ts:332` `closeBracket` / `resolveNodes`: `Scan` mutated from about ten functions over a three-way `Inline` union
- Locality: `src/markdown/parse/markdown-to-adf.ts:237` `splitPath`: a local simulation of the task-list split, hard to convince oneself is right
- Locality: `src/markdown/emit/adf-to-markdown.ts:127` `readableBlock`: a reference-keyed memo filled across three directories
- Shape: `src/markdown/portable/adf-to-portable-markdown.ts:59` `reduceToPortable`: reruns the reduction on the raw document to get a refusal's path

Inherited architect, would restructure first:

- Navigation, Shape: `src/markdown/portable/conventions.ts:8` `Claims` / `flavourClaims`: the switch for all three flavours filed under portable/
- Navigation: `src/markdown/parse/markdown-to-adf.ts:161` `quoteNode` / `splitPath`: the portable reader lives in parse/ and the portable writer's spellings in `emit/adf-to-markdown.ts:157` `spellPortableBlock`
- Locality: `src/markdown/parse/markdown-to-adf.ts:266` `directiveNode`: the reader asks the writer's `commonMarkSpelling`, and the writer reuses the reader's tokenizer, so neither side changes alone
- Shape: `src/markdown/directive-syntax.ts:32` `Read`: the general reader-failure type housed in the directive grammar file, among 15 loose files in `src/markdown/`
- Shape: `src/markdown/emit/adf-to-markdown.ts:45` `writeMarkdown`: writes both flavours in a file named for the lossless one

## 2026-10-14T19:06:43Z, PR #49 at d8fbff6fde4dbbe28f9d4fb796d8385240d5a445, against 696aca1c717c69c63e1b5dce7e2e2ae78f5b5b8b

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | same | same | better |
| Inherited architect | same | same | worse | same | same |
| Maintainability senior | same | better | same | same | better |
| Junior A | better | same | worse | same | better |

Mid A, decided by:

- Navigation, Locality: `src/adf/inline-nodes.ts:41` `takenMarkTypes` / `takesMark`: the code-text rule lives in one predicate beside the mark table, reached by the parser, the emitter's carry and the portable reducer
- Locality: `src/markdown/parse/inline-content.ts:584` `highlighted`: asks `marksItem` instead of a hand-kept code check
- Locality: `src/markdown/portable/inline-reduction.ts:136` `portableMarks`: drops exactly the marks the reader refuses, by the shared name
- Locality: `src/markdown/emit/inline-line.ts:103` `freshFallbacks`: `carries` no longer shows every reason a node is carried; the set starts pre-filled
- Shape, Self-sufficiency: `src/adf/inline-nodes.ts:40` `takenMarkTypes`: `undefined` means every mark, explained only by its comment; spec says code text takes only `link`

Inherited architect, decided by:

- Shape, Locality: `src/markdown/emit/inline-line.ts:102` `freshFallbacks`: seeds schema carries into a set named for fallbacks, and `carries` no longer says why a node is carried
- Locality: `src/adf/inline-nodes.ts:5` `codeTextMarkTypes`: holds `code` with nothing saying why, and spec/flavour.md says code text takes only `link`
- Locality: `src/adf/inline-nodes.ts:46` `takesMark`: the answer depends on the node's marks at call time, right only because a code span is built with `code` first
- Locality: `src/markdown/parse/inline-content.ts:584` `highlighted`: one table now answers what two hand-written checks did

Maintainability senior, decided by:

- Locality, Overall: `src/adf/inline-nodes.ts:41` `takenMarkTypes` / `takesMark`: one function states the code-text rule the parser and emitter both ask; `undefined` meaning every mark is visible only in its comment
- Locality: `src/markdown/parse/inline-content.ts:587` `highlighted`: routes through `marksItem` instead of a private copy of a schema rule
- Locality: `src/markdown/portable/inline-reduction.ts:146` `portableMarks`: filters by the shared list, but checks `code` itself rather than asking `takesMark`
- Locality: `src/markdown/emit/inline-line.ts:103` `freshFallbacks`: `carries` is right only if the caller seeded the set, and its comment no longer names withheld marks

Junior A, decided by:

- Navigation, Overall: `src/adf/inline-nodes.ts:5` `codeTextMarkTypes`: the code-text rule lives in one table beside the other inline nodes' table
- Shape: `src/adf/inline-nodes.ts:41` `takenMarkTypes`: "taken" reads as accepted or as already held, and `undefined` means every mark
- Shape: `src/markdown/emit/inline-line.ts:103` `freshFallbacks`: named fresh but seeds the carried set, and `carries`'s comment no longer names the withheld-mark carry

## 2026-10-14T20:46:20Z, PR #53 at 787d909, against 498e874

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | better | better | same | better |
| Inherited architect | better | better | better | same | better |

Mid A, decided by:

- Shape: `src/markdown/emit/inline-line.ts:103` `withheldMarkFallbacks`: renamed from `freshFallbacks`, it now says the fallbacks start seeded with every node holding a withheld mark
- Locality: `src/markdown/emit/inline-line.ts:234` `carries`: the comment now names `withheldMarkFallbacks` as where the withheld-mark carries are decided, linking the two units

Inherited architect, decided by:

- Locality, Navigation: `src/markdown/emit/inline-line.ts:234` `carries`: the comment now points at `withheldMarkFallbacks` for the third kind of carry, a hidden dependence made followable
- Shape, Navigation: `src/markdown/emit/inline-line.ts:103` `withheldMarkFallbacks`: the old name `freshFallbacks` hid a pre-seeded set; the new one says what it holds
- Shape: `src/markdown/portable/inline-reduction.ts:84` `mediaLeaves`: three branches, two writing `[alt](url)` by different routes, seen only by reading `portableMarks`
- Self-sufficiency: `src/markdown/portable/inline-reduction.ts:83` `mediaLeaves`: the comment says why an inline image becomes a link, not why the other target goes in parentheses as `image`

## 2026-10-22T19:35:21Z, PR #80 at ff220e6, against 2e06141

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | same | better |
| Inherited architect | better | better | better | same | better |

Mid A, decided by:

- Navigation, Shape: `src/markdown/portable/portable-markdown-to-adf.ts:22` `portableMarkdownToAdf`: the portable reading has its own file, and `parse/markdown-to-adf.ts` shrinks from 394 to 267 lines
- Navigation, Shape: `src/markdown/directive/syntax.ts:1` `directive/`: ten directive files once spread over three directories share one folder
- Navigation, Shape: `.oxlintrc.json:5` `overrides`: lint enforces the layering, and `parse/` reaches `emit/` only through `spelling-questions.ts`
- Navigation, Shape: `src/markdown/flavour.ts:6` `Claims`: the shared claims left a portable-named file for a neutral home
- Locality: `src/markdown/portable/portable-markdown-to-adf.ts:102` `bulletBlocks` / `readTaskBlock`: a refusal's path is found by one marker after the one split, not a replayed split on stand-ins
- Locality: `src/markdown/emit/adf-to-markdown.ts:35` `SpelledBlock`: a list's interruption and kind are fixed when spelled, not re-derived with a taskList special case
- Locality: `src/markdown/commonmark/backtick-runs.ts:11` `backtickCloser`: per-length cursors that need `from` rising add hidden state (counterweight)
- Shape: `src/markdown/emit/adf-to-markdown.ts:26` `FlavourBlockWriters` / `FlavourBlockReaders`: the core now exports internals and a reader follows an injected function (counterweight)

Inherited architect, decided by:

- Locality, Shape: `src/markdown/parse/markdown-to-adf.ts:23` `FlavourBlockReaders` / `ReadAs`: the core reader is flavour-neutral but for two hooks; the callback costs a search to find its supplier
- Locality: `src/markdown/portable/portable-markdown-to-adf.ts:147` `readTaskBlock` / `bulletBlocks`: one marker found by identity replaces `splitPath`'s fake list; `steps.slice(0, -2)` still costs a re-read
- Navigation, Shape: `src/markdown/flavour.ts:1` `Flavour` / `Claims` / `flavourClaims`: what any flavour claims no longer lives in a portable-named file
- Navigation, Shape: `src/markdown/directive/syntax.ts:1` `directive/`: one folder answers where the directive grammar is
- Navigation, Shape: `src/markdown/emit/spelling-questions.ts:1` `spelling-questions`: the one parse→emit dependency is a named seam
- Locality, Shape: `src/markdown/portable/block-spelling.ts:12` `portableBlockWriters`: the emitter loses the portable spellings and re-derives no list facts; the portable file imports five emitter internals back
- Locality: `src/markdown/commonmark/backtick-runs.ts:11` `backtickCloser`: a closure correct only for rising `from`, stated not enforced (against)
- Locality: `src/markdown/parse/blocks.ts:67` `Line.spaces` / `matchBlankLine`: tab remainders in a separate field every site must remember (against)
- Shape: `src/markdown/portable/portable-markdown-to-adf.ts:19` `expandBlockReaders` / `portableBlockReaders`: a swapped reader object replaces the `inExpand` flag, less obvious on first read

## 2026-10-23T01:53:14Z, PR #82 at 8e7da0d, against 33e2a86

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | worse | same | worse |
| Inherited architect | same | worse | same | same | worse |

Mid A, decided by:

- Locality, Shape: `src/markdown/parse/inline-content.ts:264` `assemble`: an (image) leaves a slot through `Scanned.imageLinks`, is dropped by `linkedAlt`, regathered by `linkedImages` and kept apart by `resolvedPieces`; five functions and two recursion levels to follow one image
- Locality: `src/markdown/parse/inline-content.ts:209` `directivePieces`: `inLink` holds only through mark slots, so the mark is read before the slot and a node directive silently resets it
- Shape: `src/markdown/parse/inline-content.ts:58` `Piece`: gains `ImageLink`, `Scanned` becomes `{ imageLinks, pieces }`, and `linkedAlt` now also discards `imageLink` pieces, which its name does not say
- Shape: `src/markdown/mark-spellings.ts:58` `commonMarkLink`: a sixth positional parameter, `escapes`, which the parser always passes as `'lossless'`
- Locality: `src/markdown/portable/inline-reduction.ts:154` `portableLink`: reads easier; it keeps the title and leaves escaping to `spellTitle`, and `imageAside` builds the (image) once

Inherited architect, decided by:

- Locality: `src/markdown/parse/inline-content.ts:209` `directivePieces`: each slot returns its nodes and a list of (image)s still to place, tracked through eight units, and `inLink`'s narrowed meaning lives in one boolean expression
- Locality: `src/markdown/emit/inline-line.ts:69` `tryPipeCell`: the portable flavour skips the pipe check, its safety resting on three guards elsewhere, and the comment names the wrong file for half of it
- Locality: `src/markdown/portable/inline-reduction.ts:154` `portableLink`: reads easier; the reducer only normalizes and escaping stays in `spellTitle`

## 2026-10-26T12:16:45Z, PR #86 at fa00f09e18c478f4049ce7026ebc58645da055ec, against 61a5c073e9a087fd88e58e4a2fd5de90d22a5671

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | same | same | better |
| Inherited architect | same | better | same | same | better |

Mid A, decided by:

- Locality, Navigation: `src/adf/shown-text.ts:60` `shownText`: one switch per question says what each node shows, shared by the portable writer and the HTML carry, where `nodeLeaves` worked it out inline
- Locality: `src/adf/document.ts:53` `writableContent`: every writer takes the shape, version and length checks from one function instead of repeating them
- Navigation, Locality: `src/adf/plain-image.ts:19` `plainImage`: one named predicate answers "is this the plain image" for both formats; `tryImage` shrinks to a lookup
- Navigation: `src/length-bound.ts:4` `longestOutput`: the file and the name now say the bound covers every writer
- Navigation: `src/html/emit/adf-to-html.ts:21` `adfToHtml`: a cold-findable `html/emit/` of small units named for one block kind each, its contract in `spec/html.md`
- Shape: `src/markdown/mark-spellings.ts:40` `linkMark`: seven small converters between three representations of one link; `shownLink` and `linkAttrs` differ only on a non-string title
- Shape: `src/html/emit/carry-element.ts:13` `carriedBlock`: reuses the names `src/markdown/opaque-carry.ts` exports, with other return types
- Shape, Self-sufficiency: `src/html/emit/carry-element.ts:30` `shownBlocks`: a stack walk with `null` sentinels and a threaded `code` field needs its comment and a second read

Inherited architect, decided by:

- Locality, Overall: `src/adf/shown-text.ts:60` `shownText`: what each node shows has one switch per question, shared by the portable writer and the HTML carry, where it was worked out inline in `nodeLeaves`, `cardLeaves` and `mediaLeaves`
- Locality, Overall: `src/adf/document.ts:53` `writableContent`: every writer opens with one call instead of repeating the prologue
- Locality: `.oxlintrc.json:6` the `src/adf/**` and `src/html/**` import bans: `adf/` importing no format, and HTML and markdown not importing each other, is now machine-checked
- Locality: `src/markdown/parse/inline-content.ts:387` `closeBracket`: an explicit bracket stack matches CommonMark's algorithm where a backward scan and `deactivatedBefore` did
- Shape: `src/markdown/mark-spellings.ts:40` `linkMark`: two shapes for one link with converters both ways, and `shownLink` reading a non-string title differently from `linkAttrs`
- Shape: `src/adf/shown-text.ts:7` `isBlockNodeType`: neither it nor `oneLine` is about shown text; the renames to `longestOutput` and `plain-image.ts` balance it
- Navigation: `src/html/emit/carry-element.ts:13` `carriedBlock`: its name, `tryImage` and `linkedText` collide with units in `src/markdown/`, so a symbol search finds two homes
- Self-sufficiency: `src/html/emit/carry-element.ts:30` `shownBlocks`: the densest new unit, a stack with `null` block ends and an inherited `code`; its comments send a reader to the decision log where `spec/html.md` explains it

## 2026-10-28T10:33:35Z, PR #88 at 207bf01, against 240c39a

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | better | worse | same | same |
| Inherited architect | better | worse | better | same | same |

Mid A, decided by:

- Locality: `src/html/block-elements.ts:27` `readListStart`: each element's spelling now sits in a small file beside its reader (`anchor-element.ts`, `image-element.ts`, `language-class.ts`), where 240c39a kept them inside the emitter, so changing one spelling no longer means hunting for its inverse
- Locality: `src/adf/carried-json.ts:24` `carriedValue`: the markdown carry and the HTML carry share three named steps where `readCarriedJson` parsed, bounded and validated inline; `notAString` likewise leaves `markdown-to-adf.ts`
- Shape: `src/html/parse/html-to-adf.ts:248` `readItemLine`: an item's line spreads across `readLineParagraph`, `partedLine`, `asFirstParagraph` and `formRefusals`, with a nested ternary picking the refusal, in a file importing 20 modules
- Shape, Self-sufficiency: `src/html/escaping.ts:14` `misspelling`: four plain `replaceAll` calls became regexes built from an entity map, with a negative lookahead to rebuild in one's head
- Self-sufficiency: `src/html/parse/carry-element.ts:14` `readCarry`: the coupling to `carryContent` is stated where it lives, so `spec/html.md` need not be open
- Shape: `src/html/data-attributes.ts:26` `readDataAttributes`: an optional `leading` parameter and a `previous` sentinel only `nameFault`'s comment explains, and a `respell` default added to `spellsCanonicalJson`

Inherited architect, decided by:

- Locality: `src/html/parse/html-to-adf.ts:234` `readItem`: the writer's list-item layout is copied as string literals into the reader, to change in lockstep with `writeItem` in another directory; `readParagraph` finds an item's first paragraph by order, and line 256 is one ternary of about 300 characters
- Navigation, Shape: `src/html/anchor-element.ts:4` `anchorOpener`: each element's spelling has a file named after the element with its inverse beside it, where 240c39a kept them in a file named for escaping
- Shape: `src/html/emit/adf-to-html.ts:90` `listElement`: tag names and the order check come from `block-elements.ts` instead of inline literals, and `readListStart` is defined by re-running the writer
- Locality: `src/html/carry-content.ts:13` `carryContent`: the writer and the reader's edit check share one function, its comment warning that a change breaks reading
- Locality, Self-sufficiency: `src/html/data-attributes.ts:26` `readDataAttributes`: a `leading` parameter only `<ol start>` uses, with the hardest comments in the change to parse
- Locality: `src/html/carry-attributes.ts:11` `carryJsonOffset`: rebuilds the writer's start-tag prefix to place an error, correct only while `carryAttributes` writes `class` first
- Shape: `src/adf/carried-json.ts:12` `BoundedJson`: a type whose only job is to order three steps, a `respell` hook, and ten small root files in `src/html/`

## 2026-10-28T18:08:02Z, PR #99 at fcc24ad, against 1530666

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | better | same | same | better |
| Inherited architect | same | better | same | better | better |

Mid A, decided by:

- Locality, Overall: `src/markdown/emit/line-escaping.ts:97` `readBack`: the writer reads its escaped line back through the real reader instead of imitating its backtick, emphasis and bracket rules by hand in `escapeClosedRuns`, `unspellableRuns` and `lastLinkClose`
- Locality: `src/markdown/inline-content.ts:103` `SharedScan`: what a directive's content shares with the outer content is one named object, where the base spread it through `Scan` and picked it with `Pick`
- Locality: `src/markdown/commonmark/link-syntax.ts:55` `readInlineTarget`: a mutable memo shared by every link target, filled lazily, where the base read a target as a pure function of its arguments
- Self-sufficiency: `src/markdown/commonmark/link-syntax.ts:76` `destinationEnds`: a stack-based table followed only through its long comment, though the base's equally opaque `escapeClosedRuns` is gone
- Shape, Navigation: `src/markdown/inline-content.ts:121` `parseInlineContent`: moved out of `parse/` now that `emit/` uses it, and takes `openingLinkTakesDirective` as an argument every caller passes the same

Inherited architect, decided by:

- Locality, Self-sufficiency: `src/markdown/emit/line-escaping.ts:97` `readBack`: the writer checks its line through `readLineBack`, so a change to the reader's matching needs no mirror in `emit/`; the `faulted` fallback still leans on its comment
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:136` `withTextEscapes`: with `textOpeners`, states the whole rule, where the base's `escapeClosedRuns` and its `formed` set needed the spec paragraph beside it
- Locality: `src/markdown/emit/line-escaping.ts:271` `unspellableRuns`: asks the reader's emphasis pairing instead of rebuilding delimiter runs and re-running `matchEmphasis`
- Locality: `src/markdown/inline-content.ts:461` `resolveTarget`: one target memo keyed by outermost offsets, shared through `scan.shared`, brings offset arithmetic and a bounds check that depends on how the slot was cut
- Self-sufficiency: `src/markdown/commonmark/link-syntax.ts:76` `destinationEnds`: the densest new code, understandable only through its five-clause comment
- Shape: `src/markdown/inline-content.ts:768` `parseInlineContent`: takes the writer's `openingLinkTakesDirective` as a sixth parameter, and moved out of `parse/` where a reader would look for it

## 2026-10-28T19:34:20Z, PR #100 at 222ad24, against 0003675

Ruling: same

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | same | same | same | same |
| Inherited architect | better | same | same | same | same |

Inherited architect, decided by:

- Navigation: `README.md:730` "Changing the source": names `./ci.sh` and `./mutation-tests/run.sh`, what they need and what fails a run, where the base's README named neither

## 2026-10-29T15:41:57Z, PR #106 at 4246600, against c7bbb04

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | worse | worse | worse |
| Inherited architect | same | worse | worse | same | worse |

Mid A, decided by:

- Locality, Self-sufficiency: `src/markdown/emit/block-text.ts:56` `writtenText`: prefixes recorded in a tree and applied later by a stack walk over `open`, `quotes`, `started` and `'leave'` sentinels, where the base's `quoted` and `tryListItemLines` applied them in place with split, map and join
- Locality, Shape: `src/markdown/emit/block-text.ts:12` `Shape`: eight cached measures kept in step by hand across four constructors, their arithmetic shown equal to the written text only in a test
- Locality: `src/markdown/commonmark/grammar.ts:207` `holdsOnlyRuleCharacters`: a grammar helper carries a contract owned by BlockText, standing in front of `isThematicBreak`
- Locality: `src/markdown/portable/block-spelling.ts:15` `claimsItem`: a `markerOpening` fast path that must agree with two regexes, only a comment saying so
- Shape, Locality: `src/markdown/emit/inline-line.ts:31` `FallbacksPerPass`: a switch whose only second user is a test, threaded through five production functions and changing `droppedRuns`
- Self-sufficiency, Shape: `src/markdown/emit/line-escaping.ts:274` `unspellableRuns`: the cascade through `givesUp` and `mayFlank` needs CommonMark's flanking rules open beside it, where the base returned the first misread pair
- Shape: `src/markdown/emit/inline-line.ts:94` `emitLine`: `linePass`, `takenThisPass` and `checkedCarry` add two concepts to the fallback loop

Inherited architect, decided by:

- Locality, Shape: `src/markdown/emit/block-text.ts:56` `writtenText`: a stack walk with a `'leave'` sentinel and eight hand-kept counters replaces string operations readable where they stood; `prefixedText` with an empty indent stretches its name
- Locality: `src/markdown/portable/inline-reduction.ts:254` `droppedRuns`: which runs drop in one pass is decided twice, by `givesUp` in line-escaping and again by `dropsAlone`, in the code the 3am question lands in
- Shape: `src/markdown/emit/inline-line.ts:31` `FallbacksPerPass`: a test-only mode threaded through production signatures, its `'first'` reading not holding in inline-reduction's highlight drops; `checkedCarry` adds an ordering rule
- Locality: `src/markdown/emit/adf-to-markdown.ts:310` `tryListItemLines`: reads four measures defined in `block-text.ts` where the base checked strings in place
- Locality: `src/markdown/commonmark/grammar.ts:206` `holdsOnlyRuleCharacters`: the grammar module holds a rule that exists only for the emitter's BlockText
- Locality: `src/markdown/portable/conventions.ts:5` `markerOpening`: repeats the `[` the marker regexes encode

## 2026-10-30T11:10:42Z, PR #107 at 430310d, against 41fd106

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | worse | worse | worse |
| Inherited architect | same | worse | worse | worse | worse |

Mid A, decided by:

- Locality, Shape: `src/markdown/emit/line-escaping.ts:294` `unspellableRuns`: a sweep over the shared `PairSweep.fallen`, each verdict reading those settled before it, through helpers that call each other in a web, where the base's one loop called `givesUp`
- Locality: `src/markdown/emit/line-escaping.ts:32` `RunFallback`: the escaper models how each caller takes a run back, the portable reducer's `dropsAlone` reaching it as the `alone` callback, where the base's reducer chose its drops beside its leaves
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:344` `holdsAlike`: its delimiter condition needs the delimiters' spellings known, and the sweep's rule rests on matching one run per pass, which only a property test shows
- Shape: `src/markdown/emit/line-escaping.ts:65` `Standing`: `fallen`, `merging`, `pairAt` and `either` are defined only by one-line comments that use further new terms

Inherited architect, decided by:

- Locality, Shape: `src/markdown/emit/line-escaping.ts:294` `unspellableRuns`: settles pairs outward from the first misread pair, each verdict reading the `fallen` flags settled before it, so one pair's verdict needs the whole sweep's state, where the base's rule was one loop plus `givesUp` and a four-line `mayFlank`
- Shape, Locality: `src/markdown/emit/line-escaping.ts:337` `fallsWithFirst`: calls run about five levels deep through `mayFlank`, `runEdge`, `pairSpellings`, `wordBeside` and `pairStanding`, each taking the whole sweep; `holdsAlike`, `holdsEarlier`, `spansAlike` and `Standing` need their comments, and `pairStanding`'s rule is asserted with no derivation
- Locality: `src/markdown/portable/inline-reduction.ts:223` `spellableLine`: passes `dropsAlone` as a callback through four functions into the escaper's `merging`, splitting one contract across two files
- Locality: `src/markdown/portable/inline-reduction.ts:244` `withoutMarks`: runs may now nest, for a reason that lives in the escaper's sweep
- Self-sufficiency: `src/markdown/emit/line-escaping.ts:336` `fallsWithFirst`: its rule is equivalence to the `'first'` mode, checked only by a property test, and `runEdge` and `wordBeside` need CommonMark's delimiter-run rules beside the code

## 2026-10-31T01:31:04Z, PR #110 at ceebcfb, against e743868

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | better | better | better | worse | better |
| Inherited architect | better | better | better | worse | better |

Mid A, decided by:

- Navigation, Shape: `src/markdown/emit/unspellable-runs.ts:33` `unspellableRuns`: the emphasis-run sweep has its own file; line-escaping.ts holds only escaping
- Locality, Shape: `src/markdown/emit/unspellable-runs.ts:9` `RunFallback`: the drop fallback carries nodes, and dropsAlone sits beside its only consumer
- Shape: `src/markdown/emit/unspellable-runs.ts:30` `Standing`: four named states and shared `touching` replace a bare undefined and two hand-rolled walks
- Locality, Shape: `src/markdown/emit/inline-line.ts:268` `emitLeaf`: leaf spellers return segments, and one place builds and checks every carry
- Locality: `src/markdown/emit/block-text.ts:58` `holdsBlankLine`: callers ask BlockText instead of combining flat fields
- Self-sufficiency: `src/markdown/emit/unspellable-runs.ts:208` `pairStanding`: the reasoning moved to the decision log, so its branches cannot be checked without it open
- Self-sufficiency: `src/markdown/emit/inline-line.ts:48` `readBackPasses`: the 32-pass cap and its carry-all fallback are justified only by a pointer to the decision log

Inherited architect, decided by:

- Navigation, Shape: `src/markdown/emit/unspellable-runs.ts:33` `unspellableRuns`: a mark gone after a round trip now leads to a file whose name says so
- Locality: `src/markdown/portable/inline-reduction.ts:228` `spellableLine`: no closure into the portable reducer's dropsAlone from deep in the emitter
- Locality, Shape: `src/markdown/emit/inline-line.ts:53` `emitInlineLine`: the test-only perPass knob is gone from production signatures, at the price of exports only a test uses
- Shape: `src/markdown/emit/unspellable-runs.ts:191` `touching`: one shared walk, and truer names such as holdsPairBefore and mergingEnds
- Shape: `src/markdown/emit/block-text.ts:13` `FirstLine`: eight flat fields became two grouped records with named predicates
- Self-sufficiency: `src/markdown/emit/unspellable-runs.ts:208` `pairStanding`: five branches whose proof now lives in the decision log
- Self-sufficiency, Locality: `src/markdown/emit/inline-line.ts:48` `readBackPasses`: a magic cap of 32 shared by two retry loops that must agree on giving up

## 2026-10-31T02:06:38Z, PR #111 at b067b88, against de0033c

Ruling: better

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | better | same | better | better |
| Inherited architect | same | same | better | same | better |

Mid A, decided by:

- Self-sufficiency, Overall: `src/adf/inline-nodes.ts:42` `takenMarkTypes`: text takes a named list, so the marks it takes read without the schema open
- Locality: `src/markdown/emit/inline-line.ts:65` `portableLineFallback`: one guard covers both the seeded carries and the emission's

Inherited architect, decided by:

- Shape, Overall: `src/adf/inline-nodes.ts:42` `takenMarkTypes`: `undefined` now means only a node type outside the tables
- Shape: `src/markdown/inline-content.ts:261` `directiveMarkPieces`: this caller overrides `marksItem`'s rule that a non-node is markable, with nothing at the call site saying why

## 2026-10-31T03:20:46Z, PR #112 at 66ad0be, against 8bcf4a5

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | same | same | worse |
| Inherited architect | same | worse | same | same | worse |

Mid A, decided by:

- Locality: `src/markdown/emit/skipped-nodes.ts:15` `spanRuns`: a second copy of `inlineRuns`' run grouping, kept in step only by a comment, editing `spanned` in place while it recurses
- Locality: `src/markdown/portable/inline-reduction.ts:169` `trimmedEdges`: reads each leaf's neighbours from a parallel spanned array, so the portable edge rule depends on the writer's spanning
- Locality: `src/markdown/emit/inline-line.ts:119` `spannedLine`: every pass emits a second, spanned line first and throws it away on a fallback or a portable `!adf:`
- Locality: `src/markdown/emit/skipped-nodes.ts:54` `holdsEmptyMarks`: a one-line exception at the end of a predicate decides whether a node is lent a mark

Inherited architect, decided by:

- Locality: `src/markdown/emit/skipped-nodes.ts:16` `spanRuns`: run grouping in two places that must agree, linked only by a comment naming `inlineRuns`
- Locality: `src/markdown/portable/inline-reduction.ts:169` `trimmedEdges`: models the writer as always spanning, which `spannedLine` does only where the line reads back
- Locality: `src/markdown/emit/inline-line.ts:119` `spannedLine`: refuses a portable span by the `!adf:` prefix of a segment's text, and turns every emission failure into the parted line
- Locality: `src/markdown/emit/skipped-nodes.ts:11` `spanSkippedNodes`: signals nothing spanned by returning the same array, and hides the empty-marks exception from the caller

## 2026-10-31T07:18:17Z, PR #112 at d554e22, against 8bcf4a5

Ruling: worse

| Seat | Navigation | Locality | Shape | Self-sufficiency | Overall |
|---|---|---|---|---|---|
| Mid A | same | worse | worse | same | worse |
| Inherited architect | same | worse | worse | same | worse |

Mid A, decided by:

- Locality, Shape: `src/markdown/emit/inline-line.ts:246` `inlineRuns`: a `spans` flag switches it between two modes, and a mutable `spanEnd` set by `spannedTo` lets one iteration steer later ones
- Shape: `src/markdown/emit/inline-line.ts:230` `emitRun`: picks the behaviour with a bare positional `false`, as `lendMarks` does with `true`
- Locality: `src/markdown/emit/inline-line.ts:291` `spannedNodes`: decides whether anything spanned by object identity, which holds only because `lendMarks` pushes originals and only `withMark` copies
- Locality: `src/markdown/emit/inline-line.ts:108` `linePass`: tries the spanned line first and falls back to the parted line, and `spannedLine` turns every refusal into a quiet `undefined`
- Locality: `src/markdown/portable/inline-reduction.ts:168` `trimmedEdges`: judges edge whitespace against the emitter's `spannedNodes`, so the portable trimming depends on the writer's span rule
- Shape: `src/markdown/emit/inline-line.ts:270` `spannedTo`: one of four new units in a file grown from 390 to 451 lines

Inherited architect, decided by:

- Locality: `src/markdown/emit/inline-line.ts:108` `linePass`: each pass emits two candidate lines, and nothing records which one was written
- Locality: `src/markdown/portable/inline-reduction.ts:168` `trimmedEdges`: imports the emitter's `spannedNodes` with a fresh carried set, so its verdict and the written line can be judged on different node lists
- Shape: `src/markdown/emit/inline-line.ts:246` `inlineRuns`: one function serves two callers through a boolean that `emitRun` always passes as `false`, plus a lookahead cursor
- Shape: `src/markdown/emit/inline-line.ts:271` `spannedTo`: returns `start` to mean "spans nothing", a sentinel its name does not state, beside `spansNode`'s five-condition expression

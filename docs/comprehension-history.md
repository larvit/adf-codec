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

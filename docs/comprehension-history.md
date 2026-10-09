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

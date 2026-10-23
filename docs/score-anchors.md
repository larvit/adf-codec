# Score anchors

Shipped items that anchor each level of L, E and I in `todo.md` (`~/.claude/rules/todo-items.md`).
A level no shipped item shows has no row.

| Level | Items |
|---|---|
| L 1 | 90, 117 |
| L 2 | 102, 120 |
| L 3 | 114, 122 |
| L 4 | 43, 61 |
| E 1 | 62, 103 |
| E 2 | 71, 121 |
| E 3 | 61, 65 |
| I 1 | 92, 126 |
| I 2 | 120, 123 |
| I 3 | 49, 114 |

Why each sits at its level, with its chunk's lines changed as `score-outcomes` measures them:

- L 1, item 90 (6 lines in 2 files): the README's tagline and `package.json`'s description.
- L 1, item 117 (13 lines in 1 file): one decision's wording.
- L 2, item 102 (162 lines in 5 files): the portable task-list split, in its own component.
- L 2, item 120 (87 lines in 4 files): one loop in the block reader, by the linear-time pattern
  items before it set.
- L 3, item 114 (145 lines in 15 files): every reader and both writers.
- L 3, item 122 (285 lines in 9 files): the inline reader, the portable writer and the image module.
- L 4, item 43 (3192 lines in 37 files): a new reader per markdown input, across `src/markdown/`.
- L 4, item 61 (547 lines in 9 files): a new pattern, the writer asking the reader how a line reads
  back, across `emit/` and `parse/`.
- E 1, item 62: a move between directories, which the types, the tests and the import boundaries
  fail on.
- E 1, item 103: one error code folded into another, which the types and the tests fail on.
- E 2, item 71: the README's comparison table, each cell checked by hand against the other package.
- E 2, item 121: a decision's text, which only a reader checks.
- E 3, item 61: its escape walk scans for an inline HTML terminator at every opener, quadratic in
  the text; that shipped in 0.2.0 and item 96 fixed it after.
- E 3, item 65: inside a link's text, its reading drops an image's URL and title; that shipped in
  0.2.0 and item 122 fixed it after.
- I 1, item 92: a working rule in `AGENTS.md`.
- I 1, item 126: the lint config, which only contributors run.
- I 2, item 120: one reader's speed on one list shape.
- I 2, item 123: link titles in one writer.
- I 3, item 49: how every reader parts lists, and the retired `!adf:listBreak` in every consumer's
  stored markdown.
- I 3, item 114: a breaking change to code text in every reader, with a migration for stored
  markdown.

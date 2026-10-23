# Score anchors

To score an item's L, E or I in `todo.md`, compare it with each level's anchors, the shipped items
below, and give it the level whose anchors it matches. E 3, I 4 and I 5 have no row: no shipped
item fits them.

| Level | Items |
|---|---|
| L 1 | 90, 117 |
| L 2 | 102, 120 |
| L 3 | 114, 122 |
| L 4 | 43, 61 |
| E 1 | 62, 103 |
| E 2 | 71, 121 |
| I 1 | 92, 126 |
| I 2 | 120, 123 |
| I 3 | 49, 114 |

Why each sits at its level:

- L 1, item 90 (6 lines changed in 2 files): the README's tagline and `package.json`'s description.
- L 1, item 117 (13 lines in 1 file): one decision's wording.
- L 2, item 102 (162 lines in 5 files): the portable reader's split of a task list, in
  `src/markdown/portable/task-list.ts`.
- L 2, item 120 (87 lines in 4 files): one loop in the block reader, following the linear-time
  pattern earlier items set.
- L 3, item 114 (145 lines in 15 files): every reader and both writers.
- L 3, item 122 (285 lines in 9 files): the inline reader, the portable writer and the image module.
- L 4, item 43 (3192 lines in 37 files): a new reader per markdown flavour, across `src/markdown/`.
- L 4, item 61 (547 lines in 9 files): a new pattern, the writer asking the reader how a line reads
  back, across `emit/` and `parse/`.
- E 1, item 62: a move between directories; a slip in it fails the types, the tests or the import
  boundaries.
- E 1, item 103: one error code folded into another; a slip in it fails the types or the tests.
- E 2, item 71: the README's comparison table, whose cells only a person checks against each of the
  seven packages it compares.
- E 2, item 121: a decision's text, which only review checks.
- I 1, item 92: a working rule in `AGENTS.md`.
- I 1, item 126: the lint config, which only contributors run.
- I 2, item 120: one reader's speed on one list shape.
- I 2, item 123: link titles in one writer.
- I 3, item 49: a breaking change to how every reader parts lists, retiring the `::listBreak`
  separator that consumers' stored markdown held.
- I 3, item 114: a breaking change to code text in every reader, with a migration for stored
  markdown.

# The markdown flavour

The grammar of the extended markdown `adfToMarkdown` emits and `markdownToAdf` parses. Plain
CommonMark is a subset: the flavour adds directives, never changes CommonMark meaning. The emitted
form is contract (AGENTS.md §8). Per-node syntaxes build on this grammar in sections that follow
(todo.md 1b–1c).

## Canonical form

`adfToMarkdown` emits exactly one spelling; every CommonMark variant of the same document
normalizes to it through the round-trip.

- Emphasis `_em_`, strong `**strong**`; `*` replaces `_` only where `_` cannot parse
  (intra-word).
- Bullet lists `- `, two-space continuation indent. Ordered lists incrementing `1.` `2.` `3.`,
  the first number taken from the node's `order` attribute.
- ATX headings (`#` … `######`); setext input normalizes to ATX.
- Code fences ``` with the node's language as info string, the fence lengthened past any backtick
  run in the content; indented-code input normalizes to fences.
- Thematic break `---`.
- Hard break: backslash at end of line (survives editors that trim trailing spaces).
- Links `[text](url)`; `<…>` around a destination containing spaces; title in double quotes;
  `<url>` autolink when the link text equals its destination.
- Paragraphs on one line — no soft wrapping; soft line breaks in input collapse per CommonMark.
- Entity references in input decode to their characters; output backslash-escapes only where text
  would otherwise parse as syntax.
- Blocks separated by one blank line, no trailing whitespace, single trailing newline.

## Directives

One grammar for everything CommonMark lacks. Names are the ADF node names (camelCase).

**Inline**: `:name[content]{attrs}`. `[content]` is inline markdown; each node's section says
whether content and attrs are required. `:` opens a directive only when the name is followed
immediately by `[` or `{` — anything else (`10:30`, `:smile:`) is literal text.

**Container block**:

```
:::name arg {attrs}
block content
:::
```

The fence is three or more colons. `arg` is one optional bare token whose meaning each node
defines (e.g. the panel type). The body is block markdown. The closing fence is a line of at
least the opening's length, and a container's fence is longer than every directive fence line in
its body, so closers are unambiguous — the code-fence rule. Canonical form uses minimal lengths.

**Leaf block**: `::name {attrs}` — a block-position node with no body.

**Attributes**: `{key=value key2="two words"}`. A bare value matches `[A-Za-z0-9_-]+`; anything
else is double-quoted with `\"` and `\\` as the only escapes. All values are strings at the
grammar level; each node's section assigns types. Canonical form orders keys alphabetically and
spells values bare wherever allowed.

**Escaping**: the emitter backslash-escapes a `:` whose text would otherwise parse as a
directive; a backslash before `:` in input always yields a literal colon.

## The opaque carry (AGENTS.md §3)

A node type the library does not know rides as its raw JSON and restores to a deep-equal node:

- **Block position**: a fenced code block with info string `adf`, body = the node's JSON,
  serialized canonically — two-space indent, object keys sorted.
- **Inline position**: `:adf{json="…"}`, same serialization, quote-escaped.

The info string `adf` is reserved: a genuine `codeBlock` whose `language` is exactly `adf` is
itself emitted through the opaque carry, so the reservation stays absolute and stays lossless.

## Raw HTML in input

CommonMark input may contain raw HTML. `markdownToAdf` routes each construct through the foreign
HTML element mapping (AGENTS.md §3; specified with the HTML dialect, todo.md milestone 6) — ADF
has no raw-HTML node, so a construct without a mapping, comments and processing instructions
included, is an error result naming it. The flavour never emits raw HTML.

# The markdown flavour

The grammar of the extended markdown `adfToMarkdown` emits and `markdownToAdf` parses. Plain
CommonMark is a subset with one carve-out: literal text that matches directive syntax below is
claimed by the flavour (escape the `:` to keep it literal). The emitted form is contract
(AGENTS.md §8). Per-node syntaxes build on this grammar in sections that follow (todo.md 1b–1c).

## Canonical form

`adfToMarkdown` emits exactly one spelling; every CommonMark variant of the same document
normalizes to it through the round-trip.

- Emphasis `_em_`, strong `**strong**`; `*` replaces `_` only where `_` cannot parse
  (intra-word).
- Bullet lists `- `; ordered lists incrementing `1.` `2.` `3.`, the first number taken from the
  node's `order` attribute. Continuation lines align with the first character after the marker
  (two spaces for `- `, three for `1. `). Lists are tight — blank lines between items normalize
  away; ADF does not record tightness.
- Blockquotes prefix every line with `> `.
- ATX headings (`#` … `######`); setext input normalizes to ATX.
- Code fences ``` with the node's language as info string, the fence lengthened past any backtick
  run in the content; indented-code input normalizes to fences.
- Thematic break `---`.
- Hard break: backslash at end of line (survives editors that trim trailing spaces).
- Links `[text](url)`; `<…>` around a destination containing spaces; title in double quotes.
  `<url>` autolink form only when the text equals the destination and the destination is a valid
  CommonMark autolink (absolute URI).
- Paragraphs on one line — no soft wrapping; soft line breaks in input collapse per CommonMark.
- Entity references in input decode to their characters; output backslash-escapes only where text
  would otherwise parse as syntax.
- Blocks separated by one blank line, no trailing whitespace, single trailing newline.

## Directives

One grammar for everything CommonMark lacks. A directive name is `[a-z][A-Za-z0-9]*` — the ADF
node names. Recognition is syntactic and name-set-independent: anything matching the forms below
parses as a directive regardless of whether the name is known, and an unknown name is an error
result naming it — so output an old emitter escaped stays escaped, and erroring input gaining
meaning later is MINOR, never a reparse (§8). The name `adf` is reserved for the opaque carry, as
both directive name and fence info string.

**Inline**: `:name[content]{attrs}`, on one line — an inline directive never spans lines.
`[content]` is inline markdown; brackets inside balance as in CommonMark link text, `\]` for a
literal bracket. Each node's section says whether content and attrs are required. `:` opens a
directive only when the name is followed immediately by `[` or `{`, and `{attrs}` must follow
`]` (or the name) with no gap — anything else (`10:30`, `:smile:`, a stray `{…}` in text) is
literal text.

**Container block**:

```
:::name arg {attrs}
block content
:::
```

The fence is three or more colons. `arg` is one optional bare token whose meaning each node
defines (e.g. the panel type). The body is block markdown. The closing fence is a line of at
least the opening's length, and a container's fence is longer than every directive fence line in
its body — counting only lines that parse as directive fences in the body's block structure; a
colon run inside a code fence or opaque carry is content. Canonical form uses minimal lengths.

**Leaf block**: `::name {attrs}` — a block-position node with no body.

**Attributes**: `{key=value key2="two words"}`. A bare value matches `[A-Za-z0-9_-]+`; any other
value is double-quoted with JSON string escaping (`\"` `\\` `\n` `\t` `\uXXXX`, …) — total over
Unicode, and raw newlines never appear inside quotes. All values are strings at the grammar
level; each node's section assigns types. Canonical form orders keys alphabetically, spells
values bare wherever allowed, and inside quotes escapes only what it must, using the shortest
escape form.

**Escaping**: the emitter backslash-escapes whatever literal text would otherwise parse as
directive syntax — the leading `:` of a would-be directive, `]` inside content; a backslash
before `:` in input always yields a literal colon.

**Malformed directives are error results**, named: an unclosed container at end of input, a body
fence line of the container's length or longer, unparseable or duplicate-keyed attrs, invalid
JSON in an opaque carry. Never a silent literal-text fallback — a typo that reparses as prose is
the silent loss §2 refuses.

## The opaque carry (AGENTS.md §3)

A node type the library does not know rides as its raw JSON and restores to a deep-equal node.
Block and inline positions canonicalize differently, each fitting where it sits:

- **Block position**: a fenced code block with info string `adf`, body = the node's JSON —
  two-space indent, object keys sorted.
- **Inline position**: `:adf{json="…"}` — compact serialization (keys sorted, no whitespace),
  JSON-string-escaped into the attribute.

The info string `adf` is reserved: a genuine `codeBlock` whose `language` is exactly `adf` is
itself emitted through the opaque carry, so the reservation stays absolute and stays lossless.

## Raw HTML in input

CommonMark input may contain raw HTML. `markdownToAdf` routes each construct through the foreign
HTML element mapping (AGENTS.md §3; specified with the HTML dialect, todo.md milestone 6) — ADF
has no raw-HTML node, so a construct without a mapping, comments and processing instructions
included, is an error result naming it. The flavour never emits raw HTML.

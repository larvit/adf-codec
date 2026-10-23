# The HTML dialect

The HTML `adfToHtml` writes: semantic elements for the nodes and marks below, and the carry element
for every other node (`docs/decisions.md` §The HTML dialect). The written form is contract
(`docs/decisions.md` §The formats are API).

## Blocks

One block a line: blocks are separated by a line feed, and a document holding any ends with one. A
document whose `content` is an empty array is the empty string.

| ADF | HTML |
| --- | --- |
| `paragraph` | `<p>…</p>` |
| `heading`, `level` 1 to 6 | `<h1>…</h1>` to `<h6>…</h6>` |
| `blockquote` | `<blockquote>`, a line feed, its blocks, a line feed, `</blockquote>` |
| `bulletList` | `<ul>`, a line feed, its items a line each, a line feed, `</ul>` |
| `orderedList` | as `bulletList` with `<ol>`; `<ol start="3">` for an `order` of 3, a safe integer other than `-0`; no `start` where the list holds no `order` |
| `listItem` | `<li>…</li>`: a first paragraph holding content and no attribute bare, its inline content straight after `<li>`, then each other block after a line feed and a line feed before `</li>`; with no bare paragraph, `<li>`, a line feed, its blocks, a line feed, `</li>` |
| `codeBlock` | `<pre><code class="language-js">…</code></pre>`, the language one token holding no whitespace; no `class` where it holds no `language` |
| `rule` | `<hr>` |
| `mediaSingle`, centered, holding one external `media` | `<p><img src="…" alt="…"></p>`, no `alt` where the media holds none; `<p><a href="…"><img …></a></p>` where a link marks it |

A container holding no `content` key is its element holding nothing: `<blockquote></blockquote>`,
`<ul></ul>`, `<li></li>`; so is a paragraph or heading, `<p></p>`.

Every other attribute its type holds (`spec/flavour.md` §Block nodes) is a `data-*` attribute on the
element, named as HTML's `dataset` names it, `localId` as `data-local-id`, after the element's own
attributes and sorted by name. A string is its value; any other value is its JSON, compact:
`<ol start="3" data-local-id="91177a27-b0ff">`, `<pre data-wrap="true"><code>`. A code block's
`data-*` attributes stand on its `<pre>`.

## Inline

| ADF | HTML |
| --- | --- |
| `text` | its text, escaped |
| `em`, `strong`, `code` | `<em>`, `<strong>`, `<code>` around the text |
| `link`, holding `href` and an optional `title` | `<a href="…" title="…">` around the text |
| `hardBreak` | `<br>` |

A text node's marks nest in the order its `marks` array lists them, the first outermost:
`<strong><em>manual</em></strong>`. Each text node writes its own elements, so two text nodes a link
marks are two `<a>` elements.

## Escaping

Text and attribute values escape `&`, `<`, `>` and `"` as `&amp;`, `&lt;`, `&gt;` and `&quot;`.
Attribute values are double-quoted. A link's `href` and an image's `src` are the URL as the ADF
holds it, whatever its scheme (`docs/decisions.md` §HTML writes a URL as the ADF holds it, whatever
its scheme).

HTML text and attribute values cannot hold a carriage return, which a parser reads as a line feed,
a control other than a tab, line feed or form feed, a noncharacter, or a lone surrogate, which
UTF-8 cannot encode (WHATWG HTML §13.1.3). A node holding one in a value its element writes rides
the carry.

## The carry element

A node the sections above cannot write where it stands is the carry element: `<div>` in block
position, `<span>` inline, of class `adf-carry`, holding the node's JSON in `data-adf` and showing
its content. A carry element may hold a node the sections above write, as the markdown carry may:
it reads back as the node it holds, so HTML stored while a node rode the carry reads the same once a
later release writes it as its own element.

```html
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelType&quot;:&quot;info&quot;},…,&quot;type&quot;:&quot;panel&quot;}"><p>Read the <a href="https://spec.commonmark.org/">CommonMark spec</a> first.</p><p>Then import.</p></div>
<p>Ask <span class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;id&quot;:&quot;5b10a2&quot;,&quot;text&quot;:&quot;@Mikael&quot;},&quot;type&quot;:&quot;mention&quot;}">@Mikael</span></p>
```

- `data-adf` holds the node's JSON compact, keys sorted, as `!adf:carry` does in markdown, its type
  included, each character HTML cannot hold spelled as a JSON escape, `\u0085`. A document holding
  no `content` key is the block carry of `{"type":"doc","version":1}`.
- The content shown is every text node's text below the node, and what a node holding no text shows
  in its place: a mention's text, else `@` and its id; an emoji's text, else its `shortName`; a
  status's text; a date as `2026-09-13` in UTC; a card's URL, else its name, else the URL its data
  holds; media's `alt`, else an external one's URL; an extension's text; an expand's title.
  - In a `<div>`, each block's content is a `<p>`; in a `<span>`, `<br>` parts two blocks'.
  - A hard break and a line feed in text are `<br>`.
  - Text a link marks is `<a href="…" title="…">` around it, and a card or an external image is a
    link to its URL.
  - A node referencing what it cannot show is a note naming it, `<em>(image)</em>`: `image` for
    media with no `alt` or URL, `link card` for a card with neither URL nor name, an extension's
    key, else `extension`, for an extension with no text, and `synced block` for a `syncBlock`.
  - Characters HTML cannot hold are dropped.
- A node rides the carry where it holds a mark or a key its element does not write, an attribute
  its type does not hold as that kind, an empty `attrs`, `content` or `marks`, or a value its
  element cannot hold:
  - text holding no character, or a character HTML cannot hold; text holding a mark twice, or a
    mark with attributes besides a link's `href` and `title`;
  - an unmarked text node straight after another, which would read back as one;
  - a link whose `href` or `title` holds a character HTML cannot hold, and an image whose `url` or
    `alt` holds one or whose link's `href` or `title` does;
  - a heading whose `level` is not 1 to 6, and an ordered list whose `order` is not a safe integer
    or is `-0`;
  - a code block holding more than one text node, a marked one, or a language holding whitespace;
  - a rule or hard break holding `content`;
  - a list holding a node that is no `listItem`, or an item holding a mark, text, an empty key or
    an attribute its type does not hold: the whole list rides the carry;
  - a `listItem` outside a list, an inline node in block position and a block node inline.
- A block carry's JSON nests at most 500 levels less the depth it stands at, an inline carry's at
  most 500, as in markdown.

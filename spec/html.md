# The HTML dialect

The HTML `adfToHtml` writes: semantic elements for the nodes and marks below, and the carry element
for every other node (`docs/decisions.md` §The HTML dialect). The written form is contract
(`docs/decisions.md` §The formats are API).

## Blocks

Blocks are separated by a line feed, and a document holding any ends with one. A document whose
`content` is an empty array is the empty string.

| ADF | HTML |
| --- | --- |
| `blockquote` | `<blockquote>`, a line feed, its blocks, a line feed, `</blockquote>` |
| `bulletList` | `<ul>`, a line feed, its items a line each, a line feed, `</ul>` |
| `codeBlock` | `<pre><code class="language-js">…</code></pre>`, the language one token holding no ASCII whitespace (a tab, line feed, form feed, carriage return or space); no `class` where it holds no `language` |
| `heading`, `level` 1 to 6 | `<h1>…</h1>` to `<h6>…</h6>` |
| `listItem` | its first paragraph straight after `<li>`: bare where it holds content and no attribute, `<li>Bolt</li>`, and as its `<p>` element where it holds an attribute, `<li><p data-local-id="p1">Bolt</p></li>`; where other blocks follow, each after a line feed, and a line feed before `</li>`. Where the first block is no paragraph, holds neither content nor an attribute, or rides the carry: `<li>`, a line feed, its blocks, a line feed, `</li>` |
| `mediaSingle`, centered, holding one external `media` | `<p><img src="…" alt="…"></p>`, no `alt` where the media holds none; `<p><a href="…"><img …></a></p>` where a link marks it |
| `orderedList` | as `bulletList` with `<ol>`; `<ol start="3">` for an `order` of 3, a safe integer other than `-0`; no `start` where the list holds no `order` |
| `paragraph` | `<p>…</p>` |
| `rule` | `<hr>` |

A container holding no `content` key is its element holding nothing: `<blockquote></blockquote>`,
`<ul></ul>`, `<li></li>`; so is a paragraph or heading, `<p></p>`.

On a paragraph, heading, quote, list, list item, code block or rule, each attribute its type holds
(`spec/flavour.md` §Block nodes) that the element does not write as `level`, `order` or `language`
is a `data-*` attribute, named as HTML's `dataset` names it, `localId` as `data-local-id`, after the
element's own attributes and sorted by name. A string is its value; any other value is its JSON,
compact: `<ol start="3" data-local-id="91177a27-b0ff">`, `<pre data-wrap="true"><code>`. A code
block's `data-*` attributes stand on its `<pre>`.

## Inline

| ADF | HTML |
| --- | --- |
| `em`, `strong`, `code` | `<em>`, `<strong>`, `<code>` around the text |
| `hardBreak` | `<br>` |
| `link`, holding `href` and an optional `title` | `<a href="…" title="…">` around the text |
| `text` | its text, escaped |

A text node's marks nest in the order its `marks` array lists them, the first outermost:
`<strong><em>manual</em></strong>`. Each text node writes its own elements, so two text nodes a link
marks are two `<a>` elements.

## Escaping

Text and attribute values escape `&`, `<`, `>` and `"` as `&amp;`, `&lt;`, `&gt;` and `&quot;`.
Attribute values are double-quoted. Every URL is written as the ADF holds it, whatever its scheme
(`docs/decisions.md` §HTML writes a URL as the ADF holds it, whatever its scheme): a link's `href`,
an image's `src`, and the `href` of each link a carry element shows.

HTML text and attribute values cannot hold these (WHATWG HTML §13.1.3): any control but a tab, line
feed or form feed, so a carriage return too, which a parser reads as a line feed; a noncharacter;
and a lone surrogate, which UTF-8 cannot encode. A node holding one in a value its element writes
rides the carry.

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
  in its place: a mention's text, else `@` and its id where it has one; an emoji's text, else its
  `shortName`; a status's text; a date as `2026-09-13` in UTC; a card's URL, else its name, else the
  URL its data holds; media's `alt`, else an external one's URL; an extension's text; an expand's
  title.
  - In a `<div>`, each block's content is a `<p>`, and a code block's is
    `<pre><code class="language-js">…</code></pre>`, keeping its line feeds and spaces. The `<code>`
    takes the class the code block's own element takes, and none where the language is not one
    token free of ASCII whitespace. In a `<span>`, a `<br>` parts each block's content from the
    next.
  - A hard break is `<br>`, and so is a line feed in text outside a `<div>`'s code block.
  - Text a link marks is `<a href="…" title="…">` around it, or the text alone where HTML cannot
    hold the link's `href` or `title`. A card is a link to the target of a link marking it, else to
    its URL.
  - An external image with no link to another target is a link to its URL. An image marked by a
    link to another target shows as portable markdown writes it inline. First comes the link,
    around the image's `alt`, else the link's target, else the image's URL. Then comes ` (image)`,
    the word `image` linking to the image:
    `<a href="https://example.com/">The moon</a> (<a href="https://example.com/moon.jpg">image</a>)`.
  - A node referencing what it cannot show is a note naming it, `<em>(image)</em>`: `image` for
    media with no `alt` or URL, `link card` for a card with neither URL nor name, an extension's
    key, else `extension`, for an extension with no text, and `synced block` for a `syncBlock`. A
    link marking the node goes around the note: `<a href="…"><em>(image)</em></a>`.
  - Characters HTML cannot hold are dropped.
- A node rides the carry where it holds a mark or a key its element does not write, an attribute
  its type does not hold as that kind, an empty `attrs`, `content` or `marks`, or a value its
  element cannot hold:
  - text holding no character, or a character HTML cannot hold; text holding a mark twice, or a
    mark with attributes besides a link's `href` and `title`;
  - an unmarked text node straight after one written as plain text, which would read back as one;
  - a link whose `href` or `title` holds a character HTML cannot hold, and an image whose `url` or
    `alt` holds one or whose link's `href` or `title` does;
  - an image holding an attribute besides its `center` layout and its media's `type`, `url` and
    non-empty `alt`;
  - a heading whose `level` is not 1 to 6, and an ordered list whose `order` is not a safe integer
    or is `-0`;
  - a code block holding more than one text node, a marked one, or a language holding ASCII
    whitespace;
  - a rule or hard break holding `content`, and a hard break holding an attribute;
  - a list holding a node that is no `listItem`, or an item holding a mark, text, an empty key or
    an attribute its type does not hold: the whole list rides the carry;
  - a `listItem` outside a list, an inline node in block position and a block node inline.
- A block carry's JSON nests at most 500 levels less the depth it stands at, an inline carry's at
  most 500, as in markdown.

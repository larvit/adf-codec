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
| `orderedList` | as `bulletList` with `<ol>`; `<ol start="3">` for an `order` of 3, a safe integer; no `start` where the list holds no `order` |
| `listItem` | `<li>…</li>`: a first paragraph holding content bare, its inline content straight after `<li>`, then each other block after a line feed and a line feed before `</li>`; with no bare paragraph, `<li>`, a line feed, its blocks, a line feed, `</li>` |
| `codeBlock` | `<pre><code class="language-js">…</code></pre>`, the language one token holding no whitespace; no `class` where it holds no `language` |
| `rule` | `<hr>` |
| `mediaSingle`, centered, holding one external `media` | `<p><img src="…" alt="…"></p>`, no `alt` where the media holds none; `<p><a href="…"><img …></a></p>` where a link marks it |

A container holding no `content` key is its element holding nothing: `<blockquote></blockquote>`,
`<ul></ul>`, `<li></li>`; so is a paragraph or heading, `<p></p>`.

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

Text and attribute values escape `&`, `<`, `>` and `"` as `&amp;`, `&lt;`, `&gt;` and `&quot;`,
and a carriage return as `&#13;`, which an HTML parser would otherwise read as a line feed.
Attribute values are double-quoted.

## The carry element

A node the sections above cannot write where it stands is the carry element: `<div>` in block
position, `<span>` inline, of class `adf-carry`, holding the node's JSON in `data-adf` and showing
the node's text.

```html
<div class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;panelType&quot;:&quot;info&quot;},…,&quot;type&quot;:&quot;panel&quot;}">Check the collation.</div>
<p>Ask <span class="adf-carry" data-adf="{&quot;attrs&quot;:{&quot;id&quot;:&quot;5b10a2&quot;,&quot;text&quot;:&quot;@Mikael&quot;},&quot;type&quot;:&quot;mention&quot;}">@Mikael</span></p>
```

- `data-adf` holds the node's JSON compact, keys sorted, as `!adf:carry` does in markdown, its type
  included. A document holding no `content` key is the block carry of `{"type":"doc","version":1}`.
- The text shown is every text node's text below the node, and what a node holding no text shows
  in its place: a mention's text, else `@` and its id; an emoji's text, else its `shortName`; a
  status's text; a date as `2026-09-13` in UTC; a card's URL, else its name, else the URL its data holds; media's `alt`, else an
  external one's URL; an extension's text; an expand's title. A line feed parts two blocks and
  stands for a hard break. Null characters are dropped.
- A node rides the carry where it holds an attribute, mark or key its element does not write, an
  empty `attrs`, `content` or `marks`, or a value its element cannot hold:
  - text holding no character, or a null character, which HTML cannot hold; text holding a mark
    twice, or a mark with attributes besides a link's `href` and `title`;
  - an unmarked text node straight after another, which would read back as one;
  - a link or an image whose URL a browser would run or read as a file: a `javascript:`,
    `vbscript:` or `file:` URL, or `data:` other than a PNG, GIF, JPEG or WebP image, read after
    dropping tabs and line breaks and a leading control character or space (`docs/decisions.md`
    §A URL a browser would run is carried, never written);
  - a code block holding more than one text node, a marked one, or a language holding whitespace;
  - a list holding a node that is no `listItem`, or an item holding attributes or marks: the whole
    list rides the carry;
  - a `listItem` outside a list, an inline node in block position and a block node inline.
- A block carry's JSON nests at most 500 levels less the depth it stands at, an inline carry's at
  most 500, as in markdown.

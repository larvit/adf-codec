# Announcement posts for 0.3.0

Drafts for the maintainer to post, one per place. The Turndown sample under Topic 96176 ran against
`0.3.0` on 2026-11-05.

Delete this file once the posts are out.

## jira.atlassian.com

### JRACLOUD-77436, "Provide a public REST API endpoint to convert between ADF, HTML, Markup and Markdown"

Plain text, so it pastes into Jira's comment editor whatever its mode.

> For those who need the conversion now, in Node, Forge or a browser: `@larvit/adf-codec` converts
> markdown to ADF and ADF to markdown or HTML, with no Atlaskit, no React and no dependencies. The
> Atlaskit transformer's `encode` throws "This is not implemented yet"; here `adfToPortableMarkdown`
> and `adfToLosslessMarkdown` write the markdown, and `losslessMarkdownToAdf` reads the lossless one
> back to the same document, panels, mentions, statuses and unknown node types included. Every call
> returns a result and never throws. Wiki markup is not covered. I maintain it.
>
> https://github.com/larvit/adf-codec
> How it compares with the other npm packages, run on their published code:
> https://github.com/larvit/adf-codec#other-adf-converters
>
> It is JavaScript, so it doesn't answer the Python request above.

## Atlassian developer community

### Topic 96176, "Is there a way to convert from HTML to ADF using TypeScript on NodeJS?"

> The Turndown route above stops where the Atlaskit packages won't import as ESM, as you found. I maintain [`@larvit/adf-codec`](https://github.com/larvit/adf-codec),
> which reads markdown into ADF with no Atlaskit, no React and no dependencies, as ESM that runs in
> Node, Forge and browsers. It takes the place of the Atlaskit transformer in that route:
>
> ```ts
> import TurndownService from 'turndown'
> import { portableMarkdownToAdf } from '@larvit/adf-codec'
>
> const markdown = new TurndownService({ headingStyle: 'atx' }).turndown(html)
> const adf = portableMarkdownToAdf(markdown) // { ok: true, value: <ADF doc> } or { ok: false, error }
> ```
>
> A call returns a result and never throws. `htmlToAdf` reads only the HTML that its own `adfToHtml`
> writes, so arbitrary HTML still goes through markdown first. It also writes ADF back out as
> markdown or HTML. [How it compares with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters),
> run on their published code.

### Topic 99408, "HTML to ADF Conversion"

> If you can write the content as markdown, or turn the HTML into markdown first, an ADF body is one
> call: `portableMarkdownToAdf(markdown)` from [`@larvit/adf-codec`](https://github.com/larvit/adf-codec)
> (I maintain it) returns `{ ok: true, value }` with a document you can send as `description`, and
> `{ ok: false, error }` with a line and a node path when the input is wrong. For HTML, run it
> through Turndown first. The package has no dependencies and runs in Node, Forge and browsers.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

### Topic 82496, "Converting to ADF(Atlassian Document Format)"

> A package now does the markdown to ADF part in Node, Forge and browsers without Atlaskit:
> [`@larvit/adf-codec`](https://github.com/larvit/adf-codec), which I maintain.
> `portableMarkdownToAdf(markdown)` reads CommonMark plus GFM's tables, task lists and alerts, and
> returns the document or an error naming the line. ADF out to markdown or HTML works too, and
> `adfToLosslessMarkdown` followed by `losslessMarkdownToAdf` gives back the document it started
> from. HTML in is not general: turn it into markdown first, for example with Turndown.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

### Topic 86214, "Add a comment in Rovo action"

> The Atlaskit transformers can't be used in the Forge backend, but a plain function can:
> [`@larvit/adf-codec`](https://github.com/larvit/adf-codec) (I maintain it) turns the markdown an
> agent writes into a valid ADF comment body, with no Atlaskit, no React and no dependencies:
> `const body = portableMarkdownToAdf(markdown)`, then send `body.value` as the comment's `body`
> when `body.ok`. Headings, lists, tables, code blocks, links and marks all come out as ADF nodes and marks,
> and an invalid input returns an error instead of throwing.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

### Topic 100699, "Guidance on unmaintained markdown-confluence project"

> To the question of what else converts markdown to ADF and back: [`@larvit/adf-codec`](https://github.com/larvit/adf-codec),
> which I maintain. It is a library, so it doesn't publish to Confluence or ship an Obsidian plugin.
> It reads markdown into ADF (CommonMark, GFM tables, task lists and alerts, Obsidian callouts) and
> writes ADF back as markdown, and `adfToLosslessMarkdown` with `losslessMarkdownToAdf` gives back the original document, panels,
> mentions, statuses, macros and node types it doesn't know included. Models can edit that markdown,
> since it is markdown, which suits the MD to ADF need for LLMs mentioned above.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

### Topic 101278, "Rovo MCP Server: no attachment-upload tool, and `description` drops ADF media nodes on edit"

> I can't change what the server accepts, but a client that reads ADF over REST can avoid the loss
> itself. [`@larvit/adf-codec`](https://github.com/larvit/adf-codec) (I maintain it) writes ADF as
> markdown in which media nodes, mentions, panels, statuses and macros are kept as `!adf:` lines and
> node types it doesn't know as fenced JSON, and reads that markdown back to the same document. The
> model edits the markdown, and `losslessMarkdownToAdf` gives ADF to send with the REST API, with the
> media node still in it.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

## GitHub, `atlassian/atlassian-mcp-server`

Both issues are closed. Post only if you want to; the maintainers answered #161 with an HTML format
of their own.

### Issue 60, "Editing content via Rovo MCP causes the loss of all ADF-rich content"

> For anyone building their own client around this problem: [`@larvit/adf-codec`](https://github.com/larvit/adf-codec)
> (I maintain it) writes ADF as markdown that keeps Smart Links, mentions, dates, statuses, panels,
> expands, task lists, media, layouts, extensions and node types it doesn't know, and reads the
> edited markdown back to ADF. An unedited document comes back deep-equal. It has no dependencies
> and runs in Node, Deno, Bun and browsers.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

### Issue 161, "Lossless markdown round-trip for Confluence macros and large-page support via file-path parameter"

> The first proposal, macros surviving a markdown round-trip, is what [`@larvit/adf-codec`](https://github.com/larvit/adf-codec)
> (I maintain it) does for any client: `adfToLosslessMarkdown` writes a macro as an `!adf:extension` or
> `!adf:bodiedExtension` directive holding its key, type and parameters, and `losslessMarkdownToAdf` restores it exactly.
> [Comparison with the other npm packages](https://github.com/larvit/adf-codec#other-adf-converters).

## Left out

- Topic 96638 (a heading in a comment through the Atlassian CLI): the failure is the CLI's, not a
  conversion.
- Stack Overflow: the questions found are from 2021 to 2024, answered, and in PHP and C#,
  which this JavaScript package doesn't serve: 74559262 (HTML to ADF), 74547915 (ADF to HTML, whose
  answer is `expand=renderedFields`), 71693304 (parsing ADF in C#), 72553636, 68102225 and 78261178.
  None asks for ADF to markdown. A new question with its own answer would be the way in, if you want one.

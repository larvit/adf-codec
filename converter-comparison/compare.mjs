import * as adf2markdown from "adf2markdown";
import * as adfCodec from "@larvit/adf-codec";
import * as adfConverter from "adf-converter";
import * as adfMd from "adf-md";
import * as adfToMarkdown from "adf-to-markdown";
import adfToMd from "adf-to-md";
import * as atlaskitJson from "@atlaskit/editor-json-transformer";
import * as atlaskitMarkdown from "@atlaskit/editor-markdown-transformer";
import { createRequire } from "node:module";
import * as extendedParser from "extended-markdown-adf-parser";
import * as faulander from "@faulander/md2adf";
import { fromADF } from "mdast-util-from-adf";
import * as githubMarkdownAdf from "github-markdown-adf";
import { isDeepStrictEqual } from "node:util";
import { loadAdf4j } from "@nthings.dev/adf4j-wasm";
import * as markdownToAdf from "markdown-to-adf";
import { markdownToJiraBlock } from "@wrtnlabs/markdown-to-adf";
import * as marklassian from "marklassian";
import * as mdAdf from "md-adf";
import mdToAdf from "md-to-adf";
import { toMarkdown as mdastToMarkdown } from "mdast-util-to-markdown";
import { readFileSync } from "node:fs";

const { defaultSchema } = createRequire(import.meta.url)("@atlaskit/adf-schema/schema-default");

const roundTripDoc = {
  type: "doc", version: 1, content: [
    { type: "paragraph", content: [
      { type: "text", text: "bold italic", marks: [{ type: "strong" }, { type: "em" }] },
      { type: "text", text: " and " },
      { type: "text", text: "a link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
      { type: "text", text: " hi " },
      { type: "mention", attrs: { id: "abc", text: "@Ann" } },
      { type: "text", text: " state " },
      { type: "status", attrs: { color: "green", localId: "s1", text: "DONE" } },
    ] },
    { type: "panel", attrs: { panelType: "info" }, content: [{ type: "paragraph", content: [{ type: "text", text: "note" }] }] },
    { type: "bulletList", content: [
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
    ] },
  ],
};
const unknownNodeDoc = {
  type: "doc", version: 1, content: [
    { type: "paragraph", content: [{ type: "text", text: "before" }] },
    { type: "futureThing", attrs: { x: 1 }, content: [{ type: "paragraph", content: [{ type: "text", text: "inside" }] }] },
    { type: "paragraph", content: [{ type: "text", text: "after" }] },
  ],
};
const markdown = "***bold italic*** and [a link](https://example.com) hi @Ann\n\n> note\n\n- one\n- two\n";

const extended = new extendedParser.Parser();
const json = new atlaskitJson.JSONTransformer();
const atlaskit = new atlaskitMarkdown.MarkdownTransformer(defaultSchema);
const adf4j = await loadAdf4j();
const reported = (result) => {
  for (const diagnostic of result.diagnostics) console.log("diagnostic:", JSON.stringify(diagnostic));
  return result.value;
};
const succeeded = (result) => {
  if (result.type !== "Success") throw new Error(JSON.stringify(result));
  return result.value;
};
const converters = {
  "@atlaskit/editor-markdown-transformer": {
    toAdf: (md) => json.encode(atlaskit.parse(md)),
    toMarkdown: (doc) => atlaskit.encode(json.parse(doc)),
  },
  "@faulander/md2adf": {
    toAdf: (md) => faulander.markdownToAdf(md),
    toMarkdown: (doc) => faulander.adfToMarkdown(doc),
  },
  "@larvit/adf-codec": {
    toAdf: (md) => adfCodec.losslessMarkdownToAdf(md).value,
    toMarkdown: (doc) => adfCodec.adfToLosslessMarkdown(doc).value,
  },
  "@nthings.dev/adf4j-wasm": { toMarkdown: (doc) => adf4j.convert(JSON.stringify(doc)) },
  "@wrtnlabs/markdown-to-adf": { toAdf: (md) => markdownToJiraBlock(md) },
  "adf-converter": { toMarkdown: (doc) => adfConverter.processADF(doc, adfConverter.markdownFormatter) },
  "adf-md": {
    toAdf: (md) => succeeded(adfMd.markdownToAdf(md)),
    toMarkdown: (doc) => succeeded(adfMd.adfToMarkdown(doc)),
  },
  "adf-to-markdown": { toMarkdown: (doc) => adfToMarkdown.convertADFToMarkdown(doc) },
  "adf-to-md": { toMarkdown: (doc) => adfToMd.convert(doc).result },
  adf2markdown: { toMarkdown: (doc) => adf2markdown.adf2markdown(doc) },
  "extended-markdown-adf-parser": {
    toAdf: (md) => extended.markdownToAdf(md),
    toMarkdown: (doc) => extended.adfToMarkdown(doc),
  },
  "github-markdown-adf": {
    toAdf: (md) => githubMarkdownAdf.mdToAdf(md),
    toMarkdown: (doc) => githubMarkdownAdf.adfToMd(doc),
  },
  "markdown-to-adf": { toAdf: (md) => markdownToAdf.markdownToAdf(md) },
  marklassian: { toAdf: (md) => marklassian.markdownToAdf(md) },
  "md-adf": {
    toAdf: (md) => reported(mdAdf.markdownToAdf(md)),
    toMarkdown: (doc) => reported(mdAdf.adfToMarkdown(doc)),
  },
  "md-to-adf": { toAdf: (md) => mdToAdf(md) },
  "mdast-util-from-adf": { toMarkdown: (doc) => mdastToMarkdown(fromADF(doc)) },
};

const show = (label, call) => {
  try {
    const value = call();
    console.log(`${label}:`, JSON.stringify(value));
    return value;
  } catch (error) {
    console.log(`${label} threw:`, error.message);
  }
};
for (const [name, { toAdf, toMarkdown }] of Object.entries(converters)) {
  const manifest = JSON.parse(readFileSync(`node_modules/${name}/package.json`, "utf8"));
  console.log(`\n## ${name} ${manifest.version}`);
  console.log("direct runtime dependencies:", Object.keys(manifest.dependencies ?? {}).length);
  const written = toMarkdown && show("ADF to markdown", () => toMarkdown(roundTripDoc));
  if (written !== undefined && toAdf) {
    const readBack = show("read back", () => toAdf(written));
    if (readBack !== undefined) console.log("round-trip deep-equal:", isDeepStrictEqual(readBack, roundTripDoc));
  }
  const unknown = toMarkdown && show("unknown node to markdown", () => toMarkdown(unknownNodeDoc));
  if (toAdf && unknown !== undefined) show("unknown node read back", () => toAdf(unknown));
  if (toAdf) show("markdown to ADF", () => toAdf(markdown));
}

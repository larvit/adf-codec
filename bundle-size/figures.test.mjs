import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { drift, minifiedGzippedBytes } from "./figures.mjs";

const fixture = (files) => {
	const dir = mkdtempSync(join(tmpdir(), "bundle-size-"));
	for (const [path, contents] of Object.entries(files)) {
		mkdirSync(join(dir, path, ".."), { recursive: true });
		writeFileSync(join(dir, path), contents);
	}
	return dir;
};

const readmeSaying = (minified, tarball, unpacked, tableCell) =>
	`| Aspect | Contract |\n| Size | ${minified} kB minified and gzipped; ${tarball} kB tarball, ${unpacked} kB unpacked |\n` +
	`| \`@larvit/adf-codec\` | both ways | a | b | c | 0 | ${tableCell} kB |\n`;

const measured = { minified: 13000, tarball: 60000, unpacked: 220000 };

test("minified size ignores comments, whitespace and the length of local names", async () => {
	const bare = fixture({ "entry.js": "export const r=((a)=>a+1)(1);" });
	const padded = fixture({ "entry.js": "// a comment\nexport const r = ((someVeryLongParameterName) => someVeryLongParameterName + 1)(1);\n\n\n" });
	assert.equal(await minifiedGzippedBytes(padded, ["./entry.js"]), await minifiedGzippedBytes(bare, ["./entry.js"]));
});

test("minified size counts every package it is given", async () => {
	const dir = fixture({
		"one.js": "export const one = 1;",
		"two.js": `export const two = ${JSON.stringify(Array.from({ length: 200 }, (_, i) => (i * 2654435761 % 4294967296).toString(36)))};`,
	});
	assert.ok(await minifiedGzippedBytes(dir, ["./one.js", "./two.js"]) > await minifiedGzippedBytes(dir, ["./one.js"]) + 500);
});

test("minified size counts a default export and exports two packages share by name", async () => {
	const dir = fixture({
		"first.js": `export const same = ${JSON.stringify(Array.from({ length: 200 }, (_, i) => (i * 2654435761 % 4294967296).toString(36)))};`,
		"second.js": `export const same = ${JSON.stringify(Array.from({ length: 200 }, (_, i) => (i * 40503 % 4294967296 * 65537).toString(36)))};`,
		"only-default.js": `export default ${JSON.stringify(Array.from({ length: 200 }, (_, i) => (i * 69069 % 4294967296 * 97).toString(36)))};`,
	});
	const first = await minifiedGzippedBytes(dir, ["./first.js"]);
	assert.ok(await minifiedGzippedBytes(dir, ["./first.js", "./second.js"]) > first + 500);
	assert.ok(await minifiedGzippedBytes(dir, ["./only-default.js"]) > 500);
});

test("minified size counts the dependencies a bundler pulls in", async () => {
	const alone = fixture({ "entry.js": "export const a = 1;" });
	const withDependency = fixture({
		"entry.js": "export * from 'dep'; export const a = 1;",
		"node_modules/dep/index.js": `export const words = ${JSON.stringify(Array.from({ length: 200 }, (_, i) => (i * 2654435761 % 4294967296).toString(36)))};`,
		"node_modules/dep/package.json": '{"name":"dep","type":"module","main":"index.js"}',
	});
	assert.ok(await minifiedGzippedBytes(withDependency, ["./entry.js"]) > await minifiedGzippedBytes(alone, ["./entry.js"]) + 500);
});

test("a README within a tenth of every measure has no drift", () => {
	assert.deepEqual(drift(readmeSaying(13, 60, 220, 13), measured), []);
	assert.deepEqual(drift(readmeSaying(14, 65, 240, 14), measured), []);
});

test("a figure exactly a tenth off holds and a little more does not", () => {
	assert.deepEqual(drift(readmeSaying(13, 54, 198, 13), measured), []);
	assert.deepEqual(drift(readmeSaying(13, 66, 242, 13), measured), []);
	assert.deepEqual(drift(readmeSaying(13, 66.1, 242.1, 13), measured), [
		"README says 66.1 kB tarball; measured 60.0 kB",
		"README says 242.1 kB unpacked; measured 220.0 kB",
	]);
});

test("a figure more than a tenth off is named with its measure", () => {
	assert.deepEqual(drift(readmeSaying(13, 60, 220, 11), measured), [
		"README's comparison table says 11 kB for @larvit/adf-codec; measured 13.0 kB",
	]);
	assert.deepEqual(drift(readmeSaying(13, 53, 220, 13), measured), [
		"README says 53 kB tarball; measured 60.0 kB",
	]);
});

test("a README missing a figure names it", () => {
	assert.deepEqual(drift("| Dependencies | none |\n", measured), [
		"README has no minified and gzipped figure in its Size row",
		"README has no tarball figure in its Size row",
		"README has no unpacked figure in its Size row",
		"README's comparison table has no size for @larvit/adf-codec",
	]);
});

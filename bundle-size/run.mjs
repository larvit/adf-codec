import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drift, minifiedGzippedBytes, packedBytes } from "./figures.mjs";

const root = resolve(import.meta.dirname, "..");
const measured = { minified: await minifiedGzippedBytes(root, ["./dist/index.js"]), ...packedBytes(root) };
console.log(`${(measured.minified / 1000).toFixed(1)} kB minified and gzipped; ${(measured.tarball / 1000).toFixed(1)} kB tarball, ${(measured.unpacked / 1000).toFixed(1)} kB unpacked`);
if (process.argv.includes("--check")) {
  const problems = drift(readFileSync(resolve(root, "README.md"), "utf8"), measured);
  for (const problem of problems) console.error(problem);
  process.exit(problems.length === 0 ? 0 : 1);
}

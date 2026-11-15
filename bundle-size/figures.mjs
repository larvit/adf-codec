import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";

const bytesPerKilobyte = 1000;

// A namespace export keeps default exports and same-named exports, which a star re-export drops.
// What a consumer's bundler ships for the whole of the packages: their code and dependencies, minified, gzipped.
export const minifiedGzippedBytes = async (resolveDir, specifiers) => {
  const { outputFiles } = await build({
    bundle: true,
    format: "esm",
    logLevel: "silent",
    minify: true,
    platform: "node",
    stdin: { contents: specifiers.map((specifier, i) => `import * as m${i} from ${JSON.stringify(specifier)}; export { m${i} };`).join("\n"), resolveDir },
    write: false,
  });
  return gzipSync(outputFiles[0].contents, { level: 9 }).length;
};

export const packedBytes = (packageDir) => {
  const [{ size, unpackedSize }] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: packageDir, encoding: "utf8", env: { ...process.env, npm_config_update_notifier: "false" } }));
  return { tarball: size, unpacked: unpackedSize };
};

const number = "(\\d+(?:\\.\\d+)?)";
const published = [
  ["minified", "minified and gzipped", new RegExp(`^\\| Size \\|.*?${number} kB minified and gzipped`, "m")],
  ["tarball", "tarball", new RegExp(`^\\| Size \\|.*?${number} kB tarball`, "m")],
  ["unpacked", "unpacked", new RegExp(`^\\| Size \\|.*?${number} kB unpacked`, "m")],
];
const tableCell = new RegExp(`^\\| \`@larvit/adf-codec\` \\|.*\\| ${number} kB \\|$`, "m");

// Whole bytes keep the bound exact: 0.1 has no binary spelling.
const offBy = (claimed, bytes) => Math.abs(Math.round(Number(claimed) * bytesPerKilobyte) - bytes) * 10 > bytes;
const kilobytes = (bytes) => (bytes / bytesPerKilobyte).toFixed(1);

// The README's size claims that are missing or more than a tenth off the measure, each as a sentence.
export const drift = (readme, measured) => [
  ...published.flatMap(([key, label, pattern]) => {
    const found = pattern.exec(readme);
    if (!found) return [`README has no ${label} figure in its Size row`];
    return offBy(found[1], measured[key]) ? [`README says ${found[1]} kB ${label}; measured ${kilobytes(measured[key])} kB`] : [];
  }),
  ...(() => {
    const found = tableCell.exec(readme);
    if (!found) return ["README's comparison table has no size for @larvit/adf-codec"];
    return offBy(found[1], measured.minified) ? [`README's comparison table says ${found[1]} kB for @larvit/adf-codec; measured ${kilobytes(measured.minified)} kB`] : [];
  })(),
];

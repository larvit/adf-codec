import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const entry = resolve(import.meta.dirname, 'bundle-entry.js')
const outputFolder = resolve(import.meta.dirname, 'bundles')
// The bundlers are installed in bundle-size's package, which this folder's resolution never reaches.
const bundler = createRequire(resolve(import.meta.dirname, '../bundle-size/package.json'))

const bundlers = {
  async bun(outfile) {
    const built = await Bun.build({ entrypoints: [entry], naming: outfile.slice(outputFolder.length + 1), outdir: outputFolder })
    assert.ok(built.success)
    return built.logs.map((log) => log.message)
  },
  async esbuild(outfile) {
    const built = await bundler('esbuild').build({ bundle: true, entryPoints: [entry], format: 'esm', logLevel: 'silent', outfile })
    return built.warnings.map((warning) => warning.text)
  },
  async rollup(outfile) {
    const warnings = []
    const bundle = await bundler('rollup').rollup({ input: entry, onwarn: (warning) => warnings.push(warning.message), plugins: [bundler('@rollup/plugin-node-resolve')()] })
    await bundle.write({ file: outfile, format: 'es' })
    return warnings
  },
  async webpack(outfile) {
    const stats = await new Promise((settle, fail) => {
      bundler('webpack')({ entry, mode: 'production', output: { filename: 'webpack.js', path: outputFolder } }, (error, built) => (error ? fail(error) : settle(built)))
    })
    const { errors, warnings } = stats.toJson({ all: false, errors: true, warnings: true })
    assert.deepEqual(errors, [])
    return warnings.map((warning) => warning.message)
  },
}

// Bun builds its bundle under its own image; Node builds the other three and runs all four.
const builtHere = 'Bun' in globalThis ? ['bun'] : ['esbuild', 'rollup', 'webpack']
for (const name of builtHere) {
  assert.deepEqual(await bundlers[name](resolve(outputFolder, `${name}.js`)), [], `${name} warned`)
}
if (!('Bun' in globalThis)) {
  for (const name of Object.keys(bundlers)) {
    const { document, read } = JSON.parse(execFileSync(process.execPath, [resolve(outputFolder, `${name}.js`)], { encoding: 'utf8' }))
    assert.deepEqual(read, { ok: true, value: document }, `${name}'s bundle`)
  }
}

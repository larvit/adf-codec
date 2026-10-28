import { readFileSync } from 'node:fs'
import config from './stryker.config.mjs'

const mutants = Object.values(JSON.parse(readFileSync(config.jsonReporter.fileName, 'utf8')).files).flatMap((file) => file.mutants)
const errors = mutants.filter((mutant) => mutant.status === 'RuntimeError').length
if (errors > 0) {
  console.error(`${errors} of ${mutants.length} mutants ended as RuntimeError, so each may hide a survivor`)
  process.exit(1)
}

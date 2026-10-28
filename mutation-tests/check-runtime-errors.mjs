import { readFileSync } from 'node:fs'
import config from './stryker.config.mjs'

const files = Object.entries(JSON.parse(readFileSync(config.jsonReporter.fileName, 'utf8')).files)
const mutants = files.flatMap(([path, file]) => file.mutants.map((mutant) => ({ ...mutant, path })))
const errors = mutants.filter((mutant) => mutant.status === 'RuntimeError')
if (errors.length > 0) {
  console.error(`${errors.length} of ${mutants.length} mutants ended as RuntimeError, so each may hide a survivor. A test run killed for lack of memory ends so:`)
  for (const mutant of errors) console.error(`  ${mutant.path}:${mutant.location.start.line} ${mutant.mutatorName}`)
  process.exit(1)
}

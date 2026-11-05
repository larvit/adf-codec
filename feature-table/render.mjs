import { isDeepStrictEqual } from 'node:util'

const writers = [
  { column: 'Lossless', fence: 'markdown', reader: 'losslessMarkdownToAdf', writer: 'adfToLosslessMarkdown' },
  { column: 'Portable', fence: 'markdown', reader: 'portableMarkdownToAdf', writer: 'adfToPortableMarkdown' },
  { column: 'HTML', fence: 'html', reader: 'htmlToAdf', writer: 'adfToHtml' },
]

const intro = `# What each call writes

\`feature-table/build.mjs\` writes this page from the corpus and the built package, and \`./ci.sh\` fails where the page differs.

Each output is read back by its format's reader. \`holds\` means that gives the same document, \`loses\` a different one, and \`refused\` an error whose code the example names.
`

// `library` holds the package's calls, so a test can hand in what a real document cannot make them do.
export function renderFeatureTable(examples, library) {
  const written = examples.map(({ doc, name }) => ({ doc, name, outcomes: writers.map((writer) => outcome(doc, writer, library)) }))
  const rows = written.map(({ name, outcomes }) => `| [${name}](#${name.toLowerCase().replaceAll(' ', '-')}) | ${outcomes.map(({ result }) => result).join(' | ')} |`)
  const head = `| Example | ${writers.map(({ column }) => column).join(' | ')} |\n| --- | --- | --- | --- |`
  return [intro, [head, ...rows].join('\n') + '\n', ...written.map(section)].join('\n')
}

function outcome(doc, { fence, reader, writer }, library) {
  const output = library[writer](doc)
  if (!output.ok) return { label: `\`${writer}\` refuses with \`${output.error.code}\`.\n`, result: 'refused' }
  const read = library[reader](output.value)
  if (!read.ok) return { label: `\`${writer}\`, round-trip refused with \`${read.error.code}\`:\n\n${fenced(fence, output.value)}`, result: 'refused' }
  const result = isDeepStrictEqual(read.value, doc) ? 'holds' : 'loses'
  return { label: `\`${writer}\`, round-trip ${result}:\n\n${fenced(fence, output.value)}`, result }
}

function section({ doc, name, outcomes }) {
  return [`## ${name}\n`, `ADF:\n\n${fenced('json', `${JSON.stringify(doc)}\n`)}`, ...outcomes.map(({ label }) => label)].join('\n')
}

function fenced(language, text) {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map(([run]) => run.length))
  const fence = '`'.repeat(longest + 1)
  return `${fence}${language}\n${text}${fence}\n`
}

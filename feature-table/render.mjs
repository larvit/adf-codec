import { isDeepStrictEqual } from 'node:util'

const writers = [
  { column: 'Lossless', fence: 'markdown', reader: 'losslessMarkdownToAdf', writer: 'adfToLosslessMarkdown' },
  { column: 'Portable', fence: 'markdown', reader: 'portableMarkdownToAdf', writer: 'adfToPortableMarkdown' },
  { column: 'HTML', fence: 'html', reader: 'htmlToAdf', writer: 'adfToHtml' },
]

const intro = `# What each call writes

Each section sets a sample ADF document beside what each call writes for it, then reads that output back: \`adfToLosslessMarkdown\` with \`losslessMarkdownToAdf\`, \`adfToPortableMarkdown\` with \`portableMarkdownToAdf\`, \`adfToHtml\` with \`htmlToAdf\`. \`holds\` means the reader gives the same document, \`loses\` a different one, and \`refused\` that the writer or reader returned an error, whose code the section names.

A result covers that example alone, and the examples are plain. Portable markdown keeps only the attributes its spelling holds, such as a heading's level and a link's target, so a document holding any other loses it even where its row says \`holds\`: to edit and save back, use \`adfToLosslessMarkdown\` and \`losslessMarkdownToAdf\`. An image holding more than the alt, layout, type and url of this page's example, as editor-written ones do, rides the carry element in HTML, where this page shows \`<img>\`.

\`./feature-table/write.sh\` writes this page. Don't edit it by hand.
`

// `library` is a parameter, so a test can hand in calls that refuse, which no corpus example makes them do.
export function renderFeatureTable(examples, library) {
  const written = examples.map(({ doc, name }) => ({ doc, name, outcomes: writers.map((writer) => outcome(doc, writer, library)) }))
  const rows = written.map(({ name, outcomes }) => `| [${name}](#${name.toLowerCase().replaceAll(' ', '-')}) | ${outcomes.map(({ result }) => result).join(' | ')} |`)
  const head = `| Example | ${writers.map(({ column }) => column).join(' | ')} |\n| --- | ${writers.map(() => '---').join(' | ')} |`
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

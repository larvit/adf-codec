import { adfToLosslessMarkdown, losslessMarkdownToAdf } from '@larvit/adf-codec'

const document = { content: [{ content: [{ marks: [{ type: 'em' }], text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }

const emitted = adfToLosslessMarkdown(document)
console.log(JSON.stringify({ document, read: emitted.ok ? losslessMarkdownToAdf(emitted.value) : emitted }))

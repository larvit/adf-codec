try {
  const { adfToMarkdown, isAdfDocument, markdownToAdf } = await import('/dist/index.js')
  window.convertCorpus = (corpus) => ({
    errors: corpus.errors.map(({ markdown, name }) => ({ name, parsed: markdownToAdf(markdown) })),
    normalization: corpus.normalization.map(({ markdown, name }) => ({ name, parsed: markdownToAdf(markdown) })),
    realPayloads: corpus.realPayloads.map(({ json, name }) => {
      const adf = JSON.parse(json)
      const emitted = adfToMarkdown(adf)
      return { emitted, isDocument: isAdfDocument(adf), name, parsed: emitted.ok ? markdownToAdf(emitted.value) : undefined }
    }),
    roundTrip: corpus.roundTrip.map(({ json, markdown, name }) => {
      const adf = JSON.parse(json)
      return { emitted: adfToMarkdown(adf), isDocument: isAdfDocument(adf), name, parsed: markdownToAdf(markdown) }
    }),
  })
} catch (cause) {
  window.adfCodecFault = `/dist/index.js did not load: ${cause}`
}

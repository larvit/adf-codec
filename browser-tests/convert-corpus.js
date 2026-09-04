try {
  const { adfToMarkdown, isAdfDocument, markdownToAdf } = await import('/dist/index.js')
  window.convertCorpus = (corpus) => ({
    errors: corpus.errors.map(({ markdown, name }) => ({ name, parsed: markdownToAdf(markdown) })),
    normalization: corpus.normalization.map(({ markdown, name }) => ({ name, parsed: markdownToAdf(markdown) })),
    roundTrip: corpus.roundTrip.map(({ json, markdown, name }) => {
      const adf = JSON.parse(json)
      return { emitted: adfToMarkdown(adf), isDocument: isAdfDocument(adf), name, parsed: markdownToAdf(markdown) }
    }),
  })
} catch (cause) {
  window.adfCodecFault = `/dist/index.js did not load: ${cause}`
}

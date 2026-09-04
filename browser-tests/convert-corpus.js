try {
  const { adfToMarkdown, isAdfDocument, markdownToAdf } = await import('/dist/index.js')
  window.convertCorpus = (corpus) => ({
    errors: corpus.errors.map(({ markdown }) => markdownToAdf(markdown)),
    normalization: corpus.normalization.map(({ markdown }) => markdownToAdf(markdown)),
    roundTrip: corpus.roundTrip.map(({ json, markdown }) => {
      const adf = JSON.parse(json)
      return { emitted: adfToMarkdown(adf), isDocument: isAdfDocument(adf), parsed: markdownToAdf(markdown) }
    }),
  })
} catch (cause) {
  window.adfCodecFault = `/dist/index.js did not load: ${cause}`
}

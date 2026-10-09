try {
  const { adfToLosslessMarkdown, isAdfDocument, losslessMarkdownToAdf } = await import('/dist/index.js')
  // WebDriver's JSON reads -0 back as 0, so a document crosses as JSON text with -0 tagged; run.js revives it.
  const spelled = (result) => (result.ok ? { ok: true, value: JSON.stringify(result.value, (_, value) => (Object.is(value, -0) ? '\u0000-0' : value)) } : result)
  window.convertCorpus = (corpus) => ({
    errors: corpus.errors.map(({ markdown, name }) => ({ name, parsed: losslessMarkdownToAdf(markdown) })),
    normalization: corpus.normalization.map(({ markdown, name }) => ({ name, parsed: spelled(losslessMarkdownToAdf(markdown)) })),
    realPayloads: corpus.realPayloads.map(({ json, name }) => {
      const adf = JSON.parse(json)
      const emitted = adfToLosslessMarkdown(adf)
      return { emitted, isDocument: isAdfDocument(adf), name, parsed: emitted.ok ? spelled(losslessMarkdownToAdf(emitted.value)) : undefined }
    }),
    roundTrip: corpus.roundTrip.map(({ json, markdown, name }) => {
      const adf = JSON.parse(json)
      return { emitted: adfToLosslessMarkdown(adf), isDocument: isAdfDocument(adf), name, parsed: spelled(losslessMarkdownToAdf(markdown)) }
    }),
  })
} catch (cause) {
  window.adfCodecFault = `/dist/index.js did not load: ${cause}`
}

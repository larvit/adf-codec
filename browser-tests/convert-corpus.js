try {
  const { adfToMarkdown, isAdfDocument, markdownToAdf } = await import('/dist/index.js')
  const { serializeCanonicalJson } = await import('/dist/canonical-json.js')
  // WebDriver's JSON reads -0 back as 0, so a document crosses as its canonical spelling.
  const spelled = (result) => (result.ok ? { ok: true, value: `${serializeCanonicalJson(result.value, 'two-space')}\n` } : result)
  window.convertCorpus = (corpus) => ({
    errors: corpus.errors.map(({ markdown, name }) => ({ name, parsed: markdownToAdf(markdown) })),
    normalization: corpus.normalization.map(({ markdown, name }) => ({ name, parsed: spelled(markdownToAdf(markdown)) })),
    realPayloads: corpus.realPayloads.map(({ json, name }) => {
      const adf = JSON.parse(json)
      const emitted = adfToMarkdown(adf)
      return { emitted, isDocument: isAdfDocument(adf), name, parsed: emitted.ok ? spelled(markdownToAdf(emitted.value)) : undefined }
    }),
    roundTrip: corpus.roundTrip.map(({ json, markdown, name }) => {
      const adf = JSON.parse(json)
      return { emitted: adfToMarkdown(adf), isDocument: isAdfDocument(adf), name, parsed: spelled(markdownToAdf(markdown)) }
    }),
  })
} catch (cause) {
  window.adfCodecFault = `/dist/index.js did not load: ${cause}`
}

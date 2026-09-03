import assert from 'node:assert/strict'

import { adfToMarkdown, markdownToAdf } from '@larvit/adf-codec'

const document = { content: [{ content: [{ marks: [{ type: 'em' }], text: 'x', type: 'text' }], type: 'paragraph' }], type: 'doc', version: 1 }

const emitted = adfToMarkdown(document)
assert.ok(emitted.ok, emitted.ok ? '' : emitted.error.message)
assert.deepEqual(markdownToAdf(emitted.value), { ok: true, value: document })

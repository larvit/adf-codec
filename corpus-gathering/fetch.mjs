// Usage: node fetch.mjs <sites.json> <raw folder>. The folder stays outside the repo: its documents hold the sites' real text.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Robots.txt on these sites asks for one second between requests.
const crawlDelay = 1000
const pagesPerSource = 20
const [sitesPath, rawFolder] = process.argv.slice(2)
const sites = JSON.parse(readFileSync(sitesPath, 'utf8'))
const documentsFolder = join(rawFolder, 'documents')
mkdirSync(documentsFolder, { recursive: true })

async function getJson(url) {
  await delay(crawlDelay)
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'adf-codec-corpus-gathering (https://github.com/larvit/adf-codec)' } })
  if (response.status === 429) {
    await delay(Number(response.headers.get('retry-after') ?? 60) * 1000)
    return getJson(url)
  }
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

let written = 0

function keep(name, source, document) {
  if (document?.type !== 'doc' || !Array.isArray(document.content) || document.content.length === 0) return
  writeFileSync(join(documentsFolder, `${name}.json`), JSON.stringify({ document, source }))
  written += 1
}

async function fetchConfluence(site, collection) {
  const base = `https://${site}.atlassian.net`
  let next = `/wiki/api/v2/${collection}?limit=100&body-format=atlas_doc_format`
  for (let page = 0; next !== undefined && page < pagesPerSource; page += 1) {
    const answer = await getJson(`${base}${next}`)
    for (const result of answer.results) {
      const body = result.body?.atlas_doc_format?.value
      if (body) keep(`${site}-wiki-${collection}-${result.id}`, `${base}/wiki/api/v2/${collection}/${result.id}`, JSON.parse(body))
    }
    next = answer._links?.next
  }
}

async function fetchJira(site) {
  const base = `https://${site}.atlassian.net`
  let token
  for (let page = 0; page < pagesPerSource; page += 1) {
    const query = new URLSearchParams({ fields: 'comment,description', jql: 'created >= "2015-01-01" ORDER BY created DESC', maxResults: '100', ...(token ? { nextPageToken: token } : {}) })
    const answer = await getJson(`${base}/rest/api/3/search/jql?${query}`)
    for (const issue of answer.issues) {
      keep(`${site}-jira-${issue.key}-description`, `${base}/rest/api/3/issue/${issue.key}?fields=description`, issue.fields.description)
      for (const comment of issue.fields.comment?.comments ?? []) keep(`${site}-jira-${issue.key}-comment-${comment.id}`, `${base}/rest/api/3/issue/${issue.key}/comment/${comment.id}`, comment.body)
    }
    token = answer.nextPageToken
    if (token === undefined) break
  }
}

for (const { products, site } of sites) {
  for (const product of Object.keys(products)) {
    try {
      if (product === 'wiki') {
        await fetchConfluence(site, 'pages')
        await fetchConfluence(site, 'footer-comments')
      } else {
        await fetchJira(site)
      }
    } catch (error) {
      console.error(`${site} ${product}: ${error.message}`)
    }
    console.error(`${site} ${product}: ${written} documents so far`)
  }
}

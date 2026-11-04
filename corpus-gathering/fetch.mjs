import { join } from 'node:path'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

import { jiraUrl, wikiUrl } from './source-urls.mjs'

// Robots.txt on these sites allows these paths and asks for one second between requests.
const crawlDelay = 1000
const defaultRetryAfter = 60
const [sitesPath, rawFolder] = process.argv.slice(2)
// Keeps a fetch to minutes.
const pagesPerListing = 20
const retries = 5
const sites = JSON.parse(readFileSync(sitesPath, 'utf8'))
const partialFolder = join(rawFolder, 'documents.partial')
rmSync(partialFolder, { force: true, recursive: true })
mkdirSync(partialFolder, { recursive: true })

async function getJson(url, retriesLeft = retries) {
  await delay(crawlDelay)
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'adf-codec-corpus-gathering (https://github.com/larvit/adf-codec)' } })
  if (response.status === 429 && retriesLeft > 0) {
    const asked = Number(response.headers.get('retry-after'))
    await delay((asked > 0 ? asked : defaultRetryAfter) * 1000)
    return getJson(url, retriesLeft - 1)
  }
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  return response.json()
}

let written = 0

function keep(name, source, document) {
  if (document?.type !== 'doc' || !Array.isArray(document.content) || document.content.length === 0) return
  writeFileSync(join(partialFolder, `${name}.json`), JSON.stringify({ document, retrieved: new Date().toISOString(), source }))
  written += 1
}

async function fetchConfluence(site, collection) {
  const base = `https://${site}.atlassian.net`
  let next = `/wiki/api/v2/${collection}?limit=100&body-format=atlas_doc_format`
  for (let page = 0; next !== undefined && page < pagesPerListing; page += 1) {
    const answer = await getJson(`${base}${next}`)
    for (const result of answer.results) {
      const body = result.body?.atlas_doc_format?.value
      if (body) keep(`${site}-wiki-${collection}-${result.id}`, wikiUrl(base, result._links.webui), JSON.parse(body))
    }
    next = answer._links?.next
  }
}

async function fetchJira(site) {
  const base = `https://${site}.atlassian.net`
  let token
  for (let page = 0; page < pagesPerListing; page += 1) {
    const query = new URLSearchParams({ fields: 'comment,description', jql: 'created >= "2015-01-01" ORDER BY created DESC', maxResults: '100', ...(token ? { nextPageToken: token } : {}) })
    const answer = await getJson(`${base}/rest/api/3/search/jql?${query}`)
    for (const issue of answer.issues) {
      keep(`${site}-jira-${issue.key}-description`, jiraUrl(base, issue.key), issue.fields.description)
      for (const comment of issue.fields.comment?.comments ?? []) keep(`${site}-jira-${issue.key}-comment-${comment.id}`, jiraUrl(base, issue.key, comment.id), comment.body)
    }
    token = answer.nextPageToken
    if (token === undefined) break
  }
}

const failures = []
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
      failures.push(`${site} ${product}`)
    }
    console.error(`${site} ${product}: ${written} documents so far`)
  }
}

if (failures.length > 0) {
  console.error(`No corpus source is complete without: ${failures.join(', ')}. Fetch again, or take the site out of sites.json.`)
  process.exit(1)
}
renameSync(partialFolder, join(rawFolder, 'documents'))

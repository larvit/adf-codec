// The pages a person reads, which name each document's creator. A wiki's web link also holds the page's title, and can hold an attachment's name, which the repo must not.
export function jiraUrl(base, key, commentId) {
  return `${base}/browse/${key}${commentId === undefined ? '' : `?focusedCommentId=${commentId}`}`
}

export function wikiUrl(base, webLink) {
  const [path, query] = webLink.split('?')
  const commentId = new URLSearchParams(query).get('focusedCommentId')
  return `${base}/wiki${path.replace(/(\/\d+)\/[^/]+$/, '$1')}${commentId === null ? '' : `?focusedCommentId=${commentId}`}`
}

function markSet(node) {
  return (node.marks ?? []).map((mark) => mark.type).sort().join('+')
}

function inlineLabel(node) {
  return node.type === 'text' ? `text[${markSet(node)}]` : node.type
}

function collect(node, parentType, found) {
  found.add(`node:${node.type}`)
  if (parentType !== undefined) found.add(`child:${parentType}>${node.type}`)
  for (const key of Object.keys(node.attrs ?? {})) found.add(`attr:${node.type}.${key}`)
  for (const mark of node.marks ?? []) {
    found.add(`mark:${mark.type}`)
    for (const key of Object.keys(mark.attrs ?? {})) found.add(`attr:${mark.type}.${key}`)
  }
  if (node.type === 'text' && (node.marks ?? []).length > 1) found.add(`marks:${markSet(node)}`)
  const children = node.content ?? []
  children.forEach((child, index) => {
    collect(child, node.type, found)
    const next = children[index + 1]
    if (next !== undefined) found.add(`beside:${inlineLabel(child)}|${inlineLabel(next)}`)
  })
}

// A document's features: its node and mark types, attribute keys, nesting, marks held together and neighbours such as bold beside a code span.
export function features(document) {
  const found = new Set()
  collect(document, undefined, found)
  return found
}

function isType(feature) {
  return feature.startsWith('node:') || feature.startsWith('mark:')
}

function bestCandidate(candidates, covered) {
  let best
  let bestScore = 0
  let bestShowsType = false
  for (const candidate of candidates) {
    let added = 0
    let showsType = false
    for (const feature of candidate.features) {
      if (covered.has(feature)) continue
      added += 1
      showsType ||= isType(feature)
    }
    const score = added / candidate.size
    if (showsType && !bestShowsType || showsType === bestShowsType && score > bestScore) {
      best = candidate
      bestScore = score
      bestShowsType = showsType
    }
  }
  return best
}

// Takes the candidate showing the most new features per byte, new node and mark types first, until `limit` or until none shows a new one.
export function selectDocuments(candidates, limit) {
  const covered = new Set()
  const chosen = []
  while (chosen.length < limit) {
    const best = bestCandidate(candidates, covered)
    if (best === undefined) break
    chosen.push(best)
    for (const feature of best.features) covered.add(feature)
  }
  return chosen
}

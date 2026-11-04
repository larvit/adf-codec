// A node's or mark's direct attribute under one of these keys names a format or a layout, never someone's words, so its value stays.
const formatKeys = new Set([
  '__autoSize', 'accessLevel', 'align', 'annotationType', 'background', 'breakoutWidth', 'color', 'colspan', 'columnRuleStyle', 'colwidth', 'displayMode',
  'extensionKey', 'extensionType', 'height', 'isNumberColumnEnabled', 'language', 'layout', 'level', 'mode', 'order', 'originalHeight', 'originalWidth',
  'panelColor', 'panelType', 'rowspan', 'shadowColor', 'size', 'state', 'style', 'type', 'userType', 'valign', 'width', 'widthType',
])
const schemes = new Set(['file', 'ftp', 'http', 'https', 'mailto', 'tel'])
const token = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu
const uuidPattern = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const uuid = new RegExp(`^${uuidPattern}$`, 'i')
const uuidOrToken = new RegExp(`(?<![\\p{L}\\p{N}])${uuidPattern}(?![\\p{L}\\p{M}\\p{N}])|${token.source}`, 'giu')
const uuidVersionAt = 14
// A chance match below this length identifies nobody, and a document may hold every such token, so redrawing around them might never end.
const shortestLeak = 3
const redraws = 64

function isScheme(text, match, offset) {
  return schemes.has(match) && text[offset + match.length] === ':'
}

function tokensOf(text) {
  return [...text.matchAll(token)].filter((found) => !isScheme(text, found[0], found.index)).map((found) => found[0])
}

// Calls `visit` with each leaf, its steps from the document and its kind: `kept`, or `free`, which the anonymizer replaces.
function walk(value, steps, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...steps, index], visit))
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, member] of Object.entries(value)) {
      const memberSteps = [...steps, key]
      if (key === 'attrs') walkAttributes(member, memberSteps, visit)
      else if (key === 'content' || key === 'marks') walk(member, memberSteps, visit)
      else if (key === 'type' || key === 'version') visit(member, memberSteps, 'kept')
      else walkFree(member, memberSteps, visit)
    }
  } else {
    visit(value, steps, 'free')
  }
}

// A Forge key reads `<app id>/<environment id>/...`, so it holds ids to replace. Any other extension key names a macro and stays.
function isForgeKey(key, value) {
  return key === 'extensionKey' && String(value).includes('/')
}

function walkAttributes(attributes, steps, visit) {
  for (const [key, member] of Object.entries(attributes)) {
    const memberSteps = [...steps, key]
    if (formatKeys.has(key) && !isForgeKey(key, member)) visit(member, memberSteps, 'kept')
    else walkFree(member, memberSteps, visit)
  }
}

function walkFree(value, steps, visit) {
  if (typeof value === 'object' && value !== null) for (const [key, member] of Object.entries(value)) walkFree(member, [...steps, key], visit)
  else visit(value, steps, 'free')
}

function replacedStrings(document) {
  const strings = []
  walk(document, [], (value, _steps, kind) => {
    if (kind === 'free' && typeof value === 'string') strings.push(value)
  })
  return strings
}

function fold(found) {
  return found.toLowerCase()
}

function heldTokens(document) {
  return new Set(replacedStrings(document).flatMap(tokensOf).map(fold).filter((found) => found.length >= shortestLeak))
}

function cursor(pool) {
  let next = 0
  return () => pool[next++ % pool.length]
}

function stream(pool) {
  const nextPiece = cursor(pool)
  let buffer = ''
  return (length) => {
    while (buffer.length < length) buffer += nextPiece()
    const taken = buffer.slice(0, length)
    buffer = buffer.slice(length)
    return taken
  }
}

function wordDrawer(words) {
  const lengths = [...new Set(words.map((word) => word.length))]
  const byLength = new Map(lengths.map((length) => [length, cursor(words.filter((word) => word.length === length))]))
  return (length) => {
    const nearest = lengths.reduce((best, candidate) => (Math.abs(candidate - length) < Math.abs(best - length) ? candidate : best))
    return byLength.get(nearest)()
  }
}

function withCaseOf(original, word) {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) return word.toUpperCase()
  if (original[0] !== original[0].toLowerCase()) return word[0].toUpperCase() + word.slice(1)
  return word
}

function replacer(document, draws) {
  const held = heldTokens(document)
  const digits = stream(draws.digits)
  const hex = stream(draws.hex)
  const letters = stream(draws.letters)
  const nextUuid = cursor(draws.uuids)
  const nextWord = wordDrawer(draws.words)
  const spelled = new Map()

  function fresh(draw) {
    let drawn = draw()
    for (let tries = 0; tries < redraws && tokensOf(drawn).some((found) => held.has(fold(found))); tries += 1) drawn = draw()
    return drawn
  }

  function number(original) {
    const drawn = fresh(() => digits(original.length))
    return original[0] !== '0' && drawn[0] === '0' ? `1${drawn.slice(1)}` : drawn
  }

  function mixed(original) {
    if (/^[0-9a-f]+$/.test(original)) return fresh(() => hex(original.length))
    return fresh(() => [...original].map((character) => {
      if (/\p{N}/u.test(character)) return digits(1)
      if (!/\p{L}/u.test(character)) return character
      return character === character.toLowerCase() ? letters(1) : letters(1).toUpperCase()
    }).join(''))
  }

  function word(original) {
    if (original.length < shortestLeak) return withCaseOf(original, letters(original.length))
    let tries = 0
    // A long document can hold every word of a length, so the last two of the draws `fresh` makes gain a suffix.
    return withCaseOf(original, fresh(() => {
      tries += 1
      return tries < redraws ? nextWord(original.length) : nextWord(original.length) + letters(2)
    }))
  }

  function spellToken(original) {
    if (/^\d+$/.test(original)) return number(original)
    if (/^\p{L}[\p{L}\p{M}]*$/u.test(original)) return word(original)
    return mixed(original)
  }

  function memo(original, spell) {
    if (!spelled.has(original)) spelled.set(original, spell(original))
    return spelled.get(original)
  }

  function spellUuid(original) {
    const drawn = fresh(() => {
      const next = nextUuid()
      return `${next.slice(0, uuidVersionAt)}${original[uuidVersionAt]}${next.slice(uuidVersionAt + 1)}`
    })
    return /[A-F]/.test(original) ? drawn.toUpperCase() : drawn
  }

  function string(original) {
    return original.replaceAll(uuidOrToken, (match, offset) => {
      if (uuid.test(match)) return memo(match, spellUuid)
      return isScheme(original, match, offset) ? match : memo(match, spellToken)
    })
  }

  function scalar(value) {
    if (typeof value === 'string') return string(value)
    if (typeof value === 'number') return Number(String(value).replaceAll(/\d+/g, number))
    return value
  }

  return scalar
}

function setAt(target, steps, value) {
  const holder = steps.slice(0, -1).reduce((held, step) => held[step], target)
  holder[steps.at(-1)] = value
}

// `draws` is fejkdata's output, as run.sh renders it.
export function anonymize(document, draws) {
  const scalar = replacer(document, draws)
  const written = structuredClone(document)
  walk(document, [], (value, steps, kind) => {
    if (kind === 'free') setAt(written, steps, scalar(value))
  })
  return written
}

function structure(document) {
  const found = new Map()
  walk(document, [], (value, steps, kind) => {
    found.set(`/${steps.join('/')}`, { kind, value })
  })
  return found
}

function skeleton(text) {
  return text.replaceAll(uuidOrToken, (match) => (uuid.test(match) ? `uuid${match[uuidVersionAt]}` : 'x'))
}

function holdsSameShape(before, after) {
  if (before.kind === 'kept') return JSON.stringify(before.value) === JSON.stringify(after.value)
  if (typeof before.value !== typeof after.value) return false
  return typeof before.value !== 'string' || skeleton(before.value) === skeleton(after.value)
}

// The paths where `after` differs from `before` in anything but the tokens the anonymizer replaces.
export function shapeDifferences(before, after) {
  const beforeValues = structure(before)
  const afterValues = structure(after)
  const paths = [...new Set([...beforeValues.keys(), ...afterValues.keys()])]
  return paths.filter((path) => {
    const first = beforeValues.get(path)
    const second = afterValues.get(path)
    return first === undefined || second === undefined || !holdsSameShape(first, second)
  })
}

// The tokens of `before`'s replaced values that `after`'s replaced values still hold.
export function leakedTokens(before, after) {
  const held = heldTokens(after)
  return [...heldTokens(before)].filter((found) => held.has(found))
}

// The anonymized document, or what keeps it out of the corpus: a slip here would publish real text, and nothing later could see it.
export function anonymizeChecked(document, draws) {
  const written = anonymize(document, draws)
  const differences = shapeDifferences(document, written)
  const leaks = leakedTokens(document, written)
  return differences.length > 0 || leaks.length > 0 ? { differences, leaks, ok: false } : { ok: true, written }
}

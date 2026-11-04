// A node's or mark's direct attribute under one of these keys names a format or a layout, never someone's words, so its value stays.
const formatKeys = new Set([
  '__autoSize', 'accessLevel', 'align', 'annotationType', 'background', 'breakoutWidth', 'color', 'colspan', 'colwidth', 'columnRuleStyle', 'displayMode',
  'extensionKey', 'extensionType', 'height', 'isNumberColumnEnabled', 'language', 'layout', 'level', 'mode', 'order', 'originalHeight', 'originalWidth',
  'panelColor', 'panelType', 'rowspan', 'shadowColor', 'size', 'state', 'style', 'type', 'userType', 'valign', 'width', 'widthType',
])
const schemes = new Set(['file', 'ftp', 'http', 'https', 'mailto', 'tel'])
const token = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// A shorter token cannot leak anything, and a document may hold all of them, so drawing around it could never end.
const shortestLeak = 3
const redraws = 64

function isScheme(text, match, offset) {
  return schemes.has(match) && text[offset + match.length] === ':'
}

function tokensOf(text) {
  return [...text.matchAll(token)].filter((found) => !isScheme(text, found[0], found.index)).map((found) => found[0])
}

// Calls `visit` with each leaf and its path, as `kept`, `person` or `free`, the last two being what the anonymizer replaces.
function walk(value, path, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}/${index}`, visit))
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, member] of Object.entries(value)) {
      const memberPath = `${path}/${key}`
      if (key === 'attrs') walkAttributes(member, memberPath, visit, value.type)
      else if (key === 'content' || key === 'marks') walk(member, memberPath, visit)
      else if (key === 'type' || key === 'version') visit(member, memberPath, 'kept')
      else walkFree(member, memberPath, visit)
    }
  } else {
    visit(value, path, 'free')
  }
}

function walkAttributes(attributes, path, visit, nodeType) {
  for (const [key, member] of Object.entries(attributes)) {
    const memberPath = `${path}/${key}`
    if (formatKeys.has(key)) visit(member, memberPath, 'kept')
    else if (nodeType === 'mention' && key === 'text') visit(member, memberPath, 'person')
    else walkFree(member, memberPath, visit)
  }
}

function walkFree(value, path, visit) {
  if (Array.isArray(value)) value.forEach((item, index) => walkFree(item, `${path}/${index}`, visit))
  else if (typeof value === 'object' && value !== null) for (const [key, member] of Object.entries(value)) walkFree(member, `${path}/${key}`, visit)
  else visit(value, path, 'free')
}

function replacedStrings(document) {
  const strings = []
  walk(document, '', (value, _path, kind) => {
    if (kind !== 'kept' && typeof value === 'string') strings.push(value)
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
  if (original.length > 1 && original === original.toUpperCase()) return word.toUpperCase()
  if (original[0] !== original[0].toLowerCase()) return word[0].toUpperCase() + word.slice(1)
  return word
}

function replacer(document, draws) {
  const held = heldTokens(document)
  const digits = stream(draws.digits)
  const hex = stream(draws.hex)
  const letters = stream(draws.letters)
  const nextPerson = cursor(draws.persons)
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
      if (/\d/.test(character)) return digits(1)
      if (!/\p{L}/u.test(character)) return character
      return character === character.toLowerCase() ? letters(1) : letters(1).toUpperCase()
    }).join(''))
  }

  function word(original) {
    if (original.length < shortestLeak) return withCaseOf(original, letters(original.length))
    let tries = 0
    // A long document can hold every word of the pool, so a redraw past the pool's size gains a suffix.
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

  function string(original) {
    if (uuid.test(original)) return memo(original, () => fresh(nextUuid))
    return original.replaceAll(token, (match, offset) => (isScheme(original, match, offset) ? match : memo(match, spellToken)))
  }

  function person(original) {
    return memo(original, () => `${original.startsWith('@') ? '@' : ''}${fresh(nextPerson)}`)
  }

  function scalar(value) {
    if (typeof value === 'string') return string(value)
    if (typeof value === 'number') return Number(String(value).replaceAll(/\d+/g, number))
    return value
  }

  return { person, scalar }
}

function setAt(target, path, value) {
  const steps = path.split('/').slice(1)
  const last = steps.pop()
  let holder = target
  for (const step of steps) holder = holder[step]
  holder[last] = value
}

// Every draw comes from `draws`: fejkdata's output, as run.sh renders it.
export function anonymize(document, draws) {
  const { person, scalar } = replacer(document, draws)
  const written = structuredClone(document)
  walk(document, '', (value, path, kind) => {
    if (kind === 'person' && typeof value === 'string') setAt(written, path, person(value))
    else if (kind === 'free') setAt(written, path, scalar(value))
  })
  return written
}

function structure(document) {
  const found = new Map()
  walk(document, '', (value, path, kind) => {
    found.set(path, { kind, value })
  })
  return found
}

function skeleton(text) {
  return text.replaceAll(token, 'x')
}

function holdsSameShape(before, after) {
  if (before.kind === 'kept') return before.value === after.value || JSON.stringify(before.value) === JSON.stringify(after.value)
  if (typeof before.value !== typeof after.value) return false
  return before.kind === 'person' || typeof before.value !== 'string' || skeleton(before.value) === skeleton(after.value)
}

// The paths where `after` differs from `before` in anything but the words the anonymizer replaces.
export function shapeDifferences(before, after) {
  const beforeValues = structure(before)
  const afterValues = structure(after)
  const paths = [...new Set([...beforeValues.keys(), ...afterValues.keys()])]
  return paths.filter((path) => {
    const first = beforeValues.get(path)
    const second = afterValues.get(path)
    return first === undefined || second === undefined || !holdsSameShape(first, second)
  }).sort()
}

// The tokens of `before`'s replaced values that `after`'s replaced values still hold.
export function leakedTokens(before, after) {
  const held = heldTokens(after)
  return [...heldTokens(before)].filter((found) => held.has(found)).sort()
}

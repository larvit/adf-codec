export type Spelling = 'attribute' | 'text'

const entityValues: ReadonlyMap<string, string> = new Map([
  ['&amp;', '&'],
  ['&gt;', '>'],
  ['&lt;', '<'],
  ['&nbsp;', '\u00a0'],
  ['&quot;', '"'],
])
const entityNames = [...entityValues.keys()].map((spelled) => spelled.slice(1, -1)).join('|')
const entity = new RegExp(`&(?:${entityNames});`, 'g')
// `adfToHtml` writes every character of `entityValues` as its entity but the no-break space.
const escapes: ReadonlyMap<string, string> = new Map([...entityValues].filter(([, character]) => character !== '\u00a0').map(([spelled, character]): [string, string] => [character, spelled]))
const escapable = new RegExp(`[${[...escapes.keys()].join('')}]`, 'g')
const writtenEntities = [...escapes.values()]
// What HTML text and attribute values cannot hold (WHATWG HTML §13.1.3): any control but a tab, line feed or form feed, a carriage return among them, since a parser reads it as a line feed; a noncharacter; and a lone surrogate, which UTF-8 cannot encode.
const unwritable = /(?![\t\n\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/u
const unwritables = new RegExp(unwritable.source, 'gu')
const strayAmpersand = `&(?!(?:${entityNames});)`
// An attribute value may hold a raw `<` or `>`, as older browsers write them; text may hold a raw `"`.
const misspellings: Readonly<Record<Spelling, RegExp>> = {
  attribute: new RegExp(`${strayAmpersand}|${unwritable.source}`, 'u'),
  text: new RegExp(`${strayAmpersand}|[<>]|${unwritable.source}`, 'u'),
}
// For each spelling, the other way a browser writes what `adfToHtml` writes as the key (WHATWG HTML §13.3).
const browserSpellings: Readonly<Record<Spelling, ReadonlyMap<string, string>>> = {
  attribute: new Map([['&gt;', '>'], ['&lt;', '<'], ['\u00a0', '&nbsp;']]),
  text: new Map([['&quot;', '"'], ['\u00a0', '&nbsp;']]),
}

// The carry's JSON, which spells each character HTML cannot hold as a JSON escape reading back to the same string.
export function holdableJson(json: string): string {
  return json.replace(unwritables, (character) => jsonEscape(character))
}

export function jsonValue(json: string): string {
  return escapeHtml(holdableJson(json))
}

// The index of the first character that reads wrongly in `html`, -1 where none stands in it.
export function misspelledAt(html: string, spelling: Spelling): number {
  return html.search(misspellings[spelling])
}

// ` name="value"`, `''` where the value is undefined, `undefined` where HTML cannot hold it.
export function optionalAttribute(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return ''
  const escaped = writableValue(value)
  return escaped === undefined ? undefined : ` ${name}="${escaped}"`
}

export function shownValue(value: string, lineFeed: string): string {
  return escapeHtml(value.replace(unwritables, '')).replaceAll('\n', lineFeed)
}

// Whether `html` holds `shown` from `index` (`whole`), and the index where the match ends or first fails. `shown` is as `adfToHtml` writes it; `html` may spell it as a browser does.
export function readsAsShown(html: string, index: number, shown: string): { at: number; whole: boolean } {
  if (html.startsWith(shown, index)) return { at: index + shown.length, whole: true }
  let at = index
  let spelling: Spelling = 'text'
  for (let next = 0; next < shown.length; ) {
    const token = writtenEntities.find((spelled) => shown.startsWith(spelled, next)) ?? shown.charAt(next)
    // A shown `<` opens a tag, whose attribute values may spell `<` and `>` raw; a shown `>` ends it.
    if (token === '<') spelling = 'attribute'
    if (token === '>') spelling = 'text'
    const read = [token, browserSpellings[spelling].get(token)].find((spelled) => spelled !== undefined && html.startsWith(spelled, at))
    if (read === undefined) return { at, whole: false }
    at += read.length
    next += token.length
  }
  return { at, whole: true }
}

// The value an escaped HTML text or attribute stands for, `undefined` where `misspelledAt` finds a character that reads wrongly.
export function unescapedValue(html: string, spelling: Spelling): string | undefined {
  return misspelledAt(html, spelling) < 0 ? html.replace(entity, (spelled) => entityValues.get(spelled) ?? spelled) : undefined
}

// `undefined` where HTML cannot hold the value, so its node rides the carry element.
export function writableValue(value: string): string | undefined {
  return unwritable.test(value) ? undefined : escapeHtml(value)
}

function escapeHtml(text: string): string {
  return text.replace(escapable, (character) => escapes.get(character) ?? character)
}

// An astral noncharacter spells as its two surrogates' escapes.
function jsonEscape(character: string): string {
  let escaped = ''
  for (let index = 0; index < character.length; index += 1) escaped += `\\u${character.charCodeAt(index).toString(16).padStart(4, '0')}`
  return escaped
}

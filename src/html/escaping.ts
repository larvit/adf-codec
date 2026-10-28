const entities: ReadonlyMap<string, string> = new Map([
  ['&amp;', '&'],
  ['&gt;', '>'],
  ['&lt;', '<'],
  ['&quot;', '"'],
])
// What HTML text and attribute values cannot hold (WHATWG HTML §13.1.3): any control but a tab, line feed or form feed, a carriage return among them, since a parser reads it as a line feed; a noncharacter; and a lone surrogate, which UTF-8 cannot encode.
const unwritable = /(?![\t\n\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/u
const unwritables = new RegExp(unwritable.source, 'gu')
// An `&` opening no entity, a character `escapeHtml` escapes standing raw, or one HTML cannot hold.
const misspelling = new RegExp(`&(?!${[...entities.keys()].map((entity) => entity.slice(1)).join('|')})|[<>"]|${unwritable.source}`, 'u')

// The carry's JSON, which spells each character HTML cannot hold as a JSON escape reading back to the same string.
export function holdableJson(json: string): string {
  return json.replace(unwritables, (character) => jsonEscape(character))
}

export function jsonValue(json: string): string {
  return escapeHtml(holdableJson(json))
}

// The index of the first character `writableValue` would not write so, -1 where none stands in `html`.
export function misspelledAt(html: string): number {
  return html.search(misspelling)
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

// The text or attribute value escaped HTML spells, `undefined` where `writableValue` would not write it so.
export function unescapedValue(html: string): string | undefined {
  return misspelledAt(html) < 0 ? html.replace(/&(?:amp|gt|lt|quot);/g, (entity) => entities.get(entity) ?? entity) : undefined
}

// `undefined` where HTML cannot hold the value, so its node rides the carry element.
export function writableValue(value: string): string | undefined {
  return unwritable.test(value) ? undefined : escapeHtml(value)
}

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

// An astral noncharacter spells as its two surrogates' escapes.
function jsonEscape(character: string): string {
  let escaped = ''
  for (let index = 0; index < character.length; index += 1) escaped += `\\u${character.charCodeAt(index).toString(16).padStart(4, '0')}`
  return escaped
}

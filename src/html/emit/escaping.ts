import type { JsonValue } from '../../json-value.ts'
import type { LinkAttrs } from '../../adf/mark-attributes.ts'

// What HTML text and attribute values cannot hold (WHATWG HTML §13.1.3): any control but a tab, line feed or form feed, a carriage return among them, since a parser reads it as a line feed; a noncharacter; and a lone surrogate, which UTF-8 cannot encode.
const unwritable = /(?![\t\n\f ])[\p{Cc}\p{Cs}\p{Noncharacter_Code_Point}]/u
const unwritables = new RegExp(unwritable.source, 'gu')

export function anchorOpener({ href, title }: LinkAttrs): string | undefined {
  const url = writableValue(href)
  const titled = optionalAttribute('title', title)
  return url === undefined || titled === undefined ? undefined : `<a href="${url}"${titled}>`
}

// The carry's JSON, which spells each character HTML cannot hold as a JSON escape reading back to the same string.
export function jsonValue(json: string): string {
  return escapeHtml(json.replace(unwritables, (character) => jsonEscape(character)))
}

// A code block's ` class="language-…"`, `''` where it holds no language, `undefined` where a class cannot hold the language as one token.
export function languageClass(language: JsonValue | undefined): string | undefined {
  if (language === undefined) return ''
  return typeof language === 'string' && /^[^\t\n\f\r ]+$/.test(language) ? optionalAttribute('class', `language-${language}`) : undefined
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

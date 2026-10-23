// An HTML parser reads a null character as U+FFFD, so each function here refuses or drops one, and the writer escapes through nothing else.

// `undefined` where the value holds a null character, so its node rides the carry element.
export function htmlValue(value: string): string | undefined {
  return value.includes('\0') ? undefined : escapeHtml(value)
}

// ` name="value"`, `''` where the value is undefined, `undefined` where it holds a null character.
export function optionalAttribute(name: string, value: string | undefined): string | undefined {
  if (value === undefined) return ''
  const escaped = htmlValue(value)
  return escaped === undefined ? undefined : ` ${name}="${escaped}"`
}

// What the carry element holds: its JSON spells a null character `\u0000`, and the text it shows drops one.
export function carriedValue(value: string): string {
  return escapeHtml(value.replaceAll('\0', ''))
}

// A carriage return is a character reference, since an HTML parser reads a raw one as a line feed.
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('\r', '&#13;')
}

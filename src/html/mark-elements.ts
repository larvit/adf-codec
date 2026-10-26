// The element each mark but a link writes around text, holding no attribute; a link writes `<a>`.
const markElements: ReadonlyMap<string, string> = new Map([
  ['code', 'code'],
  ['em', 'em'],
  ['strong', 'strong'],
])

export function elementOfMark(type: string): string | undefined {
  return markElements.get(type)
}

export function markOfElement(name: string): string | undefined {
  for (const [type, element] of markElements) if (element === name) return type
  return undefined
}

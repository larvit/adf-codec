import type { DirectiveAttributes, DirectiveValue, Read } from './directive-syntax.ts'
import type { EmptyKey } from '../adf/document.ts'
import { emptyKeys } from '../adf/document.ts'
import { unsupportedNodeShape } from './directive-syntax.ts'

type EmptyKeysRead = { empty: ReadonlySet<EmptyKey>; rest: Map<string, DirectiveValue> }

const emptyValue = 'empty'

// spec/flavour.md, Attributes: no attribute value spells an empty object or array.
export function spellEmptyKeys(held: Parameters<typeof emptyKeys>[0]): [string, string][] {
  return emptyKeys(held).map((key) => [key, emptyValue])
}

export function spellsEmpty(value: DirectiveValue | undefined): boolean {
  return value?.spelling === emptyValue
}

export function readEmptyKeys(attributes: DirectiveAttributes, keys: readonly EmptyKey[]): Read<EmptyKeysRead> {
  const rest = new Map(attributes)
  const empty = new Set<EmptyKey>()
  for (const key of keys) {
    const spelled = rest.get(key)
    if (spelled === undefined) continue
    if (!spellsEmpty(spelled)) return { fault: unsupportedNodeShape(`the reserved key ${key} reads ${key}=${emptyValue} alone: this one spells ${key}=${spelled.spelling}`) }
    empty.add(key)
    rest.delete(key)
  }
  return { value: { empty, rest } }
}

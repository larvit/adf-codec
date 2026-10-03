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

// `held` is whether the directive spells an attribute outside {attrs}: an argument or a content slot.
export function readEmptyKeys(type: string, attributes: DirectiveAttributes, keys: readonly EmptyKey[], held: boolean): Read<EmptyKeysRead> {
  const rest = new Map(attributes)
  const empty = new Set<EmptyKey>()
  for (const key of keys) {
    const spelled = rest.get(key)
    if (spelled === undefined) continue
    if (!spellsEmpty(spelled)) return { fault: unsupportedNodeShape(`the reserved key ${key} takes only the value ${emptyValue}: this one spells ${key}=${spelled.spelling}`) }
    empty.add(key)
    rest.delete(key)
  }
  if (empty.has('attrs') && (held || [...rest.keys()].some((key) => key !== 'marks'))) return { fault: unsupportedNodeShape(`${type} spells attrs=empty beside another attribute, an argument or a [content] slot: drop attrs=empty, or the rest`) }
  return { value: { empty, rest } }
}

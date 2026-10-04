import { largestNesting } from './nesting.ts'

export type JsonValue = JsonValue[] | boolean | null | number | string | { [key: string]: JsonValue }

// Tracks ancestors alone: a tree may share an object, but one holding itself would walk forever.
export function everyInTree(roots: readonly unknown[], children: (item: unknown) => readonly unknown[] | undefined): boolean {
  const pending = Array.from(roots, (item) => ({ depth: 0, item }))
  const ancestors: unknown[] = []
  const onPath = new Set<unknown>()
  while (pending.length > 0) {
    const entry = pending.pop()
    if (entry === undefined) continue
    while (ancestors.length > entry.depth) onPath.delete(ancestors.pop())
    if (onPath.has(entry.item)) return false
    const held = children(entry.item)
    if (held === undefined) return false
    if (held.length === 0) continue
    ancestors.push(entry.item)
    onPath.add(entry.item)
    for (const child of held) pending.push({ depth: entry.depth + 1, item: child })
  }
  return true
}

export function isJsonValue(value: unknown): value is JsonValue {
  return everyInTree([value], (item) => {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return []
    if (typeof item === 'number') return Number.isFinite(item) ? [] : undefined
    // A hole is not a JSON value, and Array.prototype methods skip holes — spreading materialises them.
    if (Array.isArray(item)) return [...item]
    return typeof item === 'object' ? Object.values(item) : undefined
  })
}

export function nestingDepth(value: unknown): number {
  const pending: { depth: number; item: unknown }[] = [{ depth: 0, item: value }]
  let deepest = 0
  while (pending.length > 0) {
    const entry = pending.pop()
    if (entry === undefined) continue
    const { depth, item } = entry
    deepest = Math.max(deepest, depth)
    if (Array.isArray(item)) for (const child of item) pending.push({ depth: depth + 1, item: child })
    else if (item !== null && typeof item === 'object') for (const child of Object.values(item)) pending.push({ depth: depth + 1, item: child })
  }
  return deepest
}

export function overNested(value: unknown, levels: number = largestNesting): boolean {
  return nestingDepth(value) > levels
}

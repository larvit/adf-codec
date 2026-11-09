import type { ConvertFault, Read } from '../result.ts'
import { isPlainObject } from '../json-value.ts'

// Each object, array, string, number, boolean and null counts one: far past any real page, and it stops a Proxy claiming unbounded width.
const mostValues = 10_000_000

// An object that is no plain object is copied with this prototype, so `isJsonValue` refuses the copy as it refuses the original.
const unplain = {}

type Step = { depth: number; key: number | string; source: unknown; target: object }
type Held = { entries: [number | string, unknown][]; kind: 'array' | 'object' | 'unplain' }

const badLength: ConvertFault = { code: 'not-an-adf-document', message: "an ADF document is plain data: an array's length is not a count" }
const holdsItself: ConvertFault = { code: 'not-an-adf-document', message: 'an ADF document is a tree: an object in it holds itself' }
const tooMany: ConvertFault = { code: 'unsupported-node-shape', message: `an ADF document holds at most ${mostValues} JSON values: this one holds more` }
const unreadable: ConvertFault = { code: 'not-an-adf-document', message: 'an ADF document is plain data: reading one of its objects threw' }
const withAccessor: ConvertFault = { code: 'not-an-adf-document', message: 'an ADF document is plain data: one of its objects holds a getter or a setter' }

// Reads the caller's object through property descriptors alone, so no getter runs and a Proxy's traps run once for each place the object is held; every later step reads the copy.
export function plainCopy(value: unknown): Read<unknown> {
  const root: unknown[] = []
  const pending: Step[] = [{ depth: 0, key: 0, source: value, target: root }]
  const ancestors: object[] = []
  const onPath = new Set<unknown>()
  let left = mostValues - 1
  for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
    const source = step.source
    if (typeof source !== 'object' || source === null) {
      place(step.target, step.key, source)
      continue
    }
    // A pre-order walk: a step at depth d has the d objects above it as its ancestors, and the stack pops it before its later siblings.
    while (ancestors.length > step.depth) onPath.delete(ancestors.pop())
    if (onPath.has(source)) return { fault: holdsItself }
    ancestors.push(source)
    onPath.add(source)
    const read = heldBy(source, left)
    if (read.fault !== undefined) return read
    const { entries, kind } = read.value
    left -= entries.length
    const copy = kind === 'array' ? [] : kind === 'object' ? {} : Object.create(unplain)
    place(step.target, step.key, copy)
    for (const [key, held] of entries.reverse()) pending.push({ depth: step.depth + 1, key, source: held, target: copy })
  }
  return { value: root[0] }
}

// The only reads of the caller's object, so the only `try`: a throw there is the caller's Proxy, or an engine out of memory that this cannot tell apart from it.
function heldBy(source: object, left: number): Read<Held> {
  try {
    const entries: [number | string, unknown][] = []
    if (Array.isArray(source)) {
      const length: unknown = source.length
      if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) return { fault: badLength }
      if (length > left) return { fault: tooMany }
      for (let index = 0; index < length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(source, index)
        if (descriptor !== undefined && !('value' in descriptor)) return { fault: withAccessor }
        entries.push([index, descriptor?.value])
      }
      return { value: { entries, kind: 'array' } }
    }
    const keys = Reflect.ownKeys(source)
    if (keys.length > left) return { fault: tooMany }
    for (const key of keys) {
      if (typeof key !== 'string') continue
      const descriptor = Object.getOwnPropertyDescriptor(source, key)
      if (descriptor === undefined || descriptor.enumerable !== true) continue
      if (!('value' in descriptor)) return { fault: withAccessor }
      entries.push([key, descriptor.value])
    }
    return { value: { entries, kind: isPlainObject(source) ? 'object' : 'unplain' } }
  } catch {
    return { fault: unreadable }
  }
}

function place(target: object, key: number | string, copy: unknown): void {
  if (key === '__proto__') Object.defineProperty(target, key, { configurable: true, enumerable: true, value: copy, writable: true })
  else Reflect.set(target, key, copy)
}

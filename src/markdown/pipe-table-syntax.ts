import type { ConvertFault } from '../result.ts'
import { backslashEscape, claimsPipeLine, trimSpace } from './commonmark-grammar.ts'

const alignmentCell = /^:-+:?$|^-+:$/
const delimiterCell = /^-+$/

export function isPipeAlignment(cell: string): boolean {
  return alignmentCell.test(cell)
}

export function isPipeDelimiter(cell: string): boolean {
  return delimiterCell.test(cell)
}

export function malformedPipeTable(message: string): ConvertFault {
  return { code: 'malformed-pipe-table', message }
}

// spec/flavour.md, Tables: the cells of a claimed row, the closing `|` the spelling writes optional here.
export function pipeCells(line: string): string[] | undefined {
  if (!claimsPipeLine(line)) return undefined
  const row = line.replace(/[ \t]+$/, '')
  const cells: string[] = []
  let start = 1
  let index = 1
  while (index < row.length) {
    if (backslashEscape(row, index) !== undefined) {
      index += 2
      continue
    }
    if (row.charAt(index) === '|') {
      cells.push(trimSpace(row.slice(start, index)))
      start = index + 1
    }
    index += 1
  }
  cells.push(trimSpace(row.slice(start)))
  if (cells.length > 1 && cells.at(-1) === '') cells.pop()
  return cells
}

export function spellPipeDelimiter(columns: number): string {
  return spellPipeRow(Array.from({ length: columns }, () => '---'))
}

export function spellPipeRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`
}

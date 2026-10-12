import type { ConvertFault } from '../result.ts'
import { backslashEscape, claimsPipeLine, trimSpace } from './commonmark/grammar.ts'

const alignmentCell = /^:-+:?$|^-+:$/
const delimiterCell = /^-+$/

// spec/flavour.md, Tables: the cells of a row no leading `|` claimed — GFM's form without the outer pipes.
export function barePipeCells(line: string): string[] | undefined {
  const cells = splitPipeCells(line, 0)
  return cells.length > 1 ? cells : undefined
}

export function isBareDelimiterRow(line: string): boolean {
  const cells = barePipeCells(line)
  return cells !== undefined && isDelimiterRow(cells)
}

export function isDelimiterRow(cells: readonly string[]): boolean {
  return cells.every((cell) => isPipeDelimiter(cell) || isPipeAlignment(cell))
}

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
  return claimsPipeLine(line) ? splitPipeCells(line, 1) : undefined
}

export function spellPipeDelimiter(columns: number): string {
  return spellPipeRow(Array.from({ length: columns }, () => '---'))
}

export function spellPipeRow(cells: readonly string[]): string {
  return `| ${cells.join(' | ')} |`
}

function splitPipeCells(line: string, start: number): string[] {
  const cells: string[] = []
  let cellStart = start
  let index = start
  while (index < line.length) {
    if (backslashEscape(line, index) !== undefined) {
      index += 2
      continue
    }
    if (line.charAt(index) === '|') {
      cells.push(trimSpace(line.slice(cellStart, index)))
      cellStart = index + 1
    }
    index += 1
  }
  cells.push(trimSpace(line.slice(cellStart)))
  if (cells.length > 1 && cells.at(-1) === '') cells.pop()
  return cells
}

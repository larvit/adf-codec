import type { AdfNode } from '../../adf/document.ts'
import { carriesOnly } from '../../adf/document.ts'
import { spellPipeDelimiter, spellPipeRow } from '../pipe-table-syntax.ts'
import { tryPipeCell } from './inline-line.ts'
import type { ConvertErrorPath } from '../../result.ts'

export function tryPipeTable(node: AdfNode, path: ConvertErrorPath): string | undefined {
  const rows = pipeRows(node)
  if (rows === undefined) return undefined
  const lines: string[] = []
  for (const [rowIndex, row] of rows.entries()) {
    const cells: string[] = []
    for (const [cellIndex, paragraph] of row.entries()) {
      const content = paragraph.content ?? []
      const line = content.length === 0 ? '' : tryPipeCell(content, [...path, 'content', rowIndex, 'content', cellIndex, 'content', 0])
      if (line === undefined) return undefined
      cells.push(line)
    }
    lines.push(spellPipeRow(cells))
    if (rowIndex === 0) lines.push(spellPipeDelimiter(cells.length))
  }
  return lines.join('\n')
}

function pipeRows(node: AdfNode): AdfNode[][] | undefined {
  const rows = node.content ?? []
  const columns = (rows[0]?.content ?? []).length
  if (!carriesOnly(node, []) || columns === 0) return undefined
  const grid: AdfNode[][] = []
  for (const [index, row] of rows.entries()) {
    const cells = row.content ?? []
    if (row.type !== 'tableRow' || !carriesOnly(row, []) || cells.length !== columns) return undefined
    const wanted = index === 0 ? 'tableHeader' : 'tableCell'
    const paragraphs: AdfNode[] = []
    for (const cell of cells) {
      const paragraph = plainParagraph(cell)
      if (paragraph === undefined || cell.type !== wanted || !carriesOnly(cell, [])) return undefined
      paragraphs.push(paragraph)
    }
    grid.push(paragraphs)
  }
  return grid
}

function plainParagraph(cell: AdfNode): AdfNode | undefined {
  const content = cell.content ?? []
  const paragraph = content[0]
  if (paragraph === undefined || content.length !== 1 || paragraph.type !== 'paragraph' || !carriesOnly(paragraph, [])) return undefined
  return paragraph
}

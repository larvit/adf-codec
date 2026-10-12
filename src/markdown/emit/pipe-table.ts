import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath } from '../../result.ts'
import type { WrittenFlavour } from '../portable/conventions.ts'
import { holdsOnlyAttributes, nodeContent } from '../../adf/document.ts'
import { spellPipeDelimiter, spellPipeRow } from '../pipe-table-syntax.ts'
import { tryPipeCell } from './inline-line.ts'

export function tryPipeTable(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): string | undefined {
  const rows = pipeRows(node)
  if (rows === undefined) return undefined
  const lines: string[] = []
  for (const [rowIndex, row] of rows.entries()) {
    const cells: string[] = []
    for (const [cellIndex, paragraph] of row.entries()) {
      const content = nodeContent(paragraph)
      const line = content.length === 0 ? '' : tryPipeCell(content, [...path, 'content', rowIndex, 'content', cellIndex, 'content', 0], flavour)
      if (line === undefined) return undefined
      cells.push(line)
    }
    lines.push(spellPipeRow(cells))
    if (rowIndex === 0) lines.push(spellPipeDelimiter(cells.length))
  }
  return lines.join('\n')
}

function pipeRows(node: AdfNode): AdfNode[][] | undefined {
  const rows = nodeContent(node)
  const columns = rows[0] === undefined ? 0 : nodeContent(rows[0]).length
  if (!holdsOnlyAttributes(node, []) || columns === 0) return undefined
  const grid: AdfNode[][] = []
  for (const [index, row] of rows.entries()) {
    const cells = nodeContent(row)
    if (row.type !== 'tableRow' || !holdsOnlyAttributes(row, []) || cells.length !== columns) return undefined
    const wanted = index === 0 ? 'tableHeader' : 'tableCell'
    const paragraphs: AdfNode[] = []
    for (const cell of cells) {
      const paragraph = plainParagraph(cell)
      if (paragraph === undefined || cell.type !== wanted || !holdsOnlyAttributes(cell, [])) return undefined
      paragraphs.push(paragraph)
    }
    grid.push(paragraphs)
  }
  return grid
}

function plainParagraph(cell: AdfNode): AdfNode | undefined {
  const content = nodeContent(cell)
  const paragraph = content[0]
  if (paragraph === undefined || content.length !== 1 || paragraph.type !== 'paragraph' || !holdsOnlyAttributes(paragraph, [])) return undefined
  return paragraph
}

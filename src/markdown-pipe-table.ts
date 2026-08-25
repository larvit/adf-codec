import type { AdfNode } from './adf-document.ts'
import { emitInlineLine } from './markdown-inline.ts'
import { success, type ConvertErrorPath, type Result } from './result.ts'

export function emitPipeTable(node: AdfNode, path: ConvertErrorPath): Result<string> | undefined {
  const rows = pipeRows(node)
  if (rows === undefined) return undefined
  const lines: string[] = []
  for (const [rowIndex, row] of rows.entries()) {
    const cells: string[] = []
    for (const [cellIndex, paragraph] of row.entries()) {
      const content = paragraph.content ?? []
      const line = content.length === 0 ? success('') : emitInlineLine(content, 'table-cell', [...path, 'content', rowIndex, 'content', cellIndex, 'content', 0])
      if (!line.ok) return line
      cells.push(line.value)
    }
    lines.push(`| ${cells.join(' | ')} |`)
    if (rowIndex === 0) lines.push(`| ${cells.map(() => '---').join(' | ')} |`)
  }
  return success(lines.join('\n'))
}

function pipeRows(node: AdfNode): AdfNode[][] | undefined {
  const rows = node.content ?? []
  const columns = (rows[0]?.content ?? []).length
  if (!isPlain(node) || columns === 0) return undefined
  const grid: AdfNode[][] = []
  for (const [index, row] of rows.entries()) {
    const cells = row.content ?? []
    if (row.type !== 'tableRow' || !isPlain(row) || cells.length !== columns) return undefined
    const wanted = index === 0 ? 'tableHeader' : 'tableCell'
    const paragraphs: AdfNode[] = []
    for (const cell of cells) {
      const paragraph = plainParagraph(cell)
      if (paragraph === undefined || cell.type !== wanted || !isPlain(cell)) return undefined
      paragraphs.push(paragraph)
    }
    grid.push(paragraphs)
  }
  return grid
}

function isPlain(node: AdfNode): boolean {
  return Object.keys(node.attrs ?? {}).length === 0 && (node.marks ?? []).length === 0 && node.text === undefined
}

function plainParagraph(cell: AdfNode): AdfNode | undefined {
  const content = cell.content ?? []
  const paragraph = content[0]
  if (paragraph === undefined || content.length !== 1 || paragraph.type !== 'paragraph' || !isPlain(paragraph)) return undefined
  const pipedCode = (paragraph.content ?? []).some((child) => (child.marks ?? []).some((mark) => mark.type === 'code') && (child.text ?? '').includes('|'))
  return pipedCode ? undefined : paragraph
}

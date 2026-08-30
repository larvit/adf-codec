import type { AdfNode } from '../../adf/document.ts'
import { backslashEscape, decodeTextEscapes, inlineHtmlConstruct } from '../commonmark-grammar.ts'
import { backtickRun, closingBacktickRun } from '../backtick-runs.ts'
import { failure, success, type ConvertErrorPath, type Result } from '../../result.ts'

type Run = { nodes: AdfNode[]; text: string; undecodedFrom: number }

const hardBreakSpaces = / {2,}$/
const trailingSpace = /[ \t]+$/

export function parseInlineContent(source: string, path: ConvertErrorPath): Result<AdfNode[]> {
  const run: Run = { nodes: [], text: '', undecodedFrom: 0 }
  let index = 0
  while (index < source.length) {
    const character = source.charAt(index)
    if (character === '\\' && source.charAt(index + 1) === '\n') {
      // CommonMark strips the spaces the two-space break is spelled with, and keeps those before a backslash.
      takeRun(run, source, index, index + 2, false)
      pushNode(run, { type: 'hardBreak' })
      index += 2
      continue
    }
    if (character === '\n') {
      const hard = hardBreakSpaces.test(source.slice(run.undecodedFrom, index))
      takeRun(run, source, index, index + 1, true)
      if (hard) pushNode(run, { type: 'hardBreak' })
      else run.text += ' '
      index += 1
      continue
    }
    if (character === '`') {
      const span = readCodeSpan(source, index)
      if (span === undefined) {
        index += backtickRun(source, index)
        continue
      }
      takeRun(run, source, index, span.end, false)
      pushNode(run, { marks: [{ type: 'code' }], text: span.text, type: 'text' })
      index = span.end
      continue
    }
    if (character === '<') {
      const construct = inlineHtmlConstruct(source, index)
      if (construct !== undefined) return failure('unmappable-html', `no ADF node carries ${construct}`, path)
    }
    index += backslashEscape(source, index) === undefined ? 1 : 2
  }
  takeRun(run, source, source.length, source.length, true)
  pushText(run)
  return success(run.nodes)
}

function takeRun(run: Run, source: string, end: number, resume: number, strip: boolean): void {
  const raw = source.slice(run.undecodedFrom, end)
  run.text += decodeTextEscapes(strip ? raw.replace(trailingSpace, '') : raw)
  run.undecodedFrom = resume
}

function pushText(run: Run): void {
  if (run.text !== '') run.nodes.push({ text: run.text, type: 'text' })
  run.text = ''
}

function pushNode(run: Run, node: AdfNode): void {
  pushText(run)
  run.nodes.push(node)
}

function readCodeSpan(source: string, index: number): { end: number; text: string } | undefined {
  const opener = backtickRun(source, index)
  const closer = closingBacktickRun(source, index + opener, opener)
  if (closer === undefined) return undefined
  return { end: closer + opener, text: codeSpanText(source.slice(index + opener, closer)) }
}

function codeSpanText(content: string): string {
  const text = content.replaceAll('\n', ' ')
  const padded = text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)
  return padded ? text.slice(1, -1) : text
}

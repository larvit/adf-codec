export type OpenHtmlBlock = { closer: RegExp | undefined; name: string }

type HtmlBlockCondition = { closer: RegExp | undefined; interrupts: boolean; name: string | undefined; start: RegExp }

// CommonMark 0.31.2, HTML blocks: the tag names start condition 6 lists.
const blockTagNames =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul'
const attributeSource = '(?:[ \\t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \\t]*=[ \\t]*(?:[^ \\t"\'=<>`]+|\'[^\']*\'|"[^"]*"))?)'
const completeTag = new RegExp(`^(?:<[A-Za-z][A-Za-z0-9-]*${attributeSource}*[ \\t]*/?>|</[A-Za-z][A-Za-z0-9-]*[ \\t]*>)[ \\t]*$`)
const tagName = /^<\/?([A-Za-z][A-Za-z0-9-]*).*$/

const conditions: HtmlBlockCondition[] = [
  { closer: /<\/(?:pre|script|style|textarea)>/i, interrupts: true, name: undefined, start: /^<(?:pre|script|style|textarea)(?:[ \t>]|$)/i },
  { closer: /-->/, interrupts: true, name: 'an HTML comment', start: /^<!--/ },
  { closer: /\?>/, interrupts: true, name: 'an HTML processing instruction', start: /^<\?/ },
  { closer: />/, interrupts: true, name: 'an HTML declaration', start: /^<![A-Za-z]/ },
  { closer: /\]\]>/, interrupts: true, name: 'a CDATA section', start: /^<!\[CDATA\[/ },
  { closer: undefined, interrupts: true, name: undefined, start: new RegExp(`^</?(?:${blockTagNames})(?:[ \\t>]|/>|$)`, 'i') },
  { closer: undefined, interrupts: false, name: undefined, start: completeTag },
]

export function openingHtmlBlock(line: string, interrupting: boolean): OpenHtmlBlock | undefined {
  for (const condition of conditions) {
    if ((interrupting && !condition.interrupts) || !condition.start.test(line)) continue
    return { closer: condition.closer, name: condition.name ?? line.replace(tagName, '<$1>') }
  }
  return undefined
}

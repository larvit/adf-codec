export type OpenHtmlBlock = { closer: RegExp | undefined; construct: string }

type HtmlBlockCondition = { closer: RegExp | undefined; construct: string | undefined; interrupts: boolean; start: RegExp }

// CommonMark 0.31.2, HTML blocks: the tag names start condition 6 lists.
const blockTagNames =
  'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul'
const attributeSource = '(?:[ \\t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \\t]*=[ \\t]*(?:[^ \\t"\'=<>`]+|\'[^\']*\'|"[^"]*"))?)'
const completeTag = new RegExp(`^(?:<[A-Za-z][A-Za-z0-9-]*${attributeSource}*[ \\t]*/?>|</[A-Za-z][A-Za-z0-9-]*[ \\t]*>)[ \\t]*$`)
const tagName = /^<\/?([A-Za-z][A-Za-z0-9-]*).*$/

const conditions: HtmlBlockCondition[] = [
  { closer: /<\/(?:pre|script|style|textarea)>/i, construct: undefined, interrupts: true, start: /^<(?:pre|script|style|textarea)(?:[ \t>]|$)/i },
  { closer: /-->/, construct: 'an HTML comment', interrupts: true, start: /^<!--/ },
  { closer: /\?>/, construct: 'an HTML processing instruction', interrupts: true, start: /^<\?/ },
  { closer: />/, construct: 'an HTML declaration', interrupts: true, start: /^<![A-Za-z]/ },
  { closer: /\]\]>/, construct: 'a CDATA section', interrupts: true, start: /^<!\[CDATA\[/ },
  { closer: undefined, construct: undefined, interrupts: true, start: new RegExp(`^</?(?:${blockTagNames})(?:[ \\t>]|/>|$)`, 'i') },
  { closer: undefined, construct: undefined, interrupts: false, start: completeTag },
]

export function openingHtmlBlock(line: string, interrupting: boolean): OpenHtmlBlock | undefined {
  for (const condition of conditions) {
    if ((interrupting && !condition.interrupts) || !condition.start.test(line)) continue
    return { closer: condition.closer, construct: condition.construct ?? line.replace(tagName, '<$1>') }
  }
  return undefined
}

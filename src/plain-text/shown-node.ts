import type { AdfNode } from '../adf/document.ts'
import type { LinkAttrs } from '../adf/mark-attributes.ts'
import { nodeAttrs } from '../adf/document.ts'
import { shownText, shownUrl } from '../adf/shown-text.ts'

// An image shows its alt text, else its address, else `[image]`; then the target of the link around it, then its own address, unless that is the link's target or the image showed it already.
export function imageText(alt: string | undefined, url: string | undefined, link: LinkAttrs | undefined): string {
	const shown = alt ?? url ?? '[image]'
	const target = link === undefined ? undefined : linkSuffix(link, shown)
	const own = alt !== undefined && url !== undefined && url !== link?.href ? ` (${url})` : ''
	return `${shown}${target ?? ''}${own}`
}

export function linkSuffix(link: LinkAttrs, text: string): string | undefined {
	if (link.title === undefined) return text === link.href ? undefined : ` (${link.href})`
	return ` (${link.href}, "${link.title}")`
}

// A card shows its `url`; one without shows its name, then any address its data holds; `undefined` for a node showing no text.
export function shownCard(node: AdfNode): string | undefined {
	const text = shownText(node)
	const url = shownUrl(node)
	return text === undefined || url === undefined || url === text ? text : `${text} (${url})`
}

export function taskMarker(item: AdfNode): string {
	return nodeAttrs(item)['state'] === 'DONE' ? '☑ ' : '☐ '
}

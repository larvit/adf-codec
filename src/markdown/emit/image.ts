import type { AdfNode } from '../../adf/document.ts'
import type { ConvertErrorPath, Result } from '../../result.ts'
import type { WrittenFlavour } from '../flavour.ts'
import { plainImage } from '../../adf/plain-image.ts'
import { success } from '../../result.ts'
import { toLinkDefinition } from '../mark-spellings.ts'
import { tryImageLine } from './inline-line.ts'

export function tryImage(node: AdfNode, path: ConvertErrorPath, flavour: WrittenFlavour): Result<string | undefined> {
	const image = plainImage(node)
	if (image === undefined) return success(undefined)
	const { alt, link, url } = image
	return tryImageLine(alt, url, path, flavour, link === undefined ? undefined : toLinkDefinition(link))
}

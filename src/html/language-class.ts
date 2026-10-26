import type { JsonValue } from '../json-value.ts'
import { optionalAttribute } from './escaping.ts'

const languagePrefix = 'language-'
const languageToken = /^[^\t\n\f\r ]+$/

// A code block's ` class="language-…"`, `''` where it holds no language, `undefined` where a class cannot hold the language as one token.
export function languageClass(language: JsonValue | undefined): string | undefined {
  if (language === undefined) return ''
  return typeof language === 'string' && languageToken.test(language) ? optionalAttribute('class', `${languagePrefix}${language}`) : undefined
}

// The language a `<code>`'s attributes name, none where it holds no attribute; `undefined` where `languageClass` writes no such attributes.
export function readLanguageClass(attributes: readonly (readonly [string, string])[]): { language: string | undefined } | undefined {
  const [className, ...others] = attributes
  if (className === undefined) return { language: undefined }
  const language = className[0] === 'class' && className[1].startsWith(languagePrefix) ? className[1].slice(languagePrefix.length) : undefined
  return language !== undefined && languageToken.test(language) && others.length === 0 ? { language } : undefined
}
